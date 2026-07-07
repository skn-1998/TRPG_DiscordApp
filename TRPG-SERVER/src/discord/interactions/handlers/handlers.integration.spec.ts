import { Test, TestingModule } from '@nestjs/testing'
import { InteractionRegistryService } from '../registry/interaction-registry.service'
import { PatternMatcherService } from '../registry/pattern-matcher.service'

// Character Edit Handlers
import { CharacterEditRefreshHandler } from '../../features/characterEdit/handlers/character-edit-refresh.handler'
import { CharacterEditCreateHandler } from '../../features/characterEdit/handlers/character-edit-create.handler'
import { CharacterEditCompactHandler } from '../../features/characterEdit/handlers/character-edit-compact.handler'
import { CharacterEditSectionHandler } from '../../features/characterEdit/handlers/character-edit-section.handler'
import { CharacterEditFieldHandler } from '../../features/characterEdit/handlers/character-edit-field.handler'
import { CharacterEditModalHandler } from '../../features/characterEdit/handlers/character-edit-modal.handler'

// Dice Roll Handlers（diceRoll feature へ移管済み）
import { DicePagePrevHandler } from '../../features/diceRoll/handlers/dice-roll/dice-page-prev.handler'
import { DicePageNextHandler } from '../../features/diceRoll/handlers/dice-roll/dice-page-next.handler'
import { DicePageFirstHandler } from '../../features/diceRoll/handlers/dice-roll/dice-page-first.handler'
import { DicePageLastHandler } from '../../features/diceRoll/handlers/dice-roll/dice-page-last.handler'
import { DicePageCancelHandler } from '../../features/diceRoll/handlers/dice-roll/dice-page-cancel.handler'
import { DicePageSelectHandler } from '../../features/diceRoll/handlers/dice-roll/dice-page-select.handler'
import { DiceCharacterSelectHandler } from '../../features/diceRoll/handlers/dice-roll/dice-character-select.handler'
import { DiceRollModalHandler } from '../../features/diceRoll/handlers/dice-roll/dice-roll-modal.handler'
import { DiceCharacterSelectCustomId, DicePageCustomId } from '../../features/diceRoll/custom-id'

// Character Thread Handlers（characterThread feature へ移管済み）
import { CharacterThreadSelectHandler } from '../../features/characterThread/handlers/character-thread-select.handler'
import { CharacterThreadCreateHandler } from '../../features/characterThread/handlers/character-thread-create.handler'
import { CharacterTabHandler } from '../../features/characterThread/handlers/character-tab.handler'
import { FlexibleDiceParamHandler } from '../../features/characterThread/handlers/flexible-dice-param.handler'
import { DiceGenericHandler } from '../../features/characterThread/handlers/dice-generic.handler'
import { FlexibleDiceSelectHandler } from '../../features/characterThread/handlers/flexible-dice-select.handler'
import { CharacterSkillRollHandler } from '../../features/characterThread/handlers/character-skill-roll.handler'
import { AbilityRollHandler } from '../../features/characterThread/handlers/ability-roll.handler'
import { PresetDiceQuickRollHandler } from '../../features/characterThread/handlers/preset-dice-quick-roll.handler'

// モックサービス
const mockEnhancedCharacterEditService = {
  handleButtonInteraction: jest.fn().mockResolvedValue(undefined),
  handleSelectMenuInteraction: jest.fn().mockResolvedValue(undefined),
  handleModalSubmitInteraction: jest.fn().mockResolvedValue(undefined)
}

const mockDicePagePrevButtonService = { execute: jest.fn().mockResolvedValue(undefined) }
const mockDicePageNextButtonService = { execute: jest.fn().mockResolvedValue(undefined) }
const mockDicePageFirstButtonService = { execute: jest.fn().mockResolvedValue(undefined) }
const mockDicePageLastButtonService = { execute: jest.fn().mockResolvedValue(undefined) }
const mockDicePageCancelButtonService = { execute: jest.fn().mockResolvedValue(undefined) }
const mockDicePageSelectMenuService = { execute: jest.fn().mockResolvedValue(undefined) }
const mockDiceCharacterSelectService = { execute: jest.fn().mockResolvedValue(undefined) }
const mockCustomDiceModalService = { execute: jest.fn().mockResolvedValue(undefined) }
const mockCharacterThreadSelectService = { execute: jest.fn().mockResolvedValue(undefined) }
const mockCharacterTabButtonsService = { execute: jest.fn().mockResolvedValue(undefined) }
const mockDiceRollLogicService = {
  handleDiceRoll: jest.fn().mockResolvedValue({ success: true, total: 10, details: 'test' }),
  handleSkillRoll: jest.fn().mockResolvedValue({ success: true, total: 10, details: 'test' })
}
const mockCharacterService = { findByChannelId: jest.fn().mockResolvedValue(null) }

describe('Interaction Handlers Integration', () => {
  let registry: InteractionRegistryService

  // 全ハンドラーインスタンス
  let characterEditRefreshHandler: CharacterEditRefreshHandler
  let characterEditCreateHandler: CharacterEditCreateHandler
  let characterEditCompactHandler: CharacterEditCompactHandler
  let characterEditSectionHandler: CharacterEditSectionHandler
  let characterEditFieldHandler: CharacterEditFieldHandler
  let characterEditModalHandler: CharacterEditModalHandler
  let dicePagePrevHandler: DicePagePrevHandler
  let dicePageNextHandler: DicePageNextHandler
  let dicePageFirstHandler: DicePageFirstHandler
  let dicePageLastHandler: DicePageLastHandler
  let dicePageCancelHandler: DicePageCancelHandler
  let dicePageSelectHandler: DicePageSelectHandler
  let diceCharacterSelectHandler: DiceCharacterSelectHandler
  let diceRollModalHandler: DiceRollModalHandler
  let characterThreadSelectHandler: CharacterThreadSelectHandler
  let characterThreadCreateHandler: CharacterThreadCreateHandler
  let characterTabHandler: CharacterTabHandler
  let flexibleDiceParamHandler: FlexibleDiceParamHandler
  let diceGenericHandler: DiceGenericHandler
  let flexibleDiceSelectHandler: FlexibleDiceSelectHandler
  let characterSkillRollHandler: CharacterSkillRollHandler
  let abilityRollHandler: AbilityRollHandler
  let presetDiceQuickRollHandler: PresetDiceQuickRollHandler

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InteractionRegistryService,
        PatternMatcherService,

        // Character Edit Handlers with mocked dependencies
        {
          provide: CharacterEditRefreshHandler,
          useFactory: () => {
            const handler = new (CharacterEditRefreshHandler as any)(mockEnhancedCharacterEditService)
            return handler
          }
        },
        {
          provide: CharacterEditCreateHandler,
          useFactory: () => new (CharacterEditCreateHandler as any)(mockEnhancedCharacterEditService)
        },
        {
          provide: CharacterEditCompactHandler,
          useFactory: () => new (CharacterEditCompactHandler as any)(mockEnhancedCharacterEditService)
        },
        {
          provide: CharacterEditSectionHandler,
          useFactory: () => new (CharacterEditSectionHandler as any)(mockEnhancedCharacterEditService)
        },
        {
          provide: CharacterEditFieldHandler,
          useFactory: () => new (CharacterEditFieldHandler as any)(mockEnhancedCharacterEditService)
        },
        {
          provide: CharacterEditModalHandler,
          useFactory: () => new (CharacterEditModalHandler as any)(mockEnhancedCharacterEditService)
        },

        // Dice Roll Handlers
        {
          provide: DicePagePrevHandler,
          useFactory: () => new (DicePagePrevHandler as any)(mockDicePagePrevButtonService)
        },
        {
          provide: DicePageNextHandler,
          useFactory: () => new (DicePageNextHandler as any)(mockDicePageNextButtonService)
        },
        {
          provide: DicePageFirstHandler,
          useFactory: () => new (DicePageFirstHandler as any)(mockDicePageFirstButtonService)
        },
        {
          provide: DicePageLastHandler,
          useFactory: () => new (DicePageLastHandler as any)(mockDicePageLastButtonService)
        },
        {
          provide: DicePageCancelHandler,
          useFactory: () => new (DicePageCancelHandler as any)(mockDicePageCancelButtonService)
        },
        {
          provide: DicePageSelectHandler,
          useFactory: () => new (DicePageSelectHandler as any)(mockDicePageSelectMenuService)
        },
        {
          provide: DiceCharacterSelectHandler,
          useFactory: () => new (DiceCharacterSelectHandler as any)(mockDiceCharacterSelectService)
        },
        {
          provide: DiceRollModalHandler,
          useFactory: () => new (DiceRollModalHandler as any)(mockCustomDiceModalService)
        },

        // Character Thread Handlers
        {
          provide: CharacterThreadSelectHandler,
          useFactory: () => new (CharacterThreadSelectHandler as any)(mockCharacterThreadSelectService)
        },
        {
          provide: CharacterThreadCreateHandler,
          useFactory: () => new (CharacterThreadCreateHandler as any)(mockCharacterThreadSelectService)
        },
        {
          provide: CharacterTabHandler,
          useFactory: () => new (CharacterTabHandler as any)(mockCharacterTabButtonsService)
        },
        {
          provide: FlexibleDiceParamHandler,
          useFactory: () => new (FlexibleDiceParamHandler as any)(mockCharacterThreadSelectService)
        },
        {
          provide: DiceGenericHandler,
          useFactory: () => new (DiceGenericHandler as any)(mockDiceRollLogicService)
        },
        {
          provide: FlexibleDiceSelectHandler,
          useFactory: () => new (FlexibleDiceSelectHandler as any)(mockDiceRollLogicService)
        },
        {
          provide: CharacterSkillRollHandler,
          useFactory: () => new (CharacterSkillRollHandler as any)(mockDiceRollLogicService, mockCharacterService)
        },
        {
          provide: AbilityRollHandler,
          useFactory: () => new (AbilityRollHandler as any)(mockDiceRollLogicService, mockCharacterService)
        },
        {
          provide: PresetDiceQuickRollHandler,
          useFactory: () => new (PresetDiceQuickRollHandler as any)(mockDiceRollLogicService)
        }
      ]
    }).compile()

    registry = module.get<InteractionRegistryService>(InteractionRegistryService)

    // ハンドラー取得
    characterEditRefreshHandler = module.get<CharacterEditRefreshHandler>(CharacterEditRefreshHandler)
    characterEditCreateHandler = module.get<CharacterEditCreateHandler>(CharacterEditCreateHandler)
    characterEditCompactHandler = module.get<CharacterEditCompactHandler>(CharacterEditCompactHandler)
    characterEditSectionHandler = module.get<CharacterEditSectionHandler>(CharacterEditSectionHandler)
    characterEditFieldHandler = module.get<CharacterEditFieldHandler>(CharacterEditFieldHandler)
    characterEditModalHandler = module.get<CharacterEditModalHandler>(CharacterEditModalHandler)
    dicePagePrevHandler = module.get<DicePagePrevHandler>(DicePagePrevHandler)
    dicePageNextHandler = module.get<DicePageNextHandler>(DicePageNextHandler)
    dicePageFirstHandler = module.get<DicePageFirstHandler>(DicePageFirstHandler)
    dicePageLastHandler = module.get<DicePageLastHandler>(DicePageLastHandler)
    dicePageCancelHandler = module.get<DicePageCancelHandler>(DicePageCancelHandler)
    dicePageSelectHandler = module.get<DicePageSelectHandler>(DicePageSelectHandler)
    diceCharacterSelectHandler = module.get<DiceCharacterSelectHandler>(DiceCharacterSelectHandler)
    diceRollModalHandler = module.get<DiceRollModalHandler>(DiceRollModalHandler)
    characterThreadSelectHandler = module.get<CharacterThreadSelectHandler>(CharacterThreadSelectHandler)
    characterThreadCreateHandler = module.get<CharacterThreadCreateHandler>(CharacterThreadCreateHandler)
    characterTabHandler = module.get<CharacterTabHandler>(CharacterTabHandler)
    flexibleDiceParamHandler = module.get<FlexibleDiceParamHandler>(FlexibleDiceParamHandler)
    diceGenericHandler = module.get<DiceGenericHandler>(DiceGenericHandler)
    flexibleDiceSelectHandler = module.get<FlexibleDiceSelectHandler>(FlexibleDiceSelectHandler)
    characterSkillRollHandler = module.get<CharacterSkillRollHandler>(CharacterSkillRollHandler)
    abilityRollHandler = module.get<AbilityRollHandler>(AbilityRollHandler)
    presetDiceQuickRollHandler = module.get<PresetDiceQuickRollHandler>(PresetDiceQuickRollHandler)

    // 全ハンドラーを登録
    registry.registerHandlers([
      characterEditRefreshHandler,
      characterEditCreateHandler,
      characterEditCompactHandler,
      characterEditSectionHandler,
      characterEditFieldHandler,
      characterEditModalHandler,
      dicePagePrevHandler,
      dicePageNextHandler,
      dicePageFirstHandler,
      dicePageLastHandler,
      dicePageCancelHandler,
      dicePageSelectHandler,
      diceCharacterSelectHandler,
      diceRollModalHandler,
      characterThreadSelectHandler,
      characterThreadCreateHandler,
      characterTabHandler,
      flexibleDiceParamHandler,
      diceGenericHandler,
      flexibleDiceSelectHandler,
      characterSkillRollHandler,
      abilityRollHandler,
      presetDiceQuickRollHandler
    ])
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('全ハンドラーの登録確認', () => {
    it('23個のハンドラーが登録されている', () => {
      const stats = registry.getStatistics()
      expect(stats.totalHandlers).toBe(23)
    })

    it('Character Edit系ハンドラーが6個登録されている', () => {
      const buttonHandlers = registry.getHandlersByType('button')
      const selectHandlers = registry.getHandlersByType('select')
      const modalHandlers = registry.getHandlersByType('modal')

      // Character Edit系: Button 3, Select 2, Modal 1
      const characterEditHandlers = [
        characterEditRefreshHandler,
        characterEditCreateHandler,
        characterEditCompactHandler,
        characterEditSectionHandler,
        characterEditFieldHandler,
        characterEditModalHandler
      ]

      characterEditHandlers.forEach((handler) => {
        expect(registry.getAllHandlers()).toContain(handler)
      })
    })

    it('Dice Roll系ハンドラーが8個登録されている', () => {
      const diceHandlers = [
        dicePagePrevHandler,
        dicePageNextHandler,
        dicePageFirstHandler,
        dicePageLastHandler,
        dicePageCancelHandler,
        dicePageSelectHandler,
        diceCharacterSelectHandler,
        diceRollModalHandler
      ]

      diceHandlers.forEach((handler) => {
        expect(registry.getAllHandlers()).toContain(handler)
      })
    })

    it('Character Thread系ハンドラーが6個登録されている', () => {
      const threadHandlers = [
        characterThreadSelectHandler,
        characterThreadCreateHandler,
        characterTabHandler,
        flexibleDiceParamHandler,
        diceGenericHandler,
        flexibleDiceSelectHandler
      ]

      threadHandlers.forEach((handler) => {
        expect(registry.getAllHandlers()).toContain(handler)
      })
    })
  })

  describe('customIdパターンマッチング確認', () => {
    describe('Character Edit系', () => {
      it('character-refresh-* にマッチ', () => {
        expect(registry.hasHandler('character-refresh-abc123', 'button')).toBe(true)
      })

      it('character-create-basic-* にマッチ', () => {
        expect(registry.hasHandler('character-create-basic-channel123', 'button')).toBe(true)
      })

      it('character-create-cancel-* にマッチ', () => {
        expect(registry.hasHandler('character-create-cancel-channel123', 'button')).toBe(true)
      })

      it('character-compact-view-* にマッチ', () => {
        expect(registry.hasHandler('character-compact-view-char123', 'button')).toBe(true)
      })

      it('character-edit-section-* にマッチ', () => {
        expect(registry.hasHandler('character-edit-section-char123', 'select')).toBe(true)
      })

      it('character-section-select-* にマッチ', () => {
        expect(registry.hasHandler('character-section-select-char123', 'select')).toBe(true)
      })

      it('character-field-* にマッチ', () => {
        expect(registry.hasHandler('character-field-status-char123', 'select')).toBe(true)
      })

      it('char-edit-* にマッチ', () => {
        expect(registry.hasHandler('char-edit-status-hp-char123', 'modal')).toBe(true)
      })

      it('char-edit-modal-* にマッチ', () => {
        expect(registry.hasHandler('char-edit-modal-char123', 'modal')).toBe(true)
      })
    })

    describe('Dice Roll系', () => {
      it.each([
        ['first', 'button'],
        ['prev', 'button'],
        ['next', 'button'],
        ['last', 'button'],
        ['cancel', 'button'],
        ['select', 'select']
      ] as const)('DicePageCustomId factory が生成した %s customId に handler pattern がマッチする', (action, type) => {
        const customId = DicePageCustomId.create(action, 'message123', 'channel123')

        expect(registry.hasHandler(customId, type)).toBe(true)
        expect(DicePageCustomId.parse(customId)).toEqual({
          action,
          messageId: 'message123',
          channelId: 'channel123'
        })
      })

      it('DiceCharacterSelectCustomId factory が生成した customId に handler pattern がマッチする', () => {
        const customId = DiceCharacterSelectCustomId.create('message123', 'channel123')

        expect(registry.hasHandler(customId, 'select')).toBe(true)
        expect(DiceCharacterSelectCustomId.parse(customId)).toEqual({
          messageId: 'message123',
          channelId: 'channel123'
        })
      })

      it('dice-page-prev にマッチ', () => {
        expect(registry.hasHandler('dice-page-prev', 'button')).toBe(true)
      })

      it('dice-page-next にマッチ', () => {
        expect(registry.hasHandler('dice-page-next', 'button')).toBe(true)
      })

      it('dice-page-first にマッチ', () => {
        expect(registry.hasHandler('dice-page-first', 'button')).toBe(true)
      })

      it('dice-page-last にマッチ', () => {
        expect(registry.hasHandler('dice-page-last', 'button')).toBe(true)
      })

      it('dice-page-cancel にマッチ', () => {
        expect(registry.hasHandler('dice-page-cancel', 'button')).toBe(true)
      })

      it('dice-page-select にマッチ', () => {
        expect(registry.hasHandler('dice-page-select', 'select')).toBe(true)
      })

      it('dice-char-select* にマッチ', () => {
        expect(registry.hasHandler('dice-char-select*message123*channel123', 'select')).toBe(true)
      })

      it('roll*{skill}_{channelId} は未登録（S-5c で DiceRollSkillHandler 撤去）', () => {
        expect(registry.hasHandler('roll*戦闘_1234567890', 'button')).toBe(false)
      })

      it('roll*{dice} は未登録（S-5c で DiceRollGeneralHandler 撤去）', () => {
        expect(registry.hasHandler('roll*1d100', 'button')).toBe(false)
        expect(registry.hasHandler('roll*2d6', 'button')).toBe(false)
      })

      it('roll*custom は未登録（S-5c で DiceRollCustomHandler 撤去）', () => {
        expect(registry.hasHandler('roll*custom', 'button')).toBe(false)
      })

      it('preset-dice* は未登録（S-5c で DiceRollPresetHandler 撤去）', () => {
        expect(registry.hasHandler('preset-dice*preset1_char123', 'button')).toBe(false)
      })

      it('custom-dice-modal にマッチ', () => {
        expect(registry.hasHandler('custom-dice-modal', 'modal')).toBe(true)
      })

      it('param-dice-modal* にマッチ', () => {
        expect(registry.hasHandler('param-dice-modal*char123', 'modal')).toBe(true)
      })
    })

    describe('Character Thread系', () => {
      it('character-thread-select にマッチ', () => {
        expect(registry.hasHandler('character-thread-select', 'select')).toBe(true)
      })

      it('character-thread-select-with-thread にマッチ', () => {
        expect(registry.hasHandler('character-thread-select-with-thread', 'select')).toBe(true)
      })

      it('character-thread-select-current にマッチ', () => {
        expect(registry.hasHandler('character-thread-select-current', 'select')).toBe(true)
      })

      it('character-thread-create-select にマッチ', () => {
        expect(registry.hasHandler('character-thread-create-select', 'select')).toBe(true)
      })

      it('character-tab* にマッチ', () => {
        expect(registry.hasHandler('character-tab*channel123*basic', 'button')).toBe(true)
      })

      it('flexible-dice-param* にマッチ', () => {
        expect(registry.hasHandler('flexible-dice-param*char123', 'select')).toBe(true)
      })

      it('character-dice* は未登録（S-5c で CharacterDiceHandler 撤去）', () => {
        expect(registry.hasHandler('character-dice*action*char123', 'button')).toBe(false)
      })

      it('dice_generic_* にマッチ', () => {
        expect(registry.hasHandler('dice_generic_1d6_1234567890', 'button')).toBe(true)
        expect(registry.hasHandler('dice_generic_2d6_1234567890', 'button')).toBe(true)
        expect(registry.hasHandler('dice_generic_1d20_1234567890', 'button')).toBe(true)
        expect(registry.hasHandler('dice_generic_1d100_1234567890', 'button')).toBe(true)
      })

      it('flexible_dice_* にマッチ', () => {
        expect(registry.hasHandler('flexible_dice_1234567890', 'select')).toBe(true)
      })

      it('skill_* にマッチ（P1-D slice2 で配線・button）', () => {
        expect(registry.hasHandler('skill_1234567890_dodge', 'button')).toBe(true)
      })

      it('ability_* にマッチ（S-3 で配線・button）', () => {
        expect(registry.hasHandler('ability_1234567890_str', 'button')).toBe(true)
      })

      it('dice_coc7_* / dice_dnd5e_* / dice_sw25_* にマッチ（P1-D 後続で配線・button）', () => {
        expect(registry.hasHandler('dice_coc7_1d100_1234567890', 'button')).toBe(true)
        expect(registry.hasHandler('dice_coc7_sanity_1234567890', 'button')).toBe(true)
        expect(registry.hasHandler('dice_dnd5e_save_1234567890', 'button')).toBe(true)
        expect(registry.hasHandler('dice_sw25_magic_1234567890', 'button')).toBe(true)
      })

      it('routed な dice_generic_ と未対応 system は区別される（dice_generic_ は別 handler・dice_xxx_ unknown は未routing）', () => {
        // dice_generic_ は DiceGenericHandler（preset 用 /^dice_(coc7|dnd5e|sw25)_/ には match しない）
        expect(registry.hasHandler('dice_generic_1d6_1234567890', 'button')).toBe(true)
        // coc7/dnd5e/sw25 以外の system 名は preset handler に match しない
        expect(registry.hasHandler('dice_pathfinder_attack_1234567890', 'button')).toBe(false)
      })
    })
  })

  describe('未登録のcustomId', () => {
    it('存在しないcustomIdはfalseを返す', () => {
      expect(registry.hasHandler('unknown-button-id', 'button')).toBe(false)
      expect(registry.hasHandler('unknown-select-id', 'select')).toBe(false)
      expect(registry.hasHandler('unknown-modal-id', 'modal')).toBe(false)
    })
  })
})
