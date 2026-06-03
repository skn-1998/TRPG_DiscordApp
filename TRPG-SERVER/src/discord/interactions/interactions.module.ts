import { Module, OnModuleInit } from '@nestjs/common'
import { InteractionsController } from './interactions.controller'
import { InteractionsService } from './interactions.service'
import { CharacterDiceButtonsService } from './button/character-dice-buttons.service'
import { DiceRollModule } from '../../domains/dice-roll/dice-roll.module'
import { DiceRollPaginationModule } from '../features/diceRoll/services/pagination/dice-roll-pagination.module'
import { CharacterThreadSelectService } from './select/character-thread-select.service'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { CharacterThreadFeatureModule } from '../features/characterThread/character-thread-feature.module'
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
import { InteractionRegistryService } from './registry/interaction-registry.service'
import { InteractionRegistryModule } from './registry/interaction-registry.module'

// 🆕 Interaction Handlers - Character Thread系
import { CharacterThreadSelectHandler } from './handlers/character-thread/character-thread-select.handler'
import { CharacterThreadCreateHandler } from './handlers/character-thread/character-thread-create.handler'
import { CharacterTabHandler } from './handlers/character-thread/character-tab.handler'
import { FlexibleDiceParamHandler } from './handlers/character-thread/flexible-dice-param.handler'
import { CharacterDiceHandler } from './handlers/character-thread/character-dice.handler'
import { DiceGenericHandler } from './handlers/character-thread/dice-generic.handler'
import { FlexibleDiceSelectHandler } from './handlers/character-thread/flexible-dice-select.handler'

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
    // 🆕 Interaction Handlers - Character Thread系
    CharacterThreadSelectHandler,
    CharacterThreadCreateHandler,
    CharacterTabHandler,
    FlexibleDiceParamHandler,
    CharacterDiceHandler,
    DiceGenericHandler,
    FlexibleDiceSelectHandler,

    // 既存サービス（ハンドラーから委譲先として使用）
    InteractionsService,
    InteractionsController,
    CharacterDiceButtonsService,
    CharacterThreadSelectService,
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
    CharacterDiceButtonsService,
    CharacterThreadSelectService,
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
    DiceRollPaginationModule, // button 系サービスが DiceRollPaginationService を解決するため
    DiceRollModule,
    EventEmitterModule,
    CharacterEditModule, // InteractionsService が CharacterUIService/CharacterSectionEditorService を解決するため
    CharacterThreadFeatureModule,
    CharacterModule // CharacterService用
  ]
})
export class InteractionsModule implements OnModuleInit {
  constructor(
    private readonly interactionRegistry: InteractionRegistryService,
    // Character Thread Handlers
    private readonly characterThreadSelectHandler: CharacterThreadSelectHandler,
    private readonly characterThreadCreateHandler: CharacterThreadCreateHandler,
    private readonly characterTabHandler: CharacterTabHandler,
    private readonly flexibleDiceParamHandler: FlexibleDiceParamHandler,
    private readonly characterDiceHandler: CharacterDiceHandler,
    private readonly diceGenericHandler: DiceGenericHandler,
    private readonly flexibleDiceSelectHandler: FlexibleDiceSelectHandler
  ) {}

  /**
   * モジュール初期化時にハンドラーを登録
   */
  onModuleInit(): void {
    // 全ハンドラーをRegistryに登録
    this.interactionRegistry.registerHandlers([
      // Character Thread Handlers
      this.characterThreadSelectHandler,
      this.characterThreadCreateHandler,
      this.characterTabHandler,
      this.flexibleDiceParamHandler,
      this.characterDiceHandler,
      this.diceGenericHandler,
      this.flexibleDiceSelectHandler
    ])
  }
}
