import { Injectable, UnprocessableEntityException } from '@nestjs/common'
import { buildValueInputSchema, evaluateTemplate, interpolateNotation, isNotationFragment } from '@trpg/sheet-engine'
import type { EvaluationResult, ResolvedFieldRef, RuntimeValue, SheetField, SheetTemplate } from '@trpg/sheet-engine'
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
  // api-contract の palette 上限と同値に保つ。パッケージ境界を増やさないため定数は共有しない。
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
        visibility: input.sheet.visibility,
        values
      },
      computedCache: this.buildComputedCache(template, evaluated),
      projection,
      palette: this.buildPalette(template, evaluated, values, input.existingPalette ?? [])
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
        const index = sectionIndex * 1000 + fieldIndex
        if (field.type === 'list') {
          this.projectRollableRows(projection[target], template, field, index, evaluated, rawValues[field.uid])
          // lastWriters は evaluated.values の top-level computed 最終書き手だけを検査する。
          // 行は衝突しない名前空間で evaluated.rows から投影するため、この Map へ混在させない。
          return
        }

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

        projection[target][field.id] = this.toAttributeValue(field, index, value, rawValues[field.uid])
        lastWriters[target].set(field.id, field)
      })
    })

    return { projection, lastWriters }
  }

  private projectRollableRows(
    targetProjection: CharacterSheetProjection[keyof CharacterSheetProjection],
    template: SheetTemplate,
    field: Extract<SheetField, { type: 'list' }>,
    index: number,
    evaluated: EvaluationResult,
    rawValue: unknown
  ): void {
    const rowRole = field.rowRole
    if (rowRole?.kind !== 'rollable' || !Array.isArray(rawValue)) {
      return
    }

    const labelSubField = field.itemFields.find((itemField) => itemField.id === rowRole.labelSubFieldId)
    if (!labelSubField) {
      return
    }

    const evaluatedRows = evaluated.rows[field.uid] ?? []
    rawValue.forEach((rawRow, rowIndex) => {
      const row = evaluatedRows[rowIndex]
      if (!row) {
        return
      }

      let valueRef: ResolvedFieldRef | undefined
      try {
        valueRef = interpolateNotation({
          template,
          evaluated,
          notation: rowRole.notation,
          row,
          parentListUid: field.uid
        }).refs.find((ref): ref is ResolvedFieldRef => ref.kind === 'field' && ref.path.startsWith('row.'))
      } catch {
        // notation の詳細な issue envelope は既存の buildPalette が所有するため、投影側で置き換えない。
        // materialize は buildProjection → buildPalette の順に進むため、不正 notation は後段で必ず 422 化される。
        return
      }

      const valueSubField = field.itemFields.find((itemField) => itemField.uid === valueRef?.uid)
      const value = valueRef ? row[valueRef.uid] : undefined
      const labelValue = row[labelSubField.uid]
      if (!valueSubField || !value || !labelValue) {
        return
      }

      // Invariant: 保存境界が rawRow と rowId を検査済みで、evaluator は同じ行順を維持する。
      const storedRow = rawRow as Record<string, unknown> & { rowId: string }
      // field.id と rowId はどちらも `:` を許さないため、この名前空間は宣言 field のキーと衝突しない。
      const projectionKey = `${field.id}:${storedRow.rowId}`
      // index の並び順消費者はなく、行順はキーの挿入順が保つため、全行で親 list の slot を共有する。
      targetProjection[projectionKey] = this.toAttributeValue(
        valueSubField,
        index,
        value,
        storedRow[valueSubField.uid],
        String(labelValue.value)
      )
    })
  }

  private buildPalette(
    template: SheetTemplate,
    evaluated: EvaluationResult,
    rawValues: Record<string, unknown>,
    existingPalette: PaletteEntry[]
  ): PaletteEntry[] {
    const entries: PaletteEntry[] = []
    const usedKeys = new Set<string>()
    const nonRowPaletteEntryCount = this.collectTopLevelFields(template).filter(
      (field) => field.type !== 'list' && (field.role?.kind === 'rollable' || isResourceField(field))
    ).length
    const rowRoleLists = this.collectTopLevelFields(template)
      .filter((field) => field.type === 'list' && field.rowRole?.kind === 'rollable')
      .map((field) => {
        const rows = rawValues[field.uid]
        return { field, rowCount: Array.isArray(rows) ? rows.length : 0 }
      })
    const rowRoleRowCount = rowRoleLists.reduce((total, list) => total + list.rowCount, 0)
    const effectiveRowLimit = SheetMaterializerService.PALETTE_HARD_CAP - nonRowPaletteEntryCount

    // 一般 hard cap まで構築してから落とすと、利用者はどの行を減らせば復帰できるか分からない。
    // 宣言由来 entry の消費分を先に除き、原因 list を指す 422 として行の実効上限を知らせる。
    if (rowRoleRowCount > 0 && rowRoleRowCount > effectiveRowLimit) {
      let rowsThroughList = 0
      const exceededList =
        rowRoleLists.find((list) => {
          rowsThroughList += list.rowCount
          return rowsThroughList > effectiveRowLimit
        }) ?? rowRoleLists[0]
      this.throwUnprocessable(
        [
          {
            fieldUid: exceededList.field.uid,
            path: [exceededList.field.uid],
            message:
              `list ${exceededList.field.uid} has ${exceededList.rowCount} rows; ` +
              `${nonRowPaletteEntryCount} non-row palette declarations leave effective row limit ` +
              `${effectiveRowLimit}, but rowRole rows total ${rowRoleRowCount}`
          }
        ],
        'Character sheet palette exceeds effective row limit'
      )
    }

    template.sections.forEach((section) => {
      section.fields.forEach((field) => {
        if (field.type === 'list') {
          const rowRole = field.rowRole
          if (rowRole?.kind !== 'rollable') {
            return
          }

          const rawRows = rawValues[field.uid]
          // engine の rows は検査済み raw 行の順序を保つが rowId は値空間に含めないため、同じ index で対応付ける。
          const evaluatedRows = evaluated.rows[field.uid] ?? []
          const labelSubField = field.itemFields.find((itemField) => itemField.id === rowRole.labelSubFieldId)
          if (!Array.isArray(rawRows) || !labelSubField) {
            return
          }

          // palette の issue path 第2要素は rowId を指す。保存境界の list issue path 第2要素は行 index。
          rawRows.forEach((rawRow, rowIndex) => {
            // Invariant: 保存境界（validateStoredValues）が各行の rowId: string を検査済み。
            const rowId = (rawRow as { rowId: string }).rowId
            const row = evaluatedRows[rowIndex]
            const key = this.allocatePaletteKey(field, existingPalette, usedKeys, rowId)
            let interpolated: ReturnType<typeof interpolateNotation>
            try {
              interpolated = interpolateNotation({
                template,
                evaluated,
                notation: rowRole.notation,
                row,
                parentListUid: field.uid
              })
            } catch (error) {
              const cause = error instanceof Error ? error.message : 'notation interpolation failed'
              this.throwUnprocessable(
                [
                  {
                    fieldUid: field.uid,
                    path: [field.uid, rowId, key],
                    message: `list ${field.uid} rowId ${rowId} palette key ${key}: ${cause}`
                  }
                ],
                'Character sheet row palette notation is invalid'
              )
            }

            // Invariant: interpolateNotation は値解決を ref 登録より先に行い、listSubField は throw する。
            const referencedValues = (interpolated.refs as ResolvedFieldRef[]).map((ref) =>
              ref.path.startsWith('row.') ? row[ref.uid] : evaluated.values[ref.uid]
            )
            const invalidReferencedValue = referencedValues.find((value) => {
              if (value === undefined) {
                return false
              }
              const fragment = String(value.value)
              return !isNotationFragment(fragment) || fragment.includes('.') || fragment.includes('-')
            })
            // C-08 は新設した行 palette の補間値だけを保存前に検査し、指数・小数・負数を拒否する。
            // section 直下の既存補間は互換性のため未検査のままとし、遡及は followup とする。
            if (invalidReferencedValue) {
              this.throwUnprocessable(
                [
                  {
                    fieldUid: field.uid,
                    path: [field.uid, rowId, key],
                    message:
                      `list ${field.uid} rowId ${rowId} palette key ${key} generated invalid notation: ` +
                      interpolated.notation
                  }
                ],
                'Character sheet row palette notation is invalid'
              )
            }

            const labelValue = row[labelSubField.uid]
            // Invariant: publish が labelSubFieldId を text scalar に固定し、evaluator が全 itemField 値を埋める。
            const label = String(labelValue.value)
            entries.push({
              key,
              fieldRef: { uid: field.uid, rowId },
              label,
              kind: 'roll',
              notation: interpolated.notation,
              group: rowRole.group ?? section.label
            })
          })
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

  private toAttributeValue(
    field: SheetField,
    index: number,
    value: RuntimeValue,
    rawValue: unknown,
    name = field.label
  ): AttributeValue {
    const common = {
      name,
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

  private allocatePaletteKey(
    field: SheetField,
    existingPalette: PaletteEntry[],
    usedKeys: Set<string>,
    rowId?: string
  ): string {
    const existing = existingPalette.find((entry) => entry.fieldRef.uid === field.uid && entry.fieldRef.rowId === rowId)
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
