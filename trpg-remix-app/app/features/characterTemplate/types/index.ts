// キャラクターシートテンプレート機能 — 型定義（完全刷新版）

export type TabType = 'basic' | 'status' | 'parameter' | 'skill'

export type BasicFieldType = 'text' | 'number' | 'select' | 'checkbox' | 'textarea'
export type AdvancedFieldType = 'computed' | 'roll'
export type FieldType = BasicFieldType | AdvancedFieldType

// ========================================
// Base Field
// ========================================
export interface BaseField {
  id: string // 一意識別子（英数字＋アンダースコア）
  label: string // 表示名
  description?: string // 説明文
  required?: boolean // 必須入力
  tab: TabType // 所属タブ
}

// ========================================
// Basic Fields
// ========================================
export interface TextField extends BaseField {
  type: 'text'
  defaultValue?: string
}

export interface TextareaField extends BaseField {
  type: 'textarea'
  defaultValue?: string
  rows?: number
}

export interface NumberField extends BaseField {
  type: 'number'
  min?: number
  max?: number
  defaultValue?: number
}

export interface SelectField extends BaseField {
  type: 'select'
  options: { label: string; value: string }[]
  defaultValue?: string
}

export interface CheckboxField extends BaseField {
  type: 'checkbox'
  defaultValue?: boolean
}

// ========================================
// Advanced Fields
// ========================================
export interface ComputedField extends BaseField {
  type: 'computed'
  formula: string // 例: "{pow} * 5", "max({str}, {dex})"
}

export interface RollField extends BaseField {
  type: 'roll'
  diceFormula: string // 例: "[3d6]", "[1d100]", "[2d6+6]"
}

// ========================================
// Field Union
// ========================================
export type Field = TextField | TextareaField | NumberField | SelectField | CheckboxField | ComputedField | RollField

// ========================================
// Layout
// ========================================
export interface Column {
  width: number // 1～12
  fieldIds: string[] // この列に配置するフィールドID
}

export interface Row {
  columns: Column[]
}

export interface TabLayout {
  tab: TabType
  rows: Row[]
}

// ========================================
// Template
// ========================================
export interface TemplateMeta {
  id: string
  name: string
  version: string // semver
  author?: string
  tags?: string[] // ['coc', 'dx3', 'sw2.0', ...]
  schemaVersion: number // 現在: 2
  createdAt?: string
  updatedAt?: string
}

export interface Template extends TemplateMeta {
  fields: Field[]
  layout: TabLayout[] // 各タブのレイアウト
}

// ========================================
// Mapping（character型への変換）
// ========================================
export interface FieldMapping {
  fieldId: string // テンプレートのフィールドID
  characterPath: string // character型のパス（例: "status.hp", "profile.name"）
}

export interface TemplateMapping {
  templateId: string
  fields: FieldMapping[]
}

// ========================================
// Gallery
// ========================================
export interface TemplateSummary {
  id: string
  name: string
  author?: string
  tags?: string[]
  version: string
  createdAt: string
}

// ========================================
// Validation
// ========================================
export interface ValidationError {
  field?: string
  message: string
  type: 'error' | 'warning'
}

// ========================================
// Calculation / Evaluation
// ========================================
export interface EvaluationContext {
  [fieldId: string]: number | string | boolean | undefined
}

export interface DependencyGraph {
  [fieldId: string]: Set<string> // fieldId → 依存先のfieldId集合
}

export * from './v3'
