import { Test, TestingModule } from '@nestjs/testing'
import { MongooseModule } from '@nestjs/mongoose'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { Logger } from '@nestjs/common'
import { CharacterService } from './character.service'
import { CharacterRepository } from './repositories/character.repository'
import { CharacterEventHandlerService } from './services/character-event-handler.service'
import { UserService } from '../user/user.service'
import { AppConfigService } from '../../config/config.service'
import { DiscordIntegrationService } from '../../discord/application/discord-integration.service'
import { TypedEventEmitter, TypedEventService } from '../../shared/application/typed-event.service'
import { Character, CharacterSchema, CHARACTER_MODEL } from './models/character.model'
import { CharacterInputDto, CreateCharacterDto } from './dto/create-character.dto'
import { v4 as uuidv4 } from 'uuid'
import { EventPayload } from '../../shared/domain/events/event-contracts'

/**
 * Character CRUD Events Integration Test
 * 実際のMongoDBを使用してCRUDイベントの動作を検証
 */
describe('Character CRUD Events Integration Test', () => {
  let module: TestingModule
  let characterService: CharacterService
  let characterRepository: CharacterRepository
  let characterEventHandler: CharacterEventHandlerService
  let typedEventService: TypedEventService
  let typedEventEmitter: TypedEventEmitter

  // テスト用のMongoDB URI (MongoDB Atlas with test database)
  const baseUri = process.env.MONGODB_URI || 'mongodb://localhost:27017'
  const mongoUri = baseUri.includes('mongodb+srv://')
    ? baseUri.replace('/?', '/trpg_integration_test_db?')
    : 'mongodb://localhost:27017/trpg_integration_test_db'

  // モックサービス
  const mockUserService = {
    findUserById: jest.fn().mockResolvedValue({
      discordUserId: 'test-user-123',
      username: 'test-user'
    }),
    findOrCreateUser: jest.fn(),
    addCharacterId: jest.fn().mockResolvedValue(undefined)
  }

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'prototype.eventDriven') return false // 直接DB操作を行う
      return null
    })
  }

  const mockDiscordIntegrationService = {
    createCharacterChannel: jest.fn().mockResolvedValue({
      id: 'channel-123',
      name: 'test-channel'
    }),
    updateChannelName: jest.fn(),
    deleteChannel: jest.fn(),
    requestCharacterCreation: jest.fn().mockResolvedValue(undefined),
    requestCharacterUpdate: jest.fn().mockResolvedValue(undefined)
  }

  beforeEach(async () => {
    // イベント受信用のハンドラーを初期化
    const eventHandlers = {
      creationCompleted: jest.fn(),
      creationFailed: jest.fn(),
      updateCompleted: jest.fn(),
      updateFailed: jest.fn(),
      findCompleted: jest.fn(),
      findFailed: jest.fn()
    }

    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongoUri),
        MongooseModule.forFeature([{ name: CHARACTER_MODEL, schema: CharacterSchema }]),
        EventEmitterModule.forRoot({
          wildcard: false,
          delimiter: '.',
          maxListeners: 10,
          ignoreErrors: false
        })
      ],
      providers: [
        CharacterService,
        CharacterRepository,
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
          provide: TypedEventEmitter,
          useFactory: (service: TypedEventService) => new TypedEventEmitter(service),
          inject: [TypedEventService]
        },
        {
          provide: UserService,
          useValue: mockUserService
        },
        {
          provide: AppConfigService,
          useValue: mockConfigService
        },
        {
          provide: DiscordIntegrationService,
          useValue: mockDiscordIntegrationService
        }
      ]
    }).compile()

    characterService = module.get<CharacterService>(CharacterService)
    characterRepository = module.get<CharacterRepository>(CharacterRepository)
    characterEventHandler = module.get<CharacterEventHandlerService>(CharacterEventHandlerService)
    typedEventService = module.get<TypedEventService>(TypedEventService)
    typedEventEmitter = module.get<TypedEventEmitter>(TypedEventEmitter)

    // テスト開始前にデータベースをクリア
    await clearTestDatabase()

    // イベントハンドラーを登録
    typedEventService.on('character.creation.completed', eventHandlers.creationCompleted)
    typedEventService.on('character.creation.failed', eventHandlers.creationFailed)
    typedEventService.on('character.update.completed', eventHandlers.updateCompleted)
    typedEventService.on('character.update.failed', eventHandlers.updateFailed)
    typedEventService.on('character.findByChannelId.completed', eventHandlers.findCompleted)
    typedEventService.on('character.findByChannelId.failed', eventHandlers.findFailed)
  })

  afterEach(async () => {
    // テスト後にデータベースをクリア
    await clearTestDatabase()

    // イベントリスナーをクリア（undefined チェック）
    if (typedEventService) {
      typedEventService.removeAllListeners('character.creation.completed')
      typedEventService.removeAllListeners('character.creation.failed')
      typedEventService.removeAllListeners('character.update.completed')
      typedEventService.removeAllListeners('character.update.failed')
      typedEventService.removeAllListeners('character.findByChannelId.completed')
      typedEventService.removeAllListeners('character.findByChannelId.failed')
    }

    await module.close()
  })

  /**
   * テスト用データベースクリア
   */
  async function clearTestDatabase(): Promise<void> {
    try {
      const characters = await characterRepository.findAll()
      for (const char of characters) {
        await characterRepository.remove(char.characterId)
      }
    } catch (error) {
      console.warn('Database clear warning:', error)
    }
  }

  /**
   * CREATE操作のテスト
   */
  describe('Character Creation Events', () => {
    it('should create character and emit creation.completed event', async () => {
      // Arrange - 新しいAttributeValue形式でテストデータを作成
      const createData: CharacterInputDto = {
        characterId: uuidv4(),
        characterName: 'Test Character',
        gameSystemId: 'coc',
        discordUserId: 'test-user-123',
        discordChannelId: 'test-channel-456',
        status: {
          HP: {
            name: 'HP',
            index: 1,
            values: { base: 50, other: 0 },
            description: 'ヒットポイント',
            isVisible: true
          }
        },
        parameter: {
          STR: {
            name: 'STR',
            index: 1,
            values: { base: 13, other: 0 },
            description: '筋力',
            isVisible: true
          }
        }
      }

      let createdCharacter: Character | null = null
      let eventReceived = false

      // イベントリスナーを設定
      typedEventService.once(
        'character.creation.completed',
        (payload: EventPayload<'character.creation.completed'>) => {
          createdCharacter = payload.character
          eventReceived = true
        }
      )

      // Act
      const result = await characterService.create(createData)

      // イベント発火を待機
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Assert - サービスからの戻り値検証
      expect(result).toBeDefined()
      expect(result.characterId).toBe(createData.characterId)
      expect(result.characterName).toBe(createData.characterName)
      expect(result.gameSystemId).toBe(createData.gameSystemId)
      expect(result.discordUserId).toBe(createData.discordUserId)
      expect(result.discordChannelId).toBe(createData.discordChannelId)

      // Assert - データベース永続化検証
      const savedCharacter = await characterRepository.findById(createData.characterId!)
      expect(savedCharacter).not.toBeNull()
      expect(savedCharacter!.characterName).toBe(createData.characterName)
      expect(savedCharacter!.status).toEqual(createData.status)
      expect(savedCharacter!.parameter).toEqual(createData.parameter)

      // Assert - イベント発火検証
      expect(eventReceived).toBe(true)
      expect(createdCharacter).not.toBeNull()
      expect(createdCharacter!.characterId).toBe(createData.characterId)
    })

    it('should emit creation.failed event when duplicate characterId', async () => {
      // Arrange
      const characterId = uuidv4()
      const createData: CharacterInputDto = {
        characterId,
        characterName: 'Test Character',
        gameSystemId: 'coc',
        discordUserId: 'test-user-123',
        discordChannelId: 'test-channel-456'
      }

      let errorReceived = ''
      let failedEventReceived = false

      // 最初にキャラクターを作成
      await characterService.create(createData)

      // 失敗イベントリスナーを設定
      typedEventService.once('character.creation.failed', (payload: EventPayload<'character.creation.failed'>) => {
        errorReceived = payload.error
        failedEventReceived = true
      })

      // Act - 同じIDで再度作成を試行
      try {
        await characterService.create(createData)
      } catch (error) {
        // エラーは期待される
      }

      // イベント発火を待機
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Assert
      expect(failedEventReceived).toBe(true)
      expect(errorReceived).toContain('duplicate')
    })
  })

  /**
   * READ操作のテスト
   */
  describe('Character Find Events', () => {
    let testCharacter: Character

    beforeEach(async () => {
      // テスト用キャラクターを作成
      const createData: CharacterInputDto = {
        characterId: uuidv4(),
        characterName: 'Find Test Character',
        gameSystemId: 'coc',
        discordUserId: 'test-user-123',
        discordChannelId: 'find-test-channel-456'
      }

      testCharacter = await characterService.create(createData)
      // 作成完了まで待機
      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    it('should find character by channelId and emit findByChannelId.completed event', async () => {
      // Arrange
      let foundCharacter: Character | null = null
      let eventReceived = false

      typedEventService.once(
        'character.findByChannelId.completed',
        (payload: EventPayload<'character.findByChannelId.completed'>) => {
          foundCharacter = payload.character
          eventReceived = true
        }
      )

      // Act
      await typedEventEmitter.requestCharacterByChannelId(testCharacter.discordChannelId, 'integration-test')

      // イベント発火を待機
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Assert
      expect(eventReceived).toBe(true)
      expect(foundCharacter).not.toBeNull()
      expect(foundCharacter!.characterId).toBe(testCharacter.characterId)
      expect(foundCharacter!.characterName).toBe(testCharacter.characterName)
    })

    it('should emit findByChannelId.completed with null character for non-existent channel', async () => {
      // Arrange
      let foundCharacter: Character | null = null
      let eventReceived = false

      typedEventService.once(
        'character.findByChannelId.completed',
        (payload: EventPayload<'character.findByChannelId.completed'>) => {
          foundCharacter = payload.character
          eventReceived = true
        }
      )

      // Act
      await typedEventEmitter.requestCharacterByChannelId('non-existent-channel-id', 'integration-test')

      // イベント発火を待機
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Assert
      expect(eventReceived).toBe(true)
      expect(foundCharacter).toBeNull() // キャラクターが見つからない場合はnull
    })
  })

  /**
   * UPDATE操作のテスト
   */
  describe('Character Update Events', () => {
    let testCharacter: Character

    beforeEach(async () => {
      // テスト用キャラクターを作成
      const createData: CharacterInputDto = {
        characterId: uuidv4(),
        characterName: 'Update Test Character',
        gameSystemId: 'coc',
        discordUserId: 'test-user-123',
        discordChannelId: 'update-test-channel-456',
        status: {
          HP: {
            name: 'HP',
            index: 1,
            values: { base: 50, other: 0 },
            description: 'ヒットポイント',
            isVisible: true
          }
        }
      }

      testCharacter = await characterService.create(createData)
      // 作成完了まで待機
      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    it('should update character and emit update.completed event', async () => {
      // Arrange - 新しいAttributeValue形式での更新データ
      const updateData = {
        status: {
          HP: {
            name: 'HP',
            index: 1,
            values: { base: 30, other: 0 },
            description: 'ヒットポイント',
            isVisible: true
          },
          MP: {
            name: 'MP',
            index: 2,
            values: { base: 20, other: 5 },
            description: 'マジックポイント',
            isVisible: true
          }
        }
      }

      let updatedCharacter: Character | null = null
      let eventReceived = false

      typedEventService.once('character.update.completed', (payload: EventPayload<'character.update.completed'>) => {
        updatedCharacter = payload.character
        eventReceived = true
      })

      // Act
      await typedEventEmitter.requestCharacterUpdate(testCharacter.discordChannelId, updateData, 'integration-test')

      // イベント発火を待機
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Assert - イベント検証
      expect(eventReceived).toBe(true)
      expect(updatedCharacter).not.toBeNull()
      expect(updatedCharacter!.characterId).toBe(testCharacter.characterId)

      // Assert - データベース更新検証
      const savedCharacter = await characterRepository.findById(testCharacter.characterId)
      expect(savedCharacter).not.toBeNull()
      expect(savedCharacter!.status).toEqual(updateData.status)
      expect((savedCharacter!.status as any).HP.values.base).toBe(30)
      expect((savedCharacter!.status as any).MP.values.base).toBe(20)
      expect((savedCharacter!.status as any).MP.values.other).toBe(5)
    })

    it('should handle update request for non-existent character gracefully', async () => {
      // Arrange
      const updateData = {
        status: {
          HP: {
            name: 'HP',
            index: 1,
            values: { base: 999, other: 0 },
            description: 'ヒットポイント',
            isVisible: true
          }
        }
      }

      let completedEventReceived = false
      let failedEventReceived = false

      typedEventService.once('character.update.completed', () => {
        completedEventReceived = true
      })

      typedEventService.once('character.update.failed', () => {
        failedEventReceived = true
      })

      // Act
      await typedEventEmitter.requestCharacterUpdate('non-existent-channel-id', updateData, 'integration-test')

      // イベント発火を待機
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Assert - 存在しないチャンネルの場合、更新に失敗するか完了するかを確認
      expect(completedEventReceived || failedEventReceived).toBe(true)
      if (failedEventReceived) {
        expect(completedEventReceived).toBe(false)
      }
    })
  })

  /**
   * DELETE操作のテスト（将来の拡張用）
   */
  describe('Character Delete Events', () => {
    it('should prepare for delete event implementation', async () => {
      // 現在のイベント契約にはdeleteイベントが定義されていないため、
      // 将来の実装に備えたプレースホルダー
      expect(true).toBe(true)
    })
  })

  /**
   * エンドツーエンドCRUDフローテスト
   */
  describe('End-to-End CRUD Flow', () => {
    it('should handle complete CRUD lifecycle with events', async () => {
      const characterId = uuidv4()
      const channelId = 'e2e-test-channel-789'

      // 1. CREATE - キャラクター作成
      const createData: CharacterInputDto = {
        characterId,
        characterName: 'E2E Test Character',
        gameSystemId: 'coc',
        discordUserId: 'test-user-123',
        discordChannelId: channelId,
        status: {
          HP: {
            name: 'HP',
            index: 1,
            values: { base: 100, other: 0 },
            description: 'ヒットポイント',
            isVisible: true
          }
        }
      }

      const createdCharacter = await characterService.create(createData)
      expect(createdCharacter.characterId).toBe(characterId)

      // 作成完了まで待機
      await new Promise((resolve) => setTimeout(resolve, 50))

      // 2. READ - 作成されたキャラクターの検索
      let foundCharacter: Character | null = null
      typedEventService.once('character.findByChannelId.completed', (payload) => {
        foundCharacter = payload.character
      })

      await typedEventEmitter.requestCharacterByChannelId(channelId, 'e2e-test')
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(foundCharacter).not.toBeNull()
      expect(foundCharacter!.characterId).toBe(characterId)

      // 3. UPDATE - キャラクターの更新
      const updateData = {
        status: {
          HP: {
            name: 'HP',
            index: 1,
            values: { base: 75, other: 0 },
            description: 'ヒットポイント',
            isVisible: true
          },
          MP: {
            name: 'MP',
            index: 2,
            values: { base: 50, other: 0 },
            description: 'マジックポイント',
            isVisible: true
          }
        }
      }

      let updatedCharacter: Character | null = null
      typedEventService.once('character.update.completed', (payload) => {
        updatedCharacter = payload.character
      })

      await typedEventEmitter.requestCharacterUpdate(channelId, updateData, 'e2e-test')
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(updatedCharacter).not.toBeNull()
      expect((updatedCharacter!.status as any).HP.values.base).toBe(75)
      expect((updatedCharacter!.status as any).MP.values.base).toBe(50)

      // 4. 最終検証 - データベース確認
      const finalCharacter = await characterRepository.findById(characterId)
      expect(finalCharacter).not.toBeNull()
      expect((finalCharacter!.status as any).HP.values.base).toBe(75)
      expect((finalCharacter!.status as any).MP.values.base).toBe(50)
    })
  })
})
