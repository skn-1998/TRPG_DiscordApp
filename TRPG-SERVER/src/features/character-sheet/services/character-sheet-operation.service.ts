import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException
} from '@nestjs/common'
import { clampDelta, evaluateExpression, evaluateTemplate } from '@trpg/sheet-engine'
import type { SheetField, SheetTemplate } from '@trpg/sheet-engine'
import type {
  CharacterEntity,
  CharacterHubTransition,
  CharacterPaletteEntry,
  SaveSheetMaterializedPayload
} from '../../../domains/character/models/character.entity'
import { assertCharacterHubTransition, resolveCharacterState } from '../../../domains/character/models/character.entity'
import { CharacterRepository } from '../../../domains/character/repositories/character.repository'
import type { CharacterSheetTemplateEntity } from '../../../domains/character-sheet-template/models/character-sheet-template.entity'
import { CharacterSheetTemplateService } from '../../../domains/character-sheet-template/character-sheet-template.service'
import { toEngineTemplate } from '../../../domains/character-sheet-template/validation/sheet-engine-template.mapper'
import { SheetMaterializerService } from './sheet-materializer.service'

const MAX_SAVE_ATTEMPTS = 5
const SAVE_RETRY_BUDGET_MS = 2_000

export interface CharacterSheetValuePath {
  fieldUid: string
  partsKey?: string
}

export interface CharacterSheetChange {
  path: CharacterSheetValuePath
  baseValue: unknown
  newValue: unknown
}

export interface SaveSheetInput {
  characterId: string
  baseRevision: number
  changes: CharacterSheetChange[]
}

export interface ApplyResourceDeltaInput {
  channelId: string
  paletteKey: string
  delta: number
  interaction: { id: string }
}

export interface SaveSheetResult {
  character: CharacterEntity
  revision: number
  noOp: boolean
  appliedChanges: number
}

export interface ApplyResourceDeltaResult {
  character: CharacterEntity
  revision: number
  noOp: boolean
  requestedDelta: number
  effectiveDelta: number
  clamped: boolean
}

interface MergeConflictPayload {
  path: CharacterSheetValuePath
  current: unknown
  base: unknown
  yours: unknown
}

@Injectable()
export class CharacterSheetOperationService {
  constructor(
    private readonly characterRepository: CharacterRepository,
    private readonly templateService: CharacterSheetTemplateService,
    private readonly materializer: SheetMaterializerService
  ) {}

  /** Discord hub 境界向けの materialized character 読み取り。legacy は明示的に対象外とする。 */
  async getHubCharacter(characterId: string): Promise<CharacterEntity | null> {
    const character = await this.characterRepository.findById(characterId)
    return character !== null && resolveCharacterState(character) === 'materialized' ? character : null
  }

  /**
   * OP-6 sweep 用の薄い query API。
   * repository に hub worker 固有の query を持ち込まず、Phase 2 の単一プロセス運用では全件取得後に絞る。
   */
  async findHubRefreshCandidates(now = new Date()): Promise<CharacterEntity[]> {
    const characters = await this.characterRepository.findAll()
    return characters.filter((character) => {
      if (resolveCharacterState(character) !== 'materialized' || character.hub?.status !== 'active') return false
      const pending = character.hub.pendingRevision ?? 0
      const applied = character.hub.appliedRevision ?? 0
      const retryAt = character.hub.retryAt
      return pending > applied && (retryAt === undefined || retryAt.getTime() <= now.getTime())
    })
  }

  /** hub フィールドだけを更新する repository CAS の feature 境界。 */
  setHubState(
    characterId: string,
    from: CharacterHubTransition,
    to: CharacterHubTransition
  ): Promise<CharacterEntity | null> {
    assertCharacterHubTransition(from, to)
    return this.characterRepository.setHubState(characterId, from, to)
  }

  async saveSheet(input: SaveSheetInput): Promise<SaveSheetResult> {
    this.assertSaveSheetInput(input)
    const startedAt = Date.now()
    let current = await this.findMaterializedById(input.characterId)
    const template = await this.resolvePinnedTemplate(current)

    for (let attempt = 1; attempt <= MAX_SAVE_ATTEMPTS; attempt += 1) {
      const sheet = this.requireSheet(current)
      const values = { ...sheet.values }
      const conflicts: MergeConflictPayload[] = []
      let appliedChanges = 0

      for (const change of input.changes) {
        const field = this.assertWritablePath(template, change.path)
        const currentValue = this.readPathValue(values, change.path)

        if (this.valuesEqual(change.newValue, change.baseValue)) {
          continue
        }
        if (this.valuesEqual(currentValue, change.baseValue)) {
          this.writePathValue(values, change.path, change.newValue, field)
          appliedChanges += 1
          continue
        }
        if (this.valuesEqual(currentValue, change.newValue)) {
          continue
        }
        conflicts.push({
          path: { ...change.path },
          current: currentValue,
          base: change.baseValue,
          yours: change.newValue
        })
      }

      if (conflicts.length > 0) {
        throw this.mergeConflict(input.characterId, conflicts)
      }
      if (appliedChanges === 0) {
        return {
          character: current,
          revision: sheet.revision,
          noOp: true,
          appliedChanges: 0
        }
      }

      const materialized = this.materializeOrThrow(template, current, values)
      const saved = await this.characterRepository.saveSheetMaterialized(
        current.characterId,
        this.toSavePayload(materialized, sheet.revision + 1, current.appliedInteractionIds ?? []),
        sheet.revision
      )

      if (saved !== null) {
        return {
          character: saved,
          revision: this.requireSheet(saved).revision,
          noOp: false,
          appliedChanges
        }
      }

      this.assertRetryAvailable(input.characterId, attempt, startedAt)
      current = await this.findMaterializedById(input.characterId)
    }

    throw this.retryConflict(input.characterId)
  }

  async applyResourceDelta(input: ApplyResourceDeltaInput): Promise<ApplyResourceDeltaResult> {
    this.assertResourceDeltaInput(input)
    const projected = await this.characterRepository.findByChannelId(input.channelId)
    if (projected === null) {
      throw new NotFoundException('character not found')
    }

    const startedAt = Date.now()
    let current = await this.findMaterializedById(projected.characterId)
    const template = await this.resolvePinnedTemplate(current)

    for (let attempt = 1; attempt <= MAX_SAVE_ATTEMPTS; attempt += 1) {
      const sheet = this.requireSheet(current)
      if ((current.appliedInteractionIds ?? []).includes(input.interaction.id)) {
        return {
          character: current,
          revision: sheet.revision,
          noOp: true,
          requestedDelta: input.delta,
          effectiveDelta: 0,
          clamped: false
        }
      }

      const paletteEntry = this.findResourcePaletteEntry(current.palette ?? [], input.paletteKey)
      const engineTemplate = toEngineTemplate(template)
      const field = this.findTopLevelField(engineTemplate, paletteEntry.fieldRef.uid)
      this.assertResourceField(field)

      const evaluated = this.evaluateTemplateOrThrow(engineTemplate, sheet.values)
      const currentValue = evaluated.values[field.uid]
      if (currentValue?.type !== 'number' || !Number.isFinite(currentValue.value)) {
        throw new UnprocessableEntityException(`resource field ${field.uid} did not evaluate to a finite number`)
      }

      const bounds = this.resolveResourceBounds(engineTemplate, field, sheet.values)
      const clamped = clampDelta(Number(currentValue.value), input.delta, bounds.min, bounds.max)
      const values = { ...sheet.values }
      if (clamped.effectiveDelta !== 0) {
        this.addToOtherPart(values, field.uid, Number(currentValue.value), clamped.effectiveDelta)
      }

      const materialized = this.materializeOrThrow(template, current, values)
      const appliedInteractionIds = [...(current.appliedInteractionIds ?? []), input.interaction.id].slice(-20)
      const saved = await this.characterRepository.saveSheetMaterialized(
        current.characterId,
        this.toSavePayload(materialized, sheet.revision + 1, appliedInteractionIds),
        sheet.revision
      )

      if (saved !== null) {
        return {
          character: saved,
          revision: this.requireSheet(saved).revision,
          noOp: false,
          requestedDelta: input.delta,
          effectiveDelta: clamped.effectiveDelta,
          clamped: clamped.clamped
        }
      }

      this.assertRetryAvailable(current.characterId, attempt, startedAt)
      current = await this.findMaterializedById(current.characterId)
    }

    throw this.retryConflict(current.characterId)
  }

  private async findMaterializedById(characterId: string): Promise<CharacterEntity> {
    const character = await this.characterRepository.findById(characterId)
    if (character === null) {
      throw new NotFoundException('character not found')
    }
    if (resolveCharacterState(character) !== 'materialized') {
      throw new ConflictException('character is not materialized')
    }
    return character
  }

  private async resolvePinnedTemplate(character: CharacterEntity): Promise<CharacterSheetTemplateEntity> {
    const sheet = this.requireSheet(character)
    return this.templateService.resolvePublished(sheet.templateId, sheet.templateVersion, character.discordUserId)
  }

  private requireSheet(character: CharacterEntity): NonNullable<CharacterEntity['sheet']> {
    if (character.sheet === undefined) {
      throw new ConflictException('character is not materialized')
    }
    return character.sheet
  }

  private assertWritablePath(template: CharacterSheetTemplateEntity, path: CharacterSheetValuePath): SheetField {
    const field = this.findTopLevelField(toEngineTemplate(template), path.fieldUid)
    if (field.type !== 'track' && field.type !== 'scalar') {
      throw new UnprocessableEntityException(`field ${path.fieldUid} is not an input field (${field.type})`)
    }
    if (path.partsKey !== undefined && !this.allowsParts(field)) {
      throw new UnprocessableEntityException(`field ${path.fieldUid} does not allow parts`)
    }
    if (path.partsKey !== undefined && path.partsKey.length === 0) {
      throw new UnprocessableEntityException(`field ${path.fieldUid} has an empty parts key`)
    }
    return field
  }

  private findTopLevelField(template: SheetTemplate, uid: string): SheetField {
    for (const section of template.sections) {
      const field = section.fields.find((candidate) => candidate.uid === uid)
      if (field !== undefined) return field
    }
    throw new UnprocessableEntityException(`field ${uid} is not defined by the template`)
  }

  private assertResourceField(field: SheetField): asserts field is Extract<SheetField, { type: 'track' | 'scalar' }> {
    if (field.role?.kind !== 'resource' || !this.allowsParts(field)) {
      throw new UnprocessableEntityException(`field ${field.uid} is not a parts-aware number resource`)
    }
  }

  private allowsParts(field: SheetField): field is Extract<SheetField, { type: 'track' | 'scalar' }> {
    return field.type === 'track' || (field.type === 'scalar' && field.valueType === 'number' && field.parts === true)
  }

  private readPathValue(values: Record<string, unknown>, path: CharacterSheetValuePath): unknown {
    if (path.partsKey === undefined) return values[path.fieldUid]
    const raw = values[path.fieldUid]
    if (path.partsKey === 'base' && typeof raw === 'number') return raw
    if (!this.isPartsValue(raw)) return undefined
    return Object.prototype.hasOwnProperty.call(raw.parts, path.partsKey) ? raw.parts[path.partsKey] : undefined
  }

  private writePathValue(
    values: Record<string, unknown>,
    path: CharacterSheetValuePath,
    newValue: unknown,
    field: SheetField
  ): void {
    if (path.partsKey === undefined) {
      values[path.fieldUid] = newValue
      return
    }

    const current = values[path.fieldUid]
    const parts: Record<string, number> = this.isPartsValue(current)
      ? { ...current.parts }
      : { base: typeof current === 'number' && Number.isFinite(current) ? current : 0 }
    parts[path.partsKey] = newValue as number
    values[path.fieldUid] = { parts }

    if (!this.allowsParts(field)) {
      throw new UnprocessableEntityException(`field ${path.fieldUid} does not allow parts`)
    }
  }

  private addToOtherPart(
    values: Record<string, unknown>,
    fieldUid: string,
    evaluatedCurrent: number,
    effectiveDelta: number
  ): void {
    const raw = values[fieldUid]
    const parts: Record<string, number> = this.isPartsValue(raw)
      ? { ...raw.parts }
      : { base: typeof raw === 'number' && Number.isFinite(raw) ? raw : evaluatedCurrent }
    const other = parts.other ?? 0
    if (typeof other !== 'number' || !Number.isFinite(other)) {
      throw new UnprocessableEntityException(`field ${fieldUid} parts.other must be a finite number`)
    }
    parts.other = other + effectiveDelta
    values[fieldUid] = { parts }
  }

  private resolveResourceBounds(
    template: SheetTemplate,
    field: Extract<SheetField, { type: 'track' | 'scalar' }>,
    values: Record<string, unknown>
  ): { min: number; max: number } {
    if (field.type === 'scalar') {
      return { min: Number.NEGATIVE_INFINITY, max: Number.POSITIVE_INFINITY }
    }

    const max =
      typeof field.max === 'number'
        ? field.max
        : this.evaluateBoundExpression(template, field.max.formula, values, field.uid)
    return { min: field.min ?? 0, max }
  }

  private evaluateBoundExpression(
    template: SheetTemplate,
    formula: string,
    values: Record<string, unknown>,
    fieldUid: string
  ): number {
    try {
      const result = evaluateExpression(template, formula, { values })
      if (result.type !== 'number' || !Number.isFinite(result.value)) {
        throw new Error('formula did not produce a finite number')
      }
      return Number(result.value)
    } catch (error) {
      throw new UnprocessableEntityException({
        message: `resource max evaluation failed for ${fieldUid}`,
        fieldUid,
        detail: this.errorMessage(error)
      })
    }
  }

  private findResourcePaletteEntry(
    palette: CharacterPaletteEntry[],
    paletteKey: string
  ): Extract<CharacterPaletteEntry, { kind: 'resource' }> {
    const entry = palette.find((candidate) => candidate.key === paletteKey)
    if (entry === undefined || entry.kind !== 'resource') {
      throw new NotFoundException('resource palette entry not found')
    }
    return entry
  }

  private materializeOrThrow(
    template: CharacterSheetTemplateEntity,
    current: CharacterEntity,
    values: Record<string, unknown>
  ): ReturnType<SheetMaterializerService['materialize']> {
    const sheet = this.requireSheet(current)
    try {
      return this.materializer.materialize({
        template,
        sheet: {
          templateId: sheet.templateId,
          templateVersion: sheet.templateVersion,
          revision: sheet.revision + 1,
          values
        },
        existingPalette: current.palette ?? []
      })
    } catch (error) {
      if (error instanceof HttpException) throw error
      throw new UnprocessableEntityException({
        message: 'sheet evaluation or projection failed',
        detail: this.errorMessage(error)
      })
    }
  }

  private evaluateTemplateOrThrow(
    template: SheetTemplate,
    values: Record<string, unknown>
  ): ReturnType<typeof evaluateTemplate> {
    try {
      return evaluateTemplate(template, { values })
    } catch (error) {
      throw new UnprocessableEntityException({
        message: 'sheet evaluation failed',
        detail: this.errorMessage(error)
      })
    }
  }

  private toSavePayload(
    materialized: ReturnType<SheetMaterializerService['materialize']>,
    pendingRevision: number,
    appliedInteractionIds: string[]
  ): SaveSheetMaterializedPayload {
    return {
      values: materialized.sheet.values,
      computedCache: materialized.computedCache,
      palette: materialized.palette,
      status: materialized.projection.status,
      parameter: materialized.projection.parameter,
      skill: materialized.projection.skill,
      item: materialized.projection.item,
      description: materialized.projection.description,
      pendingRevision,
      appliedInteractionIds
    }
  }

  private valuesEqual(left: unknown, right: unknown): boolean {
    if (Object.is(left, right)) return true
    if (typeof left !== typeof right || left === null || right === null) return false
    if (Array.isArray(left) || Array.isArray(right)) {
      if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false
      return left.every((value, index) => this.valuesEqual(value, right[index]))
    }
    if (typeof left !== 'object' || typeof right !== 'object') return false
    const leftRecord = left as Record<string, unknown>
    const rightRecord = right as Record<string, unknown>
    const leftKeys = Object.keys(leftRecord).sort()
    const rightKeys = Object.keys(rightRecord).sort()
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every((key, index) => key === rightKeys[index] && this.valuesEqual(leftRecord[key], rightRecord[key]))
    )
  }

  private assertRetryAvailable(characterId: string, attempt: number, startedAt: number): void {
    if (attempt >= MAX_SAVE_ATTEMPTS || Date.now() - startedAt >= SAVE_RETRY_BUDGET_MS) {
      throw this.retryConflict(characterId)
    }
  }

  private mergeConflict(characterId: string, conflicts: MergeConflictPayload[]): ConflictException {
    return new ConflictException({
      message: 'sheet changes conflict with the current revision',
      characterId,
      conflicts
    })
  }

  private retryConflict(characterId: string): ConflictException {
    return new ConflictException({
      message: 'sheet changed repeatedly; refetch the latest revision and retry',
      characterId,
      refetchRequired: true
    })
  }

  private assertSaveSheetInput(input: SaveSheetInput): void {
    if (!Number.isInteger(input.baseRevision) || input.baseRevision < 0) {
      throw new BadRequestException('baseRevision must be a non-negative integer')
    }
  }

  private assertResourceDeltaInput(input: ApplyResourceDeltaInput): void {
    if (!Number.isFinite(input.delta)) {
      throw new BadRequestException('delta must be a finite number')
    }
    if (input.interaction.id.length === 0) {
      throw new BadRequestException('interaction.id is required')
    }
  }

  private isPartsValue(value: unknown): value is { parts: Record<string, number> } {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      'parts' in value &&
      typeof (value as { parts?: unknown }).parts === 'object' &&
      (value as { parts?: unknown }).parts !== null &&
      !Array.isArray((value as { parts?: unknown }).parts)
    )
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }
}
