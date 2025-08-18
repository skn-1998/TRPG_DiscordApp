import { Module } from '@nestjs/common'
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
import { DiceRollModule } from 'src/domains/dice-roll/dice-roll.module'
import { DiceRollPaginationService } from '../components/pagination/dice-roll-pagination.service'
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
import { SharedModule } from '../../shared/shared.module'
import { CharacterThreadFeatureModule } from '../features/characterThread/character-thread-feature.module'
import { CharacterModule } from '../../domains/character/character.module'
import { CustomDiceModalService } from './modal/custom-dice-modal.service'
import { FlexibleDiceCalculatorService } from '../services/flexible-dice-calculator.service'
import { PresetDiceHandlerService } from '../services/preset-dice-handler.service'
import { DiceCalculationHandlerService } from '../services/dice-calculation-handler.service'
import { DiceNotationHandlerService } from '../services/dice-notation-handler.service'

// Character Edit Modules
import { CharacterEditModule } from '../features/characterEdit/character-edit.module'

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
 * 🚫 対象外:
 * - アプリケーション全体のイベント統合 → Global Events 層
 * - 機能固有のイベント処理 → Feature Events 層
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
    InteractionsService,
    DiceButtonService,
    InteractionsController,
    CharacterDiceButtonsService,
    // 新しい分割サービス
    DiceButtonUIService,
    DiceRollLogicService,
    DiceHistoryService,
    CharacterDiceOrchestratorService,
    // 既存サービス
    DiceRollChannelCreateService,
    CharacterChannelCreateService,
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
    FlexibleDiceCalculatorService,
    PresetDiceHandlerService,
    DiceCalculationHandlerService,
    DiceNotationHandlerService
  ],
  exports: [
    InteractionsService,
    DiceButtonService,
    CharacterDiceButtonsService,
    // 新しい分割サービス
    DiceButtonUIService,
    DiceRollLogicService,
    DiceHistoryService,
    CharacterDiceOrchestratorService,
    // 既存サービス
    DiceRollChannelCreateService,
    CharacterChannelCreateService,
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
    FlexibleDiceCalculatorService,
    PresetDiceHandlerService,
    DiceCalculationHandlerService,
    DiceNotationHandlerService
  ],
  imports: [
    DiceRollModule,
    EventEmitterModule,
    CharacterEditModule, // Modern Services + Legacy Services (統合)
    SharedModule, // TypedEventService用
    CharacterThreadFeatureModule,
    CharacterModule // CharacterService用
  ]
})
export class InteractionsModule {}
