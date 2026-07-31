import type { SheetField } from '@trpg/sheet-engine'
import { CharacterSheetTemplateEntity } from '../models/character-sheet-template.entity'

// 投影先5セクションの正本（これ以外の section id は description へ寄せる）
const PROJECTION_TARGETS = ['status', 'parameter', 'skill', 'item', 'description'] as const
const LEGACY_PROJECTION_SECTION_IDS = new Set<string>(PROJECTION_TARGETS)

// 投影規則の正本。materializer もここから import する
const PROJECTED_FIELD_TYPE_LIST: ReadonlyArray<SheetField['type']> = ['scalar', 'computed', 'track', 'roll']
const PROJECTED_FIELD_TYPES = new Set<string>(PROJECTED_FIELD_TYPE_LIST)

export type ProjectionTarget = (typeof PROJECTION_TARGETS)[number]

interface ProjectedField {
  id: string
  target: ProjectionTarget
}

/**
 * materializer が互換 5 セクションへ投影する top-level field のキー衝突を検査する。
 * 保存中の draft は許容し、publish 境界からのみ呼び出す。
 */
export function collectProjectionKeyErrors(template: CharacterSheetTemplateEntity): string[] {
  const seenFieldIds = new Map<ProjectionTarget, Set<string>>()
  const errors: string[] = []

  for (const field of collectProjectedFields(template)) {
    const fieldIds = getOrCreateSet(seenFieldIds, field.target)
    if (fieldIds.has(field.id)) {
      errors.push(`duplicate projected field id in ${field.target}: ${field.id}`)
    } else {
      fieldIds.add(field.id)
    }
  }

  return errors
}

function collectProjectedFields(template: CharacterSheetTemplateEntity): ProjectedField[] {
  const projectedFields: ProjectedField[] = []

  for (const section of template.sections) {
    if (!isRecord(section) || typeof section.id !== 'string' || !Array.isArray(section.fields)) {
      continue
    }

    const target = projectionTarget(section.id)
    for (const field of section.fields) {
      if (
        !isRecord(field) ||
        typeof field.id !== 'string' ||
        typeof field.type !== 'string' ||
        !isProjectedFieldType(field.type)
      ) {
        continue
      }

      projectedFields.push({
        id: field.id,
        target
      })
    }
  }

  return projectedFields
}

/** 投影規則の正本。materializer もこれを使う（複製を作らずここを編集する） */
export function isProjectedFieldType(type: string): boolean {
  return PROJECTED_FIELD_TYPES.has(type)
}

/** 投影規則の正本。materializer もこれを使う（複製を作らずここを編集する） */
export function projectionTarget(sectionId: string): ProjectionTarget {
  return isProjectionTarget(sectionId) ? sectionId : 'description'
}

function isProjectionTarget(sectionId: string): sectionId is ProjectionTarget {
  return LEGACY_PROJECTION_SECTION_IDS.has(sectionId)
}

function getOrCreateSet<K>(sets: Map<K, Set<string>>, key: K): Set<string> {
  const existing = sets.get(key)
  if (existing) {
    return existing
  }

  const created = new Set<string>()
  sets.set(key, created)
  return created
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
