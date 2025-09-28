# Discord機能アーキテクチャドキュメント

## 📋 概要

TRPGサーバーのDiscord統合機能に関するアーキテクチャと実装状況を管理するドキュメント

---

## ✅ 最新完了済み変更（2025-08-21）

### 📚 **ドキュメント体系整備完了**

**概要**: Discord機能全体のドキュメント体系を整備し、各フォルダにREADME.mdを作成

**整備内容**:
```
discord/services/
├── dice/README.md           - ダイス処理サービス群ドキュメント
├── monitoring/README.md     - パフォーマンス監視サービス群ドキュメント
├── channel/README.md        - チャンネル管理サービス群ドキュメント
├── README.md                - コアサービス群ドキュメント
└── features/README.md       - 機能モジュール群概要ドキュメント
```

**各ドキュメントの内容**:
- **サービス役割と責務**: 各ファイルの具体的な役割
- **アーキテクチャ設計**: 依存関係とパターン説明
- **使用方法**: 基本から高度な使用例
- **パフォーマンス特性**: レスポンス時間と制限事項
- **設定・カスタマイズ**: 環境変数と設定オプション
- **トラブルシューティング**: 問題診断と解決方法

**改善効果**:
- ✅ 完全なドキュメント体系: 全主要フォルダにドキュメント整備
- ✅ 開発者オンボーディング: 新規開発者の理解促進
- ✅ 保守性向上: アーキテクチャ理解とトラブル解決の迅速化
- ✅ 品質向上: 設計原則と最適化指針の明文化

---

## ✅ 最新完了済み変更（2025-08-21 前半）

### 🎲 **ダイスサービス統合完了**

**概要**: `dice-notation-handler.service.ts`を`/dice`フォルダに統合し、ダイス処理を一元化

**統合結果**:
```
services/dice/
├── dice-orchestrator.service.ts     (325行) - 統合オーケストレーター
├── dice-calculation.service.ts      - 計算エンジン
├── dice-parser.service.ts           - 数式解析エンジン
└── dice-preset.service.ts           - プリセット管理
```

**各サービスの役割**:
- **DiceOrchestratorService**: 全ダイス処理の統一インターフェース
  - `executeBasicNotation()` - 基本ダイス記法（1d100, 2d6+3等）
  - `calculateAndRoll()` - キャラクターパラメータ統合
  - `parseAndCalculate()` - 複雑な数式処理
  - `handlePresetDiceRoll()` - プリセット処理
- **DiceCalculationService**: ダイス計算コアロジック
- **DiceParserService**: 複雑数式の解析と変換
- **DicePresetService**: 定型ダイス処理

**改善効果**:
- ✅ 一元化: 全ダイス処理が`/dice`フォルダに統合
- ✅ 統一API: DiceOrchestratorServiceによる統一インターフェース
- ✅ 後方互換: レガシーメソッドで既存コードとの互換性維持

**使用方法**:
```typescript
// 推奨
constructor(private diceOrchestrator: DiceOrchestratorService) {}
const result = await this.diceOrchestrator.executeBasicNotation('1d100')

// 非推奨（警告ログ出力）
const legacyResult = await this.diceOrchestrator.executeNotation('1d100')
```

---

## ⚠️ 残存課題管理（2025-08-17）

### 🔴 TypeScriptエラー `[要対応: 22個]`

**高優先度**:
1. **Enhanced Character Edit Service** - Character.Entity型不一致
2. **Discord Schema** - ZodDefault関数overload不一致

**中優先度**:
3. **Character Event Handler** - Character型とEntity型の不一致
4. **Channel Create Orchestrator** - 型定義の軽微な不整合

**対応ロードマップ**:
- **Phase 1 (緊急)**: 型キャストによる一時回避
- **Phase 2 (構造改善)**: 型変換ヘルパー関数の実装
- **Phase 3 (品質向上)**: Character型とEntity型の統一設計

---

## 🏗️ アーキテクチャ概要

### サービス構成

**Core Services** (`/services`):
- `DiscordFacadeService` - Discord統合のメインエントリーポイント
- `discord-client.service.ts` - Discord.jsクライアント管理
- `discord-guild-manager.service.ts` - ギルド管理
- `discord-channel-manager.service.ts` - チャンネル管理

**Specialized Services**:
- `/dice` - ダイス処理統合サービス群
- `/monitoring` - パフォーマンス監視サービス群
- `/channel` - チャンネル専門サービス群

**Feature Modules** (`/features`):
- `characterEdit/` - キャラクター編集機能
- `characterThread/` - キャラクタースレッド機能
- `diceRoll/` - ダイスロール機能

**Interactions Layer** (`/interactions`):
- Discord.jsインタラクション処理の統合管理
- ボタン、モーダル、セレクトメニュー処理

### アーキテクチャ原則

1. **単一責任**: 各サービスは明確な責務を持つ
2. **依存性注入**: NestJSのDIコンテナを活用
3. **イベント駆動**: TypedEventServiceによる疎結合
4. **レイヤー分離**: UI層、ビジネス層、データ層の明確な分離

---

## 🚀 今後の改善項目

### 🔥 高優先度
- TypeScriptエラー22個の解消
- 型安全性の向上（Character vs Entity型統一）

### 🔧 中優先度  
- パフォーマンス監視機能の拡充
- エラーハンドリングの標準化

### 📋 低優先度
- ドキュメントの継続的更新
- テストカバレッジの向上

---

## 📊 参考情報

### ファイル構造
```
src/discord/
├── services/           # コアサービス
├── features/          # 機能別モジュール
├── interactions/      # インタラクション処理
├── controllers/       # REST API
└── dto/              # データ転送オブジェクト
```

### 主要な設定
- `discord.module.ts` - メインモジュール設定
- `discord.service.ts` - レガシーサービス（非推奨）
- `discord-facade.service.ts` - 新統合サービス

---

*最終更新: 2025-08-21*