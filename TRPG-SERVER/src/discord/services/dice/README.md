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
export { DiceParserService } from './dice-parser.service' 
export { DicePresetService } from './dice-preset.service'
export { DiceOrchestratorService } from './dice-orchestrator.service'
export { DiceOrchestratorService as DiceService } from './dice-orchestrator.service' // 推奨エイリアス
```

### dice-orchestrator.service.ts (325行)
**役割**: ダイス処理の統合オーケストレーター
**責務**: 全ダイス処理の統一インターフェースと処理振り分け

**主要機能**:
- **基本ダイス記法処理**: 1d100, 2d6+3等の標準ダイス記法
- **高度なダイス計算**: キャラクターパラメータとの統合計算
- **柔軟な数式解析**: 複雑な数式の解析と実行
- **プリセット処理**: 定型ダイスボタンの処理
- **BCDice統合**: Cthulhuシステム対応の標準処理
- **エラーハンドリング**: 統一されたエラー処理とログ出力
- **レガシー互換**: 既存コードとの後方互換性

**アーキテクチャパターン**: Facade Pattern + Strategy Pattern
- 複雑なサブシステム（各専門サービス）への統一アクセス
- 処理内容に応じた適切なサービスへの振り分け

**主要メソッド**:
```typescript
// 基本ダイス記法
executeBasicNotation(notation: string, characterName?: string): Promise<BasicDiceResult>

// 高度計算（推奨）
calculateAndRoll(formula: string, multiplier?: number, modifier?: number, character?: Character): Promise<DiceCalculationResult>

// 柔軟解析（推奨）
parseAndCalculate(formula: string, multiplier?: number, modifier?: number, character?: Character): Promise<FlexibleDiceResult>

// プリセット処理
handlePresetDiceRoll(interaction: ButtonInteraction, customId: string): Promise<void>

// レガシー互換（非推奨）
executeNotation(notation: string, characterName?: string): Promise<BasicDiceResult> // 警告ログ出力
```

### dice-calculation.service.ts
**役割**: ダイス計算のコアエンジン
**責務**: 数値計算とキャラクターデータ統合

**主要機能**:
- **数値計算**: 修正値・乗数の適用と計算実行
- **キャラクター統合**: AttributeValue型とCharacterモデルとの連携
- **結果フォーマット**: DiceCalculationResult/FlexibleDiceResult生成
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

### dice-parser.service.ts
**役割**: 数式解析エンジン
**責務**: 複雑なダイス数式の解析と変換

**主要機能**:
- **数式パース**: 複雑な数式文字列の構文解析
- **変数展開**: キャラクターパラメータの変数置換
- **妥当性検証**: 数式の論理的・構文的妥当性チェック
- **安全評価**: セキュアな数式評価（インジェクション対策）
- **型変換**: 数値とダイス記法間の相互変換
- **エラー分析**: 解析エラーの詳細レポート

**設計パターン**: Interpreter Pattern + Visitor Pattern
- 数式の抽象構文木(AST)解析
- 各ノードタイプごとの処理実装

**セキュリティ機能**:
- 危険な関数呼び出しの検出
- 無限ループ防止
- メモリ使用量制限

### dice-preset.service.ts  
**役割**: プリセット管理エンジン
**責務**: 定型ダイス処理とボタンインタラクション

**主要機能**:
- **プリセットボタン生成**: Discord UIコンポーネント作成
- **CustomId管理**: プリセット識別子の生成と解析
- **設定検証**: プリセット設定の妥当性確認
- **ボタン処理**: ButtonInteractionの専用ハンドリング
- **キャラクター統合**: キャラクター固有プリセットの管理
- **セクション管理**: 能力値別・技能別のプリセット分類

**UI統合機能**:
- Discord.jsボタンコンポーネント生成
- 動的ラベル・絵文字設定
- インタラクション状態管理

**CustomIdフォーマット**:
```
preset-dice*{characterId}*{section}*{key}*{value}*{multiplier}
```

---

## 🏗️ アーキテクチャ設計

### サービス間依存関係
```
DiceOrchestratorService (統合層)
├── DiceCalculationService (計算層)
├── DiceParserService (解析層)
└── DicePresetService (UI層)
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

// ⚠️ レガシー: 互換メソッド（警告ログ出力）
const legacyResult = await diceOrchestrator.executeNotation('2d6+3')
```

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
- **プリセット処理**: ~15ms

### リソース制限
- **ダイス個数**: 最大100個
- **ダイス面数**: 最大1000面
- **数式複雑度**: ネスト深度10まで
- **メモリ使用量**: 計算あたり~1MB

### キャッシュ戦略
- パース済み数式のキャッシュ
- キャラクターデータの一時キャッシュ
- プリセット設定のセッションキャッシュ

---

## 🔧 拡張ガイド

### 新しいダイス記法の追加
1. `DiceParserService`に解析ルール追加
2. `DiceCalculationService`に計算ロジック追加
3. `DiceOrchestratorService`にインターフェース追加

### 新しいプリセットタイプの追加
1. `DicePresetService`に新CustomIdフォーマット定義
2. ボタン生成ロジックの拡張
3. 処理ハンドラーの実装

### カスタムゲームシステム対応
1. `dice` utilsの拡張
2. システム固有の計算ルール実装
3. 結果フォーマッターの追加

---

*最終更新: 2025-08-21*