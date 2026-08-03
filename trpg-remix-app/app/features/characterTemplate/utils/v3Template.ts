import type {
  CharacterSheetTemplateEntity,
  LookupTable,
  SheetField,
  SheetSection,
  SheetTemplate,
  Template,
  V3EditorFieldType
} from '../types'

// `@trpg/sheet-engine` と同じ ID 規則を bundle 増加回避のため意図的に複製している。
// 理由・非目標は `../AI.types.md` の「sheet-engine との境界」、drift 検出は `./v3Template.spec.ts` を参照。
const FIELD_ID_PATTERN = /^[a-z][a-z0-9_]{0,31}$/
const SECTION_ID_PATTERN = FIELD_ID_PATTERN
const RESERVED_IDS = new Set([
  'row',
  'values',
  'parts',
  'base',
  'other',
  'floor',
  'ceil',
  'round',
  'max',
  'min',
  'lookup',
  'if',
  'sum',
  'count'
])

export function createStableUid(existingUids: Set<string>, prefix = 'uid'): string {
  const randomPart = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    }
    return Math.random().toString(36).slice(2, 14)
  }

  let uid = `${prefix}_${randomPart()}`
  while (existingUids.has(uid)) {
    uid = `${prefix}_${randomPart()}`
  }
  return uid
}

export function slugifyId(label: string, fallback: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24)

  const candidate = base && /^[a-z]/.test(base) ? base : fallback
  return RESERVED_IDS.has(candidate) ? `${candidate}_field` : candidate
}

export function makeUniqueId(candidate: string, existingIds: Set<string>): string {
  const base = slugifyId(candidate, 'field')
  let next = base
  let index = 2
  while (existingIds.has(next) || RESERVED_IDS.has(next)) {
    next = `${base}_${index}`
    index += 1
  }
  return next.slice(0, 32)
}

export function collectFieldUids(sections: SheetSection[]): Set<string> {
  const uids = new Set<string>()
  for (const section of sections) {
    for (const field of section.fields) {
      collectFieldUid(field, uids)
    }
  }
  return uids
}

function collectFieldUid(field: SheetField, uids: Set<string>): void {
  uids.add(field.uid)
  if (field.type === 'list') {
    for (const subField of field.itemFields) collectFieldUid(subField, uids)
  }
  if (field.type === 'relation') {
    for (const attr of field.attrs ?? []) uids.add(attr.uid)
  }
}

export function collectFieldIds(section: SheetSection): Set<string> {
  return new Set(section.fields.map((field) => field.id))
}

export function createField(type: V3EditorFieldType, section: SheetSection, label: string): SheetField {
  const id = makeUniqueId(label, collectFieldIds(section))
  const uid = createStableUid(collectFieldUids([section]), section.id)
  const base = { id, uid, label: label.trim() || '新規フィールド', visibleTo: 'public' as const }

  if (type === 'number') return { ...base, type: 'scalar', valueType: 'number' }
  if (type === 'select') {
    return {
      ...base,
      type: 'scalar',
      valueType: 'select',
      options: [
        { label: '選択肢1', value: 'option_1' },
        { label: '選択肢2', value: 'option_2' }
      ]
    }
  }
  if (type === 'checkbox') return { ...base, type: 'scalar', valueType: 'boolean' }
  if (type === 'computed') return { ...base, type: 'computed', resultType: 'number', formula: '0' }
  if (type === 'roll') return { ...base, type: 'roll', notation: '1d100', rerollable: true }
  return { ...base, type: 'scalar', valueType: 'text' }
}

export function createSection(existingSections: SheetSection[], label: string): SheetSection {
  const existingIds = new Set(existingSections.map((section) => section.id))
  return {
    id: makeUniqueId(label, existingIds),
    label: label.trim() || '新規セクション',
    fields: []
  }
}

export function normalizeTemplateReferences<T extends { sections: SheetSection[] }>(template: T): T {
  const pathByFlatId = new Map<string, string | null>()

  for (const section of template.sections) {
    for (const field of section.fields) {
      const path = `${section.id}.${field.id}`
      pathByFlatId.set(field.id, pathByFlatId.has(field.id) ? null : path)
    }
  }

  const normalizeFormula = (formula: string): string =>
    formula.replace(/\{([a-z][a-z0-9_]{0,31})\}/g, (full, fieldId: string) => {
      const path = pathByFlatId.get(fieldId)
      return path ? `{${path}}` : full
    })

  const sections = template.sections.map((section) => ({
    ...section,
    fields: section.fields.map((field) => normalizeFieldFormula(field, normalizeFormula))
  }))

  return { ...template, sections } as T
}

function normalizeFieldFormula(field: SheetField, normalizeFormula: (formula: string) => string): SheetField {
  if (field.type === 'computed') return { ...field, formula: normalizeFormula(field.formula) }
  if (field.type === 'list') {
    return {
      ...field,
      itemFields: field.itemFields.map((subField) => normalizeFieldFormula(subField, normalizeFormula))
    }
  }
  if (field.type === 'track') {
    return {
      ...field,
      max: typeof field.max === 'object' ? { formula: normalizeFormula(field.max.formula) } : field.max,
      resetTo:
        typeof field.resetTo === 'object' && 'formula' in field.resetTo
          ? { formula: normalizeFormula(field.resetTo.formula) }
          : field.resetTo
    }
  }
  return field
}

export function toSheetTemplate(entity: CharacterSheetTemplateEntity): SheetTemplate {
  return normalizeTemplateReferences({
    templateId: entity.templateId,
    name: entity.name,
    version: entity.version,
    schemaVersion: 3,
    gameSystemId: entity.gameSystemId,
    tags: entity.tags,
    visibility: entity.visibility,
    authorDiscordUserId: entity.authorDiscordUserId,
    forkedFrom: entity.forkedFrom,
    license: entity.license,
    sections: entity.sections,
    tables: entity.tables,
    settings: entity.settings
  })
}

export function validateLocalTemplate(template: CharacterSheetTemplateEntity): string[] {
  const errors: string[] = []

  if (!template.name.trim()) errors.push('テンプレート名が必須です')
  for (const section of template.sections) {
    if (!SECTION_ID_PATTERN.test(section.id) || RESERVED_IDS.has(section.id)) {
      errors.push(`section id must match [a-z][a-z0-9_]{0,31}: ${section.id}`)
    }

    const ids = new Set<string>()
    for (const field of section.fields) {
      if (!FIELD_ID_PATTERN.test(field.id) || RESERVED_IDS.has(field.id)) {
        errors.push(`field id must match [a-z][a-z0-9_]{0,31}: ${field.id}`)
      }
      if (ids.has(field.id)) errors.push(`同一セクション内の field id が重複しています: ${section.id}.${field.id}`)
      ids.add(field.id)
      if (!field.uid) errors.push(`field ${field.id} must have uid`)
    }
  }

  return errors
}

export function parseTags(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

export function stringifyTags(tags: string[]): string {
  return tags.join(', ')
}

export function safeParseTables(value: string): LookupTable[] {
  if (!value.trim()) return []
  const parsed = JSON.parse(value) as unknown
  if (!Array.isArray(parsed)) throw new Error('tables は JSON array で入力してください')
  return parsed as LookupTable[]
}

export function stringifyTables(tables: LookupTable[]): string {
  return JSON.stringify(tables, null, 2)
}

export function isV2LocalTemplate(value: unknown): value is Template {
  return !!(
    value &&
    typeof value === 'object' &&
    'schemaVersion' in value &&
    (value as { schemaVersion?: unknown }).schemaVersion === 2 &&
    Array.isArray((value as { fields?: unknown }).fields)
  )
}

export function migrateV2TemplateToCreateRequest(template: Template): CreateSheetTemplateDraft {
  const sectionsByTab: Record<string, SheetSection> = {
    basic: { id: 'basic', label: '基本情報', fields: [] },
    status: { id: 'status', label: 'ステータス', fields: [] },
    parameter: { id: 'parameter', label: 'パラメータ', fields: [] },
    skill: { id: 'skill', label: 'スキル', fields: [] }
  }
  const knownUids = new Set<string>()

  for (const field of template.fields) {
    const section = sectionsByTab[field.tab] ?? sectionsByTab.basic
    const uid = createStableUid(knownUids, section.id)
    knownUids.add(uid)
    const base = {
      id: makeUniqueId(field.id, collectFieldIds(section)),
      uid,
      label: field.label,
      description: field.description,
      visibleTo: 'public' as const
    }

    if (field.type === 'number') section.fields.push({ ...base, type: 'scalar', valueType: 'number' })
    else if (field.type === 'select')
      section.fields.push({ ...base, type: 'scalar', valueType: 'select', options: field.options })
    else if (field.type === 'checkbox') section.fields.push({ ...base, type: 'scalar', valueType: 'boolean' })
    else if (field.type === 'computed')
      section.fields.push({ ...base, type: 'computed', resultType: 'number', formula: field.formula })
    else if (field.type === 'roll')
      section.fields.push({
        ...base,
        type: 'roll',
        notation: field.diceFormula.replace(/^\[|\]$/g, ''),
        rerollable: true
      })
    else section.fields.push({ ...base, type: 'scalar', valueType: 'text' })
  }

  const draft: CreateSheetTemplateDraft = {
    name: `${template.name} (v3移行)`,
    version: template.version || '0.1.0',
    schemaVersion: 3,
    tags: template.tags ?? [],
    visibility: 'private',
    sections: Object.values(sectionsByTab),
    tables: [],
    settings: { rounding: 'floor' }
  }
  return normalizeTemplateReferences(draft)
}

export type CreateSheetTemplateDraft = {
  name: string
  version: string
  schemaVersion: 3
  tags: string[]
  visibility: 'private'
  sections: SheetSection[]
  tables: LookupTable[]
  settings: { rounding: 'floor' }
}
