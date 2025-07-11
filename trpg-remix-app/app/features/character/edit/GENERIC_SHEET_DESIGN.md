# 汎用キャラクターシート作成機能 設計書

## 概要

TRPGシステムに依存しない汎用的なキャラクターシート作成機能を実装します。
Excelのような表形式でキャラクターシートのレイアウトを作成し、動的にキャラクターシートを生成できるようにします。

## 機能要件

### 1. シートテンプレートエディタ
- **グリッド形式のレイアウト**: 行×列の表形式でセルを配置
- **セル設定機能**:
  - セル名（例：INT, STR, HP等）
  - 入力タイプ（数値、文字列、計算式等）
  - デフォルト値
  - 計算式（例：[STR]×5）
- **レスポンシブ対応**: デスクトップ・タブレット・スマートフォン対応

### 2. 動的シート生成機能
- **テンプレートベースの生成**: 作成されたテンプレートから実際のキャラクターシートを生成
- **参照式の計算処理**: セル間の参照を解決して自動計算
- **リアルタイム更新**: 参照元の値が変更されると参照先も自動更新

### 3. テンプレート管理機能
- **保存・読み込み**: テンプレートの永続化
- **編集・削除**: 既存テンプレートの修正・削除
- **共有機能**: テンプレートの他ユーザーとの共有

## 技術仕様

### ディレクトリ構成

```
edit/
├── generic/                    # 汎用シート作成機能
│   ├── components/            # コンポーネント
│   │   ├── template-editor/   # テンプレート編集
│   │   │   ├── GridEditor.tsx # グリッド編集画面
│   │   │   ├── CellEditor.tsx # セル設定エディタ
│   │   │   └── index.tsx      # エクスポート
│   │   ├── sheet-renderer/    # シート表示
│   │   │   ├── DynamicSheet.tsx # 動的シート生成
│   │   │   ├── CellRenderer.tsx # セル表示
│   │   │   └── index.tsx        # エクスポート
│   │   └── index.tsx           # 全エクスポート
│   ├── types/                  # 型定義
│   │   ├── template.ts         # テンプレート型
│   │   ├── sheet.ts           # シート型
│   │   └── index.ts           # エクスポート
│   ├── utils/                  # ユーティリティ
│   │   ├── formula-parser.ts   # 数式解析
│   │   ├── cell-calculator.ts  # セル計算
│   │   └── index.ts           # エクスポート
│   └── index.tsx              # メインエディタ
└── coc/                       # 既存のCOC機能（維持）
```

### 主要型定義

```typescript
// テンプレート関連
export interface CellTemplate {
  id: string
  name: string                    // セル名（例：INT, STR）
  type: 'number' | 'text' | 'formula' | 'dice' // 入力タイプ
  defaultValue?: string | number  // デフォルト値
  formula?: string               // 計算式（例：[STR]×5）
  validation?: {
    min?: number
    max?: number
    required?: boolean
  }
  style?: {
    backgroundColor?: string
    textColor?: string
    fontSize?: number
  }
}

export interface GridTemplate {
  id: string
  name: string                   // テンプレート名
  gameSystem: string            // 対応ゲームシステム
  description?: string          // 説明
  dimensions: {
    rows: number
    cols: number
  }
  cells: Map<string, CellTemplate> // セル座標 -> セル定義
  createdAt: Date
  updatedAt: Date
}

// シート関連
export interface CellValue {
  id: string
  value: string | number
  calculatedValue?: number      // 計算結果
  error?: string               // エラーメッセージ
}

export interface CharacterSheet {
  id: string
  templateId: string
  characterId: string
  values: Map<string, CellValue>
  lastCalculated: Date
}
```

### 主要コンポーネント

#### 1. GridEditor (テンプレート編集)

```typescript
interface GridEditorProps {
  template: GridTemplate
  onTemplateChange: (template: GridTemplate) => void
  onSave: () => void
}

export function GridEditor({ template, onTemplateChange, onSave }: GridEditorProps) {
  // グリッド表示
  // セル選択・編集
  // ドラッグ&ドロップ
  // プレビュー機能
}
```

#### 2. CellEditor (セル設定)

```typescript
interface CellEditorProps {
  cell: CellTemplate
  onCellChange: (cell: CellTemplate) => void
  availableReferences: string[] // 参照可能なセル名一覧
}

export function CellEditor({ cell, onCellChange, availableReferences }: CellEditorProps) {
  // セル名入力
  // 入力タイプ選択
  // 計算式入力（参照補完付き）
  // バリデーション設定
  // スタイル設定
}
```

#### 3. DynamicSheet (動的シート)

```typescript
interface DynamicSheetProps {
  template: GridTemplate
  values: Map<string, CellValue>
  onValueChange: (cellId: string, value: string | number) => void
  readOnly?: boolean
}

export function DynamicSheet({ template, values, onValueChange, readOnly }: DynamicSheetProps) {
  // テンプレートからシート生成
  // 値の入力・表示
  // 参照式の計算
  // エラー表示
}
```

### 数式解析機能

```typescript
// 数式解析器
export class FormulaParser {
  // [STR]×5 -> { references: ['STR'], expression: 'STR * 5' }
  parseFormula(formula: string): ParseResult
  
  // 参照を実際の値に置換して計算
  calculateFormula(formula: string, values: Map<string, number>): number
  
  // 循環参照チェック
  checkCircularReference(cells: Map<string, CellTemplate>): boolean
}

// ダイス記法対応
export class DiceParser {
  // 1d6, 2d10+5 等の解析
  parseDiceNotation(notation: string): DiceResult
  
  // ダイスロール実行
  rollDice(notation: string): number
}
```

## 実装フェーズ

### Phase 1: 基本機能実装
1. 基本型定義の作成
2. GridEditorの実装（基本的なグリッド表示・セル編集）
3. CellEditorの実装（セル設定画面）
4. DynamicSheetの実装（基本的なシート表示）

### Phase 2: 計算機能実装
1. FormulaParserの実装（参照式解析）
2. CellCalculatorの実装（自動計算）
3. 循環参照チェック機能
4. エラーハンドリング

### Phase 3: 拡張機能実装
1. ダイス記法対応
2. テンプレート保存・読み込み
3. スタイル設定機能
4. インポート・エクスポート機能

### Phase 4: UI/UX向上
1. ドラッグ&ドロップ機能
2. プレビュー機能
3. レスポンシブデザイン最適化
4. アクセシビリティ対応

## 既存機能との統合

### COC機能の維持
- 既存の`edit/coc/`は完全に維持
- 新機能は`edit/generic/`として独立実装
- 共通部分は`edit/shared/`として抽出

### ルーティング
- `/character/edit/generic` - 汎用シート作成
- `/character/edit/coc` - COC専用（既存）
- `/character/template` - テンプレート管理

### データ構造
- 既存のCharacter型は維持
- 新規にGenericCharacterSheet型を追加
- 互換性を保つためのマッピング機能

## 使用例

### テンプレート作成
```typescript
const template: GridTemplate = {
  id: 'simple-rpg',
  name: 'シンプルRPG',
  gameSystem: 'Generic',
  dimensions: { rows: 10, cols: 6 },
  cells: new Map([
    ['0,0', { id: 'str', name: 'STR', type: 'number', defaultValue: 10 }],
    ['0,1', { id: 'str-bonus', name: 'STRボーナス', type: 'formula', formula: '([STR] - 10) / 2' }],
    ['1,0', { id: 'hp', name: 'HP', type: 'formula', formula: '[STR] + [CON]' }],
  ])
}
```

### シート使用
```typescript
<DynamicSheet
  template={template}
  values={characterValues}
  onValueChange={(cellId, value) => {
    updateCharacterValue(cellId, value)
  }}
/>
```

## 今後の拡張予定

1. **ビジュアルエディタ**: ドラッグ&ドロップでのセル配置
2. **条件分岐**: IF文などの条件式対応
3. **データベース連携**: 参照データの外部連携
4. **プラグイン機能**: カスタムセルタイプの追加
5. **コラボレーション**: 複数人での同時編集