# Discord Features Documentation

> **アーキテクチャ全体・リファクタ計画**: [../DESIGN.md](../DESIGN.md)

## 📋 概要

TRPGサーバーのDiscord機能モジュール群のドキュメント。各機能は独立したモジュールとして設計され、特定のTRPG用途に特化したサービスを提供します。

---

## 🗂️ フィーチャー構成と役割

### characterEdit/

**役割**: キャラクター編集機能の統合管理
**責務**: キャラクター作成・編集・更新のDiscord UIとロジック

**主要コンポーネント**:

- `character-edit.module.ts` - モジュール定義と依存関係管理
- `enhanced-character-edit.service.ts` - キャラクター編集の中核サービス
- `events/` - キャラクター編集イベントの管理
  - `handlers/` - 作成・編集イベントハンドラー
  - `contracts/` - イベント契約定義
- `services/` - 編集機能専門サービス群
  - `channel-create-orchestrator.service.ts` - チャンネル作成統合
  - `character-creation.service.ts` - キャラクター作成ロジック
  - `character-embed-manager.service.ts` - Discord Embed管理
  - `character-modal-handler.service.ts` - モーダル処理
  - `character-ui.service.ts` - UI コンポーネント管理

**アーキテクチャパターン**: Feature Module + Event-Driven Architecture

- 機能の完全カプセル化
- イベントによる疎結合な連携

**主要ワークフロー**:

```
1. キャラクター編集開始 → モーダル表示
2. ユーザー入力 → バリデーション・保存
3. チャンネル作成 → Discord UI 更新
4. イベント発行 → 他機能への通知
```

### characterThread/

**役割**: キャラクタースレッド機能管理
**責務**: キャラクター専用スレッドの作成・表示・管理

**主要コンポーネント**:

- `character-thread-feature.module.ts` - フィーチャーモジュール定義
- `character-channel.service.ts` - キャラクターチャンネル選択メニュー処理（`CharacterChannelService`）
- `character-tab-buttons.service.ts` - キャラクタータブボタン処理（`CharacterTabButtonsService`）
- `services/` - スレッド・チャンネル管理専門サービス群
  - `character-thread.orchestrator.ts` - スレッド統合管理（`CharacterThreadOrchestrator`）
  - `thread-orchestrator.service.ts` - スレッド処理オーケストレーション（`ThreadOrchestratorService`）
  - `character-channel-orchestrator.service.ts` - キャラクターチャンネル統合管理（`CharacterChannelOrchestratorService`）
  - `thread-creation.service.ts` - スレッド作成ロジック（`ThreadCreationService`）
  - `thread-manager.service.ts` - スレッド管理（`ThreadManagerService`）
  - `channel-manager.service.ts` - チャンネル管理（`ChannelManagerService`）
  - `thread-interaction.service.ts` - スレッドインタラクション処理（`ThreadInteractionService`）
  - `character-display.service.ts` - キャラクター表示管理（`CharacterDisplayService`）
  - `character-display-handler.service.ts` - キャラクター表示ハンドラー（`CharacterDisplayHandlerService`）
  - `character-embed.service.ts` - Embed生成・フォーマット（`CharacterEmbedService`）
  - `dice-ui-builder.service.ts` - ダイスUI構築（`DiceUIBuilderService`）
  - `index.ts` - サービス群のエクスポート集約
- `services/`（utils 相当の純粋ロジック）
  - `thread-creation.util.ts` - スレッド作成ロジックの純関数
  - `thread-manager.util.ts` - スレッド管理ロジックの純関数
  - `channel-manager.util.ts` - チャンネル管理ロジックの純関数
- `dto/thread-creation.dto.ts` - データ転送オブジェクト
- `events/character-thread.ids.ts` - イベント識別子

**設計パターン**: Orchestrator Pattern + Builder Pattern

- 複雑な業務フローの統合管理
- UI コンポーネントの段階的構築

**主要機能フロー**:

```
1. スレッド作成要求 → バリデーション
2. キャラクターデータ取得 → Embed生成
3. ダイスUIコンポーネント構築 → スレッド作成
4. 表示設定 → 初期化完了通知
```

### diceRoll/

**役割**: ダイスロール機能統合
**責務**: TRPG用ダイス処理のDiscord UI統合

**主要コンポーネント**:

- `dice-roll.module.ts` - ダイスロール機能モジュール
- `index.ts` - 公開エクスポート
- `adapters/` - Discord インタラクション アダプター群
  - `dice-button.adapter.ts` - ダイスボタンインタラクション
  - `custom-dice-modal.adapter.ts` - カスタムダイスモーダル
  - `dice-character-select.adapter.ts` - キャラクター選択
  - `dice-page-prev-button.adapter.ts` / `dice-page-next-button.adapter.ts` / `dice-page-first-button.adapter.ts` / `dice-page-last-button.adapter.ts` / `dice-page-cancel-button.adapter.ts` - ページネーション制御ボタン
  - `dice-page-select-menu.adapter.ts` - ページ選択メニュー
- `services/` - ダイス処理オーケストレーション
  - `roll-dice.orchestrator.ts` - ダイスロール統合管理（`RollDiceOrchestrator`）
  - `dice-result.orchestrator.ts` - 結果処理・表示（`DiceResultOrchestrator`）
- `utils/channel-topic.util.ts` - チャンネルトピック管理

> **補足（Phase 1 完了）**: 上記 `adapters/`、pagination 関連サービス、handlers、custom-id は `DiceRollFeatureModule` が所有する。handler 登録も feature 側の `onModuleInit()` から `InteractionRegistryService` へ明示登録する。詳細は [../DESIGN.md](../DESIGN.md) §7 Phase 1。

**設計パターン**: Adapter Pattern + Command Pattern

- Discord APIとビジネスロジックの分離
- ダイス操作のコマンド化

**ダイス処理フロー**:

```
1. ダイスボタン押下 → アダプター処理
2. キャラクター・ダイス選択 → バリデーション
3. ダイス計算実行 → 結果フォーマット
4. Discord メッセージ生成 → 結果表示
```

### gameSystem/

**役割**: ゲームシステム選択機能
**責務**: TRPG システム（CoC、D&D等）の選択・設定管理

**主要コンポーネント**:

- `game-system.module.ts` - ゲームシステム機能モジュール
- `services/select-game-system.orchestrator.ts` - システム選択統合管理
- `utils/search.util.ts` - システム検索・フィルタリング

**設計パターン**: Strategy Pattern + Factory Pattern

- ゲームシステム別の処理戦略
- システム固有オブジェクトの生成

**システム選択フロー**:

```
1. システム選択UI表示 → 利用可能システム一覧
2. ユーザー選択 → システム固有設定ロード
3. キャラクターテンプレート適用 → UI更新
4. システム設定保存 → 他機能への通知
```

### userDefinedDice/

**役割**: ユーザー定義ダイス機能
**責務**: カスタムダイス設定の作成・管理・実行

**主要コンポーネント**:

- `user-defined-dice.module.ts` - カスタムダイス機能モジュール
- `services/user-defined-dice.orchestrator.ts` - カスタムダイス統合管理

**設計パターン**: Template Method Pattern + Interpreter Pattern

- カスタムダイス処理のテンプレート化
- ユーザー定義記法の解釈実行

**カスタムダイス処理**:

```
1. ダイス定義作成 → 構文バリデーション
2. 定義保存・管理 → ユーザー設定統合
3. 実行要求 → カスタム記法解釈
4. 結果計算・表示 → 標準フォーマット出力
```

---

## 🏗️ アーキテクチャ設計

### フィーチャー間依存関係

```
Feature Dependencies Flow
├── characterEdit
│   ├── → characterThread (スレッド作成)
│   └── → gameSystem (システム設定適用)
├── characterThread
│   ├── → diceRoll (ダイスUI構築)
│   └── → characterEdit (編集リンク)
├── diceRoll
│   ├── → userDefinedDice (カスタムダイス)
│   └── → gameSystem (システム固有ダイス)
├── gameSystem
│   └── → characterEdit (テンプレート提供)
└── userDefinedDice
    └── → diceRoll (実行統合)
```

### 共通アーキテクチャパターン

```
Feature Module Pattern
├── Module Definition (*.module.ts)
├── Service Layer (services/)
│   ├── Orchestrator Services (統合管理)
│   ├── Domain Services (業務ロジック)
│   └── Integration Services (外部連携)
├── Adapter Layer (adapters/)
│   ├── Discord Interaction Adapters
│   └── External API Adapters
├── Event Layer (events/)
│   ├── Event Handlers (handlers/)
│   ├── Event Contracts (contracts/)
│   └── Event IDs (*.ids.ts)
├── Data Layer (dto/)
└── Utility Layer (utils/)
```

### 外部依存関係

```
External Integration
├── Discord Services Layer
│   ├── DiscordChannelManagerService
│   ├── DiceOrchestratorService (/services/dice)
│   └── MonitoringService (/services/monitoring)
├── Domain Layer
│   ├── CharacterService (ドメイン層)
│   ├── UserService (認証・ユーザー管理)
│   └── GameSystemRepository (データ永続化)
├── Shared Infrastructure
│   ├── EventEmitter2 (イベント通信)
│   ├── ConfigService (設定管理)
│   └── Logger (ログ統合)
└── Discord.js API
    ├── Client (基本機能)
    ├── Interactions (ボタン・モーダル)
    └── Embeds (リッチメッセージ)
```

---

## 🚀 使用方法

### フィーチャーモジュール統合

```typescript
// メインDiscordモジュールでの統合
@Module({
  imports: [
    // Discord基盤サービス
    DiscordServicesModule,

    // フィーチャーモジュール群
    CharacterEditModule,
    CharacterThreadFeatureModule,
    DiceRollModule,
    GameSystemModule,
    UserDefinedDiceModule
  ]
})
export class DiscordModule {}
```

### 機能横断的な処理例

```typescript
// キャラクター作成 → スレッド作成 → ダイス設定
@Injectable()
export class TRPGWorkflowService {
  constructor(
    private characterEdit: EnhancedCharacterEditService,
    private characterThread: CharacterThreadOrchestrator,
    private diceRoll: RollDiceOrchestrator,
    private gameSystem: SelectGameSystemOrchestrator
  ) {}

  async createCompleteCharacter(userId: string, characterData: any) {
    // 1. ゲームシステム設定
    const system = await this.gameSystem.selectSystem(characterData.system)

    // 2. キャラクター作成
    const character = await this.characterEdit.createCharacter({
      ...characterData,
      gameSystem: system
    })

    // 3. 専用スレッド作成
    const thread = await this.characterThread.createCharacterThread({
      characterId: character.id,
      userId: userId
    })

    // 4. ダイス設定初期化
    await this.diceRoll.initializeDiceForCharacter(character.id, system)

    return { character, thread, system }
  }
}
```

### イベント駆動連携例

```typescript
// 横断的イベント処理
@Injectable()
export class FeatureEventCoordinator {
  constructor(private eventEmitter: EventEmitter2) {
    this.setupEventHandlers()
  }

  private setupEventHandlers() {
    // キャラクター作成完了 → スレッド自動作成
    this.eventEmitter.on('character.creation.completed', async (event) => {
      await this.characterThread.createCharacterThread(event.characterId)
    })

    // ゲームシステム変更 → ダイス設定更新
    this.eventEmitter.on('gameSystem.changed', async (event) => {
      await this.diceRoll.updateSystemDice(event.userId, event.newSystem)
    })

    // カスタムダイス作成 → UI更新
    this.eventEmitter.on('userDice.created', async (event) => {
      await this.diceRoll.refreshDiceUI(event.userId)
    })
  }
}
```

---

## 📊 パフォーマンス特性

### 機能別レスポンス時間

| 機能            | 平均レスポンス | 複雑度 | 主要ボトルネック     |
| --------------- | -------------- | ------ | -------------------- |
| characterEdit   | ~200-500ms     | 高     | データベース書き込み |
| characterThread | ~100-300ms     | 中     | Discord API呼び出し  |
| diceRoll        | ~50-150ms      | 低     | ダイス計算処理       |
| gameSystem      | ~100-200ms     | 中     | システム設定ロード   |
| userDefinedDice | ~80-200ms      | 中     | カスタム記法解釈     |

### リソース使用量

```typescript
// 機能別メモリ使用量（推定）
characterEdit:    ~5-15MB  // UI状態・一時データ
characterThread:  ~2-8MB   // スレッド管理・Embed
diceRoll:         ~1-5MB   // ダイス履歴・UI状態
gameSystem:       ~3-10MB  // システム定義・テンプレート
userDefinedDice:  ~2-6MB   // カスタムダイス定義
```

### 同時利用制限

- **Discord API制限**: レート制限遵守（50req/秒）
- **データベース接続**: プール管理（最大20接続）
- **メモリ使用量**: フィーチャー合計で~50-100MB
- **同時セッション**: ユーザーあたり最大5セッション

---

## 🔧 設定とカスタマイズ

### 環境変数設定

```typescript
// フィーチャー固有設定
CHARACTER_EDIT_AUTO_THREAD = true // 自動スレッド作成
DICE_ROLL_HISTORY_LIMIT = 50 // ダイス履歴保持数
GAME_SYSTEM_CACHE_TTL = 3600000 // システム設定キャッシュ（1時間）
USER_DICE_LIMIT_PER_USER = 20 // ユーザー別カスタムダイス上限

// パフォーマンス設定
FEATURE_CONCURRENT_LIMIT = 10 // 同時処理数制限
FEATURE_TIMEOUT_MS = 30000 // 処理タイムアウト
FEATURE_RETRY_ATTEMPTS = 3 // 失敗時再試行回数
```

### 機能別カスタマイズ

```typescript
// キャラクター編集カスタマイズ
const characterEditConfig = {
  maxFieldLength: 2000, // フィールド文字数制限
  autoSaveInterval: 30000, // 自動保存間隔
  validationRules: {
    // バリデーションルール
    required: ['name', 'system'],
    optional: ['background', 'notes']
  }
}

// ダイスロールカスタマイズ
const diceRollConfig = {
  maxDiceCount: 100, // 最大ダイス数
  maxSides: 1000, // 最大面数
  resultFormat: 'detailed', // 結果表示形式
  animationEnabled: true // アニメーション有効化
}

// ゲームシステムカスタマイズ
const gameSystemConfig = {
  supportedSystems: [
    // サポートシステム
    'CoC',
    'D&D5e',
    'Pathfinder',
    'Custom'
  ],
  defaultSystem: 'CoC', // デフォルトシステム
  allowCustomSystems: true // カスタムシステム許可
}
```

---

## 🚨 トラブルシューティング

### よくある問題

1. **キャラクター作成失敗**
   - 原因: バリデーション失敗、DB接続エラー、Discord API制限
   - 対処: 入力値確認、接続状態診断、レート制限チェック

2. **スレッド作成エラー**
   - 原因: 権限不足、チャンネル制限、名前重複
   - 対処: Bot権限確認、チャンネル設定見直し、名前一意性確保

3. **ダイス計算異常**
   - 原因: 記法エラー、数値オーバーフロー、システム設定不整合
   - 対処: 記法バリデーション、制限値確認、システム設定修正

4. **UI更新遅延**
   - 原因: イベント処理遅延、Discord API遅延、キャッシュ問題
   - 対処: イベント処理確認、API状態確認、キャッシュ更新

### 診断手順

```typescript
// フィーチャー状態診断
async function diagnoseFeatures() {
  // 1. 基本機能テスト
  const characterEditHealth = await characterEditService.healthCheck()
  const threadCreationHealth = await threadService.healthCheck()
  const diceRollHealth = await diceService.healthCheck()

  // 2. 依存関係確認
  const dbConnection = await databaseService.ping()
  const discordApiStatus = await discordClient.ping()

  // 3. リソース使用量確認
  const memoryUsage = process.memoryUsage()
  const eventQueueSize = eventEmitter.listenerCount()

  return {
    features: { characterEditHealth, threadCreationHealth, diceRollHealth },
    dependencies: { dbConnection, discordApiStatus },
    resources: { memoryUsage, eventQueueSize }
  }
}

// エラー回復処理
async function recoverFromErrors() {
  // イベントキュー クリア
  eventEmitter.removeAllListeners()

  // キャッシュ更新
  await gameSystemService.refreshCache()

  // 接続再初期化
  await discordClientService.reconnect()
}
```

### メンテナンス推奨

```typescript
// 定期メンテナンス（週次実行推奨）
async function weeklyMaintenance() {
  // 1. 古いセッション データ クリーンアップ
  await characterEditService.cleanupExpiredSessions()

  // 2. ダイス履歴の整理
  await diceRollService.archiveOldHistory()

  // 3. 使用されていないカスタムダイス削除
  await userDefinedDiceService.cleanupUnusedDice()

  // 4. システム設定最適化
  await gameSystemService.optimizeSettings()

  // 5. パフォーマンス統計レポート生成
  const report = await generatePerformanceReport()
  logger.info('Weekly maintenance completed', report)
}
```

---

_最終更新: 2025-08-21_
