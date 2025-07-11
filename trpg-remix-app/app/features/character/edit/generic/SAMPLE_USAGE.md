# 汎用キャラクターシート作成機能 - 使用方法

## 基本的な使用方法

### 1. 汎用エディタの使用

```tsx
import { GenericCharacterEdit } from '~/features/character/edit/generic'

function CharacterEditPage() {
  const handleTemplateSave = (template: GridTemplate) => {
    // テンプレートを保存する処理
    console.log('テンプレート保存:', template)
  }

  const handleSheetSave = (sheet: CharacterSheet) => {
    // キャラクターシートを保存する処理
    console.log('シート保存:', sheet)
  }

  return (
    <GenericCharacterEdit
      onTemplateSave={handleTemplateSave}
      onSheetSave={handleSheetSave}
      onCancel={() => console.log('キャンセル')}
    />
  )
}
```

### 2. 既存テンプレートの編集

```tsx
import { GenericCharacterEdit } from '~/features/character/edit/generic'

function EditExistingTemplate() {
  const existingTemplate = {
    id: 'simple-rpg',
    name: 'シンプルRPG',
    gameSystem: 'Generic',
    description: '基本的なRPG用テンプレート',
    dimensions: { rows: 5, cols: 4 },
    cells: new Map([
      ['0,0', { id: 'str', name: 'STR', type: 'number', defaultValue: 10 }],
      ['0,1', { id: 'dex', name: 'DEX', type: 'number', defaultValue: 10 }],
      ['1,0', { id: 'hp', name: 'HP', type: 'formula', formula: '[STR] + [CON]' }],
    ]),
    createdAt: new Date(),
    updatedAt: new Date()
  }

  return (
    <GenericCharacterEdit
      initialTemplate={existingTemplate}
      onTemplateSave={handleTemplateSave}
      onSheetSave={handleSheetSave}
    />
  )
}
```

### 3. コンポーネントの個別使用

#### DynamicSheet (動的シート表示)

```tsx
import { DynamicSheet } from '~/features/character/edit/generic'

function CharacterSheetView() {
  const [sheet, setSheet] = useState(characterSheet)

  return (
    <DynamicSheet
      template={template}
      sheet={sheet}
      onSheetChange={setSheet}
      onSave={(savedSheet) => console.log('保存:', savedSheet)}
      readOnly={false}
    />
  )
}
```

#### GridEditor (テンプレート編集)

```tsx
import { GridEditor } from '~/features/character/edit/generic'

function TemplateEditor() {
  const [template, setTemplate] = useState(initialTemplate)

  return (
    <GridEditor
      template={template}
      onTemplateChange={setTemplate}
      onSave={() => console.log('テンプレート保存')}
    />
  )
}
```

## テンプレート作成例

### 1. 基本的なRPGテンプレート

```tsx
const basicRPGTemplate: GridTemplate = {
  id: 'basic-rpg',
  name: '基本RPG',
  gameSystem: 'Generic',
  description: '基本的なRPG用キャラクターシート',
  dimensions: { rows: 6, cols: 4 },
  cells: new Map([
    // 基本能力値
    ['0,0', { id: 'str', name: 'STR', type: 'number', defaultValue: 10 }],
    ['0,1', { id: 'dex', name: 'DEX', type: 'number', defaultValue: 10 }],
    ['0,2', { id: 'con', name: 'CON', type: 'number', defaultValue: 10 }],
    ['0,3', { id: 'int', name: 'INT', type: 'number', defaultValue: 10 }],
    
    // 計算値
    ['1,0', { id: 'hp', name: 'HP', type: 'formula', formula: '[STR] + [CON]' }],
    ['1,1', { id: 'mp', name: 'MP', type: 'formula', formula: '[INT] * 2' }],
    ['1,2', { id: 'ac', name: 'AC', type: 'formula', formula: '10 + [DEX]' }],
    
    // キャラクター情報
    ['2,0', { id: 'name', name: '名前', type: 'text', defaultValue: '' }],
    ['2,1', { id: 'class', name: 'クラス', type: 'text', defaultValue: '' }],
    ['2,2', { id: 'level', name: 'レベル', type: 'number', defaultValue: 1 }],
    
    // ダイス
    ['3,0', { id: 'damage', name: 'ダメージ', type: 'dice', formula: '1d6' }],
  ]),
  createdAt: new Date(),
  updatedAt: new Date()
}
```

### 2. クトゥルフ神話TRPG風テンプレート

```tsx
const cocStyleTemplate: GridTemplate = {
  id: 'coc-style',
  name: 'CoC風',
  gameSystem: 'CoC',
  description: 'クトゥルフ神話TRPG風キャラクターシート',
  dimensions: { rows: 8, cols: 6 },
  cells: new Map([
    // 基本能力値
    ['0,0', { id: 'str', name: 'STR', type: 'number', defaultValue: 50 }],
    ['0,1', { id: 'con', name: 'CON', type: 'number', defaultValue: 50 }],
    ['0,2', { id: 'pow', name: 'POW', type: 'number', defaultValue: 50 }],
    ['0,3', { id: 'dex', name: 'DEX', type: 'number', defaultValue: 50 }],
    ['0,4', { id: 'app', name: 'APP', type: 'number', defaultValue: 50 }],
    ['0,5', { id: 'siz', name: 'SIZ', type: 'number', defaultValue: 50 }],
    
    ['1,0', { id: 'int', name: 'INT', type: 'number', defaultValue: 50 }],
    ['1,1', { id: 'edu', name: 'EDU', type: 'number', defaultValue: 50 }],
    
    // 副次能力値
    ['2,0', { id: 'hp', name: 'HP', type: 'formula', formula: '([STR] + [SIZ]) / 10' }],
    ['2,1', { id: 'mp', name: 'MP', type: 'formula', formula: '[POW] / 5' }],
    ['2,2', { id: 'san', name: 'SAN', type: 'formula', formula: '[POW]' }],
    
    // スキル例
    ['3,0', { id: 'dodge', name: '回避', type: 'formula', formula: '[DEX] / 2' }],
    ['3,1', { id: 'listen', name: '聞き耳', type: 'number', defaultValue: 25 }],
    ['3,2', { id: 'spot', name: '目星', type: 'number', defaultValue: 25 }],
  ]),
  createdAt: new Date(),
  updatedAt: new Date()
}
```

## 計算式の例

### 基本的な計算式

```typescript
// 単純な参照
'[STR]'                    // STRの値をそのまま参照

// 四則演算
'[STR] + [CON]'           // STRとCONの合計
'[STR] * 5'               // STRの5倍
'([STR] + [CON]) / 2'     // 平均値

// 複雑な計算
'[STR] + [CON] + [DEX]'   // 複数能力値の合計
'10 + [DEX]'              // 固定値との計算
'([STR] + [SIZ]) / 10'    // 括弧を使った計算
```

### ダイス記法の例

```typescript
// 基本的なダイス
'1d6'                     // 1d6
'2d10'                    // 2d10
'1d20+5'                  // 1d20+5
'3d6+2'                   // 3d6+2
```

## バリデーション例

```typescript
const cellWithValidation: CellTemplate = {
  id: 'hp',
  name: 'HP',
  type: 'number',
  defaultValue: 10,
  validation: {
    min: 0,
    max: 100,
    required: true
  }
}
```

## スタイル設定例

```typescript
const styledCell: CellTemplate = {
  id: 'title',
  name: 'タイトル',
  type: 'text',
  style: {
    backgroundColor: '#f0f0f0',
    textColor: '#333333',
    fontSize: 16
  }
}
```

## ルーティングの設定例

```tsx
// routes/character+/edit.generic.tsx
import { GenericCharacterEdit } from '~/features/character/edit/generic'

export default function GenericCharacterEditPage() {
  return <GenericCharacterEdit />
}
```

## API統合例

```tsx
function CharacterEditWithAPI() {
  const handleTemplateSave = async (template: GridTemplate) => {
    try {
      await saveTemplate(template)
      notifications.show({
        title: '保存完了',
        message: 'テンプレートが保存されました',
        color: 'green'
      })
    } catch (error) {
      notifications.show({
        title: 'エラー',
        message: '保存に失敗しました',
        color: 'red'
      })
    }
  }

  const handleSheetSave = async (sheet: CharacterSheet) => {
    try {
      await saveCharacterSheet(sheet)
      notifications.show({
        title: '保存完了',
        message: 'キャラクターシートが保存されました',
        color: 'green'
      })
    } catch (error) {
      notifications.show({
        title: 'エラー',
        message: '保存に失敗しました',
        color: 'red'
      })
    }
  }

  return (
    <GenericCharacterEdit
      onTemplateSave={handleTemplateSave}
      onSheetSave={handleSheetSave}
    />
  )
}
```

## 今後の拡張

- より複雑な計算式のサポート
- 条件分岐機能
- 画像の挿入
- PDFエクスポート機能
- テンプレートの共有機能