import { Module, forwardRef } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { DiscordService } from './discord.service'
import { DiscordFacadeService } from './discord-facade.service'
import { InteractionsModule } from './interactions/interactions.module'
import { CommandsModule } from './commands/commands.module'
import { CommandManagerService } from './services/command-manager.service'
import { DiscordCommandRegistrationService } from './services/discord-command-registration.service'
import { DiscordInteractionHandlerService } from './services/discord-interaction-handler.service'
import { DiscordGuildManagerService } from './services/discord-guild-manager.service'
import { DiscordChannelManagerService } from './services/discord-channel-manager.service'
import { MessageManagerService, ChannelCacheService, ChannelCreatorService } from './services/channel'
import { PerformanceOrchestratorService } from './services/monitoring/performance-orchestrator.service'
import { MetricsCollectorService } from './services/monitoring/metrics-collector.service'
import { AlertManagerService } from './services/monitoring/alert-manager.service'
import { DiscordMonitorService } from './services/monitoring/discord-monitor.service'
import { AuthModule } from '../domains/auth/auth.module'
import { DiscordController } from './discord.controller'
import { PerformanceDashboardController } from './controllers/performance-dashboard.controller'
import { DiscordIntegrationModule } from './application/discord-integration.module'
import { CharacterModule } from '../domains/character/character.module'
import { DiscordEventHandlersModule } from './events/discord-event-handlers.module'

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(), // パフォーマンス監視の定期実行用
    forwardRef(() => InteractionsModule),
    CommandsModule,
    AuthModule,
    CharacterModule, // DiscordControllerでCharacterServiceが必要
    DiscordIntegrationModule, // DiscordIntegrationServiceとその依存関係
    DiscordEventHandlersModule // Discord UI を更新する完了系イベントハンドラー（events 層から移設）
  ],
  controllers: [DiscordController, PerformanceDashboardController],
  providers: [
    // 新しいアーキテクチャ（推奨）
    DiscordFacadeService,
    DiscordInteractionHandlerService,
    DiscordGuildManagerService,
    DiscordChannelManagerService,
    // チャンネル管理専門サービス（分割結果）
    MessageManagerService,
    ChannelCacheService,
    ChannelCreatorService,

    // 統合された監視系
    PerformanceOrchestratorService,
    MetricsCollectorService,
    AlertManagerService,
    DiscordMonitorService,

    // 後方互換性のために保持
    DiscordService,
    CommandManagerService,
    DiscordCommandRegistrationService
    // Note: DiscordClientService, DiscordUIService は
    // DiscordIntegrationModule で提供されるため削除
    // DiscordIntegrationService は廃止済み（イベント駆動アーキテクチャに移行）
  ],
  exports: [
    // 新しいアーキテクチャ（推奨）
    DiscordFacadeService,
    DiscordInteractionHandlerService,
    DiscordGuildManagerService,
    DiscordChannelManagerService,

    // チャンネル管理専門サービス（分割結果）
    MessageManagerService,
    ChannelCacheService,
    ChannelCreatorService,

    // 統合された監視系
    PerformanceOrchestratorService,
    MetricsCollectorService,
    AlertManagerService,
    DiscordMonitorService,

    // 後方互換性のために保持
    DiscordService,
    CommandManagerService,
    DiscordIntegrationModule // 他のモジュールがDiscord基盤サービスを使用できるように
  ]
})
export class DiscordModule {}
