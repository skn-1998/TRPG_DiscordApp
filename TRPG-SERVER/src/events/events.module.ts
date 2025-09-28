import { Module, Global, forwardRef } from '@nestjs/common'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { CharacterModule } from 'domains/character/character.module'
import { DiscordIntegrationModule } from 'discord/application/discord-integration.module'
import { CharacterEditModule } from 'discord/features/characterEdit/character-edit.module'
import { CharacterThreadFeatureModule } from 'discord/features/characterThread/character-thread-feature.module'

// Legacy Bus Services (暫定的に保持)
import { GlobalEventBusService } from './bus/global-event-bus.service'
import { EventRouterService } from './bus/event-router.service'

// Legacy Event Handlers (暫定的に保持)
import { CharacterEventHandler } from './handlers/character-event.handler'
import { DiscordIntegrationHandler } from './handlers/discord-integration.handler'

// 🚨 Event Bridge削除対象（レガシー）
// import { UniversalEventBridge } from './handlers/universal-event-bridge'

// ✅ NEW: File-based Event Handlers
import { EventRegistryService } from './event-registry.service'
import { CharacterCreationRequestedHandler } from './handlers/character.creation.requested'
import { CharacterUpdateRequestedHandler } from './handlers/character.update.requested'
import { CharacterFindByChannelIdRequestedHandler } from './handlers/character.findByChannelId.requested'
import { CharacterFindByIdRequestedHandler } from './handlers/character.findById.requested'
import { CharacterCreationCompletedHandler } from './handlers/character.creation.completed'
import { CharacterUpdateCompletedHandler } from './handlers/character.update.completed'
// import { CharacterDeletionCompletedHandler } from './handlers/character.deletion.completed'
import { CharacterFindByNameRequestedHandler } from './handlers/character.findByName.requested'
import { DiscordThreadCreateRequestedHandler } from './handlers/discord.thread.create.requested'

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
    DiscordIntegrationModule, // Discord基盤サービス
    forwardRef(() => CharacterEditModule), // CharacterUIService用
    forwardRef(() => CharacterThreadFeatureModule) // ThreadOrchestratorService用
  ],
  providers: [
    // ✅ NEW: File-based Event Registry & Handlers
    EventRegistryService,
    CharacterCreationRequestedHandler,
    CharacterUpdateRequestedHandler,
    CharacterFindByChannelIdRequestedHandler,
    CharacterFindByIdRequestedHandler,
    CharacterCreationCompletedHandler,
    CharacterUpdateCompletedHandler,
    // CharacterDeletionCompletedHandler,
    CharacterFindByNameRequestedHandler,
    DiscordThreadCreateRequestedHandler,

    // 🔄 LEGACY: 暫定的に保持（段階的削除予定）
    GlobalEventBusService,
    EventRouterService,
    CharacterEventHandler,
    DiscordIntegrationHandler
    // UniversalEventBridge, // 🚨 削除済み
  ],
  exports: [
    // ✅ NEW: File-based Event System
    EventRegistryService,

    // 🔄 LEGACY: 後方互換性のため暫定保持
    GlobalEventBusService,
    EventRouterService,
    CharacterEventHandler,
    DiscordIntegrationHandler,

    // EventEmitterModule for direct usage
    EventEmitterModule
  ]
})
export class EventsModule {}
