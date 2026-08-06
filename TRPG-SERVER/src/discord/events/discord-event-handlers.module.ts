import { Module } from '@nestjs/common'
import { DiscordIntegrationModule } from '../application/discord-integration.module'
import { CharacterEditModule } from '../features/characterEdit/character-edit.module'
import { CharacterThreadFeatureModule } from '../features/characterThread/character-thread-feature.module'

// Discord UI を更新する「完了系」イベントハンドラー群
// （events 層から移設。TypedEventService への自己購読で動作する）
import { CharacterCreationCompletedHandler } from './handlers/character.creation.completed'
import { CharacterUpdateCompletedHandler } from './handlers/character.update.completed'
import { DiscordThreadCreateRequestedHandler } from './handlers/discord.thread.create.requested'

/**
 * Discord Event Handlers Module
 *
 * 🎯 目的:
 * - 「Discord UI を更新する完了系イベントハンドラー」を discord 層に集約する。
 * - 旧構成では events 層がこれらを保持し discord/features へ依存していた
 *   （ARCHITECTURE 違反の逆流依存）。本モジュールへ移設することで
 *   依存方向を discord → features / shared（許可方向）に正す。
 *
 * 🏗️ 登録方式:
 * - 各ハンドラーは OnModuleInit で TypedEventService に自己購読する。
 *   イベントバス（TypedEventService）は従来と同一のため、producer が emit する
 *   `character.creation.completed` 等のフローはそのまま繋がる。
 * - EventHandler 基底の execute()（検証・ログ・統計・リトライ）は維持。
 *
 * 📦 依存:
 * - CoreEventsModule(@Global): TypedEventService
 * - DiscordIntegrationModule: DiscordClientService
 * - CharacterEditModule: CharacterEmbedManagerService
 * - CharacterThreadFeatureModule: ThreadOrchestratorService
 *
 * 🧹 E-3f: キャラクター削除完了イベントの専用ハンドラーは
 *    emit 元ゼロ＋自己購読なしの dead listener だったため削除した。
 */
@Module({
  imports: [DiscordIntegrationModule, CharacterEditModule, CharacterThreadFeatureModule],
  providers: [CharacterCreationCompletedHandler, CharacterUpdateCompletedHandler, DiscordThreadCreateRequestedHandler]
})
export class DiscordEventHandlersModule {}
