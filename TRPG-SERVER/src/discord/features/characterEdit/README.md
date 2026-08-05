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
├── events/                                  # feature 固有イベント
│   ├── index.ts
│   ├── character-edit.ids.ts                # CustomId 定義（後方互換）
│   └── handlers/
│       └── character-edit-feature.handler.ts   # feature 内部 ⇔ グローバルイベント橋渡し
├── services/                                # サービス群（@Injectable）
│   ├── channel-detection.service.ts          # チャンネル検出（作成対象判定）
│   ├── character-notification.service.ts     # 作成通知・URL 送信（自己完結型）
│   ├── channel-create-orchestrator.service.ts # チャンネル作成フローの統合
│   ├── character-event-integration.service.ts # キャラクター関連イベントの統合処理
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

**Modern Services**

- `ChannelDetectionService`
- `CharacterCreationService`
- `CharacterNotificationService`
- `ChannelCreateOrchestratorService`
- `CharacterEventIntegrationService`

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

`CharacterEditModule` は内部で `CharacterModule` と `DiscordIntegrationModule` をインポートします
（CharacterModule は characterEdit を import しない＝循環なしのため forwardRef 不要・P1-B）。

### 2. オーケストレーターの利用（チャンネル作成フロー）

```typescript
import { Injectable } from '@nestjs/common'
import { TextChannel } from 'discord.js'
import { ChannelCreateOrchestratorService } from './services/channel-create-orchestrator.service'

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
import { ChannelDetectionService } from './services/channel-detection.service'

@Injectable()
export class CustomService {
  constructor(private readonly channelDetectionService: ChannelDetectionService) {}

  async customFlow(channel: TextChannel) {
    const detectionResult = await this.channelDetectionService.detectCharacterChannel(channel)

    if (detectionResult.shouldCreateCharacter && detectionResult.context) {
      // キャラクター作成〜通知の実経路は ChannelCreateOrchestratorService が統合している。
      // 旧 CharacterCreationService（作成ロジック単体）は production 参照 0 のため
      // 第5群 G5-a（2026-08-05）で削除済み — 個別再実装せず orchestrator を利用すること
    }
  }
}
```

## 📚 型定義

`channel-detection.service.ts` で定義されます（旧 character-creation.service.ts の
`CharacterCreationResult` は G5-a 2026-08-05 でファイルごと削除済み）。

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
```

かつて `index.ts` が公開していた feature 向けの型・設定・バリデーション
（`CharacterEditContext` / `CharacterUpdatePayload` / `CHARACTER_EDIT_CONFIG` /
`CharacterEditValidator`）は、いずれも production 参照 0 のため第5群 G5-a/G5-b
（2026-08-05）で削除済みです。さらに **barrel（`index.ts`・`services/index.ts`）自体も
importer 0 のため H1-a（同日）で削除済み** — 各サービス・型は実ファイルを直接 import し、
利用は NestJS の DI（`CharacterEditModule`）経由で行います。

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
pnpm test channel-create-orchestrator.service.spec

# カバレッジ付き
pnpm test:cov
```

## 🐛 トラブルシューティング

- **依存性注入エラー**: `CharacterEditModule` が正しくインポートされているか、
  利用したいサービスが `exports` に含まれているかを確認。
- **型エラー**: 型は定義元の実ファイル（例: `services/channel-detection.service.ts`）から
  直接 import しているか確認（barrel は H1-a で削除済み）。

### ログレベル

- `LOG`: 正常な処理フロー
- `WARN`: 警告（作成者 ID 取得失敗など）
- `ERROR`: エラー（キャラクター作成失敗など）
