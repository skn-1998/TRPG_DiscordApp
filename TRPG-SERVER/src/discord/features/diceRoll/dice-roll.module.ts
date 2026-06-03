import { Module, OnModuleInit } from '@nestjs/common'
import { RollDiceOrchestrator } from './services/roll-dice.orchestrator'
import { DiceResultOrchestrator } from './services/dice-result.orchestrator'
import { InteractionsModule } from '../../interactions/interactions.module'
import { InteractionRegistryModule } from '../../interactions/registry/interaction-registry.module'
import { InteractionRegistryService } from '../../interactions/registry/interaction-registry.service'
import { DiceRollPaginationModule } from './services/pagination/dice-roll-pagination.module'
import { DicePagePrevButtonService } from './adapters/dice-page-prev-button.adapter'
import { DicePageNextButtonService } from './adapters/dice-page-next-button.adapter'
import { DicePageSelectMenuService } from './adapters/dice-page-select-menu.adapter'
import { DicePageFirstButtonService } from './adapters/dice-page-first-button.adapter'
import { DicePageLastButtonService } from './adapters/dice-page-last-button.adapter'
import { DicePageCancelButtonService } from './adapters/dice-page-cancel-button.adapter'
import { DiceCharacterSelectService } from './adapters/dice-character-select.adapter'
import { DiceButtonService } from './adapters/dice-button.adapter'

// 🆕 Interaction Handlers - Dice Roll 系（interactions core から diceRoll feature へ移管）
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

/**
 * Dice Roll Feature Module
 *
 * 🎯 責務: ダイスロール機能の Discord インタラクション処理を feature として所有する。
 *
 * 🏗️ 構造課題③（ARCHITECTURE §8 / §5.3）:
 * - diceRoll の handler 12 個・adapter・pagination を feature 配下で所有する。
 * - InteractionsModule は diceRoll の handler/adapter/pagination を import/provide しない
 *   （= feature module を import しない向きへ是正）。
 * - feature 側が InteractionRegistryService を import し、自身の handler を登録する。
 *
 * 📋 import 構成:
 * - InteractionRegistryModule: handler を registry へ登録するため。
 * - DiceRollPaginationModule: adapter が DiceRollPaginationService を解決するため。
 * - InteractionsModule: handler の委譲先 CharacterDiceOrchestratorService / CustomDiceModalService
 *   （interactions core 所有のダイス実行・モーダルサービス）を解決するため。
 *   ※ この依存は DiceRollFeatureModule → InteractionsModule の一方向であり、
 *     InteractionsModule は DiceRollFeatureModule を import しないため循環は発生しない。
 */
@Module({
  imports: [InteractionsModule, InteractionRegistryModule, DiceRollPaginationModule],
  providers: [
    RollDiceOrchestrator,
    DiceResultOrchestrator,
    DicePagePrevButtonService,
    DicePageNextButtonService,
    DicePageSelectMenuService,
    DicePageFirstButtonService,
    DicePageLastButtonService,
    DicePageCancelButtonService,
    DiceCharacterSelectService,
    DiceButtonService,
    // 🆕 Dice Roll Interaction Handlers
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
    DiceRollModalHandler
  ],
  exports: [
    RollDiceOrchestrator,
    DiceResultOrchestrator,
    DicePagePrevButtonService,
    DicePageNextButtonService,
    DicePageSelectMenuService,
    DicePageFirstButtonService,
    DicePageLastButtonService,
    DicePageCancelButtonService,
    DiceCharacterSelectService,
    DiceButtonService
  ]
})
export class DiceRollFeatureModule implements OnModuleInit {
  constructor(
    private readonly interactionRegistry: InteractionRegistryService,
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
    private readonly diceRollModalHandler: DiceRollModalHandler
  ) {}

  /**
   * モジュール初期化時に diceRoll handler を Registry へ登録する。
   * （旧: InteractionsModule.onModuleInit で集中登録していたものを feature 側へ移管）
   */
  onModuleInit(): void {
    this.interactionRegistry.registerHandlers([
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
      this.diceRollModalHandler
    ])
  }
}
