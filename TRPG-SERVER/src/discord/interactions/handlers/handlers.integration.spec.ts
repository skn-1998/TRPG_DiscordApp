import { Test, TestingModule } from '@nestjs/testing'
import { ModuleRef } from '@nestjs/core'
import { InteractionRegistryService } from '../registry/interaction-registry.service'
import { PatternMatcherService } from '../registry/pattern-matcher.service'

// Character Edit Handlers
import { CharacterEditRefreshHandler } from './character-edit/character-edit-refresh.handler'
import { CharacterEditCreateHandler } from './character-edit/character-edit-create.handler'
import { CharacterEditCompactHandler } from './character-edit/character-edit-compact.handler'
import { CharacterEditSectionHandler } from './character-edit/character-edit-section.handler'
import { CharacterEditFieldHandler } from './character-edit/character-edit-field.handler'
import { CharacterEditModalHandler } from './character-edit/character-edit-modal.handler'

// Dice Roll Handlers
import { DicePagePrevHandler } from './dice-roll/dice-page-prev.handler'
import { DicePageNextHandler } from './dice-roll/dice-page-next.handler'
import { DicePageFirstHandler } from './dice-roll/dice-page-first.handler'
import { DicePageLastHandler } from './dice-roll/dice-page-last.handler'
import { DicePageCancelHandler } from './dice-roll/dice-page-cancel.handler'
import { DicePageSelectHandler } from './dice-roll/dice-page-select.handler'
import { DiceCharacterSelectHandler } from './dice-roll/dice-character-select.handler'
import { DiceRollSkillHandler } from './dice-roll/dice-roll-skill.handler'
import { DiceRollGeneralHandler } from './dice-roll/dice-roll-general.handler'
import { DiceRollCustomHandler } from './dice-roll/dice-roll-custom.handler'
import { DiceRollPresetHandler } from './dice-roll/dice-roll-preset.handler'
import { DiceRollModalHandler } from './dice-roll/dice-roll-modal.handler'

// Character Thread Handlers
import { CharacterThreadSelectHandler } from './character-thread/character-thread-select.handler'
import { CharacterThreadCreateHandler } from './character-thread/character-thread-create.handler'
import { CharacterTabHandler } from './character-thread/character-tab.handler'
import { FlexibleDiceParamHandler } from './character-thread/flexible-dice-param.handler'
import { CharacterDiceHandler } from './character-thread/character-dice.handler'
import { DiceGenericHandler } from './character-thread/dice-generic.handler'
import { FlexibleDiceSelectHandler } from './character-thread/flexible-dice-select.handler'

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
const mockCharacterDiceOrchestratorService = { execute: jest.fn().mockResolvedValue(undefined) }
const mockCustomDiceModalService = { execute: jest.fn().mockResolvedValue(undefined) }
const mockCharacterThreadSelectService = { execute: jest.fn().mockResolvedValue(undefined) }
const mockCharacterTabButtonsService = { execute: jest.fn().mockResolvedValue(undefined) }
const mockCharacterDiceButtonsService = { execute: jest.fn().mockResolvedValue(undefined) }
const mockDiceRollLogicService = {
  handleDiceRoll: jest.fn().mockResolvedValue({ success: true, total: 10, details: 'test' })
}

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
  let diceRollSkillHandler: DiceRollSkillHandler
  let diceRollGeneralHandler: DiceRollGeneralHandler
  let diceRollCustomHandler: DiceRollCustomHandler
  let diceRollPresetHandler: DiceRollPresetHandler
  let diceRollModalHandler: DiceRollModalHandler
  let characterThreadSelectHandler: CharacterThreadSelectHandler
  let characterThreadCreateHandler: CharacterThreadCreateHandler
  let characterTabHandler: CharacterTabHandler
  let flexibleDiceParamHandler: FlexibleDiceParamHandler
  let characterDiceHandler: CharacterDiceHandler
  let diceGenericHandler: DiceGenericHandler
  let flexibleDiceSelectHandler: FlexibleDiceSelectHandler

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InteractionRegistryService,
        PatternMatcherService,
        { provide: ModuleRef, useValue: { get: jest.fn().mockReturnValue(undefined) } },

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
          provide: DiceRollSkillHandler,
          useFactory: () => new (DiceRollSkillHandler as any)(mockCharacterDiceOrchestratorService)
        },
        {
          provide: DiceRollGeneralHandler,
          useFactory: () => new (DiceRollGeneralHandler as any)(mockCharacterDiceOrchestratorService)
        },
        {
          provide: DiceRollCustomHandler,
          useFactory: () => new (DiceRollCustomHandler as any)(mockCharacterDiceOrchestratorService)
        },
        {
          provide: DiceRollPresetHandler,
          useFactory: () => new (DiceRollPresetHandler as any)(mockCharacterDiceOrchestratorService)
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
          provide: CharacterDiceHandler,
          useFactory: () => new (CharacterDiceHandler as any)(mockCharacterDiceButtonsService)
        },
        {
          provide: DiceGenericHandler,
          useFactory: () => new (DiceGenericHandler as any)(mockDiceRollLogicService)
        },
        {
          provide: FlexibleDiceSelectHandler,
          useFactory: () => new (FlexibleDiceSelectHandler as any)(mockDiceRollLogicService)
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
    diceRollSkillHandler = module.get<DiceRollSkillHandler>(DiceRollSkillHandler)
    diceRollGeneralHandler = module.get<DiceRollGeneralHandler>(DiceRollGeneralHandler)
    diceRollCustomHandler = module.get<DiceRollCustomHandler>(DiceRollCustomHandler)
    diceRollPresetHandler = module.get<DiceRollPresetHandler>(DiceRollPresetHandler)
    diceRollModalHandler = module.get<DiceRollModalHandler>(DiceRollModalHandler)
    characterThreadSelectHandler = module.get<CharacterThreadSelectHandler>(CharacterThreadSelectHandler)
    characterThreadCreateHandler = module.get<CharacterThreadCreateHandler>(CharacterThreadCreateHandler)
    characterTabHandler = module.get<CharacterTabHandler>(CharacterTabHandler)
    flexibleDiceParamHandler = module.get<FlexibleDiceParamHandler>(FlexibleDiceParamHandler)
    characterDiceHandler = module.get<CharacterDiceHandler>(CharacterDiceHandler)
    diceGenericHandler = module.get<DiceGenericHandler>(DiceGenericHandler)
    flexibleDiceSelectHandler = module.get<FlexibleDiceSelectHandler>(FlexibleDiceSelectHandler)

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
      diceRollSkillHandler,
      diceRollGeneralHandler,
      diceRollCustomHandler,
      diceRollPresetHandler,
      diceRollModalHandler,
      characterThreadSelectHandler,
      characterThreadCreateHandler,
      characterTabHandler,
      flexibleDiceParamHandler,
      characterDiceHandler,
      diceGenericHandler,
      flexibleDiceSelectHandler
    ])
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('全ハンドラーの登録確認', () => {
    it('25個のハンドラーが登録されている', () => {
      const stats = registry.getStatistics()
      expect(stats.totalHandlers).toBe(25)
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

    it('Dice Roll系ハンドラーが12個登録されている', () => {
      const diceHandlers = [
        dicePagePrevHandler,
        dicePageNextHandler,
        dicePageFirstHandler,
        dicePageLastHandler,
        dicePageCancelHandler,
        dicePageSelectHandler,
        diceCharacterSelectHandler,
        diceRollSkillHandler,
        diceRollGeneralHandler,
        diceRollCustomHandler,
        diceRollPresetHandler,
        diceRollModalHandler
      ]

      diceHandlers.forEach((handler) => {
        expect(registry.getAllHandlers()).toContain(handler)
      })
    })

    it('Character Thread系ハンドラーが7個登録されている', () => {
      const threadHandlers = [
        characterThreadSelectHandler,
        characterThreadCreateHandler,
        characterTabHandler,
        flexibleDiceParamHandler,
        characterDiceHandler,
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

      it('roll*{skill}_{channelId} にマッチ', () => {
        expect(registry.hasHandler('roll*戦闘_1234567890', 'button')).toBe(true)
      })

      it('roll*{dice} にマッチ', () => {
        expect(registry.hasHandler('roll*1d100', 'button')).toBe(true)
        expect(registry.hasHandler('roll*2d6', 'button')).toBe(true)
      })

      it('roll*custom にマッチ', () => {
        expect(registry.hasHandler('roll*custom', 'button')).toBe(true)
      })

      it('preset-dice* にマッチ', () => {
        expect(registry.hasHandler('preset-dice*preset1_char123', 'button')).toBe(true)
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

      it('character-dice にマッチ', () => {
        expect(registry.hasHandler('character-dice*action*char123', 'button')).toBe(true)
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
