# Character Edit Feature Module

Discord 上でのキャラクターチャンネル作成・初期化、およびキャラクター情報（Status / Skill / Parameter）の
編集を統合した NestJS feature モジュールです。`EnhancedCharacterEditService` を中心とした薄いオーケストレーター構成で、
副作用（Discord I/O・イベント発行）を専用サービスへ、純粋ロジックを `utils/` へ分離しています。

## 🏗️ ディレクトリ構成

実体に基づく構成（`*.spec.ts` はテストファイル）:

```
characterEdit/
├── character-edit.module.ts                # NestJS モジュール定義（providers / exports）
├── enhanced-character-edit.service.ts       # 中心となる統合オーケストレーター
├── index.ts                                 # 公開 API・型・設定・バリデータの集約
├── events/                                  # feature 固有イベント
│   ├── index.ts
│   ├── character-edit.ids.ts                # CustomId 定義（後方互換）
│   ├── contracts/
│   │   └── character-edit-events.contract.ts  # イベント契約定義
│   └── handlers/
│       ├── character-edit-feature.handler.ts   # feature 内部 ⇔ グローバルイベント橋渡し
│       └── character-edit-creation.handler.ts  # creation.requested イベント処理
├── services/                                # サービス群（@Injectable）
│   ├── index.ts
│   ├── channel-detection.service.ts          # チャンネル検出（作成対象判定）
│   ├── character-creation.service.ts         # キャラクター作成（イベント駆動）
│   ├── character-notification.service.ts     # 作成通知・URL 送信（自己完結型）
│   ├── channel-create-orchestrator.service.ts # チャンネル作成フローの統合
│   ├── character-event-integration.service.ts # キャラクター関連イベントの統合処理
│   ├── channel-name-sync.service.ts          # チャンネル名 ⇔ キャラクター名の同期
│   ├── character-embed-manager.service.ts    # 分割 Embed の生成・管理
│   ├── character-section-editor.service.ts   # セクション編集（SelectMenu / Modal）
│   ├── character-modal-handler.service.ts    # モーダル送信処理（追加・更新・削除）
│   ├── modal-session-manager.service.ts      # CustomId 長さ制限対応のセッション管理
│   ├── character-edit-event-emitter.service.ts # characterEdit.* イベント発行の集約
│   ├── character-edit-message-updater.service.ts # 既存メッセージの探索・更新（refresh）
│   ├── character-ui.service.ts               # チャンネル/メッセージの UI I/O
│   ├── character-modal-handler.util.ts       # モーダル処理の純粋ロジック
│   └── character-section-editor.util.ts      # セクション編集の純粋ロジック
└── utils/                                    # discord.js 非依存の純粋関数群
    ├── character-embed.util.ts               # Embed データ整形（AttributeValue 合算等）
    ├── character-ui.util.ts                  # Embed/SelectMenu データ構築・文言整形
    └── enhanced-character-edit.util.ts       # customId 解析・分岐判定
```

> `character-modal-handler.util.ts` と `character-section-editor.util.ts` は対応するサービスと密接なため
> `services/` 配下に置かれています（`Character` / `EmbedSectionType` 型に触れるため。詳細は各ファイル冒頭コメント参照）。

### 設計原則

1. **単一責任原則**: 各サービス・util が明確な責任を持つ
2. **オーケストレーター + 協力者**: `EnhancedCharacterEditService` は薄い調整役に徹し、実処理を協力サービスへ委譲
3. **純粋ロジックの分離**: discord.js / DI に依存しない変換・解析・判定を `utils/`・`*.util.ts` に切り出しテスト可能化
4. **イベント駆動**: 作成処理は `TypedEventService` 経由のイベントで疎結合に連携
5. **型安全性**: TypeScript の恩恵を最大限活用
6. **グローバルモジュール活用**: `AppConfigService` はグローバル登録のためインポート不要

## 📦 公開 API

`character-edit.module.ts` の `exports` で公開しているもの（他モジュールから DI 可能）:

**Event Handlers**

- `CharacterEditFeatureHandler`
- `CharacterEditCreationHandler`

**Modern Services**

- `ChannelDetectionService`
- `CharacterCreationService`
- `CharacterNotificationService`
- `ChannelCreateOrchestratorService`
- `CharacterEventIntegrationService`
- `ChannelNameSyncService`

**Enhanced Character Edit Services**

- `CharacterEmbedManagerService`
- `ModalSessionManagerService`
- `CharacterSectionEditorService`
- `CharacterModalHandlerService`
- `EnhancedCharacterEditService`
- `CharacterUIService`

> `CharacterEditEventEmitterService` と `CharacterEditMessageUpdaterService` は providers には登録されていますが
> exports には含まれません（モジュール内部利用）。

## 🚀 使用方法

### 1. モジュールのインポート

```typescript
import { CharacterEditModule } from './features/characterEdit/character-edit.module'

@Module({
  imports: [
    CharacterEditModule
    // その他のモジュール...
  ]
})
export class YourModule {}
```

`CharacterEditModule` は内部で `CharacterModule`（forwardRef）と `DiscordIntegrationModule` をインポートします。

### 2. オーケストレーターの利用（チャンネル作成フロー）

```typescript
import { Injectable } from '@nestjs/common'
import { TextChannel } from 'discord.js'
import { ChannelCreateOrchestratorService } from './services'

@Injectable()
export class YourService {
  constructor(private readonly orchestratorService: ChannelCreateOrchestratorService) {}

  async handleChannelCreate(channel: TextChannel) {
    // チャンネル検出 → キャラクター作成イベント発火までを統合実行
    await this.orchestratorService.execute(channel)
  }
}
```

### 3. 個別サービスの利用

```typescript
import { Injectable } from '@nestjs/common'
import { TextChannel } from 'discord.js'
import { ChannelDetectionService, CharacterCreationService, CharacterNotificationService } from './services'

@Injectable()
export class CustomService {
  constructor(
    private readonly channelDetectionService: ChannelDetectionService,
    private readonly characterCreationService: CharacterCreationService,
    private readonly characterNotificationService: CharacterNotificationService
  ) {}

  async customFlow(channel: TextChannel) {
    const detectionResult = await this.channelDetectionService.detectCharacterChannel(channel)

    if (detectionResult.shouldCreateCharacter && detectionResult.context) {
      const creationResult = await this.characterCreationService.createCharacter(detectionResult.context)

      if (creationResult.success) {
        await this.characterNotificationService.notifyCharacterCreation(
          channel,
          creationResult.characterId!,
          creationResult.characterName!
        )
      }
    }
  }
}
```

## 📚 型定義

`channel-detection.service.ts` / `character-creation.service.ts` で定義され、`services/index.ts` から再エクスポートされます。

```typescript
// channel-detection.service.ts
interface ChannelCreationContext {
  channel: TextChannel
  categoryId: string
  creatorId: string | null
}

interface ChannelCreationResult {
  success: boolean
  shouldCreateCharacter: boolean
  context?: ChannelCreationContext
  error?: string
}

// character-creation.service.ts
interface CharacterCreationResult {
  success: boolean
  characterId?: string
  characterName?: string
  error?: string
}
```

`index.ts` では feature 向けの型・設定・ユーティリティも公開しています:

- `CharacterEditContext` / `CharacterUpdatePayload`（型）
- `CHARACTER_EDIT_CONFIG`（設定値オブジェクト）
- `CharacterEditValidator`（フィールド・入力・コンテキストのバリデーション）

```typescript
export const CHARACTER_EDIT_CONFIG = {
  MAX_INPUT_LENGTH: 2000,
  AUTO_DELETE_ERROR_TIMEOUT: 5000,
  SUPPORTED_FIELDS: ['status', 'parameter', 'skill'] as const,
  AUDIT_LOG_LIMIT: 10,
  DEFAULT_GAME_SYSTEM_ID: '',
  NOTIFICATION_TIMEOUT: 30000
} as const
```

> 注: かつて `index.ts` にあった `CharacterEditServiceFactory`（実在しない `./character-channel-create.service` を
> `require` する未使用デッドコード）は 2026-06-03 に削除済み。各サービスは `./services` から export され、NestJS の DI
> （`CharacterEditModule`）経由で利用する。

## 🔧 設定

### 環境変数

- `DISCORD_CHARACTER_CATEGORY`: キャラクター作成対象のカテゴリ名（チャンネル検出に使用）

その他の環境変数の全体像は [`src/config/README.md`](../../../config/README.md) を参照してください。

### グローバルモジュール

`AppConfigService` は `@Global()` 登録のため、各モジュールで明示的にインポートする必要はありません。

## 🧪 テスト

各サービス・util には対応する `*.spec.ts` が用意されています（Jest ユニットテスト）。
実行コマンドはルートの package.json に従います。

```bash
# 全ユニットテスト
pnpm test

# 特定ファイルのみ（ファイル名でフィルタ）
pnpm test character-creation.service.spec
pnpm test channel-create-orchestrator.service.spec

# カバレッジ付き
pnpm test:cov
```

## 🐛 トラブルシューティング

- **依存性注入エラー**: `CharacterEditModule` が正しくインポートされているか、
  利用したいサービスが `exports` に含まれているかを確認。
- **型エラー**: 型は `services/index.ts` 経由で再エクスポートされたものを使用しているか確認。

### ログレベル

- `LOG`: 正常な処理フロー
- `WARN`: 警告（作成者 ID 取得失敗など）
- `ERROR`: エラー（キャラクター作成失敗など）
