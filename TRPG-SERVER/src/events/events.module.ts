import { Module, Global } from '@nestjs/common'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { CharacterModule } from 'domains/character/character.module'
import { DiscordIntegrationModule } from 'discord/application/discord-integration.module'

// Discord 統合（TypedEventService 経由のログ処理）
import { DiscordIntegrationHandler } from './handlers/discord-integration.handler'

// 🚨 Event Bridge削除対象（レガシー）
// import { UniversalEventBridge } from './handlers/universal-event-bridge'

// ✅ NEW: File-based Event Handlers
// 注: Discord UI を更新する「完了系」ハンドラー（creation/update/deletion.completed,
//     discord.thread.create.requested）は discord 層（DiscordEventHandlersModule）へ移設した。
//     これにより events→discord/features の逆流依存（forwardRef）を撤去している。
import { EventRegistryService } from './event-registry.service'
import { CharacterCreationRequestedHandler } from './handlers/character.creation.requested'
import { CharacterUpdateRequestedHandler } from './handlers/character.update.requested'
import { CharacterFindByChannelIdRequestedHandler } from './handlers/character.findByChannelId.requested'
import { CharacterFindByIdRequestedHandler } from './handlers/character.findById.requested'
import { CharacterFindByNameRequestedHandler } from './handlers/character.findByName.requested'

/**
 * File-based Events Module
 *
 * 🎯 目的: File-based Event Handlersによるシンプルなイベント処理
 *
 * 📋 責務:
 * - Remix.js風ファイルベースイベントハンドリング
 * - 1イベント = 1ファイル = 1責務
 * - 型安全なイベント処理
 * - 自動登録・ルーティングシステム
 *
 * 🏗️ 新アーキテクチャ:
 * File-based Event Handlers (このモジュール)
 * ├── character.creation.requested.ts
 * ├── character.update.requested.ts
 * ├── character.findByChannelId.requested.ts
 * ├── character.findById.requested.ts
 * ├── character.creation.completed.ts
 * ├── character.update.completed.ts
 * └── character.deletion.completed.ts
 *
 * 🔄 移行計画:
 * 1. 新しいFile-based Handlersを併用開始
 * 2. 既存Event Bridgeから段階的移行
 * 3. レガシーコード削除
 */
@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot({
      // EventEmitter2の設定
      wildcard: false, // ワイルドカードイベントを無効
      delimiter: '.', // イベント名の区切り文字
      newListener: false, // newListenerイベントを無効
      removeListener: false, // removeListenerイベントを無効
      maxListeners: 20, // 最大リスナー数
      verboseMemoryLeak: true, // メモリリーク検出を有効
      ignoreErrors: false // エラーを無視しない
    }),
    CharacterModule, // Character domain services
    DiscordIntegrationModule // Discord基盤サービス
    // 注: CharacterEditModule / CharacterThreadFeatureModule の forwardRef は撤去した。
    //     完了系ハンドラーは discord 層（DiscordEventHandlersModule）へ移設済み。
  ],
  providers: [
    // ✅ NEW: File-based Event Registry & Handlers
    EventRegistryService,
    CharacterCreationRequestedHandler,
    CharacterUpdateRequestedHandler,
    CharacterFindByChannelIdRequestedHandler,
    CharacterFindByIdRequestedHandler,
    CharacterFindByNameRequestedHandler,

    // Discord 統合（TypedEventService 経由のログ処理）
    DiscordIntegrationHandler
  ],
  exports: [
    // ✅ NEW: File-based Event System
    EventRegistryService,

    DiscordIntegrationHandler,

    // EventEmitterModule for direct usage
    EventEmitterModule
  ]
})
export class EventsModule {}
