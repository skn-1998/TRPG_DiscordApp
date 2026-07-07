# Dice Services Documentation

## 📋 概要

TRPGサーバーのダイス処理を統合管理するサービス群のドキュメント。

---

## 🗂️ ファイル構成と役割

### index.ts

**役割**: サービス群のエクスポート管理

- 各ダイスサービスのエクスポート統合
- 外部モジュールからのアクセスポイント
- DiceOrchestratorServiceを推奨インターフェースとして提供

**提供内容**:

```typescript
export { DiceCalculationService } from './dice-calculation.service'
export { DiceOrchestratorService } from './dice-orchestrator.service'
export { DiceOrchestratorService as DiceService } from './dice-orchestrator.service' // 推奨エイリアス
```

### dice-orchestrator.service.ts

**役割**: ダイス処理の統合オーケストレーター
**責務**: 全ダイス処理の統一インターフェースと処理振り分け

**主要機能**:

- **基本ダイス記法処理**: 1d100, 2d6+3等の標準ダイス記法
- **高度なダイス計算**: キャラクターパラメータとの統合計算
- **BCDice統合**: Cthulhuシステム対応の標準処理
- **エラーハンドリング**: 統一されたエラー処理とログ出力

**アーキテクチャパターン**: Facade Pattern + Strategy Pattern

- 複雑なサブシステム（各専門サービス）への統一アクセス
- 処理内容に応じた適切なサービスへの振り分け

**主要メソッド**:

```typescript
// 基本ダイス記法
executeBasicNotation(notation: string, characterName?: string): Promise<BasicDiceResult>

// 高度計算（推奨）
calculateAndRoll(formula: string, multiplier?: number, modifier?: number, character?: Character): Promise<DiceCalculationResult>
```

> 注（2026-07-07 C-2）: `parseAndCalculate` / `parseFormula` / `evaluateFormula` / `convertToDiceNotation` /
> `getServiceStats` / レガシー互換メソッド（`legacyCalculateAndRoll` / `legacyParseAndCalculate` / `executeNotation`）は
> 呼び出し元ゼロの dead code として撤去済み。

### dice-calculation.service.ts

**役割**: ダイス計算のコアエンジン
**責務**: 数値計算とキャラクターデータ統合

**主要機能**:

- **数値計算**: 修正値・乗数の適用と計算実行
- **キャラクター統合**: AttributeValue型とCharacterモデルとの連携
- **結果フォーマット**: DiceCalculationResult生成
- **計算エラー処理**: 詳細な計算エラー分析と報告
- **Discord統合**: 親チャンネル送信とメッセージフォーマット
- **結果表示**: 絵文字とメッセージの生成

**設計パターン**: Strategy Pattern + Builder Pattern

- 計算方法の戦略選択
- 結果オブジェクトの段階的構築

**依存関係**:

- `Character` (ドメインモデル)
- `AttributeValue` (型定義)
- `dice` utils (BCDice統合)

### ~~dice-parser.service.ts~~（撤去済み: 2026-07-07 C-2）

旧・数式解析エンジン（`parseFormula` / `evaluateFormula` / `convertToDiceNotation`）。
唯一の利用者だった DiceOrchestratorService の委譲ラッパーが dead code として撤去され孤児化したため、
サービス本体・spec・module 登録・index re-export ごと撤去した。
現役の数式評価は DiceCalculationService 内部（`shared/utils/arithmetic-evaluator.util` ベース）が担う。

### ~~dice-preset.service.ts~~（撤去済み: 2026-06-10）

旧 `preset-dice*` customId 系のプリセット処理サービス。生成元・handler が customId 統合キャンペーン
（S-4.3/S-5c）で撤去され dead 化したため、サービス本体・spec・module 登録ごと撤去した。
現役のプリセットダイスは `features/characterThread` の `PresetDiceQuickRollHandler`
（customId 契約 `dice_(coc7|dnd5e|sw25)_`・`preset-dice.custom-id.ts`）を参照。

---

## 🏗️ アーキテクチャ設計

### サービス間依存関係

```
DiceOrchestratorService (統合層)
└── DiceCalculationService (計算層)
```

### 外部依存関係

```
External Dependencies
├── BCDice (utils/dice.ts) - 標準ダイス処理
├── Character Domain - キャラクターデータ
├── AttributeValue Types - 型定義
└── Discord.js - UIインタラクション
```

### 設計原則

1. **単一責任原則**: 各サービスは特定の責務のみ担当
2. **依存性逆転**: 抽象に依存し、具象に依存しない
3. **開放閉鎖原則**: 拡張に開放、修正に閉鎖
4. **インターフェース分離**: 使用しないメソッドへの依存を避ける

---

## 🚀 使用方法

### 基本的な使用パターン

```typescript
// 依存注入
constructor(
  private readonly diceOrchestrator: DiceOrchestratorService
) {}

// 基本ダイス記法
const basicResult = await this.diceOrchestrator.executeBasicNotation('1d100', 'キャラクター名')

// キャラクター統合計算
const advancedResult = await this.diceOrchestrator.calculateAndRoll('STR*5', 1, 0, character)

// エラーハンドリング
if (!basicResult.success) {
  this.logger.error(`ダイス処理エラー: ${basicResult.description}`)
}
```

### 推奨vs非推奨パターン

```typescript
// ✅ 推奨: 統合サービス使用
const result = await diceOrchestrator.executeBasicNotation('2d6+3')

// ❌ 非推奨: 個別サービス直接使用
const calcService = new DiceCalculationService()
const result = await calcService.calculateAndRoll('2d6+3')
```

> 注: レガシー互換メソッド（`executeNotation` 等）は 2026-07-07 C-2 で撤去済み。

### エラーハンドリングパターン

```typescript
try {
  const result = await diceOrchestrator.executeBasicNotation(notation)

  if (result.success) {
    // 成功処理
    const emoji = diceOrchestrator.getBasicResultEmoji(result.diceResult, rollValue)
    await interaction.reply(`${emoji} 結果: ${rollValue}`)
  } else {
    // 失敗処理
    await interaction.reply(`❌ ${result.description}`)
  }
} catch (error) {
  // 例外処理
  this.logger.error('ダイス処理例外:', error)
  await interaction.reply('❌ システムエラーが発生しました')
}
```

---

## 📊 パフォーマンス特性

### 処理時間目安

- **基本ダイス記法**: ~10ms
- **キャラクター統合計算**: ~20-50ms
- **複雑数式解析**: ~50-100ms

### リソース制限

- **ダイス個数**: 最大100個
- **ダイス面数**: 最大1000面
- **数式複雑度**: ネスト深度10まで
- **メモリ使用量**: 計算あたり~1MB

### キャッシュ戦略

- パース済み数式のキャッシュ
- キャラクターデータの一時キャッシュ

---

## 🔧 拡張ガイド

### 新しいダイス記法の追加

1. `DiceCalculationService`に計算ロジック追加
2. `DiceOrchestratorService`にインターフェース追加

### 新しいプリセットタイプの追加

プリセットダイスは `features/characterThread` 側が所有する（本ディレクトリではない）。
`preset-dice.custom-id.ts` の契約拡張＋`PresetDiceQuickRollHandler` への分岐追加で対応する。

### カスタムゲームシステム対応

1. `dice` utilsの拡張
2. システム固有の計算ルール実装
3. 結果フォーマッターの追加

---

_最終更新: 2026-07-07（C-2: DiceParserService 撤去・orchestrator/calculation の dead メソッド撤去を反映）_
