# Discord機能アーキテクチャドキュメント

## 📋 概要

TRPGサーバーのDiscord統合機能に関するアーキテクチャと実装状況を管理するドキュメント

### 📖 主要ドキュメント（2026-05-30 整備）

| ドキュメント                                                             | 内容                                                                  |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| **[DESIGN.md](./DESIGN.md)**                                             | 統合設計書（現状評価・目標アーキテクチャ・customId 契約・Phase 0〜4） |
| **[interactions/README.md](./interactions/README.md)**                   | Interactions レイヤーの役割・構成・Handler 作法                       |
| **[interactions/MIGRATION_GUIDE.md](./interactions/MIGRATION_GUIDE.md)** | Registry 移行・Feature 分離の手順書                                   |

---

## 📝 最新メモ（2026-06-01）

### H3 巨大サービス分割: `dice-roll-pagination.service.ts`（挙動保存）

監査 H3「Discord 巨大サービスが単一責任を超過」対応。`components/pagination/dice-roll-pagination.service.ts`（590 行）を責務ごとに分割。

- **抽出した責務（同 feature 配下に co-locate）**
  - `dice-roll-pagination.util.ts`（101 行）… 純粋関数（discord.js 非依存・I/O なし）: `resolveHistoryTitle` / `filterRollsByCharacter` / `sortRollsByCreatedAtDesc` / `limitRolls` / `formatDiceRoll` / `computeNewPage` / `clampPage` / `isSpecificCharacter`。モック不要でユニットテスト可能。
  - `dice-roll-pagination.builder.ts`（196 行）… discord.js の Embed / コンポーネント生成（状態を持たない関数群）: `buildHistoryPages` / `setPageFooters` / `createEmptyEmbed` / `buildPageButtonRow` / `buildPageSelectRow` / `buildCharacterSelectRow`。
  - `dice-roll-pagination.store.ts`（116 行）… インメモリ状態 + ページ/キャラクターキャッシュ（TTL）。`PaginatedDiceRoll` 型の正本もここへ移し service から再エクスポート。
  - `dice-roll-pagination.service.ts`（234 行）… 上記を束ねる薄いオーケストレーター。
- **公開 API は不変**（コンストラクタ 2 引数も維持＝`character-select.spec.ts` が直接 `new` するため）。`@Global`/`forwardRef` 増やさず、provider 登録（interactions.module）も変更なし。
- 純粋関数の置き場所は ARCHITECTURE §12 に従い「pagination 固有 → 同 feature 配下の util」。`shared/` は横断純関数専用のため使わず。
- **検証**: `pnpm build` 成功 / `pnpm test src/discord/components/pagination` = 既存 33 + 新規 25（util.spec）= **58 緑** / `check:circular` は許容済み Auth⇄User の 1 件のみ（新規循環なし）。`src/discord` 全体の 13 失敗は本変更前から同数・同一（event-debug の timing 系）で本件と無関係。

---

## 📝 最新メモ（2026-05-30）

### Discord 層 統合設計書を作成

- 設計評価（78/100）・As-Is / To-Be・customId 契約・Phase 0〜4 を [DESIGN.md](./DESIGN.md) に集約
- 空だった `interactions/README.md` / `MIGRATION_GUIDE.md` を補完
- **次の着手**: Phase 0 残件（Factory / Parser 統一、legacy customId 廃止）→ Phase 1（diceRoll を InteractionsModule から分離）

### 設計上の最重要原則

- **InteractionsModule は feature 実装を所有しない**（registry 基盤のみ）
- **InteractionsModule は feature module を import しない**。feature 側が Registry を import して handler を明示登録する
- customId は Factory / Parser / Handler pattern に集約（文字列直書き禁止）
- `DiceRollCharacterProviderService` の ports 切り出しは正しい方向

### 既知の不具合リスク

- Legacy `dice-prev*` 系 customId が Registry handler（`dice-page-prev`）と不一致 → pagination 無反応
- ルーティング 3 層並存（Map → InteractionsService 特例 → Registry）

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

## 📝 進行中メモ（2026-03-08）→ [DESIGN.md](./DESIGN.md) に統合済み

- Registry 移行方針・customId 洗い出し・Phase 計画は DESIGN.md §6〜7 を参照
- `InteractionRegistryService` 未登録 customId 集計・`debugInfo()` は実装済み

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

**中優先度**: 3. **Character Event Handler** - Character型とEntity型の不一致4. **Channel Create Orchestrator** - 型定義の軽微な不整合

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

### 🔥 高優先度（[DESIGN.md](./DESIGN.md) Phase 0〜1）

- customId 統一（`dice-prev*` → `dice-page-*`）
- diceRoll を InteractionsModule から FeatureModule へ分離
- InteractionsModule slim 化・ルーティング 1 本化

### 🔧 中優先度

- TypeScriptエラー22個の解消（Character vs Entity型統一）
- ModuleRef / forwardRef の段階的排除
- パフォーマンス監視の Module 二重登録解消

### 📋 低優先度

- core/ フォルダ新設・commands の feature 移動
- Legacy（DiscordService, interactions/button/）削除
- テストカバレッジの feature 単位拡充

---

## 📊 参考情報

### ファイル構造

```
src/discord/
├── DESIGN.md          # 統合設計書（目標アーキテクチャ・リファクタ計画）
├── services/          # コアサービス（dice 計算エンジン、monitoring 等）
├── features/          # 機能別モジュール（目標: handler/pagination/ports もここに集約）
├── interactions/      # インタラクションルーティング基盤（Registry）
├── commands/          # スラッシュコマンド
├── components/        # 共有 UI（pagination 等 → diceRoll へ移動予定）
└── dto/               # データ転送オブジェクト
```

### 主要な設定

- `discord.module.ts` - メインモジュール設定
- `discord.service.ts` - レガシーサービス（非推奨）
- `discord-facade.service.ts` - 新統合サービス

---

_最終更新: 2026-05-30_
