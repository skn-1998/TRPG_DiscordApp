/// <reference types="jest" />

import { Test, TestingModule } from '@nestjs/testing'
import { Logger } from '@nestjs/common'
import { EventsController } from './events.controller'
import { CharaInfoButtonService } from './button/chara-info-button.service'
import { DiceButtonService } from './button/dice-button.service'
import { AddCharaInfoService } from './modal/add-chara-info.service'
import { ChangeCharaInfoService } from './select/change-chara-info.service'
import { CharacterChannelService } from './select/character-channel.service'
import { CharacterService } from '../../domains/character/character.service'
import { AppConfigService } from '../../config/config.service'
import { CharacterTabButtonsService } from './button/character-tab-buttons.service'
import { CharacterDiceButtonsService } from './button/character-dice-buttons.service'
import { ChannelCreateService } from './channel/character-channel-create.service'
import { DiceRollChannelCreateService } from './channel/diceroll-channel-create.service'
import { DicePagePrevButtonService } from './button/dice-page-prev-button.service'
import { DicePageNextButtonService } from './button/dice-page-next-button.service'
import { DicePageFirstButtonService } from './button/dice-page-first-button.service'
import { DicePageLastButtonService } from './button/dice-page-last-button.service'
import { DicePageCancelButtonService } from './button/dice-page-cancel-button.service'
import { DiceCharacterSelectService } from './select/dice-character-select.service'
import { DicePageSelectMenuService } from './select-menu/dice-page-select-menu.service'
import { Events, ChannelType } from 'discord.js'

// Mock Discord.js modules to avoid undefined issues
jest.mock('discord.js', () => ({
  Events: {
    ChannelCreate: 'channelCreate'
  },
  ChannelType: {
    GuildText: 0,
    GuildVoice: 2,
    GuildCategory: 4
  }
}))

describe('EventsController', () => {
  let controller: EventsController
  let mockLogger: jest.Mocked<Logger>

  // Service mocks
  let charaInfoButtonService: jest.Mocked<CharaInfoButtonService>
  let diceButtonService: jest.Mocked<DiceButtonService>
  let addCharaInfoService: jest.Mocked<AddCharaInfoService>
  let changeCharaInfoService: jest.Mocked<ChangeCharaInfoService>
  let characterChannelService: jest.Mocked<CharacterChannelService>
  let characterService: jest.Mocked<CharacterService>
  let appConfigService: jest.Mocked<AppConfigService>
  let characterTabButtonsService: jest.Mocked<CharacterTabButtonsService>
  let characterDiceButtonsService: jest.Mocked<CharacterDiceButtonsService>
  let channelCreateHandler: jest.Mocked<ChannelCreateService>
  let diceRollChannelCreateHandler: jest.Mocked<DiceRollChannelCreateService>
  let dicePagePrevButtonService: jest.Mocked<DicePagePrevButtonService>
  let dicePageNextButtonService: jest.Mocked<DicePageNextButtonService>
  let dicePageFirstButtonService: jest.Mocked<DicePageFirstButtonService>
  let dicePageLastButtonService: jest.Mocked<DicePageLastButtonService>
  let dicePageCancelButtonService: jest.Mocked<DicePageCancelButtonService>
  let diceCharacterSelectService: jest.Mocked<DiceCharacterSelectService>
  let dicePageSelectMenuService: jest.Mocked<DicePageSelectMenuService>

  // Discord mocks - simplified approach
  const mockClient = {
    on: jest.fn(),
    emit: jest.fn(),
    off: jest.fn(),
    removeAllListeners: jest.fn()
  }

  const mockButtonInteraction = {
    id: 'interaction-id-button',
    customId: 'test-button',
    replied: false,
    deferred: false,
    isButton: () => true,
    isStringSelectMenu: () => false,
    isModalSubmit: () => false,
    reply: jest.fn().mockResolvedValue(undefined)
  }

  const mockStringSelectInteraction = {
    id: 'interaction-id-select',
    customId: 'test-select',
    replied: false,
    deferred: false,
    isButton: () => false,
    isStringSelectMenu: () => true,
    isModalSubmit: () => false,
    values: ['test-value'],
    reply: jest.fn().mockResolvedValue(undefined)
  }

  const mockModalInteraction = {
    id: 'interaction-id-modal',
    customId: 'test-modal',
    replied: false,
    deferred: false,
    isButton: () => false,
    isStringSelectMenu: () => false,
    isModalSubmit: () => true,
    fields: {
      getTextInputValue: jest.fn(() => 'test-input')
    },
    reply: jest.fn().mockResolvedValue(undefined)
  }

  const mockTextChannel = {
    id: 'channel-id',
    name: 'test-channel',
    type: 0, // GuildText
    parent: {
      id: 'category-id',
      name: 'test-category'
    },
    guild: {
      id: 'guild-id',
      name: 'test-guild'
    }
  }

  beforeEach(async () => {
    // Service mocks creation
    const createMockService = (methods: string[]) => {
      const mock = {} as any
      methods.forEach((method) => {
        mock[method] = jest.fn().mockResolvedValue(undefined)
      })
      return mock
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [
        {
          provide: CharaInfoButtonService,
          useValue: createMockService(['execute'])
        },
        {
          provide: DiceButtonService,
          useValue: createMockService(['execute'])
        },
        {
          provide: AddCharaInfoService,
          useValue: createMockService(['execute'])
        },
        {
          provide: ChangeCharaInfoService,
          useValue: createMockService(['execute'])
        },
        {
          provide: CharacterChannelService,
          useValue: createMockService(['execute'])
        },
        {
          provide: CharacterService,
          useValue: createMockService(['findOne', 'create', 'update', 'remove'])
        },
        {
          provide: AppConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'discord.characterCategory') return 'test-category'
              if (key === 'discord.diceRollCategory') return 'dice-category'
              return 'default-config'
            })
          }
        },
        {
          provide: CharacterTabButtonsService,
          useValue: createMockService(['execute'])
        },
        {
          provide: CharacterDiceButtonsService,
          useValue: createMockService(['execute'])
        },
        {
          provide: ChannelCreateService,
          useValue: createMockService(['execute'])
        },
        {
          provide: DiceRollChannelCreateService,
          useValue: createMockService(['execute'])
        },
        {
          provide: DicePagePrevButtonService,
          useValue: createMockService(['execute'])
        },
        {
          provide: DicePageNextButtonService,
          useValue: createMockService(['execute'])
        },
        {
          provide: DicePageFirstButtonService,
          useValue: createMockService(['execute'])
        },
        {
          provide: DicePageLastButtonService,
          useValue: createMockService(['execute'])
        },
        {
          provide: DicePageCancelButtonService,
          useValue: createMockService(['execute'])
        },
        {
          provide: DiceCharacterSelectService,
          useValue: createMockService(['execute'])
        },
        {
          provide: DicePageSelectMenuService,
          useValue: createMockService(['execute'])
        }
      ]
    }).compile()

    controller = module.get<EventsController>(EventsController)

    // Get service references
    charaInfoButtonService = module.get(CharaInfoButtonService)
    diceButtonService = module.get(DiceButtonService)
    addCharaInfoService = module.get(AddCharaInfoService)
    changeCharaInfoService = module.get(ChangeCharaInfoService)
    characterChannelService = module.get(CharacterChannelService)
    characterService = module.get(CharacterService)
    appConfigService = module.get(AppConfigService)
    characterTabButtonsService = module.get(CharacterTabButtonsService)
    characterDiceButtonsService = module.get(CharacterDiceButtonsService)
    channelCreateHandler = module.get(ChannelCreateService)
    diceRollChannelCreateHandler = module.get(DiceRollChannelCreateService)
    dicePagePrevButtonService = module.get(DicePagePrevButtonService)
    dicePageNextButtonService = module.get(DicePageNextButtonService)
    dicePageFirstButtonService = module.get(DicePageFirstButtonService)
    dicePageLastButtonService = module.get(DicePageLastButtonService)
    dicePageCancelButtonService = module.get(DicePageCancelButtonService)
    diceCharacterSelectService = module.get(DiceCharacterSelectService)
    dicePageSelectMenuService = module.get(DicePageSelectMenuService)

    // Mock logger
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn()
    } as unknown as jest.Mocked<Logger>

    // Replace the logger
    ;(controller as any).logger = mockLogger
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('基本機能', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined()
    })

    it('should have all required methods', () => {
      expect(controller.handleCommand).toBeDefined()
      expect(controller.handleInteraction).toBeDefined()
      expect(controller.handleChannelCreate).toBeDefined()
      expect(controller.doSystemEvent).toBeDefined()
      expect(controller.doEvents).toBeDefined()
    })

    it('should have all required services injected', () => {
      expect(charaInfoButtonService).toBeDefined()
      expect(diceButtonService).toBeDefined()
      expect(addCharaInfoService).toBeDefined()
      expect(changeCharaInfoService).toBeDefined()
      expect(characterChannelService).toBeDefined()
      expect(characterService).toBeDefined()
      expect(appConfigService).toBeDefined()
    })
  })

  describe('handleCommand', () => {
    it('should handle Discord client setup', () => {
      controller.handleCommand(mockClient as any)

      expect(mockClient.on).toHaveBeenCalledWith('channelCreate', expect.any(Function))
    })

    it('should set up channel create event listener', () => {
      const spy = jest.spyOn(controller, 'handleChannelCreate')

      controller.handleCommand(mockClient as any)

      expect(spy).toHaveBeenCalledWith(mockClient)
    })
  })

  describe('handleInteraction', () => {
    it('should skip already replied interactions', async () => {
      const repliedInteraction = {
        ...mockButtonInteraction,
        replied: true
      }

      await controller.handleInteraction(repliedInteraction as any)

      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('は既に応答済みです'))
    })

    it('should skip already deferred interactions', async () => {
      const deferredInteraction = {
        ...mockButtonInteraction,
        deferred: true
      }

      await controller.handleInteraction(deferredInteraction as any)

      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('は既に応答済みです'))
    })

    it('should handle button interactions', async () => {
      const buttonInteraction = {
        ...mockButtonInteraction,
        customId: 'add-chara-info'
      }

      await controller.handleInteraction(buttonInteraction as any)

      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('インタラクション処理開始'))
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('ボタン処理'))
    })

    it('should handle string select menu interactions', async () => {
      const selectInteraction = {
        ...mockStringSelectInteraction,
        customId: 'thread-create-character'
      }

      await controller.handleInteraction(selectInteraction as any)

      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('セレクトメニュー処理'))
    })

    it('should handle modal submit interactions', async () => {
      const modalInteraction = {
        ...mockModalInteraction,
        customId: 'add-chara-info'
      }

      await controller.handleInteraction(modalInteraction as any)

      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('モーダル処理'))
    })

    it('should warn when interaction is not responded', async () => {
      const unhandledInteraction = {
        ...mockButtonInteraction,
        customId: 'unknown-custom-id',
        replied: false,
        deferred: false
      }

      await controller.handleInteraction(unhandledInteraction as any)

      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('に対して応答が行われませんでした'))
    })

    it('should handle interaction errors gracefully', async () => {
      const errorInteraction = {
        ...mockButtonInteraction,
        isButton: jest.fn(() => {
          throw new Error('Test error')
        })
      }

      await controller.handleInteraction(errorInteraction as any)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('インタラクション処理エラー'),
        expect.any(Error)
      )
    })

    it('should reply with error message on unhandled errors', async () => {
      const errorInteraction = {
        ...mockButtonInteraction,
        isButton: jest.fn(() => {
          throw new Error('Test error')
        }),
        reply: jest.fn().mockResolvedValue(undefined)
      }

      await controller.handleInteraction(errorInteraction as any)

      expect(errorInteraction.reply).toHaveBeenCalledWith({
        content: '処理中にエラーが発生しました。しばらく経ってから再度お試しください。',
        ephemeral: true
      })
    })

    it('should handle reply error gracefully', async () => {
      const errorInteraction = {
        ...mockButtonInteraction,
        isButton: jest.fn(() => {
          throw new Error('Test error')
        }),
        reply: jest.fn().mockRejectedValue(new Error('Reply error'))
      }

      await controller.handleInteraction(errorInteraction as any)

      expect(mockLogger.error).toHaveBeenCalledWith('エラー応答中にさらにエラーが発生しました:', expect.any(Error))
    })
  })

  describe('handleChannelCreate', () => {
    it('should set up channel create event listener', () => {
      controller.handleChannelCreate(mockClient as any)

      expect(mockLogger.log).toHaveBeenCalledWith('チャンネル作成ハンドラーを呼び出します')
      expect(mockClient.on).toHaveBeenCalledWith('channelCreate', expect.any(Function))
    })

    it('should handle text channel creation', async () => {
      controller.handleChannelCreate(mockClient as any)

      const channelCreateCallback = mockClient.on.mock.calls.find((call) => call[0] === 'channelCreate')?.[1]

      expect(channelCreateCallback).toBeDefined()

      const spy = jest.spyOn(controller, 'doSystemEvent')

      await channelCreateCallback?.(mockTextChannel as any)

      expect(spy).toHaveBeenCalledTimes(2)
      expect(spy).toHaveBeenCalledWith(channelCreateHandler, 'test-category', mockTextChannel)
      expect(spy).toHaveBeenCalledWith(diceRollChannelCreateHandler, 'dice-category', mockTextChannel)
    })

    it('should ignore non-text channels', async () => {
      const nonTextChannel = {
        ...mockTextChannel,
        type: 2 // GuildVoice
      }

      controller.handleChannelCreate(mockClient as any)

      const channelCreateCallback = mockClient.on.mock.calls.find((call) => call[0] === 'channelCreate')?.[1]

      const spy = jest.spyOn(controller, 'doSystemEvent')

      await channelCreateCallback?.(nonTextChannel as any)

      expect(spy).not.toHaveBeenCalled()
    })
  })

  describe('doSystemEvent', () => {
    const mockHandler = {
      execute: jest.fn()
    }

    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('should execute handler when category matches', () => {
      controller.doSystemEvent(mockHandler, 'test-category', mockTextChannel as any)

      expect(mockLogger.debug).toHaveBeenCalledWith('システムイベント実行: test-category')
      expect(mockHandler.execute).toHaveBeenCalledWith(mockTextChannel, 'test-category')
    })

    it('should not execute handler when category does not match', () => {
      controller.doSystemEvent(mockHandler, 'different-category', mockTextChannel as any)

      expect(mockHandler.execute).not.toHaveBeenCalled()
    })

    it('should handle channel without parent', () => {
      const channelWithoutParent = {
        ...mockTextChannel,
        parent: null
      }

      controller.doSystemEvent(mockHandler, 'test-category', channelWithoutParent as any)

      expect(mockLogger.debug).toHaveBeenCalledWith('チャンネルに親カテゴリがありません')
      expect(mockHandler.execute).not.toHaveBeenCalled()
    })
  })

  describe('doEvents', () => {
    beforeEach(() => {
      // Set up interaction for doEvents testing
      ;(controller as any).interaction = mockButtonInteraction
    })

    it('should execute service when custom ID matches exactly', async () => {
      const mockService = { execute: jest.fn().mockResolvedValue(undefined) }
      const config = { customId: 'test-button' }
      const interaction = { ...mockButtonInteraction, customId: 'test-button' }
      ;(controller as any).interaction = interaction

      await controller.doEvents(mockService, config)

      expect(mockLogger.debug).toHaveBeenCalledWith('イベント実行: test-button')
      expect(mockService.execute).toHaveBeenCalledWith(interaction, config)
    })

    it('should execute service when custom ID matches with wildcard', async () => {
      const mockService = { execute: jest.fn().mockResolvedValue(undefined) }
      const config = { customId: 'roll' }
      const interaction = { ...mockButtonInteraction, customId: 'roll*character-123' }
      ;(controller as any).interaction = interaction

      await controller.doEvents(mockService, config)

      expect(mockLogger.debug).toHaveBeenCalledWith('ワイルドカードイベント実行: roll*character-123 (マッチ: roll)')
      expect(mockService.execute).toHaveBeenCalledWith(interaction, config)
    })

    it('should not execute service when custom ID does not match', async () => {
      const mockService = { execute: jest.fn().mockResolvedValue(undefined) }
      const config = { customId: 'different-button' }

      await controller.doEvents(mockService, config)

      expect(mockService.execute).not.toHaveBeenCalled()
    })

    it('should return early when config has no customId', async () => {
      const mockService = { execute: jest.fn().mockResolvedValue(undefined) }
      const config = { customId: undefined } as any

      await controller.doEvents(mockService, config)

      expect(mockService.execute).not.toHaveBeenCalled()
    })

    it('should not execute when interaction is already replied', async () => {
      const mockService = { execute: jest.fn().mockResolvedValue(undefined) }
      const config = { customId: 'test-button' }
      const repliedInteraction = { ...mockButtonInteraction, replied: true }
      ;(controller as any).interaction = repliedInteraction

      await controller.doEvents(mockService, config)

      expect(mockService.execute).not.toHaveBeenCalled()
    })

    it('should not execute when interaction is already deferred', async () => {
      const mockService = { execute: jest.fn().mockResolvedValue(undefined) }
      const config = { customId: 'test-button' }
      const deferredInteraction = { ...mockButtonInteraction, deferred: true }
      ;(controller as any).interaction = deferredInteraction

      await controller.doEvents(mockService, config)

      expect(mockService.execute).not.toHaveBeenCalled()
    })
  })

  describe('統合テスト', () => {
    it('should handle complete button interaction flow', async () => {
      const buttonInteraction = {
        ...mockButtonInteraction,
        customId: 'add-chara-info',
        replied: false,
        deferred: false
      }

      await controller.handleInteraction(buttonInteraction as any)

      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('インタラクション処理開始'))
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('ボタン処理'))
    })

    it('should handle complete select menu interaction flow', async () => {
      const selectInteraction = {
        ...mockStringSelectInteraction,
        customId: 'thread-create-character',
        replied: false,
        deferred: false
      }

      await controller.handleInteraction(selectInteraction as any)

      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('セレクトメニュー処理'))
    })

    it('should handle complete modal interaction flow', async () => {
      const modalInteraction = {
        ...mockModalInteraction,
        customId: 'add-chara-info',
        replied: false,
        deferred: false
      }

      await controller.handleInteraction(modalInteraction as any)

      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('モーダル処理'))
    })
  })

  describe('エラーハンドリング総合', () => {
    it('should handle service execution errors', async () => {
      const failingService = {
        execute: jest.fn().mockRejectedValue(new Error('Service error'))
      }
      const config = { customId: 'test-button' }
      const interaction = { ...mockButtonInteraction, customId: 'test-button' }
      ;(controller as any).interaction = interaction

      // Service error should be propagated to handleInteraction
      await expect(controller.doEvents(failingService, config)).rejects.toThrow('Service error')

      expect(failingService.execute).toHaveBeenCalled()
    })

    it('should handle multiple interaction types gracefully', async () => {
      const interactions = [
        { ...mockButtonInteraction, customId: 'add-chara-info' },
        { ...mockStringSelectInteraction, customId: 'thread-create-character' },
        { ...mockModalInteraction, customId: 'add-chara-info' }
      ]

      for (const interaction of interactions) {
        await controller.handleInteraction(interaction as any)

        expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('インタラクション処理開始'))
      }
    })
  })
})
