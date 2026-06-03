import { Module } from '@nestjs/common'
import { InteractionsController } from './interactions.controller'
import { InteractionsService } from './interactions.service'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { CharacterModule } from '../../domains/character/character.module'
// dice 計算・ロジック系（DiceRollLogic/Orchestrator/Calculation/Parser/Preset）は DiceServicesModule が所有
import { DiceServicesModule } from '../services/dice/dice-services.module'
// characterEdit feature module: handler は feature 所有へ移管済みだが、InteractionsService が
// CharacterUIService / CharacterSectionEditorService を inject するため import は維持（§8 完全是正は別課題）
import { CharacterEditModule } from '../features/characterEdit/character-edit.module'

// 統合された監視サービス
import { PerformanceOrchestratorService } from '../services/monitoring/performance-orchestrator.service'
import { MetricsCollectorService } from '../services/monitoring/metrics-collector.service'
import { AlertManagerService } from '../services/monitoring/alert-manager.service'
import { DiscordMonitorService } from '../services/monitoring/discord-monitor.service'

// 🆕 Interaction Registry (Events方式の自動ルーティング)
import { InteractionRegistryModule } from './registry/interaction-registry.module'

/**
 * Discord Interactions Module
 *
 * 🎯 目的: Discord.js インタラクション処理の統合管理
 *
 * 📋 責務:
 * - Discord.js ボタンインタラクション処理
 * - Discord.js モーダルインタラクション処理
 * - Discord.js セレクトメニューインタラクション処理
 * - Discord チャンネル作成イベント処理
 * - Discord インタラクションの統一的なエラーハンドリング
 *
 * 🆕 Registry方式（Events方式と統一）:
 * - InteractionRegistryService による自動ルーティング
 * - ファイル名 = customIdパターン で管理
 * - if文による分岐を廃止
 *
 * 🏗️ 構造課題③（ARCHITECTURE §8）:
 * - diceRoll / characterEdit / characterThread の handler は各 feature 所有へ移管済み。
 *   各 feature module が onModuleInit で自身の handler を registry 登録する。
 * - これにより interactions core は feature module（CharacterThreadFeatureModule 等）を import しない。
 *
 * 🏗️ 位置づけ:
 * Global Events (/events)
 * ├── Discord Interactions (このモジュール)
 * │   └── Discord.js インタラクション処理
 * └── Feature Events (/discord/features/[feature]/events)
 *     └── 機能固有のイベント処理
 */
@Module({
  controllers: [InteractionsController],
  providers: [
    // 既存サービス（ハンドラーから委譲先として使用）
    InteractionsService,
    InteractionsController,
    // 統合された監視サービス
    PerformanceOrchestratorService,
    MetricsCollectorService,
    AlertManagerService,
    DiscordMonitorService
  ],
  exports: [
    // 🆕 Registry Services（InteractionRegistryModule からの re-export）
    InteractionRegistryModule,

    // 既存サービス
    InteractionsService,
    // dice 計算・ロジック系は DiceServicesModule を re-export して下流（feature 等）へ供給
    DiceServicesModule,
    // 統合された監視サービス
    PerformanceOrchestratorService,
    MetricsCollectorService,
    AlertManagerService,
    DiscordMonitorService
  ],
  imports: [
    InteractionRegistryModule,
    DiceServicesModule, // dice 計算・ロジック系（旧 interactions ad-hoc provide を集約・§5.3 是正）
    EventEmitterModule,
    CharacterEditModule, // InteractionsService が CharacterUIService/CharacterSectionEditorService を解決するため
    CharacterModule // CharacterService用
  ]
})
export class InteractionsModule {}
