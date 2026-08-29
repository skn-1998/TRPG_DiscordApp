import { normalizeTemplateLayout, SHEET_ID_PATTERN, SHEET_RESERVED_ID_VALUES } from '@trpg/sheet-engine'
import type { Template } from '../types/v2'
import type {
  CharacterSheetTemplateEntity,
  CreateSheetTemplateRequest,
  LookupTable,
  SheetField,
  SheetSection,
  SheetTemplate,
  V3EditorFieldType
} from '../types/v3'
import { createStableUid } from '../../../lib/stable-uid'

// NOTE: 既存呼び出し元と v3Template.spec の互換維持用 re-export。実装と pin の正本は app/lib/stable-uid.(spec.)ts。
export { createStableUid }

// ID 規則の正本は engine（SHEET_ID_PATTERN / SHEET_RESERVED_ID_VALUES）に置き、保存前のローカル UX 検証も同じ規則を参照する。
// ここでは top-level の section/field id だけを検査し、list.itemFields / relation.attrs のネスト id は engine の publish 検証に委ねる。
const RESERVED_IDS: ReadonlySet<string> = new Set(SHEET_RESERVED_ID_VALUES)

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
  if (type === 'roll') return { ...base, type: 'roll', notation: '1d100' }
  // autosave の save が publish 検証を通るよう、track は検証通過形の既定値で作る。
  if (type === 'track') return { ...base, type: 'track', max: 10, style: 'gauge' }
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
  // `SHEET_ID_PATTERN.source` は `^...$` 付きでアンカー無しの表示用写しと一致しないため、literal を `${SHEET_ID_PATTERN.source}` の補間へ置換できない。
  // pattern 変更時は section/field の 2 literal と `v3Template.spec.ts` の期待文字列 pin を手動で追随させる。
  for (const section of template.sections) {
    if (!SHEET_ID_PATTERN.test(section.id) || RESERVED_IDS.has(section.id)) {
      errors.push(`section id must match [a-z][a-z0-9_]{0,31}: ${section.id}`)
    }

    const ids = new Set<string>()
    for (const field of section.fields) {
      if (!SHEET_ID_PATTERN.test(field.id) || RESERVED_IDS.has(field.id)) {
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

// Boundary: client は JSON 構文・top-level object・name の入力事故だけを検査し、構造検証は server 保存時検証を正本とする。
// 余分キーの除去は server ValidationPipe の whitelist に委ね、payload は補完・変換せず parse 結果をそのまま渡す。
export function parseTemplateImportJson(
  text: string
): { ok: true; payload: CreateSheetTemplateRequest } | { ok: false; error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    return { ok: false, error: 'JSON として読み取れません' }
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'テンプレート JSON はオブジェクトである必要があります' }
  }

  const candidate = parsed as Record<string, unknown>
  if (typeof candidate.name !== 'string' || !candidate.name.trim()) {
    return { ok: false, error: 'name（テンプレート名）は必須です' }
  }

  return { ok: true, payload: parsed as CreateSheetTemplateRequest }
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

export function createEditorSignature(template: CharacterSheetTemplateEntity, tablesText: string): string {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- サーバー管理メタデータと別 state の tables を signature から除外する。
  const { draftRevision, updatedAt, createdAt, publishedAt, status, tables, ...content } = template
  return JSON.stringify({ content, tablesText: normalizeTablesTextForSignature(tablesText) })
}

function normalizeTablesTextForSignature(tablesText: string): string {
  try {
    return `valid:${stringifyTables(safeParseTables(tablesText))}`
  } catch {
    return `invalid:${tablesText}`
  }
}

/**
 * V2 migration 入力の消費表:
 * - template.schemaVersion: ガードで検査（V2 を表す 2 だけを受理）。
 * - template.name: ガードで検査（移行後の名前を構築）。
 * - template.fields: ガードで検査（field を反復するため array を要求）。
 * - template.fields[]: ガードで検査（各 field を直接参照するため object を要求）。
 * - field.id: ガードで検査（V3 field id の生成に直接使用）。
 * - field.type: migration フォールバック（未知・欠落は text scalar）。
 * - field.tab: migration フォールバック（own key 以外（未知・欠落・継承キー）は basic）。
 * - template.version: migration フォールバック（falsy は 0.1.0、それ以外は素通しして server 検証）。
 * - template.tags: migration フォールバック（nullish は空配列、それ以外は素通しして server 検証）。
 * - field.label: 素通し（server 検証が受ける）。
 * - field.description: 素通し（server 検証が受ける）。
 * - select field.options: 素通し（server 検証が受ける）。
 * - computed field.formula: ガードで検査（式として直接消費）。
 * - roll field.diceFormula: ガードで検査（replace で直接消費）。
 * migration で新しく直接消費する値を追加したら、この表とガードも更新する。
 * この述語は migration を安全に通すための最小契約であり、V2 Template の完全検証ではない。
 */
export function isV2LocalTemplate(value: unknown): value is Template {
  if (!value || typeof value !== 'object') return false

  const candidate = value as { schemaVersion?: unknown; name?: unknown; fields?: unknown }
  return (
    candidate.schemaVersion === 2 &&
    typeof candidate.name === 'string' &&
    Array.isArray(candidate.fields) &&
    candidate.fields.every((field: unknown) => {
      if (field === null || typeof field !== 'object' || !('id' in field) || typeof field.id !== 'string') {
        return false
      }
      if ('type' in field && field.type === 'roll') {
        return 'diceFormula' in field && typeof field.diceFormula === 'string'
      }
      if ('type' in field && field.type === 'computed') {
        return 'formula' in field && typeof field.formula === 'string'
      }
      return true
    })
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
    const section = Object.hasOwn(sectionsByTab, field.tab) ? sectionsByTab[field.tab] : sectionsByTab.basic
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
        notation: field.diceFormula.replace(/^\[|\]$/g, '')
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
  return normalizeTemplateLayout(normalizeTemplateReferences(draft))
}

type CreateSheetTemplateDraft = {
  name: string
  version: string
  schemaVersion: 3
  tags: string[]
  visibility: 'private'
  sections: SheetSection[]
  tables: LookupTable[]
  settings: { rounding: 'floor' }
}
