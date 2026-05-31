import { Test, TestingModule } from '@nestjs/testing'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { CharacterEventHandlerService } from './character-event-handler.service'
import { CharacterRepository } from '../repositories/character.repository'
import { UserService } from '../../user/user.service'
import { TypedEventService } from '../../../core/events/typed-event.service'
import { Character } from '../models/character.model'
import { v4 as uuidv4 } from 'uuid'

/**
 * CharacterEventHandlerService テスト
 * イベント駆動でのキャラクターCRUD操作の動作を検証
 */
describe('CharacterEventHandlerService', () => {
  let module: TestingModule
  let eventHandlerService: CharacterEventHandlerService
  let characterRepository: CharacterRepository
  let userService: UserService
  let typedEventService: TypedEventService

  const mockCharacter: Character = {
    characterId: 'test-character-id',
    characterName: 'Test Character',
    gameSystemId: 'coc',
    discordUserId: 'test-user-id',
    discordChannelId: 'test-channel-id',
    status: {},
    parameter: {},
    skill: {},
    item: {},
    description: {}
  }

  const mockCharacterRepository = {
    findById: jest.fn(),
    findByChannelId: jest.fn(),
    findByName: jest.fn(),
    create: jest.fn(),
    updateByChannelId: jest.fn()
  }

  const mockUserService = {
    addCharacterId: jest.fn()
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
        }
      ]
    }).compile()

    eventHandlerService = module.get<CharacterEventHandlerService>(CharacterEventHandlerService)
    characterRepository = module.get<CharacterRepository>(CharacterRepository)
    userService = module.get<UserService>(UserService)
    typedEventService = module.get<TypedEventService>(TypedEventService)

    // 手動でonModuleInitを呼び出してイベントハンドラーを登録
    await eventHandlerService.onModuleInit()

    // モックをリセット
    jest.clearAllMocks()
  })

  afterEach(async () => {
    await module.close()
  })

  describe('character.findById イベント処理', () => {
    it('should emit character.findById.completed when character is found', async () => {
      // Arrange
      const characterId = 'test-character-id'
      mockCharacterRepository.findById.mockResolvedValue(mockCharacter)

      let completedEventReceived = false
      let receivedPayload: any

      // Act: イベントリスナーを登録
      typedEventService.on('character.findById.completed', (payload) => {
        completedEventReceived = true
        receivedPayload = payload
      })

      // findById.requestedイベントを発行
      await typedEventService.emit('character.findById.requested', {
        characterId,
        source: 'test',
        timestamp: new Date()
      })

      // イベント処理を待機
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Assert
      expect(mockCharacterRepository.findById).toHaveBeenCalledWith(characterId)
      expect(completedEventReceived).toBe(true)
      expect(receivedPayload).toEqual({
        characterId,
        character: mockCharacter,
        source: 'test',
        timestamp: expect.any(Date)
      })
    })

    it('should emit character.findById.failed when character is not found', async () => {
      // Arrange
      const characterId = 'non-existent-id'
      mockCharacterRepository.findById.mockResolvedValue(null)

      let failedEventReceived = false
      let receivedPayload: any

      // Act: イベントリスナーを登録
      typedEventService.on('character.findById.failed', (payload) => {
        failedEventReceived = true
        receivedPayload = payload
      })

      // findById.requestedイベントを発行
      await typedEventService.emit('character.findById.requested', {
        characterId,
        source: 'test',
        timestamp: new Date()
      })

      // イベント処理を待機
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Assert
      expect(mockCharacterRepository.findById).toHaveBeenCalledWith(characterId)
      expect(failedEventReceived).toBe(true)
      expect(receivedPayload).toEqual({
        characterId,
        error: 'Character not found',
        source: 'test',
        timestamp: expect.any(Date)
      })
    })

    it('should emit character.findById.failed when repository throws error', async () => {
      // Arrange
      const characterId = 'error-character-id'
      const errorMessage = 'Database connection failed'
      mockCharacterRepository.findById.mockRejectedValue(new Error(errorMessage))

      let failedEventReceived = false
      let receivedPayload: any

      // Act: イベントリスナーを登録
      typedEventService.on('character.findById.failed', (payload) => {
        failedEventReceived = true
        receivedPayload = payload
      })

      // findById.requestedイベントを発行
      await typedEventService.emit('character.findById.requested', {
        characterId,
        source: 'test',
        timestamp: new Date()
      })

      // イベント処理を待機
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Assert
      expect(mockCharacterRepository.findById).toHaveBeenCalledWith(characterId)
      expect(failedEventReceived).toBe(true)
      expect(receivedPayload).toEqual({
        characterId,
        error: errorMessage,
        source: 'test',
        timestamp: expect.any(Date)
      })
    })
  })

  describe('character.findByChannelId イベント処理', () => {
    it('should emit character.findByChannelId.completed when character is found', async () => {
      // Arrange
      const channelId = 'test-channel-id'
      mockCharacterRepository.findByChannelId.mockResolvedValue(mockCharacter)

      let completedEventReceived = false
      let receivedPayload: any

      // Act: イベントリスナーを登録
      typedEventService.on('character.findByChannelId.completed', (payload) => {
        completedEventReceived = true
        receivedPayload = payload
      })

      // findByChannelId.requestedイベントを発行
      await typedEventService.emit('character.findByChannelId.requested', {
        channelId,
        source: 'test',
        timestamp: new Date()
      })

      // イベント処理を待機
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Assert
      expect(mockCharacterRepository.findByChannelId).toHaveBeenCalledWith(channelId)
      expect(completedEventReceived).toBe(true)
      expect(receivedPayload).toEqual({
        channelId,
        character: mockCharacter,
        source: 'test',
        timestamp: expect.any(Date)
      })
    })

    it('should emit character.findByChannelId.completed with null when character is not found', async () => {
      // Arrange
      const channelId = 'non-existent-channel-id'
      mockCharacterRepository.findByChannelId.mockResolvedValue(null)

      let completedEventReceived = false
      let receivedPayload: any

      // Act: イベントリスナーを登録
      typedEventService.on('character.findByChannelId.completed', (payload) => {
        completedEventReceived = true
        receivedPayload = payload
      })

      // findByChannelId.requestedイベントを発行
      await typedEventService.emit('character.findByChannelId.requested', {
        channelId,
        source: 'test',
        timestamp: new Date()
      })

      // イベント処理を待機
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Assert
      expect(mockCharacterRepository.findByChannelId).toHaveBeenCalledWith(channelId)
      expect(completedEventReceived).toBe(true)
      expect(receivedPayload).toEqual({
        channelId,
        character: null, // 見つからない場合はnullで完了
        source: 'test',
        timestamp: expect.any(Date)
      })
    })
  })

  describe('character.creation イベント処理', () => {
    it('should emit character.creation.completed when character is created successfully', async () => {
      // Arrange
      const createData = {
        characterId: uuidv4(),
        characterName: 'New Character',
        gameSystemId: 'coc',
        discordUserId: 'test-user-id',
        discordChannelId: 'test-channel-id',
        status: {},
        skill: {},
        parameter: {}
      }

      mockCharacterRepository.create.mockResolvedValue(mockCharacter)
      mockUserService.addCharacterId.mockResolvedValue(undefined)

      let completedEventReceived = false
      let receivedPayload: any

      // Act: イベントリスナーを登録
      typedEventService.on('character.creation.completed', (payload) => {
        completedEventReceived = true
        receivedPayload = payload
      })

      // creation.requestedイベントを発行
      await typedEventService.emit('character.creation.requested', {
        createData,
        userId: createData.discordUserId,
        source: 'test',
        timestamp: new Date()
      })

      // イベント処理を待機
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Assert
      expect(mockCharacterRepository.create).toHaveBeenCalled()
      expect(mockUserService.addCharacterId).toHaveBeenCalledWith('test-user-id', createData.characterId)
      expect(completedEventReceived).toBe(true)
      expect(receivedPayload.character).toEqual(mockCharacter)
    })

    it('should emit character.creation.failed when creation fails', async () => {
      // Arrange
      const createData = {
        characterId: uuidv4(),
        characterName: 'Failed Character',
        gameSystemId: 'coc',
        discordUserId: 'test-user-id',
        discordChannelId: 'test-channel-id'
      }

      const errorMessage = 'Character creation failed'
      mockCharacterRepository.create.mockRejectedValue(new Error(errorMessage))

      let failedEventReceived = false
      let receivedPayload: any

      // Act: イベントリスナーを登録
      typedEventService.on('character.creation.failed', (payload) => {
        failedEventReceived = true
        receivedPayload = payload
      })

      // creation.requestedイベントを発行
      await typedEventService.emit('character.creation.requested', {
        createData,
        userId: createData.discordUserId,
        source: 'test',
        timestamp: new Date()
      })

      // イベント処理を待機
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Assert
      expect(failedEventReceived).toBe(true)
      expect(receivedPayload.error).toContain(errorMessage)
      expect(receivedPayload.createData).toEqual(createData)
    })
  })

  describe('イベントハンドラーのタイムアウト対応テスト', () => {
    it('should handle waitForEvent timeout correctly', async () => {
      // Arrange
      const characterId = uuidv4()

      // リポジトリが応答しない状態をシミュレート
      mockCharacterRepository.findById.mockImplementation(() => {
        return new Promise(() => {}) // 永続的に解決しない Promise
      })

      // Act & Assert
      const startTime = Date.now()

      const timeoutPromise = Promise.race([
        typedEventService.waitForEvent('character.findById.completed', 1000),
        typedEventService.waitForEvent('character.findById.failed', 1000)
      ]).catch((error) => {
        const duration = Date.now() - startTime
        expect(duration).toBeGreaterThanOrEqual(1000)
        expect(error.message).toContain('timeout')
        return { timeout: true }
      })

      // findById.requestedイベントを発行
      await typedEventService.emit('character.findById.requested', {
        characterId,
        source: 'timeout-test',
        timestamp: new Date()
      })

      const result = await timeoutPromise
      expect(result).toEqual({ timeout: true })
    }, 10000)
  })

  describe('イベントハンドラーの登録確認', () => {
    it('should register all required event handlers on module init', async () => {
      // Assert: すべての必要なイベントハンドラーが登録されているかを確認
      const requiredEvents = [
        'character.creation.requested',
        'character.update.requested',
        'character.findByChannelId.requested',
        'character.findById.requested',
        'character.findByName.requested'
      ]

      for (const eventName of requiredEvents) {
        const hasHandler = (typedEventService as any).listenerCount(eventName) > 0
        expect(hasHandler).toBe(true)
      }
    })
  })
})
