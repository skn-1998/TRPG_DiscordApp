// キャラクターシートテンプレート機能 — 型定義（完全刷新版）

type TabType = 'basic' | 'status' | 'parameter' | 'skill'

export interface Template {
  id: string
  name: string
  version: string // semver
  author?: string
  tags?: string[] // ['coc', 'dx3', 'sw2.0', ...]
  schemaVersion: number // 現在: 2
  createdAt?: string
  updatedAt?: string
  fields: Array<
    {
      id: string
      label: string
      description?: string
      required?: boolean
      tab: TabType
    } & (
      | { type: 'text'; defaultValue?: string }
      | { type: 'textarea'; defaultValue?: string; rows?: number }
      | { type: 'number'; min?: number; max?: number; defaultValue?: number }
      | { type: 'select'; options: { label: string; value: string }[]; defaultValue?: string }
      | { type: 'checkbox'; defaultValue?: boolean }
      | { type: 'computed'; formula: string }
      | { type: 'roll'; diceFormula: string }
    )
  >
}

export type {
  CharacterSheetTemplateEntity,
  CharacterSheetTemplateSummary,
  LookupTable,
  SheetField,
  SheetSection,
  SheetTemplate,
  V3EditorFieldType
} from './v3'
