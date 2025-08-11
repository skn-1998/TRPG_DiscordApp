import { Module, forwardRef } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { DiscordService } from './discord.service'
import { DiscordFacadeService } from './discord-facade.service'
import { EventsModule } from './events/events.module'
import { CommandsModule } from './commands/commands.module'
import { CommandManagerService } from './services/command-manager.service'
import { DiscordCommandRegistrationService } from './services/discord-command-registration.service'
import { DiscordInteractionHandlerService } from './services/discord-interaction-handler.service'
import { DiscordGuildManagerService } from './services/discord-guild-manager.service'
import { DiscordChannelManagerService } from './services/discord-channel-manager.service'
import { DiscordPerformanceMonitorService } from './services/discord-performance-monitor.service'
import { PerformanceMetricsIntegrationService } from './services/performance-metrics-integration.service'
import { AlertSystemService } from './services/alert-system.service'
import { AuthModule } from '../domains/auth/auth.module'
import { DiscordController } from './discord.controller'
import { PerformanceDashboardController } from './controllers/performance-dashboard.controller'
import { SharedModule } from '../shared/shared.module'
import { DiscordIntegrationModule } from './application/discord-integration.module'
import { CharacterModule } from '../domains/character/character.module'

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(), // パフォーマンス監視の定期実行用
    SharedModule,
    forwardRef(() => EventsModule),
    CommandsModule,
    AuthModule,
    CharacterModule, // DiscordControllerでCharacterServiceが必要
    DiscordIntegrationModule // DiscordIntegrationServiceとその依存関係
  ],
  controllers: [DiscordController, PerformanceDashboardController],
  providers: [
    // 新しいアーキテクチャ（推奨）
    DiscordFacadeService,
    DiscordInteractionHandlerService,
    DiscordGuildManagerService,
    DiscordChannelManagerService,
    DiscordPerformanceMonitorService,

    // パフォーマンス監視系
    PerformanceMetricsIntegrationService,
    AlertSystemService,

    // 後方互換性のために保持
    DiscordService,
    CommandManagerService,
    DiscordCommandRegistrationService
    // Note: DiscordClientService, DiscordUIService, DiscordIntegrationService は
    // DiscordIntegrationModule で提供されるため削除
  ],
  exports: [
    // 新しいアーキテクチャ（推奨）
    DiscordFacadeService,
    DiscordInteractionHandlerService,
    DiscordGuildManagerService,
    DiscordChannelManagerService,
    DiscordPerformanceMonitorService,

    // パフォーマンス監視系
    PerformanceMetricsIntegrationService,
    AlertSystemService,

    // 後方互換性のために保持
    DiscordService,
    CommandManagerService,
    DiscordIntegrationModule // 他のモジュールがDiscordIntegrationServiceを使用できるように
  ]
})
export class DiscordModule {}
