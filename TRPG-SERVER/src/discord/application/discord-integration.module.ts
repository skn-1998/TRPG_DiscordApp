import { Module, forwardRef } from '@nestjs/common'
import { SharedModule } from 'src/shared/shared.module'
import { CharacterModule } from 'src/domains/character/character.module'
import { DiscordIntegrationService } from './discord-integration.service'
import { DiscordUIService } from '../services/discord-ui.service'
import { DiscordClientService } from '../services/discord-client.service'

/**
 * Discord Integration Module
 *
 * DiscordIntegrationServiceとその依存関係のみを管理する独立モジュール
 * - CharacterEditModuleなどから必要に応じてインポート
 * - DiscordModuleへの循環依存を避ける
 * - 最小限の依存関係で提供
 * - AppConfigServiceはグローバルモジュールのため、インポート不要
 */
@Module({
  imports: [
    SharedModule, // EventBusService用
    forwardRef(() => CharacterModule) // Character関連のドメインサービス用
    // Note: AppConfigServiceはグローバルモジュールのためインポート不要
  ],
  providers: [
    DiscordClientService, // DiscordUIServiceが依存
    DiscordUIService, // DiscordIntegrationServiceが依存
    DiscordIntegrationService
  ],
  exports: [DiscordClientService, DiscordUIService, DiscordIntegrationService]
})
export class DiscordIntegrationModule {}
