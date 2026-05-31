import { Module, OnModuleInit } from '@nestjs/common'
import { InteractionsController } from './interactions.controller'
import { InteractionsService } from './interactions.service'
import { CharacterDiceButtonsService } from './button/character-dice-buttons.service'
// 新しい分割サービス
import { DiceButtonUIService } from './button/dice-button-ui.service'
import { DiceRollLogicService } from './button/dice-roll-logic.service'
import { DiceHistoryService } from './button/dice-history.service'
import { CharacterDiceOrchestratorService } from './button/character-dice-orchestrator.service'
import { DiceRollChannelCreateService } from './channel/diceroll-channel-create.service'
import { CharacterChannelCreateService } from './channel/character-channel-create.service'
import { DiceRollModule } from '../../domains/dice-roll/dice-roll.module'
import { DiceRollPaginationService } from '../components/pagination/dice-roll-pagination.service'
import { DiceRollCharacterProviderService } from '../components/pagination/dice-roll-character-provider.service'
import { DicePagePrevButtonService } from '../features/diceRoll/adapters/dice-page-prev-button.adapter'
import { DicePageNextButtonService } from '../features/diceRoll/adapters/dice-page-next-button.adapter'
import { DicePageSelectMenuService } from '../features/diceRoll/adapters/dice-page-select-menu.adapter'
import { CharacterThreadSelectService } from './select/character-thread-select.service'
import { DicePageFirstButtonService } from '../features/diceRoll/adapters/dice-page-first-button.adapter'
import { DicePageLastButtonService } from '../features/diceRoll/adapters/dice-page-last-button.adapter'
import { DicePageCancelButtonService } from '../features/diceRoll/adapters/dice-page-cancel-button.adapter'
import { DiceCharacterSelectService } from '../features/diceRoll/adapters/dice-character-select.adapter'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { DiceButtonService } from '../features/diceRoll/adapters/dice-button.adapter'
import { CharacterThreadFeatureModule } from '../features/characterThread/character-thread-feature.module'
import { CharacterModule } from '../../domains/character/character.module'
import { CustomDiceModalService } from './modal/custom-dice-modal.service'
// 新しい統合されたダイスサービス
import { DiceOrchestratorService } from '../services/dice/dice-orchestrator.service'
import { DiceCalculationService } from '../services/dice/dice-calculation.service'
import { DiceParserService } from '../services/dice/dice-parser.service'
import { DicePresetService } from '../services/dice/dice-preset.service'

// 統合された監視サービス
import { PerformanceOrchestratorService } from '../services/monitoring/performance-orchestrator.service'
import { MetricsCollectorService } from '../services/monitoring/metrics-collector.service'
import { AlertManagerService } from '../services/monitoring/alert-manager.service'
import { DiscordMonitorService } from '../services/monitoring/discord-monitor.service'

// Character Edit Modules
import { CharacterEditModule } from '../features/characterEdit/character-edit.module'

// 🆕 Interaction Registry (Events方式の自動ルーティング)
import { InteractionRegistryService } from './registry/interaction-registry.service'
import { PatternMatcherService } from './registry/pattern-matcher.service'

// 🆕 Interaction Handlers - Character Edit系
import { CharacterEditRefreshHandler } from './handlers/character-edit/character-edit-refresh.handler'
import { CharacterEditCreateHandler } from './handlers/character-edit/character-edit-create.handler'
import { CharacterEditCompactHandler } from './handlers/character-edit/character-edit-compact.handler'
import { CharacterEditSectionHandler } from './handlers/character-edit/character-edit-section.handler'
import { CharacterEditFieldHandler } from './handlers/character-edit/character-edit-field.handler'
import { CharacterEditModalHandler } from './handlers/character-edit/character-edit-modal.handler'

// 🆕 Interaction Handlers - Dice Roll系
import { DicePagePrevHandler } from './handlers/dice-roll/dice-page-prev.handler'
import { DicePageNextHandler } from './handlers/dice-roll/dice-page-next.handler'
import { DicePageFirstHandler } from './handlers/dice-roll/dice-page-first.handler'
import { DicePageLastHandler } from './handlers/dice-roll/dice-page-last.handler'
import { DicePageCancelHandler } from './handlers/dice-roll/dice-page-cancel.handler'
import { DicePageSelectHandler } from './handlers/dice-roll/dice-page-select.handler'
import { DiceCharacterSelectHandler } from './handlers/dice-roll/dice-character-select.handler'
import { DiceRollSkillHandler } from './handlers/dice-roll/dice-roll-skill.handler'
import { DiceRollGeneralHandler } from './handlers/dice-roll/dice-roll-general.handler'
import { DiceRollCustomHandler } from './handlers/dice-roll/dice-roll-custom.handler'
import { DiceRollPresetHandler } from './handlers/dice-roll/dice-roll-preset.handler'
import { DiceRollModalHandler } from './handlers/dice-roll/dice-roll-modal.handler'

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
    // 🆕 Registry Services
    InteractionRegistryService,
    PatternMatcherService,

    // 🆕 Interaction Handlers - Character Edit系
    CharacterEditRefreshHandler,
    CharacterEditCreateHandler,
    CharacterEditCompactHandler,
    CharacterEditSectionHandler,
    CharacterEditFieldHandler,
    CharacterEditModalHandler,

    // 🆕 Interaction Handlers - Dice Roll系
    DicePagePrevHandler,
    DicePageNextHandler,
    DicePageFirstHandler,
    DicePageLastHandler,
    DicePageCancelHandler,
    DicePageSelectHandler,
    DiceCharacterSelectHandler,
    DiceRollSkillHandler,
    DiceRollGeneralHandler,
    DiceRollCustomHandler,
    DiceRollPresetHandler,
    DiceRollModalHandler,

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
    DiceButtonService,
    InteractionsController,
    CharacterDiceButtonsService,
    DiceButtonUIService,
    DiceRollLogicService,
    DiceHistoryService,
    CharacterDiceOrchestratorService,
    DiceRollChannelCreateService,
    CharacterChannelCreateService,
    DiceRollCharacterProviderService,
    DiceRollPaginationService,
    DicePagePrevButtonService,
    DicePageNextButtonService,
    DicePageFirstButtonService,
    DicePageLastButtonService,
    DicePageCancelButtonService,
    DiceCharacterSelectService,
    CharacterThreadSelectService,
    DicePageSelectMenuService,
    CustomDiceModalService,
    // 統合されたダイスサービス
    DiceOrchestratorService,
    DiceCalculationService,
    DiceParserService,
    DicePresetService,
    // 統合された監視サービス
    PerformanceOrchestratorService,
    MetricsCollectorService,
    AlertManagerService,
    DiscordMonitorService
  ],
  exports: [
    // 🆕 Registry Services
    InteractionRegistryService,
    PatternMatcherService,

    // 既存サービス
    InteractionsService,
    DiceButtonService,
    CharacterDiceButtonsService,
    DiceButtonUIService,
    DiceRollLogicService,
    DiceHistoryService,
    CharacterDiceOrchestratorService,
    DiceRollChannelCreateService,
    CharacterChannelCreateService,
    DiceRollCharacterProviderService,
    DiceRollPaginationService,
    DicePagePrevButtonService,
    DicePageNextButtonService,
    DicePageFirstButtonService,
    DicePageLastButtonService,
    DicePageCancelButtonService,
    DiceCharacterSelectService,
    CharacterThreadSelectService,
    DicePageSelectMenuService,
    CustomDiceModalService,
    // 統合されたダイスサービス
    DiceOrchestratorService,
    DiceCalculationService,
    DiceParserService,
    DicePresetService,
    // 統合された監視サービス
    PerformanceOrchestratorService,
    MetricsCollectorService,
    AlertManagerService,
    DiscordMonitorService
  ],
  imports: [
    DiceRollModule,
    EventEmitterModule,
    CharacterEditModule, // Modern Services + Legacy Services (統合)
    CharacterThreadFeatureModule,
    CharacterModule // CharacterService用
  ]
})
export class InteractionsModule implements OnModuleInit {
  constructor(
    private readonly interactionRegistry: InteractionRegistryService,
    // Character Edit Handlers
    private readonly characterEditRefreshHandler: CharacterEditRefreshHandler,
    private readonly characterEditCreateHandler: CharacterEditCreateHandler,
    private readonly characterEditCompactHandler: CharacterEditCompactHandler,
    private readonly characterEditSectionHandler: CharacterEditSectionHandler,
    private readonly characterEditFieldHandler: CharacterEditFieldHandler,
    private readonly characterEditModalHandler: CharacterEditModalHandler,
    // Dice Roll Handlers
    private readonly dicePagePrevHandler: DicePagePrevHandler,
    private readonly dicePageNextHandler: DicePageNextHandler,
    private readonly dicePageFirstHandler: DicePageFirstHandler,
    private readonly dicePageLastHandler: DicePageLastHandler,
    private readonly dicePageCancelHandler: DicePageCancelHandler,
    private readonly dicePageSelectHandler: DicePageSelectHandler,
    private readonly diceCharacterSelectHandler: DiceCharacterSelectHandler,
    private readonly diceRollSkillHandler: DiceRollSkillHandler,
    private readonly diceRollGeneralHandler: DiceRollGeneralHandler,
    private readonly diceRollCustomHandler: DiceRollCustomHandler,
    private readonly diceRollPresetHandler: DiceRollPresetHandler,
    private readonly diceRollModalHandler: DiceRollModalHandler,
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
      // Character Edit Handlers
      this.characterEditRefreshHandler,
      this.characterEditCreateHandler,
      this.characterEditCompactHandler,
      this.characterEditSectionHandler,
      this.characterEditFieldHandler,
      this.characterEditModalHandler,
      // Dice Roll Handlers
      this.dicePagePrevHandler,
      this.dicePageNextHandler,
      this.dicePageFirstHandler,
      this.dicePageLastHandler,
      this.dicePageCancelHandler,
      this.dicePageSelectHandler,
      this.diceCharacterSelectHandler,
      this.diceRollSkillHandler,
      this.diceRollGeneralHandler,
      this.diceRollCustomHandler,
      this.diceRollPresetHandler,
      this.diceRollModalHandler,
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
