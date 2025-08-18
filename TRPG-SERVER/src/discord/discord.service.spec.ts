/// <reference types="jest" />

import { Test, TestingModule } from '@nestjs/testing'
import { Logger } from '@nestjs/common'
import { DiscordService } from './discord.service'
import { DiscordClientService } from './services/discord-client.service'
import { InteractionsService } from './interactions/interactions.service'
import { CommandsService } from './commands/commands.service'
import { CharacterService } from '../domains/character/character.service'
import { AppConfigService } from '../config/config.service'
import { CommandManagerService } from './services/command-manager.service'
import { Events, InteractionType } from 'discord.js'

// Mock Discord.js modules
jest.mock('discord.js', () => ({
  Events: {
    ClientReady: 'ready',
    InteractionCreate: 'interactionCreate'
  },
  InteractionType: {
    ApplicationCommand: 2,
    MessageComponent: 3,
    ApplicationCommandAutocomplete: 4,
    ModalSubmit: 5,
    2: 'ApplicationCommand',
    3: 'MessageComponent',
    4: 'ApplicationCommandAutocomplete',
    5: 'ModalSubmit'
  },
  GatewayIntentBits: {
    Guilds: 1,
    MessageContent: 32768
  }
}))

describe('DiscordService', () => {
  let service: DiscordService
  let mockLogger: jest.Mocked<Logger>

  // Service mocks
  let discordClientService: jest.Mocked<DiscordClientService>
  let interactionsService: jest.Mocked<InteractionsService>
  let commandsService: jest.Mocked<CommandsService>
  let characterService: jest.Mocked<CharacterService>
  let appConfigService: jest.Mocked<AppConfigService>
  let commandManagerService: jest.Mocked<CommandManagerService>

  // Discord mocks
  const mockClient = {
    once: jest.fn(),
    on: jest.fn(),
    user: { tag: 'TestBot#0000' },
    login: jest.fn().mockResolvedValue(undefined)
  }

  const mockButtonInteraction = {
    id: 'button-interaction-id',
    customId: 'test-button',
    type: 3, // MessageComponent
    replied: false,
    deferred: false,
    isCommand: () => false,
    isAutocomplete: () => false,
    isButton: () => true,
    isModalSubmit: () => false,
    isAnySelectMenu: () => false,
    reply: jest.fn().mockResolvedValue(undefined)
  }

  const mockModalInteraction = {
    id: 'modal-interaction-id',
    customId: 'test-modal',
    type: 5, // ModalSubmit
    replied: false,
    deferred: false,
    isCommand: () => false,
    isAutocomplete: () => false,
    isButton: () => false,
    isModalSubmit: () => true,
    isAnySelectMenu: () => false,
    reply: jest.fn().mockResolvedValue(undefined)
  }

  const mockSelectInteraction = {
    id: 'select-interaction-id',
    customId: 'test-select',
    type: 3, // MessageComponent
    replied: false,
    deferred: false,
    isCommand: () => false,
    isAutocomplete: () => false,
    isButton: () => false,
    isModalSubmit: () => false,
    isAnySelectMenu: () => true,
    reply: jest.fn().mockResolvedValue(undefined)
  }

  const mockCommandInteraction = {
    id: 'command-interaction-id',
    commandName: 'test-command',
    type: 2, // ApplicationCommand
    replied: false,
    deferred: false,
    isCommand: () => true,
    isAutocomplete: () => false,
    isButton: () => false,
    isModalSubmit: () => false,
    isAnySelectMenu: () => false,
    reply: jest.fn().mockResolvedValue(undefined)
  }

  const mockAutocompleteInteraction = {
    id: 'autocomplete-interaction-id',
    commandName: 'test-autocomplete',
    type: 4, // ApplicationCommandAutocomplete
    isCommand: () => false,
    isAutocomplete: () => true,
    isButton: () => false,
    isModalSubmit: () => false,
    isAnySelectMenu: () => false
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscordService,
        {
          provide: DiscordClientService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockClient),
            initializeClient: jest.fn().mockResolvedValue(undefined)
          }
        },
        {
          provide: InteractionsService,
          useValue: {
            loadClient: jest.fn(),
            handleInteraction: jest.fn().mockResolvedValue(false)
          }
        },
        {
          provide: CommandsService,
          useValue: {
            loadClient: jest.fn()
          }
        },
        {
          provide: CharacterService,
          useValue: {
            findOne: jest.fn(),
            create: jest.fn()
          }
        },
        {
          provide: AppConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-config')
          }
        },
        {
          provide: CommandManagerService,
          useValue: {
            handleCommandInteraction: jest.fn().mockResolvedValue(undefined),
            handleAutocompleteInteraction: jest.fn().mockResolvedValue(undefined)
          }
        }
      ]
    }).compile()

    service = module.get<DiscordService>(DiscordService)

    // Get service references
    discordClientService = module.get(DiscordClientService)
    interactionsService = module.get(InteractionsService)
    commandsService = module.get(CommandsService)
    characterService = module.get(CharacterService)
    appConfigService = module.get(AppConfigService)
    commandManagerService = module.get(CommandManagerService)

    // Mock logger
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn()
    } as unknown as jest.Mocked<Logger>

    // Replace the logger
    ;(service as any).logger = mockLogger
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('基本機能', () => {
    it('should be defined', () => {
      expect(service).toBeDefined()
    })

    it('should have all required methods', () => {
      expect(service.initializeDiscord).toBeDefined()
      expect(service.registerButton).toBeDefined()
      expect(service.registerModal).toBeDefined()
      expect(service.registerSelectMenu).toBeDefined()
    })

    it('should have all required services injected', () => {
      expect(discordClientService).toBeDefined()
      expect(interactionsService).toBeDefined()
      expect(commandsService).toBeDefined()
      expect(characterService).toBeDefined()
      expect(appConfigService).toBeDefined()
      expect(commandManagerService).toBeDefined()
    })
  })

  describe('initializeDiscord', () => {
    it('should initialize Discord successfully', async () => {
      await service.initializeDiscord()

      expect(mockLogger.log).toHaveBeenCalledWith('Discord初期化を開始します...')
      expect(mockClient.once).toHaveBeenCalledWith('ready', expect.any(Function))
      expect(interactionsService.loadClient).toHaveBeenCalledWith(mockClient)
      expect(commandsService.loadClient).toHaveBeenCalledWith(mockClient)
      expect(mockClient.on).toHaveBeenCalledWith('interactionCreate', expect.any(Function))
      expect(discordClientService.initializeClient).toHaveBeenCalled()
      expect(mockLogger.log).toHaveBeenCalledWith('Discord初期化が完了しました')
    })

    it('should not initialize twice', async () => {
      await service.initializeDiscord()
      await service.initializeDiscord()

      // Should only call initialization once
      expect(discordClientService.initializeClient).toHaveBeenCalledTimes(1)
    })

    it('should handle initialization errors', async () => {
      const error = new Error('Initialization failed')
      discordClientService.initializeClient.mockRejectedValueOnce(error)

      await expect(service.initializeDiscord()).rejects.toThrow('Initialization failed')
      expect(mockLogger.error).toHaveBeenCalledWith('Discord初期化に失敗しました', error)
    })

    it('should set up client ready event handler', async () => {
      await service.initializeDiscord()

      expect(mockClient.once).toHaveBeenCalledWith('ready', expect.any(Function))

      // Simulate client ready event
      const readyHandler = mockClient.once.mock.calls.find((call) => call[0] === 'ready')?.[1]
      expect(readyHandler).toBeDefined()

      readyHandler?.(mockClient)
      expect(mockLogger.log).toHaveBeenCalledWith('Discord BOTが起動しました: TestBot#0000')
    })

    it('should attach CharacterService to client', async () => {
      await service.initializeDiscord()

      expect((mockClient as any).characterService).toBe(characterService)
    })
  })

  describe('Registration Methods', () => {
    const mockButton = {
      id: 'test-button',
      name: 'Test Button',
      data: {
        setCustomId: jest.fn().mockReturnThis(),
        setLabel: jest.fn().mockReturnThis(),
        setStyle: jest.fn().mockReturnThis()
      } as any,
      execute: jest.fn().mockResolvedValue(undefined)
    } as any

    const mockModal = {
      id: 'test-modal',
      name: 'Test Modal',
      data: {
        setCustomId: jest.fn().mockReturnThis(),
        setTitle: jest.fn().mockReturnThis(),
        addComponents: jest.fn().mockReturnThis()
      } as any,
      execute: jest.fn().mockResolvedValue(undefined)
    } as any

    const mockSelect = {
      id: 'test-select',
      name: 'Test Select',
      data: {
        setCustomId: jest.fn().mockReturnThis(),
        setPlaceholder: jest.fn().mockReturnThis(),
        addOptions: jest.fn().mockReturnThis()
      } as any,
      execute: jest.fn().mockResolvedValue(undefined)
    } as any

    describe('registerButton', () => {
      it('should register button successfully', () => {
        service.registerButton(mockButton)

        expect(mockLogger.log).toHaveBeenCalledWith('ボタン「Test Button」を登録しています')

        // Test that button was registered internally
        const buttons = (service as any).buttons
        expect(buttons.get('test-button')).toBe(mockButton)
      })
    })

    describe('registerModal', () => {
      it('should register modal successfully', () => {
        service.registerModal(mockModal)

        expect(mockLogger.log).toHaveBeenCalledWith('モーダル「Test Modal」を登録しています')

        // Test that modal was registered internally
        const modals = (service as any).modals
        expect(modals.get('test-modal')).toBe(mockModal)
      })
    })

    describe('registerSelectMenu', () => {
      it('should register select menu successfully', () => {
        service.registerSelectMenu(mockSelect)

        expect(mockLogger.log).toHaveBeenCalledWith('セレクトメニュー「Test Select」を登録しています')

        // Test that select was registered internally
        const selects = (service as any).selects
        expect(selects.get('test-select')).toBe(mockSelect)
      })
    })
  })

  describe('Interaction Event Handler', () => {
    beforeEach(async () => {
      await service.initializeDiscord()
    })

    it('should set up interaction event handler', () => {
      expect(mockClient.on).toHaveBeenCalledWith('interactionCreate', expect.any(Function))
    })

    it('should handle command interactions', async () => {
      const interactionHandler = mockClient.on.mock.calls.find((call) => call[0] === 'interactionCreate')?.[1]

      await interactionHandler?.(mockCommandInteraction)

      expect(mockLogger.log).toHaveBeenCalledWith(
        'インタラクション受信: Type=ApplicationCommand, ID=command-interaction-id'
      )
      expect(commandManagerService.handleCommandInteraction).toHaveBeenCalledWith(mockCommandInteraction)
    })

    it('should handle autocomplete interactions', async () => {
      const interactionHandler = mockClient.on.mock.calls.find((call) => call[0] === 'interactionCreate')?.[1]

      await interactionHandler?.(mockAutocompleteInteraction)

      expect(commandManagerService.handleAutocompleteInteraction).toHaveBeenCalledWith(mockAutocompleteInteraction)
    })

    it('should handle button interactions', async () => {
      const interactionHandler = mockClient.on.mock.calls.find((call) => call[0] === 'interactionCreate')?.[1]

      await interactionHandler?.(mockButtonInteraction)

      expect(interactionsService.handleInteraction).toHaveBeenCalledWith(mockButtonInteraction)
    })

    it('should prevent duplicate interaction processing', async () => {
      const interactionHandler = mockClient.on.mock.calls.find((call) => call[0] === 'interactionCreate')?.[1]

      // Process same interaction twice
      await interactionHandler?.(mockButtonInteraction)
      await interactionHandler?.(mockButtonInteraction)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'インタラクション(ID: button-interaction-id)は既に処理されています。処理をスキップします。'
      )
      expect(interactionsService.handleInteraction).toHaveBeenCalledTimes(1)
    })

    it('should handle unsupported interaction types', async () => {
      const unsupportedInteraction = {
        id: 'unsupported-id',
        type: 99, // Unknown type
        isCommand: () => false,
        isAutocomplete: () => false,
        isButton: () => false,
        isModalSubmit: () => false,
        isAnySelectMenu: () => false
      }

      const interactionHandler = mockClient.on.mock.calls.find((call) => call[0] === 'interactionCreate')?.[1]

      await interactionHandler?.(unsupportedInteraction)

      expect(mockLogger.log).toHaveBeenCalledWith('未サポートのインタラクションタイプ: Unknown')
    })

    it('should handle interaction processing errors', async () => {
      const error = new Error('Processing error')
      interactionsService.handleInteraction.mockRejectedValueOnce(error)

      const interactionHandler = mockClient.on.mock.calls.find((call) => call[0] === 'interactionCreate')?.[1]

      await interactionHandler?.(mockButtonInteraction)

      expect(mockLogger.error).toHaveBeenCalledWith('InteractionsServiceでの処理中にエラーが発生しました')
    })
  })

  describe('Command Interaction Handling', () => {
    beforeEach(async () => {
      await service.initializeDiscord()
    })

    it('should handle command interaction successfully', async () => {
      const interactionHandler = mockClient.on.mock.calls.find((call) => call[0] === 'interactionCreate')?.[1]

      await interactionHandler?.(mockCommandInteraction)

      expect(mockLogger.log).toHaveBeenCalledWith(
        'コマンドインタラクション処理: test-command (ID: command-interaction-id)'
      )
      expect(commandManagerService.handleCommandInteraction).toHaveBeenCalledWith(mockCommandInteraction)
    })

    it('should handle command interaction errors', async () => {
      const error = new Error('Command error')
      commandManagerService.handleCommandInteraction.mockRejectedValueOnce(error)

      const interactionHandler = mockClient.on.mock.calls.find((call) => call[0] === 'interactionCreate')?.[1]

      await interactionHandler?.(mockCommandInteraction)

      expect(mockLogger.error).toHaveBeenCalledWith('コマンド「test-command」の処理中にエラーが発生しました')
      expect(mockCommandInteraction.reply).toHaveBeenCalledWith({
        content: 'コマンド処理中にエラーが発生しました。',
        ephemeral: true
      })
    })

    it('should handle command reply errors', async () => {
      const commandError = new Error('Command error')
      const replyError = new Error('Reply error')
      commandManagerService.handleCommandInteraction.mockRejectedValueOnce(commandError)
      mockCommandInteraction.reply.mockRejectedValueOnce(replyError)

      const interactionHandler = mockClient.on.mock.calls.find((call) => call[0] === 'interactionCreate')?.[1]

      await interactionHandler?.(mockCommandInteraction)

      expect(mockLogger.error).toHaveBeenCalledWith('コマンドエラー応答中にさらにエラーが発生しました')
    })

    it('should not reply to already replied command interactions', async () => {
      const repliedCommandInteraction = {
        ...mockCommandInteraction,
        replied: true
      }

      const error = new Error('Command error')
      commandManagerService.handleCommandInteraction.mockRejectedValueOnce(error)

      const interactionHandler = mockClient.on.mock.calls.find((call) => call[0] === 'interactionCreate')?.[1]

      await interactionHandler?.(repliedCommandInteraction)

      expect(repliedCommandInteraction.reply).not.toHaveBeenCalled()
    })
  })

  describe('Autocomplete Interaction Handling', () => {
    beforeEach(async () => {
      await service.initializeDiscord()
    })

    it('should handle autocomplete interaction successfully', async () => {
      const interactionHandler = mockClient.on.mock.calls.find((call) => call[0] === 'interactionCreate')?.[1]

      await interactionHandler?.(mockAutocompleteInteraction)

      expect(commandManagerService.handleAutocompleteInteraction).toHaveBeenCalledWith(mockAutocompleteInteraction)
    })

    it('should handle autocomplete interaction errors', async () => {
      const error = new Error('Autocomplete error')
      commandManagerService.handleAutocompleteInteraction.mockRejectedValueOnce(error)

      const interactionHandler = mockClient.on.mock.calls.find((call) => call[0] === 'interactionCreate')?.[1]

      await interactionHandler?.(mockAutocompleteInteraction)

      expect(mockLogger.error).toHaveBeenCalledWith(
        'オートコンプリート「test-autocomplete」の処理中にエラーが発生しました'
      )
    })
  })

  describe('Unprocessed Interaction Handling', () => {
    const mockButton = {
      id: 'test-button',
      name: 'Test Button',
      data: {
        setCustomId: jest.fn().mockReturnThis(),
        setLabel: jest.fn().mockReturnThis(),
        setStyle: jest.fn().mockReturnThis()
      } as any,
      execute: jest.fn().mockResolvedValue(undefined)
    } as any

    const mockModal = {
      id: 'test-modal',
      name: 'Test Modal',
      data: {
        setCustomId: jest.fn().mockReturnThis(),
        setTitle: jest.fn().mockReturnThis(),
        addComponents: jest.fn().mockReturnThis()
      } as any,
      execute: jest.fn().mockResolvedValue(undefined)
    } as any

    const mockSelect = {
      id: 'test-select',
      name: 'Test Select',
      data: {
        setCustomId: jest.fn().mockReturnThis(),
        setPlaceholder: jest.fn().mockReturnThis(),
        addOptions: jest.fn().mockReturnThis()
      } as any,
      execute: jest.fn().mockResolvedValue(undefined)
    } as any

    beforeEach(async () => {
      await service.initializeDiscord()
      service.registerButton(mockButton)
      service.registerModal(mockModal)
      service.registerSelectMenu(mockSelect)

      // Mock InteractionsService to return false (not handled)
      interactionsService.handleInteraction.mockResolvedValue(false)
    })

    it('should handle unprocessed button interaction', async () => {
      const interactionHandler = mockClient.on.mock.calls.find((call) => call[0] === 'interactionCreate')?.[1]

      await interactionHandler?.(mockButtonInteraction)

      expect(mockButton.execute).toHaveBeenCalledWith(mockButtonInteraction)
    })

    it('should handle unprocessed modal interaction', async () => {
      const interactionHandler = mockClient.on.mock.calls.find((call) => call[0] === 'interactionCreate')?.[1]

      await interactionHandler?.(mockModalInteraction)

      expect(mockModal.execute).toHaveBeenCalledWith(mockModalInteraction)
    })

    it('should handle unprocessed select interaction', async () => {
      const interactionHandler = mockClient.on.mock.calls.find((call) => call[0] === 'interactionCreate')?.[1]

      await interactionHandler?.(mockSelectInteraction)

      expect(mockSelect.execute).toHaveBeenCalledWith(mockSelectInteraction)
    })

    it('should handle unregistered button interaction', async () => {
      const unregisteredButtonInteraction = {
        ...mockButtonInteraction,
        customId: 'unregistered-button'
      }

      const interactionHandler = mockClient.on.mock.calls.find((call) => call[0] === 'interactionCreate')?.[1]

      await interactionHandler?.(unregisteredButtonInteraction)

      expect(mockLogger.warn).toHaveBeenCalledWith('未登録のボタン「unregistered-button」が押されました')
      expect(unregisteredButtonInteraction.reply).toHaveBeenCalledWith({
        content: '無効なボタンです。管理者に問い合わせてください。',
        ephemeral: true
      })
    })

    it('should handle button execution errors', async () => {
      const error = new Error('Button execution error')
      mockButton.execute.mockRejectedValueOnce(error)

      const interactionHandler = mockClient.on.mock.calls.find((call) => call[0] === 'interactionCreate')?.[1]

      await interactionHandler?.(mockButtonInteraction)

      expect(mockLogger.error).toHaveBeenCalledWith('ボタン「test-button」の処理中にエラーが発生しました')
      expect(mockButtonInteraction.reply).toHaveBeenCalledWith({
        content: 'ボタン処理中にエラーが発生しました。',
        ephemeral: true
      })
    })

    it('should handle custom ID with parameters', async () => {
      const parameterizedInteraction = {
        ...mockButtonInteraction,
        customId: 'test-button:param1:param2'
      }

      const interactionHandler = mockClient.on.mock.calls.find((call) => call[0] === 'interactionCreate')?.[1]

      await interactionHandler?.(parameterizedInteraction)

      expect(mockButton.execute).toHaveBeenCalledWith(parameterizedInteraction)
    })

    it('should skip already replied interactions in fallback', async () => {
      const repliedInteraction = {
        ...mockButtonInteraction,
        replied: true
      }

      const interactionHandler = mockClient.on.mock.calls.find((call) => call[0] === 'interactionCreate')?.[1]

      await interactionHandler?.(repliedInteraction)

      expect(mockButton.execute).not.toHaveBeenCalled()
    })

    it('should handle fallback processing errors', async () => {
      const error = new Error('Fallback error')
      mockButton.execute.mockRejectedValueOnce(error)

      const replyError = new Error('Reply error')
      mockButtonInteraction.reply.mockRejectedValueOnce(replyError)

      const interactionHandler = mockClient.on.mock.calls.find((call) => call[0] === 'interactionCreate')?.[1]

      await interactionHandler?.(mockButtonInteraction)

      expect(mockLogger.error).toHaveBeenCalledWith('ボタンエラー応答中にさらにエラーが発生しました')
    })
  })

  describe('Edge Cases and Error Handling', () => {
    beforeEach(async () => {
      await service.initializeDiscord()
    })

    it('should handle InteractionsService errors gracefully', async () => {
      const error = new Error('InteractionsService error')
      interactionsService.handleInteraction.mockRejectedValueOnce(error)

      const interactionHandler = mockClient.on.mock.calls.find((call) => call[0] === 'interactionCreate')?.[1]

      await interactionHandler?.(mockButtonInteraction)

      expect(mockLogger.error).toHaveBeenCalledWith('InteractionsServiceでの処理中にエラーが発生しました')
    })

    it('should clean up processed interactions after timeout', async () => {
      jest.useFakeTimers()

      const interactionHandler = mockClient.on.mock.calls.find((call) => call[0] === 'interactionCreate')?.[1]

      await interactionHandler?.(mockButtonInteraction)

      // Fast-forward 60 seconds
      jest.advanceTimersByTime(60000)

      // Try to process same interaction again - should not be marked as duplicate anymore
      await interactionHandler?.(mockButtonInteraction)

      expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining('は既に処理されています'))

      jest.useRealTimers()
    })

    it('should handle mixed interaction processing scenarios', async () => {
      // First, InteractionsService handles it
      interactionsService.handleInteraction.mockResolvedValueOnce(true)

      const interactionHandler = mockClient.on.mock.calls.find((call) => call[0] === 'interactionCreate')?.[1]

      await interactionHandler?.(mockButtonInteraction)

      // Should not reach fallback processing
      expect(mockLogger.log).not.toHaveBeenCalledWith(
        expect.stringContaining('InteractionsServiceで処理されなかったインタラクション')
      )
    })
  })
})
