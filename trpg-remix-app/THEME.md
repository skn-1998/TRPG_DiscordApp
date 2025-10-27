# TRPG-Remix-App テーマガイドライン

## 概要

TRPG-Remix-Appは、TRPGセッション管理に特化したWebアプリケーションです。ダークテーマを基調とし、ユーザビリティとアクセシビリティを重視したデザインシステムを採用しています。

## デザインシステムの基本原則

### 1. カラーパレット配分

- **ベースカラー**: 70% - 背景やメインコンテンツエリア
- **メインカラー**: 25% - ナビゲーションやセカンダリコンテンツ
- **アクセントカラー**: 5% - 重要なアクションやハイライト

### 2. 一貫性の原則

- 全てのコンポーネントは統一されたデザインシステムに従う
- カラー、タイポグラフィ、余白は一貫したルールに基づく
- レスポンシブデザインを前提とした設計

---

## 配色システム

### ベースカラー（70%）

#### 背景色

```typescript
// メイン背景色
theme.colors.bg[0] = '#1E1E23' // ダークグレー

// セカンダリ背景色（ヘッダー・フッター）
darken(theme.colors.bg[0], 0.4) // より暗いグレー
```

**使用場面:**

- アプリケーション全体の背景
- メインコンテンツエリア
- カードやパネルの背景

#### メインカラー（25%）

```typescript
// プライマリカラー（グレー系）
theme.colors.main[5] = '#3A3A3A' // メイングレー

// カラーパレット（0-9の10段階）
mainColor = generateColors('#3A3A3A', 5)
```

**使用場面:**

- ナビゲーションバー
- セカンダリボタン
- ボーダーライン
- テキストのセカンダリ色

#### アクセントカラー（5%）

```typescript
// プライマリアクセント（紫系）
theme.colors.accent[5] = '#673AB7' // メインアクセント

// セカンダリアクセント（青緑系）
theme.colors.sub[5] = '#78b7b7' // サブアクセント

// 補色アクセント（緑系）
theme.colors.comp[5] = '#8ab73a' // 補色アクセント

// セカンダリ補色（ピンク系）
theme.colors.subComp[5] = '#b77878' // セカンダリ補色
```

**使用場面:**

- プライマリボタン
- ロゴ・ブランド要素
- リンクテキスト
- 重要度の高い情報のハイライト

### カラーパレット生成システム

```typescript
// generateColors関数による自動生成
function generateColors(hex: string, primaryShade: number) {
  const colors = Array.from({ length: 10 }, (_, index) => {
    const diff = primaryShade - index
    const alpha = Math.abs(diff / 10) + 0.03
    const rgba = diff >= 0 ? lighten(hex, alpha) : darken(hex, alpha)
    return rgba2hex(rgba)
  })
  return colorsTuple(colors)
}
```

**特徴:**

- 各カラーは0-9の10段階の明度バリエーション
- primaryShade（通常5）を中心とした明度調整
- Mantineのlighten/darken関数を活用

---

## タイポグラフィ

### フォントファミリー

```typescript
fontFamily: `Noto Sans JP, ${DEFAULT_THEME.fontFamily}`
```

**フォントスタック:**

1. **Noto Sans JP** - 日本語表示に最適化
2. **Mantineデフォルトフォント** - フォールバック

**Google Fonts読み込み:**

```css
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@100..900&display=swap');
```

### フォントサイズ階層

#### 見出し

```typescript
// 大見出し
Title order={1} size="h2"  // 32px相当

// 中見出し
Title order={2} size="h3"  // 24px相当

// 小見出し
Title order={3} size="h4"  // 20px相当
```

#### 本文テキスト

```typescript
// 通常テキスト
Text size="md"  // 16px

// 小さいテキスト
Text size="sm"  // 14px

// 最小テキスト
Text size="xs"  // 12px
```

#### ロゴ・ブランド

```typescript
// ヘッダーロゴ
Text size="xl" fw={700}  // 20px, 太字

// フッターロゴ
Text size="lg" fw={700}  // 18px, 太字
```

### フォントウェイト

```typescript
fw={700}  // 太字（見出し、ロゴ）
fw={600}  // 中太字（セクションタイトル）
fw={400}  // 通常（本文）
```

### 行間・文字間隔

- **行間**: Mantineのデフォルト設定に従う
- **文字間隔**: 日本語読みやすさを重視
- **一行あたり文字数**: 約40-60文字（レスポンシブ対応）

### テキストカラー

```typescript
// プライマリテキスト
c={theme.colors.sub[5]}  // #78b7b7

// セカンダリテキスト
c="dimmed"  // Mantineのdimmed色

// アクセントテキスト
c={theme.colors.accent[5]}  // #673AB7

// アクティブテキスト
c={theme.colors.comp[5]}  // #8ab73a
```

---

## UIコンポーネント

### ボタン

#### プライマリボタン

```typescript
<Button
  color="accent"
  variant="gradient"
  gradient={{ from: 'accent.5', to: 'accent.7', deg: 45 }}
  size="lg"
  radius="xl"
  leftSection={<IconBrandDiscord size={20} />}
  styles={{
    root: {
      '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: '0 6px 20px 0 rgba(103, 58, 183, 0.4)'
      }
    }
  }}
>
  アクション
</Button>
```

**特徴:**

- アクセントカラーのグラデーション
- ホバー時の浮き上がり効果
- アイコンとの組み合わせ

#### セカンダリボタン

```typescript
<Button variant="subtle" color="accent">
  セカンダリアクション
</Button>
```

#### アウトライン ボタン

```typescript
<Button variant="outline" color="accent">
  アウトライン
</Button>
```

### アイコン

#### アイコンサイズ

```typescript
// 小さいアイコン
size={16}  // 16px

// 標準アイコン
size={18}  // 18px

// 大きいアイコン
size={24}  // 24px

// 特大アイコン
size={50}  // 50px
```

#### アイコンカラー

```typescript
// アクセントカラー
color={theme.colors.accent[5]}

// メインカラー
color={theme.colors.main[5]}

// サブカラー
color={theme.colors.sub[5]}
```

### フォーム要素

#### 入力フィールド

```typescript
// 標準入力フィールド
<TextInput
  label="ラベル"
  placeholder="プレースホルダー"
  color="accent"
  radius="md"
/>
```

#### セレクトボックス

```typescript
<Select
  label="選択肢"
  data={options}
  color="accent"
  radius="md"
/>
```

### カード・パネル

#### メインカード

```typescript
<Paper
  shadow="xl"
  p={50}
  radius="lg"
  style={{
    background: 'linear-gradient(135deg, var(--mantine-color-bg-5) 0%, var(--mantine-color-main-9) 100%)',
    border: '1px solid var(--mantine-color-main-6)'
  }}
>
  コンテンツ
</Paper>
```

#### ナビゲーションカード

```typescript
// アクティブ状態
backgroundColor: `rgba(${hexToRgb(complementaryColor[primaryShade])}, 0.12)`
border: `1px solid ${complementaryColor[primaryShade]}`

// ホバー状態
backgroundColor: `rgba(${hexToRgb(accentColor[primaryShade])}, 0.08)`
border: `1px solid rgba(${hexToRgb(accentColor[primaryShade])}, 0.4)`
```

---

## 余白設定ルール

### 基本単位

**8px単位システム**を採用し、一貫した余白を確保します。

```typescript
// 余白の基本単位
const spacing = {
  xs: 4, // 4px
  sm: 8, // 8px
  md: 16, // 16px
  lg: 24, // 24px
  xl: 32, // 32px
  xxl: 48 // 48px
}
```

### コンポーネント別余白

#### ヘッダー

```typescript
// ヘッダー高さ
h={60}  // 60px

// ヘッダーパディング
px="md"  // 16px左右

// アイコン間隔
gap="xs"  // 4px
```

#### メインコンテンツ

```typescript
// メインエリアパディング
padding: '16px' // 16px

// セクション間隔
gap = 'lg' // 24px
```

#### フッター

```typescript
// フッターパディング
py="xl"  // 32px上下

// リンク間隔
gap={4}  // 4px
```

#### カード・パネル

```typescript
// カードパディング
p={50}  // 50px（特別なケース）

// 標準パディング
p="md"  // 16px

// コンテナパディング
Container size="xl" py="xl"  // 最大幅 + 32px上下
```

### レスポンシブ余白

```typescript
// モバイル対応
padding: '8px' // 小画面
padding: '16px' // 中画面
padding: '24px' // 大画面
```

---

## アニメーション・トランジション

### 基本トランジション

```typescript
// ナビゲーション用
transitions: {
  smooth: 'all 0.2s ease-out',  // スムーズ
  fast: 'all 0.15s ease-out'    // 高速
}
```

### ホバー効果

```typescript
// ボタンホバー
'&:hover': {
  transform: 'translateY(-2px)',
  boxShadow: '0 6px 20px 0 rgba(103, 58, 183, 0.4)'
}

// カードホバー
'&:hover': {
  boxShadow: '0 1px 4px rgba(103, 58, 183, 0.1)'
}
```

### シャドウシステム

```typescript
shadows: {
  primary: `2px 0 8px rgba(${hexToRgb(bgColor[0])}, 0.3)`,
  active: `0 2px 8px rgba(${hexToRgb(complementaryColor[primaryShade])}, 0.15)`,
  hover: `0 1px 4px rgba(${hexToRgb(accentColor[primaryShade])}, 0.1)`,
  badge: `0 1px 3px rgba(${hexToRgb(complementaryColor[primaryShade])}, 0.2)`
}
```

---

## アクセシビリティ

### カラーコントラスト

- **WCAG AA準拠**のコントラスト比を確保
- ダークテーマでの視認性を重視
- カラーブラインド対応を考慮

### フォーカス表示

```typescript
// フォーカスリング
'&:focus': {
  outline: `2px solid ${theme.colors.accent[5]}`,
  outlineOffset: '2px'
}
```

### キーボードナビゲーション

- 全てのインタラクティブ要素はキーボード操作可能
- Tab順序の論理的配置
- ショートカットキーの提供

---

## 実装ガイドライン

### テーマ使用

```typescript
import { useMantineTheme } from '@mantine/core'

const theme = useMantineTheme()

// カラーアクセス
theme.colors.accent[5]
theme.colors.main[5]
theme.colors.sub[5]
```

### カスタムスタイル

```typescript
// インラインスタイル
style={{
  backgroundColor: theme.colors.bg[0],
  color: theme.colors.sub[5]
}}

// Mantineのsx prop
sx={(theme) => ({
  backgroundColor: theme.colors.bg[0],
  '&:hover': {
    backgroundColor: theme.colors.main[1]
  }
})}
```

### レスポンシブ対応

```typescript
// ブレークポイント使用
<Container size="xl">  // 最大幅制限
<Group gap={{ base: 'sm', md: 'lg' }}>  // レスポンシブ間隔
```

---

## 今後の拡張計画

### ダークモード完全対応

- システム設定との連動
- ユーザー設定での切り替え

### アニメーション強化

- ページ遷移アニメーション
- マイクロインタラクション

### アクセシビリティ向上

- スクリーンリーダー対応強化
- 高コントラストモード

---

このテーマガイドラインに従って、一貫性のあるユーザーインターフェースを構築してください。
