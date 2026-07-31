import { Injectable, UnprocessableEntityException } from '@nestjs/common'
import { buildValueInputSchema, evaluateTemplate, interpolateNotation } from '@trpg/sheet-engine'
import type { EvaluationResult, RuntimeValue, SheetField, SheetTemplate } from '@trpg/sheet-engine'
import { formatPaletteLabel } from '@trpg/sheet-projection'
import { AttributeValue, isAttributeSection } from '../../../core/types/attribute.types'
import type { CharacterSheetTemplateEntity } from '../../../domains/character-sheet-template/models/character-sheet-template.entity'
import {
  isProjectedFieldType,
  projectionTarget
} from '../../../domains/character-sheet-template/validation/projection-key-validation'
import { toEngineTemplate } from '../../../domains/character-sheet-template/validation/sheet-engine-template.mapper'
import {
  CharacterSheetProjection,
  MaterializeCharacterSheetInput,
  MaterializedCharacterSheet,
  PaletteEntry
} from '../types/character-sheet.types'
import { isPartsValue, isResourceField } from './sheet-values.util'
import {
  buildBoundedNonFiniteErrorEnvelope,
  type NonFiniteFieldDiagnostic,
  toNonFiniteNumberKind
} from './track-range.policy'

interface MaterializationIssue {
  fieldUid?: string
  path: string[]
  message: string
}

type ProjectionLastWriters = {
  [Target in keyof CharacterSheetProjection]: Map<string, SheetField>
}

interface ProjectionBuildResult {
  projection: CharacterSheetProjection
  lastWriters: ProjectionLastWriters
}

@Injectable()
export class SheetMaterializerService {
  private static readonly PALETTE_HARD_CAP = 512

  validateInputValues(
    templateEntity: CharacterSheetTemplateEntity,
    values: Record<string, unknown>
  ): Record<string, unknown> {
    const template = toEngineTemplate(templateEntity)
    const result = buildValueInputSchema(template).safeParse(values)

    if (!result.success) {
      this.throwUnprocessable(
        result.error.issues.map((issue) => ({
          fieldUid: typeof issue.path[0] === 'string' ? issue.path[0] : undefined,
          path: issue.path.map(String),
          message: issue.message
        }))
      )
    }

    return result.data
  }

  materialize(input: MaterializeCharacterSheetInput): MaterializedCharacterSheet {
    const template = toEngineTemplate(input.template)
    const values = this.validateStoredValues(template, input.sheet.values)
    const evaluated = this.evaluate(template, values)
    const { projection, lastWriters } = this.buildProjection(template, evaluated, values)
    this.assertFiniteComputedValues(lastWriters, evaluated)
    this.assertCanonicalProjection(projection)

    return {
      sheet: {
        templateId: input.sheet.templateId,
        templateVersion: input.sheet.templateVersion,
        revision: input.sheet.revision,
        values
      },
      computedCache: this.buildComputedCache(template, evaluated),
      projection,
      palette: this.buildPalette(template, evaluated, input.existingPalette ?? [])
    }
  }

  private evaluate(template: SheetTemplate, values: Record<string, unknown>): EvaluationResult {
    try {
      return evaluateTemplate(template, { values })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Template evaluation failed'
      const fieldUid = this.extractFieldUid(message)
      this.throwUnprocessable([
        {
          fieldUid,
          path: fieldUid ? [fieldUid] : [],
          message
        }
      ])
    }
  }

  private assertFiniteComputedValues(lastWriters: ProjectionLastWriters, evaluated: EvaluationResult): void {
    const nonFiniteValues: NonFiniteFieldDiagnostic[] = []

    // projection に実際に残る最後の書き手だけを検査し、従来の上書き後の保存可否を維持する。
    for (const targetWriters of Object.values(lastWriters)) {
      for (const field of targetWriters.values()) {
        if (field.type !== 'computed') {
          continue
        }

        const value = evaluated.values[field.uid]
        if (value?.type !== 'number' || typeof value.value !== 'number' || Number.isFinite(value.value)) {
          continue
        }

        nonFiniteValues.push({
          kind: 'computed',
          fieldUid: field.uid,
          label: field.label,
          formula: field.formula,
          result: toNonFiniteNumberKind(value.value)
        })
      }
    }

    if (nonFiniteValues.length === 0) {
      return
    }

    throw new UnprocessableEntityException(buildBoundedNonFiniteErrorEnvelope(nonFiniteValues))
  }

  private buildComputedCache(
    template: SheetTemplate,
    evaluated: EvaluationResult
  ): Record<string, number | string | boolean> {
    const cache: Record<string, number | string | boolean> = {}
    for (const field of this.collectTopLevelFields(template)) {
      if (field.type !== 'computed') {
        continue
      }
      const value = evaluated.values[field.uid]
      if (value !== undefined) {
        cache[field.uid] = value.value
      }
    }
    return cache
  }

  private buildProjection(
    template: SheetTemplate,
    evaluated: EvaluationResult,
    rawValues: Record<string, unknown>
  ): ProjectionBuildResult {
    const projection: CharacterSheetProjection = {
      status: {},
      parameter: {},
      skill: {},
      item: {},
      description: {}
    }
    const lastWriters: ProjectionLastWriters = {
      status: new Map(),
      parameter: new Map(),
      skill: new Map(),
      item: new Map(),
      description: new Map()
    }

    template.sections.forEach((section, sectionIndex) => {
      const target = projectionTarget(section.id)

      section.fields.forEach((field, fieldIndex) => {
        if (!isProjectedFieldType(field.type)) {
          return
        }

        if (field.type === 'roll' && !Object.prototype.hasOwnProperty.call(rawValues, field.uid)) {
          return
        }

        const value = evaluated.values[field.uid]
        if (!value) {
          return
        }

        projection[target][field.id] = this.toAttributeValue(
          field,
          sectionIndex * 1000 + fieldIndex,
          value,
          rawValues[field.uid]
        )
        lastWriters[target].set(field.id, field)
      })
    })

    return { projection, lastWriters }
  }

  private buildPalette(
    template: SheetTemplate,
    evaluated: EvaluationResult,
    existingPalette: PaletteEntry[]
  ): PaletteEntry[] {
    const entries: PaletteEntry[] = []
    const usedKeys = new Set<string>()

    template.sections.forEach((section) => {
      section.fields.forEach((field) => {
        if (field.type === 'list') {
          return
        }

        const value = evaluated.values[field.uid]
        if (field.role?.kind === 'rollable') {
          const interpolated = interpolateNotation({
            template,
            evaluated,
            notation: field.role.notation,
            value
          })

          entries.push({
            key: this.allocatePaletteKey(field, existingPalette, usedKeys),
            fieldRef: { uid: field.uid },
            label: this.paletteLabel(field.label, value),
            kind: 'roll',
            notation: interpolated.notation,
            group: field.role.group ?? section.label
          })
          return
        }

        if (isResourceField(field)) {
          entries.push({
            key: this.allocatePaletteKey(field, existingPalette, usedKeys),
            fieldRef: { uid: field.uid },
            label: this.paletteLabel(field.label, value),
            kind: 'resource',
            deltas: [...field.role.deltas],
            group: section.label
          })
        }
      })
    })

    if (entries.length > SheetMaterializerService.PALETTE_HARD_CAP) {
      throw new Error(`palette entries exceed hard cap: ${entries.length}/${SheetMaterializerService.PALETTE_HARD_CAP}`)
    }

    return entries
  }

  private toAttributeValue(field: SheetField, index: number, value: RuntimeValue, rawValue: unknown): AttributeValue {
    const common = {
      name: field.label,
      index,
      isVisible: true
    }

    if (value.type === 'number') {
      return {
        ...common,
        values: isPartsValue(rawValue) ? { ...rawValue.parts } : { base: Number(value.value) }
      }
    }

    if (value.type === 'dice') {
      return {
        ...common,
        dice: String(value.value)
      }
    }

    return {
      ...common,
      description: String(value.value)
    }
  }

  private paletteLabel(label: string, value?: RuntimeValue): string {
    if (value?.type === 'number') {
      return formatPaletteLabel(label, value.value)
    }
    return label
  }

  private allocatePaletteKey(field: SheetField, existingPalette: PaletteEntry[], usedKeys: Set<string>): string {
    const existing = existingPalette.find((entry) => entry.fieldRef.uid === field.uid)
    if (existing && !usedKeys.has(existing.key)) {
      usedKeys.add(existing.key)
      return existing.key
    }

    const base = this.toPaletteKeyBase(field.id || field.uid)
    let candidate = base
    let suffix = 2
    while (usedKeys.has(candidate) || existingPalette.some((entry) => entry.key === candidate)) {
      candidate = `${base}${suffix}`
      suffix += 1
    }
    usedKeys.add(candidate)
    return candidate
  }

  private toPaletteKeyBase(value: string): string {
    const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, '')
    return normalized.length > 0 ? normalized.slice(0, 32) : 'f'
  }

  private collectTopLevelFields(template: SheetTemplate): SheetField[] {
    return template.sections.flatMap((section) => section.fields)
  }

  private validateStoredValues(template: SheetTemplate, values: Record<string, unknown>): Record<string, unknown> {
    const fieldsByUid = new Map(this.collectTopLevelFields(template).map((field) => [field.uid, field]))
    const schemaValues: Record<string, unknown> = {}
    const rollValues: Record<string, unknown> = {}
    const issues: MaterializationIssue[] = []
    const nonFiniteRollDiagnostics: NonFiniteFieldDiagnostic[] = []

    for (const [uid, value] of Object.entries(values)) {
      const field = fieldsByUid.get(uid)
      if (!field) {
        issues.push({
          fieldUid: uid,
          path: [uid],
          message: `field ${uid} is not defined by the template`
        })
        continue
      }
      if (field.type === 'computed') {
        issues.push({
          fieldUid: uid,
          path: [uid],
          message: `field ${uid} is not an input field (computed)`
        })
        continue
      }
      if (field.type === 'roll') {
        if ((typeof value === 'number' && Number.isFinite(value)) || typeof value === 'string') {
          rollValues[uid] = value
        } else {
          if (typeof value === 'number') {
            const diagnostic: NonFiniteFieldDiagnostic = {
              kind: 'roll',
              fieldUid: uid,
              label: field.label,
              result: toNonFiniteNumberKind(value)
            }
            nonFiniteRollDiagnostics.push(diagnostic)
            continue
          }
          issues.push({
            fieldUid: uid,
            path: [uid],
            message: `field ${uid} must be a finite number or string roll result`
          })
        }
        continue
      }
      schemaValues[uid] = value
    }

    const result = buildValueInputSchema(template).safeParse(schemaValues)
    if (!result.success) {
      issues.push(
        ...result.error.issues.map((issue) => ({
          fieldUid: typeof issue.path[0] === 'string' ? issue.path[0] : undefined,
          path: issue.path.map(String),
          message: issue.message
        }))
      )
    }

    if (nonFiniteRollDiagnostics.length > 0) {
      throw new UnprocessableEntityException(buildBoundedNonFiniteErrorEnvelope(nonFiniteRollDiagnostics, issues))
    }
    if (issues.length > 0) {
      this.throwUnprocessable(issues)
    }

    return { ...result.data, ...rollValues }
  }

  private assertCanonicalProjection(projection: CharacterSheetProjection): void {
    for (const [sectionName, section] of Object.entries(projection)) {
      if (!isAttributeSection(section)) {
        this.throwUnprocessable([
          {
            path: ['projection', sectionName],
            message: `projection.${sectionName} is not a canonical AttributeSection`
          }
        ])
      }
    }
  }

  private extractFieldUid(message: string): string | undefined {
    return /field ([^\s]+)/.exec(message)?.[1]
  }

  private throwUnprocessable(issues: MaterializationIssue[], message = 'Character sheet values are invalid'): never {
    throw new UnprocessableEntityException({
      statusCode: 422,
      error: 'Unprocessable Entity',
      message,
      issues
    })
  }
}
