import { CharacterSheetTemplateEntity } from '../models/character-sheet-template.entity'

const LEGACY_PROJECTION_SECTION_IDS = new Set(['status', 'parameter', 'skill', 'item', 'description'])

// materializer の実投影集合（SheetMaterializerService.isProjectionField()）と一致させる。乖離すると衝突が publish を通過して黙って消える
const PROJECTED_FIELD_TYPES = new Set(['scalar', 'computed', 'track', 'roll'])

type ProjectionTarget = 'status' | 'parameter' | 'skill' | 'item' | 'description'

interface ProjectedField {
  id: string
  canonicalPath: string
  target: ProjectionTarget
}

/**
 * materializer が互換 5 セクションへ投影する top-level field のキー衝突を検査する。
 * 保存中の draft は許容し、publish 境界からのみ呼び出す。
 */
export function collectProjectionKeyErrors(template: CharacterSheetTemplateEntity): string[] {
  const seenFieldIds = new Map<ProjectionTarget, Set<string>>()
  const seenCanonicalPaths = new Map<ProjectionTarget, Set<string>>()
  const errors: string[] = []

  for (const field of collectProjectedFields(template)) {
    const fieldIds = getOrCreateSet(seenFieldIds, field.target)
    if (fieldIds.has(field.id)) {
      errors.push(`duplicate projected field id in ${field.target}: ${field.id}`)
    } else {
      fieldIds.add(field.id)
    }

    const canonicalPaths = getOrCreateSet(seenCanonicalPaths, field.target)
    if (canonicalPaths.has(field.canonicalPath)) {
      errors.push(`duplicate projected canonical path in ${field.target}: ${field.canonicalPath}`)
    } else {
      canonicalPaths.add(field.canonicalPath)
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
        !PROJECTED_FIELD_TYPES.has(field.type)
      ) {
        continue
      }

      projectedFields.push({
        id: field.id,
        canonicalPath: `${section.id}.${field.id}`,
        target
      })
    }
  }

  return projectedFields
}

function projectionTarget(sectionId: string): ProjectionTarget {
  return LEGACY_PROJECTION_SECTION_IDS.has(sectionId) ? (sectionId as ProjectionTarget) : 'description'
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
