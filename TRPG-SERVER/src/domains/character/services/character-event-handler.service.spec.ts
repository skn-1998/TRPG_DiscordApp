import { Test, TestingModule } from '@nestjs/testing'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { CharacterEventHandlerService } from './character-event-handler.service'
import { CharacterRepository } from '../repositories/character.repository'
import { UserService } from '../../user/user.service'
import { TypedEventService } from '../../../core/events/typed-event.service'
import { Character } from '../models/character.model'

/**
 * CharacterEventHandlerService テスト
 *
 * 現行仕様（重要）:
 * このサービスはレガシー化されており、すべてのイベントリスナー登録は File-based Event Handlers
 * （src/events/handlers/character.*.requested.ts）へ移行済み。重複登録を避けるため、
 * `onModuleInit` / `registerEventListeners` はリスナーを一切登録しない。
 *
 * したがって本 spec は「初期化が安全に完了し、何もリスナーを登録しないこと」と、
 * 「リクエストイベントを emit してもこのサービス由来の completed/failed が発行されないこと」を固定する。
 * 実際の CRUD イベント処理の検証は File-based Event Handlers 側の spec が担う。
 */
describe('CharacterEventHandlerService', () => {
  let module: TestingModule
  let eventHandlerService: CharacterEventHandlerService
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
    typedEventService = module.get<TypedEventService>(TypedEventService)

    jest.clearAllMocks()
  })

  afterEach(async () => {
    await module.close()
  })

  describe('onModuleInit', () => {
    it('should complete initialization without throwing', () => {
      expect(() => eventHandlerService.onModuleInit()).not.toThrow()
    })

    it('should NOT register any event listener (migrated to File-based Event Handlers)', () => {
      const onSpy = jest.spyOn(typedEventService, 'on')

      eventHandlerService.onModuleInit()

      // レガシー化によりリスナー登録は無効化されている
      expect(onSpy).not.toHaveBeenCalled()

      onSpy.mockRestore()
    })

    it('should not react to requested events (no handler registered by this service)', async () => {
      eventHandlerService.onModuleInit()

      let completedReceived = false
      typedEventService.on('character.findByChannelId.completed', () => {
        completedReceived = true
      })

      // このサービスはリスナーを登録しないため、completed は発行されない
      await typedEventService.emit('character.findByChannelId.requested', {
        channelId: 'test-channel-id',
        source: 'test',
        timestamp: new Date()
      })

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(mockCharacterRepository.findByChannelId).not.toHaveBeenCalled()
      expect(completedReceived).toBe(false)
    })

    it('should not trigger repository create on creation.requested', async () => {
      eventHandlerService.onModuleInit()

      mockCharacterRepository.create.mockResolvedValue(mockCharacter)

      await typedEventService.emit('character.creation.requested', {
        createData: {
          characterName: 'New Character',
          gameSystemId: 'coc',
          discordUserId: 'test-user-id',
          discordChannelId: 'test-channel-id'
        },
        userId: 'test-user-id',
        source: 'test',
        timestamp: new Date()
      })

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(mockCharacterRepository.create).not.toHaveBeenCalled()
      expect(mockUserService.addCharacterId).not.toHaveBeenCalled()
    })
  })
})
