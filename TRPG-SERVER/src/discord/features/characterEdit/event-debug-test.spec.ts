import { Test, TestingModule } from '@nestjs/testing'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { CharacterEventHandlerService } from '../../../domains/character/services/character-event-handler.service'
import { CharacterRepository } from '../../../domains/character/repositories/character.repository'
import { UserService } from '../../../domains/user/user.service'
import { TypedEventService } from '../../../core/events/typed-event.service'
import { EnhancedCharacterEditService } from './enhanced-character-edit.service'
import { CharacterEmbedManagerService } from './services/character-embed-manager.service'
import { CharacterSectionEditorService } from './services/character-section-editor.service'
import { CharacterModalHandlerService } from './services/character-modal-handler.service'
import { DiscordClientService } from '../../services/discord-client.service'

/**
 * CharacterEdit Event Debug Test
 * イベントフローのデバッグと動作確認
 */
describe('CharacterEdit Event Debug Test', () => {
  let module: TestingModule
  let enhancedCharacterEditService: EnhancedCharacterEditService
  let characterEventHandler: CharacterEventHandlerService
  let typedEventService: TypedEventService

  const mockCharacterRepository = {
    findById: jest.fn(),
    findByChannelId: jest.fn(),
    create: jest.fn(),
    updateByChannelId: jest.fn()
  }

  const mockUserService = {
    addCharacterId: jest.fn()
  }

  const mockDiscordClientService = {
    getClient: jest.fn().mockReturnValue({
      channels: {
        fetch: jest.fn()
      }
    })
  }

  const mockEmbedManagerService = {
    createSectionedEmbeds: jest.fn()
  }

  const mockSectionEditorService = {
    execute: jest.fn()
  }

  const mockModalHandlerService = {
    handleModalSubmit: jest.fn()
  }

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        EventEmitterModule.forRoot({
          wildcard: false,
          delimiter: '.',
          maxListeners: 10,
          ignoreErrors: false
        })
      ],
      providers: [
        EnhancedCharacterEditService,
        CharacterEventHandlerService,
        TypedEventService,
        {
          provide: 'TYPED_EVENT_EMITTER',
          useFactory: () =>
            new (require('@nestjs/event-emitter').EventEmitter2)({
              wildcard: false,
              delimiter: '.',
              maxListeners: 10,
              ignoreErrors: false
            })
        },
        {
          provide: CharacterRepository,
          useValue: mockCharacterRepository
        },
        {
          provide: UserService,
          useValue: mockUserService
        },
        {
          provide: DiscordClientService,
          useValue: mockDiscordClientService
        },
        {
          provide: CharacterEmbedManagerService,
          useValue: mockEmbedManagerService
        },
        {
          provide: CharacterSectionEditorService,
          useValue: mockSectionEditorService
        },
        {
          provide: CharacterModalHandlerService,
          useValue: mockModalHandlerService
        }
      ]
    }).compile()

    enhancedCharacterEditService = module.get<EnhancedCharacterEditService>(EnhancedCharacterEditService)
    characterEventHandler = module.get<CharacterEventHandlerService>(CharacterEventHandlerService)
    typedEventService = module.get<TypedEventService>(TypedEventService)

    // 手動でonModuleInitを呼び出してイベントハンドラーを登録
    await characterEventHandler.onModuleInit()
    await enhancedCharacterEditService.onModuleInit()

    // モックをリセット
    jest.clearAllMocks()
  })

  afterEach(async () => {
    await module.close()
  })

  describe('Event Flow Debug', () => {
    it('should test EnhancedCharacterEditService emit -> CharacterEventHandlerService handler flow', async () => {
      const characterId = 'integration-test-character-id'
      const mockCharacter = {
        characterId,
        characterName: 'Integration Test Character',
        gameSystemId: 'coc',
        discordUserId: 'test-user-id',
        discordChannelId: 'test-channel-id',
        status: {},
        parameter: {},
        skill: {},
        item: {},
        description: {}
      }

      // リポジトリの準備
      mockCharacterRepository.findById.mockResolvedValue(mockCharacter)

      const eventLog: string[] = []

      // すべてのイベントをログ
      typedEventService.on('character.findById.requested', (payload) => {
        eventLog.push(`RECEIVED: character.findById.requested - ${payload.characterId}`)
      })

      typedEventService.on('character.findById.completed', (payload) => {
        eventLog.push(`RECEIVED: character.findById.completed - ${payload.characterId}`)
      })

      typedEventService.on('character.findById.failed', (payload) => {
        eventLog.push(`RECEIVED: character.findById.failed - ${payload.characterId}`)
      })

      // EnhancedCharacterEditServiceからイベントを発行
      await typedEventService.emit('character.findById.requested', {
        characterId,
        source: 'enhanced-character-edit',
        timestamp: new Date()
      })

      // イベント処理を待機
      await new Promise((resolve) => setTimeout(resolve, 200))

      // 検証
      expect(mockCharacterRepository.findById).toHaveBeenCalledWith(characterId)
      expect(eventLog).toContain(`RECEIVED: character.findById.requested - ${characterId}`)
      expect(eventLog).toContain(`RECEIVED: character.findById.completed - ${characterId}`)
    })

    it('should test direct event emission and reception', async () => {
      const characterId = 'direct-emit-test-character-id'
      const eventLog: string[] = []

      // イベントリスナーを登録
      typedEventService.on('character.findById.requested', (payload) => {
        eventLog.push(`RECEIVED: character.findById.requested - ${payload.characterId}`)
      })

      // イベントを直接発行
      await typedEventService.emit('character.findById.requested', {
        characterId,
        source: 'direct-emit-test',
        timestamp: new Date()
      })

      // 少し待機
      await new Promise((resolve) => setTimeout(resolve, 100))

      // 検証
      expect(eventLog).toContain(`RECEIVED: character.findById.requested - ${characterId}`)
    })

    it('should verify that event handlers are properly registered', async () => {
      // EventEmitter2のlistenerCountを確認
      const eventEmitter = (typedEventService as any).eventEmitter

      const requestedListenerCount = eventEmitter.listenerCount('character.findById.requested')
      const completedListenerCount = eventEmitter.listenerCount('character.findById.completed')

      console.log(`character.findById.requested listeners: ${requestedListenerCount}`)
      console.log(`character.findById.completed listeners: ${completedListenerCount}`)

      // 少なくとも1つのハンドラーが登録されているはず
      expect(requestedListenerCount).toBeGreaterThan(0)

      // リスナーの詳細を確認
      const listeners = eventEmitter.listeners('character.findById.requested')
      console.log('character.findById.requested listener details:', listeners.length)
    })

    it('should verify that CharacterEventHandlerService methods exist and can be called directly', async () => {
      console.log('\\n=== DIRECT METHOD CALL TEST START ===')

      const characterId = 'direct-test-character-id'
      const mockCharacter = {
        characterId,
        characterName: 'Direct Test Character',
        gameSystemId: 'coc',
        discordUserId: 'test-user-id',
        discordChannelId: 'test-channel-id',
        status: {},
        parameter: {},
        skill: {},
        item: {},
        description: {}
      }

      // 1. リポジトリの準備
      mockCharacterRepository.findById.mockResolvedValue(mockCharacter)
      console.log('1. Repository mock prepared')

      // 2. イベントログを追加
      const eventLog: string[] = []

      // イベントリスナーを登録
      typedEventService.on('character.findById.completed', (payload) => {
        eventLog.push(`RECEIVED: character.findById.completed - ${payload.characterId}`)
        console.log(`2. RECEIVED: character.findById.completed - ${payload.characterId}`)
      })

      typedEventService.on('character.findById.failed', (payload) => {
        eventLog.push(`RECEIVED: character.findById.failed - ${payload.characterId}`)
        console.log(`3. RECEIVED: character.findById.failed - ${payload.characterId}`)
      })

      // 3. CharacterEventHandlerServiceのメソッドを直接呼び出し
      console.log('4. Calling handleCharacterSearchByIdRequested directly...')

      await (characterEventHandler as any).handleCharacterSearchByIdRequested({
        characterId,
        source: 'direct-test',
        timestamp: new Date()
      })

      console.log('5. Direct method call completed')
      console.log('6. Event log:', eventLog)

      // 検証
      expect(mockCharacterRepository.findById).toHaveBeenCalledWith(characterId)
      expect(eventLog).toContain(`RECEIVED: character.findById.completed - ${characterId}`)

      console.log('=== DIRECT METHOD CALL TEST END ===\\n')
    }, 10000)

    it('should trace the complete event flow for character.findById', async () => {
      console.log('\n=== EVENT FLOW DEBUG START ===')

      const characterId = 'debug-character-id'
      const mockCharacter = {
        characterId,
        characterName: 'Debug Character',
        gameSystemId: 'coc',
        discordUserId: 'debug-user-id',
        discordChannelId: 'debug-channel-id',
        status: {},
        parameter: {},
        skill: {},
        item: {},
        description: {}
      }

      // 1. リポジトリの準備
      mockCharacterRepository.findById.mockResolvedValue(mockCharacter)
      console.log('1. Repository mock prepared')

      // 2. イベントログを追加
      const eventLog: string[] = []

      // すべてのイベントをログ
      typedEventService.on('character.findById.requested', (payload) => {
        eventLog.push(`RECEIVED: character.findById.requested - ${payload.characterId}`)
        console.log(`2. RECEIVED: character.findById.requested - ${payload.characterId}`)
      })

      typedEventService.on('character.findById.completed', (payload) => {
        eventLog.push(`RECEIVED: character.findById.completed - ${payload.characterId}`)
        console.log(`3. RECEIVED: character.findById.completed - ${payload.characterId}`)
      })

      typedEventService.on('character.findById.failed', (payload) => {
        eventLog.push(`RECEIVED: character.findById.failed - ${payload.characterId}`)
        console.log(`4. RECEIVED: character.findById.failed - ${payload.characterId}`)
      })

      // 3. getCharacterById を直接テスト
      console.log('5. Starting getCharacterById...')

      const result = await (enhancedCharacterEditService as any).getCharacterById(characterId)

      console.log('6. getCharacterById completed, result:', result)
      console.log('7. Event log:', eventLog)

      // 検証
      expect(mockCharacterRepository.findById).toHaveBeenCalledWith(characterId)
      expect(result).toEqual(mockCharacter)
      expect(eventLog).toContain(`RECEIVED: character.findById.requested - ${characterId}`)
      expect(eventLog).toContain(`RECEIVED: character.findById.completed - ${characterId}`)

      console.log('=== EVENT FLOW DEBUG END ===\n')
    }, 10000)

    it('should trace event flow when character is not found', async () => {
      console.log('\n=== NOT FOUND EVENT FLOW DEBUG START ===')

      const characterId = 'non-existent-character-id'

      // リポジトリはnullを返す
      mockCharacterRepository.findById.mockResolvedValue(null)
      console.log('1. Repository mock prepared to return null')

      const eventLog: string[] = []

      typedEventService.on('character.findById.requested', (payload) => {
        eventLog.push(`RECEIVED: character.findById.requested - ${payload.characterId}`)
        console.log(`2. RECEIVED: character.findById.requested - ${payload.characterId}`)
      })

      typedEventService.on('character.findById.completed', (payload) => {
        eventLog.push(`RECEIVED: character.findById.completed - ${payload.characterId}`)
        console.log(`3. RECEIVED: character.findById.completed - ${payload.characterId}`)
      })

      typedEventService.on('character.findById.failed', (payload) => {
        eventLog.push(`RECEIVED: character.findById.failed - ${payload.characterId}`)
        console.log(`4. RECEIVED: character.findById.failed - ${payload.characterId}`)
      })

      console.log('5. Starting getCharacterById for non-existent character...')

      const result = await (enhancedCharacterEditService as any).getCharacterById(characterId)

      console.log('6. getCharacterById completed, result:', result)
      console.log('7. Event log:', eventLog)

      expect(mockCharacterRepository.findById).toHaveBeenCalledWith(characterId)
      expect(result).toBeNull()
      expect(eventLog).toContain(`RECEIVED: character.findById.requested - ${characterId}`)
      expect(eventLog).toContain(`RECEIVED: character.findById.failed - ${characterId}`)

      console.log('=== NOT FOUND EVENT FLOW DEBUG END ===\n')
    }, 10000)

    it('should trace event timeout scenario', async () => {
      console.log('\n=== TIMEOUT EVENT FLOW DEBUG START ===')

      const characterId = 'timeout-character-id'

      // リポジトリが応答しない（永続的にpending）
      mockCharacterRepository.findById.mockImplementation(() => {
        console.log('2. Repository called but will never resolve...')
        return new Promise(() => {}) // 永続的に pending
      })

      const eventLog: string[] = []

      typedEventService.on('character.findById.requested', (payload) => {
        eventLog.push(`RECEIVED: character.findById.requested - ${payload.characterId}`)
        console.log(`3. RECEIVED: character.findById.requested - ${payload.characterId}`)
      })

      console.log('1. Starting getCharacterById with timeout scenario...')

      const startTime = Date.now()
      const result = await (enhancedCharacterEditService as any).getCharacterById(characterId)
      const duration = Date.now() - startTime

      console.log(`4. getCharacterById completed after ${duration}ms, result:`, result)
      console.log('5. Event log:', eventLog)

      expect(result).toBeNull()
      expect(duration).toBeGreaterThanOrEqual(5000) // 5秒のタイムアウト
      expect(eventLog).toContain(`RECEIVED: character.findById.requested - ${characterId}`)

      console.log('=== TIMEOUT EVENT FLOW DEBUG END ===\n')
    }, 10000)
  })
})
