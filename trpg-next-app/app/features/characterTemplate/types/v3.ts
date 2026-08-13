import type { LookupTable, RoundingMode, SheetField, SheetSection, SheetTemplate } from '@trpg/sheet-engine'

type SheetTemplateStatus = 'draft' | 'published' | 'deprecated'

type SheetTemplateVisibility = 'private' | 'unlisted' | 'public'

type V3ScalarEditorType = 'number' | 'text' | 'select' | 'checkbox'

export type V3EditorFieldType = V3ScalarEditorType | 'computed' | 'roll' | 'track'

export interface CharacterSheetTemplateEntity extends SheetTemplate {
  status: SheetTemplateStatus
  draftRevision: number
  publishedAt?: string | Date
  createdAt?: string | Date
  updatedAt?: string | Date
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

export interface CreateSheetTemplateRequest {
  name: string
  version?: string
  schemaVersion?: 3
  gameSystemId?: string
  tags?: string[]
  visibility?: SheetTemplateVisibility
  forkedFrom?: { templateId: string; version: string }
  license?: string
  sections?: SheetSection[]
  tables?: LookupTable[]
  settings?: { rounding: RoundingMode }
}

export interface UpdateSheetTemplateRequest extends Partial<CreateSheetTemplateRequest> {
  draftRevision: number
}

export interface TemplateValidationMessage {
  code?: string
  fieldId?: string
  path?: string
  message: string
}

export interface PreviewValues {
  [fieldUid: string]: string | number | boolean | undefined
}

export type { LookupTable, SheetField, SheetSection, SheetTemplate }
