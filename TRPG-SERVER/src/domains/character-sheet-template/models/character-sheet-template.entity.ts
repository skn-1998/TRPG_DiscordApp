export type SheetTemplateStatus = 'draft' | 'published' | 'deprecated'

export type SheetTemplateVisibility = 'private' | 'unlisted' | 'public'

export interface SheetTemplateForkedFrom {
  templateId: string
  version: string
}

export interface SheetTemplateSettings {
  rounding: 'floor' | 'ceil' | 'round'
  [key: string]: unknown
}

export type SheetTemplateSection = Record<string, unknown>

export type SheetTemplateTable = Record<string, unknown>

/**
 * シートテンプレート公開エンティティ（plain object）
 *
 * @Schema クラスは persistence 専用とし、service / controller / repository の公開境界では
 * Mongoose Document API を持たないこの interface を扱う。
 */
export interface CharacterSheetTemplateEntity {
  templateId: string
  status: SheetTemplateStatus
  version: string
  schemaVersion: 3
  name: string
  gameSystemId?: string
  tags: string[]
  visibility: SheetTemplateVisibility
  authorDiscordUserId: string
  forkedFrom?: SheetTemplateForkedFrom
  license?: string
  sections: SheetTemplateSection[]
  tables: SheetTemplateTable[]
  settings: SheetTemplateSettings
  draftRevision: number
  publishedAt?: Date
  createdAt?: Date
  updatedAt?: Date
}

export type CharacterSheetTemplateSummary = Pick<
  CharacterSheetTemplateEntity,
  | 'templateId'
  | 'status'
  | 'version'
  | 'schemaVersion'
  | 'name'
  | 'gameSystemId'
  | 'tags'
  | 'visibility'
  | 'authorDiscordUserId'
  | 'forkedFrom'
  | 'license'
  | 'draftRevision'
  | 'publishedAt'
  | 'createdAt'
  | 'updatedAt'
>
