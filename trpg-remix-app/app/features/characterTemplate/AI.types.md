# キャラクターシートテンプレート機能 — 型/DSL 設計（完全刷新版）

## タブ構造

テンプレートは以下の4つのタブで構成される：

- `basic`: 基本情報（名前、年齢、性別、学歴、見た目など）
- `status`: ステータス（HP、SAN、幸運など）
- `parameter`: パラメータ（STR、DEX、POWなど能力値）
- `skill`: スキル（技能リスト）

## フィールド種別

### 基本フィールド

```ts
export type BasicFieldType = 'text' | 'number' | 'select' | 'checkbox' | 'textarea'

export interface BaseField {
  id: string // 一意識別子（英数字＋アンダースコア、例: pow, str, san_value）
  label: string // 表示名
  description?: string // 説明文
  required?: boolean // 必須入力
  tab: 'basic' | 'status' | 'parameter' | 'skill' // 所属タブ
}

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
```

### 計算フィールド（computed）

他フィールドを参照した計算式。依存グラフで循環参照を検出。

```ts
export interface ComputedField extends BaseField {
  type: 'computed'
  formula: string // 例: "{pow} * 5", "max({str}, {dex})", "floor({int} / 2)"
}
```

### ロールフィールド（roll）

ダイス式。ロールボタンで実行、結果は手動編集可能。

```ts
export interface RollField extends BaseField {
  type: 'roll'
  diceFormula: string // 例: "[3d6]", "[1d100]", "[2d6+6]"
}
```

### 統合型

```ts
export type Field = TextField | TextareaField | NumberField | SelectField | CheckboxField | ComputedField | RollField
```

## 式エンジン仕様

### プレースホルダ

- `{fieldId}`: 他フィールドの値を参照
- 例: `{pow}`, `{str}`, `{san_value}`

### 演算子

- 算術: `+`, `-`, `*`, `/`
- 括弧: `(`, `)`

### 関数（MVP）

- `max(a, b, ...)`: 最大値
- `min(a, b, ...)`: 最小値
- `floor(x)`: 切り捨て
- `ceil(x)`: 切り上げ
- `round(x)`: 四捨五入

### 式の例

```ts
'{pow} * 5' // POW × 5
'max({str}, {dex})' // STRとDEXの最大値
'floor({int} / 2)' // INT ÷ 2（切り捨て）
'{hp_max} - {hp_damage}' // HP最大値 - ダメージ
'({str} + {dex}) / 2' // (STR + DEX) ÷ 2
```

### 依存グラフ

- フィールド間の依存関係を有向グラフで管理
- 循環参照を検出してエラー
- 値変更時に依存先を自動再計算

## ダイスロール仕様

### 記法

- `[NdM]`: N個のM面ダイスを振る
- `[NdM+K]`: N個のM面ダイス + 修正値K
- `[NdM-K]`: N個のM面ダイス - 修正値K

### 例

```ts
'[3d6]' // 3d6（3～18）
'[1d100]' // 1d100（1～100）
'[2d6+6]' // 2d6+6（8～18）
'[1d20-2]' // 1d20-2（-1～18）
```

### ロール動作

- 初期値: 空欄
- ロールボタン: ダイス式を含むフィールドに自動表示
- 実行: ボタン押下でダイスを振り、結果を値として設定
- 編集: ロール後も手動編集可能
- 再ロール: ボタン再押下で上書き
- タブ一括ロール: タブ内の全ロールフィールドを一括実行

### 重要な分離ポリシー

計算式とロールは分離する：

```ts
// ❌ 非推奨（式内にロール）
computed: "{pow} * 5 + [1d6]"

// ✅ 推奨（ロールを別フィールドに）
roll: "rollBonus" → "[1d6]"
computed: "san" → "{pow} * 5 + {rollBonus}"
```

## レイアウト構造

### グリッドシステム

各タブは12カラムグリッドで配置。

```ts
export interface Column {
  width: number // 1～12
  fieldIds: string[] // この列に配置するフィールドID
}

export interface Row {
  columns: Column[]
}

export interface TabLayout {
  tab: 'basic' | 'status' | 'parameter' | 'skill'
  rows: Row[]
}
```

### レイアウト例

```ts
{
  tab: 'parameter',
  rows: [
    {
      columns: [
        { width: 6, fieldIds: ['str'] },
        { width: 6, fieldIds: ['dex'] }
      ]
    },
    {
      columns: [
        { width: 12, fieldIds: ['pow', 'san'] }
      ]
    }
  ]
}
```

## テンプレート定義

```ts
export interface TemplateMeta {
  id: string
  name: string
  version: string // semver
  author?: string
  tags?: string[] // ['coc', 'dx3', 'sw2.0', ...]
  schemaVersion: number // DSLバージョン（現在: 2）
  createdAt?: string
  updatedAt?: string
}

export interface Template extends TemplateMeta {
  fields: Field[]
  layout: TabLayout[] // 各タブのレイアウト
}
```

## Mapping ルール（character型への変換）

### 単純マッピング

```ts
export interface FieldMapping {
  fieldId: string // テンプレートのフィールドID
  characterPath: string // character型のパス（例: "status.hp", "profile.name"）
}

export interface TemplateMapping {
  templateId: string
  fields: FieldMapping[]
}
```

### マッピング例

```ts
{
  templateId: 'coc_basic',
  fields: [
    { fieldId: 'name', characterPath: 'profile.name' },
    { fieldId: 'str', characterPath: 'parameters.str' },
    { fieldId: 'hp', characterPath: 'status.hp' },
    { fieldId: 'san', characterPath: 'status.san' }
  ]
}
```

### ポリシー

- 競合: 最後に保存したマップを優先
- 必須未充足: エラー
- 型変換: 自動変換（string → number等）、失敗時はエラー

## バージョニング

### schemaVersion

- 現在: `2`（式＋ダイス対応版）
- 旧: `1`（基本フィールドのみ）

### 非互換変更の扱い

- 自動マイグレーションは行わない
- 非互換テンプレートはエラー表示
- 手動更新を促す

## バリデーション

### フィールドレベル

- `id`: 必須、一意、英数字＋アンダースコア
- `label`: 必須
- `formula`: 構文チェック、未定義参照検出
- `diceFormula`: ダイス記法チェック（`[NdM]`形式）

### テンプレートレベル

- 重複ID検出
- 循環参照検出（依存グラフ）
- タブ未割当フィールド検出

## 非MVP（将来対応）

- リピータ/テーブル（繰り返しフィールド）
- 条件表示（`showIf`）
- カスタム関数
- 高度な式関数（IF、SWITCH、LOOKUP等）
- バージョン間差分
