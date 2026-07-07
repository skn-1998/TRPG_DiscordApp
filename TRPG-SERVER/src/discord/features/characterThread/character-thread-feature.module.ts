import { Module, OnModuleInit } from '@nestjs/common'
import { CharacterModule } from '../../../domains/character/character.module'
import { DiscordIntegrationModule } from '../../application/discord-integration.module'
import { ThreadCreationService } from './services/thread-creation.service'
import { CharacterThreadOrchestrator } from './services/character-thread.orchestrator'
import { CharacterDisplayService } from './services/character-display.service'
import { CharacterTabButtonsService } from './character-tab-buttons.service'
import { CharacterDisplayHandlerService } from './services/character-display-handler.service'
// 新しい分割サービス
import { ChannelManagerService } from './services/channel-manager.service'
import { CharacterEmbedService } from './services/character-embed.service'
import { ThreadOrchestratorService } from './services/thread-orchestrator.service'
import { ThreadManagerService } from './services/thread-manager.service'
import { ThreadInteractionService } from './services/thread-interaction.service'

// 🆕 Interaction Registry & Services（interactions core から feature 所有へ移管・§8 / 構造課題③ Part B）
import { DiceServicesModule } from '../../services/dice/dice-services.module'
import { InteractionRegistryModule } from '../../interactions/registry/interaction-registry.module'
import { InteractionRegistryService } from '../../interactions/registry/interaction-registry.service'
import { CharacterThreadSelectService } from './services/character-thread-select.service'

// 🆕 Interaction Handlers - Character Thread 系（registry 登録対象・interactions core から移管）
import { CharacterThreadSelectHandler } from './handlers/character-thread-select.handler'
import { CharacterThreadCreateHandler } from './handlers/character-thread-create.handler'
import { CharacterTabHandler } from './handlers/character-tab.handler'
import { FlexibleDiceParamHandler } from './handlers/flexible-dice-param.handler'
import { DiceGenericHandler } from './handlers/dice-generic.handler'
import { FlexibleDiceSelectHandler } from './handlers/flexible-dice-select.handler'
// P1-D slice2: 未routing だった skill_ ボタンを配線（latent bug 修正）
import { CharacterSkillRollHandler } from './handlers/character-skill-roll.handler'
// S-3: 能力(ability)ロール handler 新設（skill_ と完全同型・ability_{channelId}_{abilityKey}）
import { AbilityRollHandler } from './handlers/ability-roll.handler'
// P1-D 後続: 未routing だった dice_{coc7,dnd5e,sw25}_ preset ボタンを配線（方針A・最小機能化）
import { PresetDiceQuickRollHandler } from './handlers/preset-dice-quick-roll.handler'

/**
 * Character Thread Feature Module
 *
 * 🏗️ 構造課題③ Part B（ARCHITECTURE §8）:
 * - characterThread の Discord インタラクション handler と専用サービス（CharacterThreadSelectService 等）を
 *   feature 所有へ移管（移管当時は character-dice* クラスタも含んでいたが S-5c で dead として撤去・後述）。
 * - diceRoll / characterEdit と同方式で、feature 側が InteractionRegistryService を import し、
 *   onModuleInit で自身の handler を登録する。InteractionsModule への依存（CharacterThreadFeatureModule import）を撤去。
 *
 * 📋 import 構成:
 * - CharacterModule: 各サービスが CharacterService を解決するため。
 * - DiscordIntegrationModule: 既存（P1-B で forwardRef 解消・循環なし）。
 * - InteractionRegistryModule: handler を registry へ登録するため。
 * - DiceServicesModule: dice-generic / flexible-dice-select / skill / ability / preset-quick handler が
 *   DiceRollLogicService を解決するため。
 *   （TypedEventService / TypedEventEmitter は core-events @Global のため import 不要）
 *
 * 🔧 S-5c: CharacterDiceHandler と委譲先 CharacterDiceButtonsService / CharacterDiceHistoryService
 *    （旧 character-dice* 生成元消滅により dead 化）を撤去。これに伴い両 dead サービス専用だった
 *    DiceRollModule(domains) / DiceRollPaginationModule の import も除去（live handler は
 *    DiceServicesModule のみで解決可能）。
 */
@Module({
  imports: [
    CharacterModule,
    DiscordIntegrationModule, // DiscordIntegrationModule は characterThread を import しない＝循環なしのため forwardRef 不要（P1-B）
    InteractionRegistryModule,
    DiceServicesModule
  ],
  providers: [
    ThreadCreationService,
    CharacterThreadOrchestrator,
    CharacterDisplayService, // CharacterTabButtonsServiceより先に定義
    CharacterDisplayHandlerService,
    CharacterTabButtonsService,
    // 新しい分割サービス
    ChannelManagerService,
    CharacterEmbedService,
    ThreadOrchestratorService,
    ThreadManagerService,
    ThreadInteractionService,
    // 🆕 Interaction Services（handler の委譲先・interactions core から移管）
    CharacterThreadSelectService,
    // 🆕 Interaction Handlers（registry 登録対象・interactions core から移管）
    CharacterThreadSelectHandler,
    CharacterThreadCreateHandler,
    CharacterTabHandler,
    FlexibleDiceParamHandler,
    DiceGenericHandler,
    FlexibleDiceSelectHandler,
    CharacterSkillRollHandler,
    AbilityRollHandler,
    PresetDiceQuickRollHandler
  ],
  exports: [
    ThreadCreationService,
    CharacterThreadOrchestrator,
    CharacterDisplayService,
    CharacterDisplayHandlerService,
    CharacterTabButtonsService,
    // 新しい分割サービス
    ChannelManagerService,
    CharacterEmbedService,
    ThreadOrchestratorService,
    ThreadManagerService,
    ThreadInteractionService,
    // 🆕 Interaction Services
    CharacterThreadSelectService
  ]
})
export class CharacterThreadFeatureModule implements OnModuleInit {
  constructor(
    private readonly interactionRegistry: InteractionRegistryService,
    private readonly characterThreadSelectHandler: CharacterThreadSelectHandler,
    private readonly characterThreadCreateHandler: CharacterThreadCreateHandler,
    private readonly characterTabHandler: CharacterTabHandler,
    private readonly flexibleDiceParamHandler: FlexibleDiceParamHandler,
    private readonly diceGenericHandler: DiceGenericHandler,
    private readonly flexibleDiceSelectHandler: FlexibleDiceSelectHandler,
    private readonly characterSkillRollHandler: CharacterSkillRollHandler,
    private readonly abilityRollHandler: AbilityRollHandler,
    private readonly presetDiceQuickRollHandler: PresetDiceQuickRollHandler
  ) {}

  /**
   * モジュール初期化時に characterThread handler を Registry へ登録する。
   * （旧: InteractionsModule.onModuleInit で集中登録していたものを feature 側へ移管・§8 / 構造課題③ Part B）
   */
  onModuleInit(): void {
    this.interactionRegistry.registerHandlers([
      this.characterThreadSelectHandler,
      this.characterThreadCreateHandler,
      this.characterTabHandler,
      this.flexibleDiceParamHandler,
      this.diceGenericHandler,
      this.flexibleDiceSelectHandler,
      this.characterSkillRollHandler,
      this.abilityRollHandler,
      this.presetDiceQuickRollHandler
    ])
  }
}
