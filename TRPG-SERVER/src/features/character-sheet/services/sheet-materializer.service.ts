import { Injectable } from '@nestjs/common'
import { evaluateTemplate, interpolateNotation } from '@trpg/sheet-engine'
import type { EvaluationResult, RuntimeValue, SheetField, SheetSection, SheetTemplate } from '@trpg/sheet-engine'
import { AttributeValue } from '../../../core/types/attribute.types'
import { toEngineTemplate } from '../../../domains/character-sheet-template/validation/sheet-engine-template.mapper'
import {
  CharacterSheetProjection,
  MaterializeCharacterSheetInput,
  MaterializedCharacterSheet,
  PaletteEntry
} from '../types/character-sheet.types'

@Injectable()
export class SheetMaterializerService {
  private static readonly PALETTE_HARD_CAP = 512

  materialize(input: MaterializeCharacterSheetInput): MaterializedCharacterSheet {
    const template = toEngineTemplate(input.template)
    const values = this.filterInputValues(template, input.sheet.values)
    const evaluated = evaluateTemplate(template, { values })

    return {
      sheet: {
        templateId: input.sheet.templateId,
        templateVersion: input.sheet.templateVersion,
        revision: input.sheet.revision,
        values
      },
      computedCache: this.buildComputedCache(template, evaluated),
      projection: this.buildProjection(template, evaluated),
      palette: this.buildPalette(template, evaluated, input.existingPalette ?? [])
    }
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
      if (value) {
        cache[field.uid] = value.value
      }
    }
    return cache
  }

  private buildProjection(template: SheetTemplate, evaluated: EvaluationResult): CharacterSheetProjection {
    const projection: CharacterSheetProjection = {
      status: {},
      parameter: {},
      skill: {},
      item: {},
      description: {}
    }

    template.sections.forEach((section, sectionIndex) => {
      const target = this.projectionTarget(section)

      section.fields.forEach((field, fieldIndex) => {
        if (field.type !== 'scalar' && field.type !== 'computed') {
          return
        }

        const value = evaluated.values[field.uid]
        if (!value) {
          return
        }

        projection[target][field.id] = this.toAttributeValue(field.label, sectionIndex * 1000 + fieldIndex, value)
      })
    })

    return projection
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
        if (field.type === 'list' || field.role?.kind !== 'rollable') {
          return
        }

        const value = evaluated.values[field.uid]
        const interpolated = interpolateNotation({
          template,
          evaluated,
          notation: field.role.notation,
          value
        })
        const key = this.allocatePaletteKey(field, existingPalette, usedKeys)

        entries.push({
          key,
          fieldRef: { uid: field.uid },
          label: this.paletteLabel(field.label, value),
          kind: 'roll',
          notation: interpolated.notation,
          group: field.role.group ?? section.label
        })
      })
    })

    if (entries.length > SheetMaterializerService.PALETTE_HARD_CAP) {
      throw new Error(`palette entries exceed hard cap: ${entries.length}/${SheetMaterializerService.PALETTE_HARD_CAP}`)
    }

    return entries
  }

  private projectionTarget(section: SheetSection): keyof CharacterSheetProjection {
    if (
      section.id === 'status' ||
      section.id === 'parameter' ||
      section.id === 'skill' ||
      section.id === 'item' ||
      section.id === 'description'
    ) {
      return section.id
    }
    return 'description'
  }

  private toAttributeValue(label: string, index: number, value: RuntimeValue): AttributeValue {
    if (value.type === 'number') {
      return {
        name: label,
        index,
        values: { base: Number(value.value) },
        isVisible: true
      }
    }

    if (value.type === 'dice') {
      return {
        name: label,
        index,
        dice: String(value.value),
        isVisible: true
      }
    }

    return {
      name: label,
      index,
      description: String(value.value),
      isVisible: true
    }
  }

  private paletteLabel(label: string, value?: RuntimeValue): string {
    if (value?.type === 'number') {
      return `${label} (${value.value})`
    }
    return label
  }

  private allocatePaletteKey(field: SheetField, existingPalette: PaletteEntry[], usedKeys: Set<string>): string {
    const existing = existingPalette.find((entry) => entry.kind === 'roll' && entry.fieldRef.uid === field.uid)
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

  private filterInputValues(template: SheetTemplate, values: Record<string, unknown>): Record<string, unknown> {
    const computedUids = new Set(
      this.collectTopLevelFields(template)
        .filter((field) => field.type === 'computed')
        .map((field) => field.uid)
    )

    return Object.fromEntries(Object.entries(values).filter(([uid]) => !computedUids.has(uid)))
  }
}
