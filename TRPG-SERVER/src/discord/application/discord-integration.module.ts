import { Module } from '@nestjs/common'
import { CharacterModule } from '../../domains/character/character.module'
// import { DiscordIntegrationService } from './discord-integration.service' // 廃止済み - イベント駆動アーキテクチャに移行
// DiscordUIService は CharacterUIService に移行されました
import { DiscordClientService } from '../services/discord-client.service'
// import { CharacterThreadFeatureModule } from '../features/characterThread/character-thread-feature.module' // 循環依存解消のため削除
// import { CharacterEditModule } from '../features/characterEdit/character-edit.module' // 循環依存解消のため削除

/**
 * Discord Integration Module
 *
 * Discord基盤サービス（DiscordClientService, DiscordUIService）のみを管理する独立モジュール
 * - DiscordIntegrationServiceは廃止済み（イベント駆動アーキテクチャに移行）
 * - features/ への直接依存を排除し、イベント駆動通信のみを使用
 * - 循環依存を完全に回避した設計
 * - 最小限の依存関係で提供
 * - AppConfigServiceはグローバルモジュールのため、インポート不要
 */
@Module({
  imports: [
    CharacterModule // Character関連のドメインサービス用（CharacterModule は DiscordIntegrationModule を import しない＝循環なしのため forwardRef 不要・P1-B）
    // Note: features/ への直接依存を排除してイベント駆動通信のみを使用
    // Note: AppConfigServiceはグローバルモジュールのためインポート不要
  ],
  providers: [
    DiscordClientService // Discord基盤サービス
    // DiscordUIService は CharacterUIService に移行されました
    // DiscordIntegrationService, // 廃止済み - イベント駆動アーキテクチャに移行
  ],
  exports: [DiscordClientService]
  // DiscordUIService は CharacterUIService に移行されました
  // exports: [DiscordClientService, DiscordUIService, DiscordIntegrationService] // 廃止済み
})
export class DiscordIntegrationModule {}
