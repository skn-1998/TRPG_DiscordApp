import { Module } from '@nestjs/common'
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
// 注: update.requested / findBy*.requested の 4 ハンドラーは E-2 完了で emit 元ゼロの
//     dead チェーンとなったため E-3a で削除した。
import { EventRegistryService } from './event-registry.service'
import { CharacterCreationRequestedHandler } from './handlers/character.creation.requested'

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
 * └── character.creation.requested.ts
 *
 * 注: 完了系（creation/update/deletion.completed）は discord 層へ移設済み。
 *     update.requested / findBy*.requested は dead チェーンのため E-3a で削除済み。
 */
@Module({
  imports: [
    CharacterModule, // Character domain services
    DiscordIntegrationModule // Discord基盤サービス
    // 注: CharacterEditModule / CharacterThreadFeatureModule の forwardRef は撤去した。
    //     完了系ハンドラーは discord 層（DiscordEventHandlersModule）へ移設済み。
  ],
  providers: [
    // ✅ NEW: File-based Event Registry & Handlers
    EventRegistryService,
    CharacterCreationRequestedHandler,

    // Discord 統合（TypedEventService 経由のログ処理）
    DiscordIntegrationHandler
  ],
  exports: [
    // ✅ NEW: File-based Event System
    EventRegistryService,

    DiscordIntegrationHandler
  ]
})
export class EventsModule {}
