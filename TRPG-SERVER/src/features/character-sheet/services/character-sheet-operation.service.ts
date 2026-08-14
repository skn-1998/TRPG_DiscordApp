import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException
} from '@nestjs/common'
import type { SheetMergeConflictWire } from '@trpg/api-contract'
import { evaluateTemplate, RESERVED_PARTS_KEY_IDS, UNSAFE_PARTS_KEYS } from '@trpg/sheet-engine'
import type { SheetField, SheetTemplate } from '@trpg/sheet-engine'
import { formatPaletteLabel } from '@trpg/sheet-projection'
import type {
  CharacterEntity,
  CharacterHubTransition,
  CharacterPaletteEntry,
  SaveSheetMaterializedPayload
} from '../../../domains/character/models/character.entity'
import {
  assertCharacterHubTransition,
  CHARACTER_HUB_ERROR_CODES,
  resolveCharacterState
} from '../../../domains/character/models/character.entity'
import { CharacterRepository } from '../../../domains/character/repositories/character.repository'
import type { CharacterSheetTemplateEntity } from '../../../domains/character-sheet-template/models/character-sheet-template.entity'
import { CharacterSheetTemplateService } from '../../../domains/character-sheet-template/character-sheet-template.service'
import { toEngineTemplate } from '../../../domains/character-sheet-template/validation/sheet-engine-template.mapper'
import { SheetMaterializerService } from './sheet-materializer.service'
import { allowsParts, isPartsValue, isResourceField, sheetValuesEqual } from './sheet-values.util'
import { buildBoundedNonFiniteErrorEnvelope, toNonFiniteNumberKind, TrackRangePolicy } from './track-range.policy'

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

interface ApplyResourceDeltaResultBase {
  character: CharacterEntity
  revision: number
}

export type ApplyResourceDeltaResult =
  | (ApplyResourceDeltaResultBase & {
      /** 既存の冪等性short-circuitを保つため、実効値は再評価しない。 */
      noOp: true
      beforeEffectiveValue: null
      afterEffectiveValue: null
    })
  | (ApplyResourceDeltaResultBase & {
      noOp: false
      beforeEffectiveValue: number
      afterEffectiveValue: number
    })

export interface HubProjectionCharacter extends CharacterEntity {
  /** 投稿先未確定のpollでは省略し、hub投影直前のsnapshotにだけ付与する非永続値。 */
  resolvedResourceValues?: Readonly<Record<string, number>>
}

export type MarkHubRefreshErrorResult = 'marked' | 'not-applicable' | 'cas-failed'

export class HubProjectionPreparationError extends Error {
  constructor(readonly projectionCause: unknown) {
    super('hub projection preparation failed')
    this.name = HubProjectionPreparationError.name
  }
}

export function resolveHubPreparationErrorCode(error: unknown): string | undefined {
  if (error instanceof HubProjectionPreparationError) {
    return CHARACTER_HUB_ERROR_CODES.PROJECTION_FAILED
  }
  if (error instanceof ConflictException || error instanceof NotFoundException || error instanceof ForbiddenException) {
    return CHARACTER_HUB_ERROR_CODES.TEMPLATE_UNRESOLVABLE
  }
  return undefined
}

type MergeConflictPayload = SheetMergeConflictWire['conflicts'][number]

@Injectable()
export class CharacterSheetOperationService {
  constructor(
    private readonly characterRepository: CharacterRepository,
    private readonly templateService: CharacterSheetTemplateService,
    private readonly materializer: SheetMaterializerService
  ) {}

  /** Discord hub 境界向けの materialized character 読み取り。legacy は明示的に対象外とする。 */
  async getHubCharacter(characterId: string): Promise<HubProjectionCharacter | null> {
    const character = await this.characterRepository.findById(characterId)
    if (character === null || resolveCharacterState(character) !== 'materialized') return null
    // none は publication CAS 後に解決し、決定的失敗を publishing->error として記録できるようにする。
    if (character.hub?.status === 'none' || (!character.discordThreadId && !character.hub?.threadId)) {
      return character
    }

    return this.resolveHubProjectionCharacter(character)
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
  ): Promise<HubProjectionCharacter | null> {
    assertCharacterHubTransition(from, to)
    const updated = this.characterRepository.setHubState(characterId, from, to)
    if (to.status !== 'publishing') return updated
    return updated.then(async (character) => {
      if (character === null) return null
      return this.resolveHubProjectionCharacter(character)
    })
  }

  /**
   * hub 読み取り中に失敗した worker が、characterId だけで active hub を error へ遷移させる。
   * その時点の最新 active 世代だけを対象とし、失敗直前に読もうとした世代を狙い撃ちはしない。
   */
  async markHubRefreshError(characterId: string, errorCode: string): Promise<MarkHubRefreshErrorResult> {
    const character = await this.getPendingActiveHub(characterId)
    if (character === null) return 'not-applicable'
    const updated = await this.setHubState(
      characterId,
      { status: 'active', messageId: character.hub!.messageId },
      { status: 'error', errorCode }
    )
    return updated === null ? 'cas-failed' : 'marked'
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
        this.assertWritablePath(template, change.path)
        const currentValue = this.readPathValue(values, change.path)

        if (sheetValuesEqual(change.newValue, change.baseValue)) {
          continue
        }
        if (sheetValuesEqual(currentValue, change.baseValue)) {
          this.writePathValue(values, change.path, change.newValue)
          appliedChanges += 1
          continue
        }
        if (sheetValuesEqual(currentValue, change.newValue)) {
          continue
        }
        conflicts.push({
          path: { ...change.path },
          // current/base は「その path に値なし」を undefined で表すが、JSON 化で undefined の own キーごと落ちる。
          // 競合 wire (sheetMergeConflictSchema) は 3 値とも nonoptional なので、キーが欠けると front の
          // safeParse ごと失敗し、構造化競合パネルが汎用エラーへ落ちる。current: null は front が undefined へ
          // 復号する。base: null は wire 必須キーを保持して schema parse を通すための sentinel とする。
          // yours は保存要求の必須値なので正規化対象にしない。
          current: currentValue ?? null,
          base: change.baseValue ?? null,
          yours: change.newValue
        })
      }

      if (conflicts.length > 0) {
        throw this.mergeConflict(input.characterId, sheet.revision, conflicts)
      }
      if (appliedChanges === 0) {
        return {
          character: current,
          revision: sheet.revision,
          noOp: true,
          appliedChanges: 0
        }
      }

      const engineTemplate = toEngineTemplate(template)
      const trackRangePolicy = new TrackRangePolicy(engineTemplate)
      trackRangePolicy.assertFiniteTrackValues(sheet.values, values)
      this.evaluateTemplateOrThrow(engineTemplate, values)
      const materialized = this.materializeOrThrow(template, current, values)
      const savePayload = this.toSavePayload(materialized, sheet.revision + 1, current.appliedInteractionIds ?? [])
      const saved = await this.characterRepository.saveSheetMaterialized(
        current.characterId,
        savePayload,
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
          beforeEffectiveValue: null,
          afterEffectiveValue: null
        }
      }

      // min/max advisory 化後の delta 0 は値を変えず revision と冪等枠だけを消費するが、適用済み interaction の replay は先行する noOp 短絡が受けるため、このガードは未処理の delta 0 だけを拒否する。
      // 新規 revision の宣言は sheet-engine publish の deltas nonzero 検査が閉じており、ここは publish 以前に保存済みの旧 palette を防御する。
      if (input.delta === 0) {
        throw new UnprocessableEntityException('delta must not be zero')
      }
      const paletteEntry = this.findResourcePaletteEntry(current.palette ?? [], input.paletteKey, input.delta)
      const engineTemplate = toEngineTemplate(template)
      const trackRangePolicy = new TrackRangePolicy(engineTemplate)
      const field = this.findTopLevelField(engineTemplate, paletteEntry.fieldRef.uid)
      this.assertResourceField(field)

      trackRangePolicy.assertFiniteTrackValues(sheet.values, sheet.values)
      const evaluated = this.evaluateTemplateOrThrow(engineTemplate, sheet.values)
      const currentValue = this.requireFiniteResourceValue(field, evaluated.values[field.uid])

      const beforeEffectiveValue = trackRangePolicy.resolveEffectiveValue(field, sheet.values[field.uid], currentValue)
      const values = { ...sheet.values }
      this.addToOtherPart(values, field.uid, currentValue, input.delta)
      trackRangePolicy.assertFiniteTrackValues(sheet.values, values)

      const afterEvaluation = this.evaluateTemplateOrThrow(engineTemplate, values)
      const afterValue = this.requireFiniteResourceValue(field, afterEvaluation.values[field.uid])
      const afterEffectiveValue = trackRangePolicy.resolveEffectiveValue(field, values[field.uid], afterValue)
      const appliedInteractionIds = [...(current.appliedInteractionIds ?? []), input.interaction.id].slice(-20)
      const materialized = this.materializeOrThrow(template, current, values)
      const savePayload = this.toSavePayload(materialized, sheet.revision + 1, appliedInteractionIds)
      const saved = await this.characterRepository.saveSheetMaterialized(
        current.characterId,
        savePayload,
        sheet.revision
      )

      if (saved !== null) {
        return {
          character: saved,
          revision: this.requireSheet(saved).revision,
          noOp: false,
          beforeEffectiveValue,
          afterEffectiveValue
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

  private async getPendingActiveHub(characterId: string): Promise<CharacterEntity | null> {
    const character = await this.characterRepository.findById(characterId)
    if (character?.hub?.status !== 'active' || !character.hub.messageId) return null
    const pendingRevision = character.hub.pendingRevision ?? 0
    const appliedRevision = character.hub.appliedRevision ?? 0
    if (pendingRevision <= appliedRevision) return null
    return character
  }

  private async resolvePinnedTemplate(character: CharacterEntity): Promise<CharacterSheetTemplateEntity> {
    const sheet = this.requireSheet(character)
    return this.templateService.resolvePinnedRevision(sheet.templateId, sheet.templateVersion, character.discordUserId)
  }

  private requireSheet(character: CharacterEntity): NonNullable<CharacterEntity['sheet']> {
    if (character.sheet === undefined) {
      throw new ConflictException('character is not materialized')
    }
    return character.sheet
  }

  private async resolveHubProjectionCharacter(character: CharacterEntity): Promise<HubProjectionCharacter> {
    const template = toEngineTemplate(await this.resolvePinnedTemplate(character))
    return this.attachResolvedResourceValues(character, template)
  }

  private attachResolvedResourceValues(character: CharacterEntity, template: SheetTemplate): HubProjectionCharacter {
    try {
      const values = this.requireSheet(character).values
      const evaluated = this.evaluateTemplateOrThrow(template, values)
      const trackRangePolicy = new TrackRangePolicy(template)
      const resolvedResourceValues: Record<string, number> = {}
      const resourceLabelsByUid = new Map<string, string>()

      for (const section of template.sections) {
        for (const field of section.fields) {
          if (!isResourceField(field)) continue

          const evaluatedValue = this.requireFiniteResourceValue(field, evaluated.values[field.uid])
          resolvedResourceValues[field.uid] = trackRangePolicy.resolveEffectiveValue(
            field,
            values[field.uid],
            evaluatedValue
          )
          resourceLabelsByUid.set(field.uid, field.label)
        }
      }

      const projectionPalette = character.palette?.map((entry) => {
        if (entry.kind !== 'resource') return entry
        const fieldLabel = resourceLabelsByUid.get(entry.fieldRef.uid)
        const effectiveValue = resolvedResourceValues[entry.fieldRef.uid]
        if (fieldLabel === undefined || effectiveValue === undefined) return entry
        return { ...entry, label: formatPaletteLabel(fieldLabel, effectiveValue) }
      })

      return {
        ...character,
        ...(projectionPalette === undefined ? {} : { palette: projectionPalette }),
        resolvedResourceValues
      }
    } catch (error) {
      throw new HubProjectionPreparationError(error)
    }
  }

  private assertWritablePath(template: CharacterSheetTemplateEntity, path: CharacterSheetValuePath): SheetField {
    const field = this.findTopLevelField(toEngineTemplate(template), path.fieldUid)
    if (field.type !== 'track' && field.type !== 'scalar') {
      throw new UnprocessableEntityException(`field ${path.fieldUid} is not an input field (${field.type})`)
    }
    const partsKey = path.partsKey
    if (partsKey === undefined) return field
    if (!allowsParts(field)) {
      throw new UnprocessableEntityException(`field ${path.fieldUid} does not allow parts`)
    }
    if (UNSAFE_PARTS_KEYS.has(partsKey)) {
      throw new UnprocessableEntityException(`field ${path.fieldUid} parts.${partsKey} is reserved`)
    }
    if (field.type === 'scalar' && field.parts !== true && field.partsKeys !== undefined) {
      const declaredPartsKeys = new Set<string>([...RESERVED_PARTS_KEY_IDS, ...field.partsKeys.map(({ id }) => id)])
      if (!declaredPartsKeys.has(partsKey)) {
        throw new UnprocessableEntityException(`field ${path.fieldUid} parts.${partsKey} is not declared`)
      }
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
    if (!isResourceField(field)) {
      throw new UnprocessableEntityException(`field ${field.uid} is not a parts-aware number resource`)
    }
  }

  private readPathValue(values: Record<string, unknown>, path: CharacterSheetValuePath): unknown {
    if (path.partsKey === undefined) return values[path.fieldUid]
    const raw = values[path.fieldUid]
    if (path.partsKey === 'base' && typeof raw === 'number') return raw
    if (!isPartsValue(raw)) return undefined
    return Object.prototype.hasOwnProperty.call(raw.parts, path.partsKey) ? raw.parts[path.partsKey] : undefined
  }

  private writePathValue(values: Record<string, unknown>, path: CharacterSheetValuePath, newValue: unknown): void {
    if (path.partsKey === undefined) {
      values[path.fieldUid] = newValue
      return
    }

    const parts = this.seedParts(values[path.fieldUid], 0)
    parts[path.partsKey] = newValue as number
    values[path.fieldUid] = { parts }
  }

  private addToOtherPart(
    values: Record<string, unknown>,
    fieldUid: string,
    evaluatedCurrent: number,
    delta: number
  ): void {
    const parts = this.seedParts(values[fieldUid], evaluatedCurrent)
    const other = parts.other ?? 0
    if (typeof other !== 'number' || !Number.isFinite(other)) {
      throw new UnprocessableEntityException(`field ${fieldUid} parts.other must be a finite number`)
    }
    parts.other = other + delta
    values[fieldUid] = { parts }
  }

  private seedParts(raw: unknown, fallback: number): Record<string, number> {
    return isPartsValue(raw)
      ? { ...raw.parts }
      : { base: typeof raw === 'number' && Number.isFinite(raw) ? raw : fallback }
  }

  private findResourcePaletteEntry(
    palette: CharacterPaletteEntry[],
    paletteKey: string,
    delta: number
  ): Extract<CharacterPaletteEntry, { kind: 'resource' }> {
    const entry = palette.find((candidate) => candidate.key === paletteKey)
    if (entry === undefined || entry.kind !== 'resource' || !entry.deltas.includes(delta)) {
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
          visibility: sheet.visibility,
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

  private requireFiniteResourceValue(
    field: Extract<SheetField, { type: 'track' | 'scalar' }>,
    evaluatedValue: ReturnType<typeof evaluateTemplate>['values'][string] | undefined
  ): number {
    if (evaluatedValue?.type === 'number' && Number.isFinite(evaluatedValue.value)) return Number(evaluatedValue.value)
    const diagnostic = {
      kind: 'resource-eval' as const,
      fieldUid: field.uid,
      label: field.label,
      ...(typeof evaluatedValue?.value === 'number'
        ? { result: toNonFiniteNumberKind(evaluatedValue.value) }
        : { detail: '数値として評価されませんでした' })
    }
    throw new UnprocessableEntityException(buildBoundedNonFiniteErrorEnvelope([diagnostic]))
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

  private assertRetryAvailable(characterId: string, attempt: number, startedAt: number): void {
    if (attempt >= MAX_SAVE_ATTEMPTS || Date.now() - startedAt >= SAVE_RETRY_BUDGET_MS) {
      throw this.retryConflict(characterId)
    }
  }

  private mergeConflict(
    characterId: string,
    currentRevision: number,
    conflicts: MergeConflictPayload[]
  ): ConflictException {
    return new ConflictException({
      message: 'sheet changes conflict with the current revision',
      characterId,
      conflicts,
      currentRevision
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

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }
}
