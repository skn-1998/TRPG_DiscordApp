import { Test, TestingModule } from '@nestjs/testing'
import { Logger } from '@nestjs/common'
import { TextChannel } from 'discord.js'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { ChannelCreateOrchestratorService } from './channel-create-orchestrator.service'
import { ChannelDetectionService } from './channel-detection.service'
import { CharacterCreationService } from './character-creation.service'
import { CharacterNotificationService } from './character-notification.service'
import { TypedEventService } from '../../../../core/events/typed-event.service'
import { DiscordClientService } from '../../../services/discord-client.service'

describe('ChannelCreateOrchestratorService', () => {
  let service: ChannelCreateOrchestratorService
  let module: TestingModule
  let channelDetectionService: ChannelDetectionService
  let characterCreationService: CharacterCreationService
  let characterNotificationService: CharacterNotificationService
  let typedEventService: TypedEventService
  let discordClientService: DiscordClientService

  const mockTextChannel = {
    id: 'test-channel-id',
    name: 'test-character',
    setName: jest.fn().mockResolvedValue(undefined)
  } as unknown as TextChannel

  const mockChannelDetectionService = {
    detectCharacterChannel: jest.fn()
  }

  const mockCharacterCreationService = {
    createCharacter: jest.fn()
  }

  const mockCharacterNotificationService = {
    notifyCharacterCreation: jest.fn()
  }

  const mockTypedEventService = {
    emit: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    off: jest.fn()
  }

  const mockDiscordClientService = {
    getClient: jest.fn(() => ({
      channels: {
        cache: {
          get: jest.fn(() => mockTextChannel)
        }
      }
    }))
  }

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ChannelCreateOrchestratorService,
        {
          provide: ChannelDetectionService,
          useValue: mockChannelDetectionService
        },
        {
          provide: CharacterCreationService,
          useValue: mockCharacterCreationService
        },
        {
          provide: CharacterNotificationService,
          useValue: mockCharacterNotificationService
        },
        {
          provide: TypedEventService,
          useValue: mockTypedEventService
        },
        {
          provide: DiscordClientService,
          useValue: mockDiscordClientService
        }
      ]
    }).compile()

    service = moduleRef.get<ChannelCreateOrchestratorService>(ChannelCreateOrchestratorService)
    channelDetectionService = moduleRef.get<ChannelDetectionService>(ChannelDetectionService)
    characterCreationService = moduleRef.get<CharacterCreationService>(CharacterCreationService)
    characterNotificationService = moduleRef.get<CharacterNotificationService>(CharacterNotificationService)
    typedEventService = moduleRef.get<TypedEventService>(TypedEventService)
    discordClientService = moduleRef.get<DiscordClientService>(DiscordClientService)
    module = moduleRef

    // Reset mocks
    jest.clearAllMocks()

    // Reset mock implementations
    mockDiscordClientService.getClient.mockReturnValue({
      channels: {
        cache: {
          get: jest.fn(() => mockTextChannel)
        }
      }
    })
  })

  afterEach(async () => {
    await module.close()
  })

  describe('execute', () => {
    it('should emit character creation event through TypedEventService', async () => {
      const mockDetectionResult = {
        success: true,
        shouldCreateCharacter: true,
        context: {
          channel: mockTextChannel,
          categoryId: 'test-category-id',
          creatorId: 'test-user-id'
        }
      }

      mockChannelDetectionService.detectCharacterChannel.mockResolvedValue(mockDetectionResult)
      mockTypedEventService.emit.mockResolvedValue(undefined)

      const loggerSpy = jest.spyOn(Logger.prototype, 'log')

      await service.execute(mockTextChannel)

      // TypedEventServiceにcharacter.creation.requestedイベントが発行されることを確認
      expect(mockTypedEventService.emit).toHaveBeenCalledWith('character.creation.requested', {
        createData: {
          characterId: '', // サービス側で生成
          characterName: 'test-character',
          gameSystemId: '', // デフォルト値
          discordChannelId: 'test-channel-id',
          discordUserId: 'test-user-id'
        },
        userId: 'test-user-id',
        source: 'channel-create-orchestrator',
        timestamp: expect.any(Date)
      })

      expect(mockChannelDetectionService.detectCharacterChannel).toHaveBeenCalledWith(mockTextChannel)
      expect(loggerSpy).toHaveBeenCalledWith('キャラクター作成イベントを発火します')
      expect(loggerSpy).toHaveBeenCalledWith(
        'キャラクター作成イベントを発火しました。後続処理はイベントハンドラーで実行されます。'
      )
    })

    it('should handle detection failure gracefully', async () => {
      const mockDetectionResult = {
        success: false,
        shouldCreateCharacter: false,
        error: 'Detection failed'
      }

      mockChannelDetectionService.detectCharacterChannel.mockResolvedValue(mockDetectionResult)

      const loggerSpy = jest.spyOn(Logger.prototype, 'error')

      await service.execute(mockTextChannel)

      expect(loggerSpy).toHaveBeenCalledWith('チャンネル検出に失敗:', 'Detection failed')
      expect(mockCharacterCreationService.createCharacter).not.toHaveBeenCalled()
      expect(mockCharacterNotificationService.notifyCharacterCreation).not.toHaveBeenCalled()
    })

    it('should skip processing when should not create character', async () => {
      const mockDetectionResult = {
        success: true,
        shouldCreateCharacter: false
      }

      mockChannelDetectionService.detectCharacterChannel.mockResolvedValue(mockDetectionResult)

      await service.execute(mockTextChannel)

      expect(mockCharacterCreationService.createCharacter).not.toHaveBeenCalled()
      expect(mockCharacterNotificationService.notifyCharacterCreation).not.toHaveBeenCalled()
    })

    it('should handle character creation failure gracefully', async () => {
      const mockDetectionResult = {
        success: true,
        shouldCreateCharacter: true,
        context: {
          channel: mockTextChannel,
          categoryId: 'test-category-id',
          creatorId: 'test-user-id'
        }
      }

      const mockCreationResult = {
        success: false,
        error: 'Creation failed'
      }

      mockChannelDetectionService.detectCharacterChannel.mockResolvedValue(mockDetectionResult)
      mockCharacterCreationService.createCharacter.mockResolvedValue(mockCreationResult)

      const loggerSpy = jest.spyOn(Logger.prototype, 'error')

      await service.execute(mockTextChannel)

      expect(loggerSpy).toHaveBeenCalledWith('キャラクター作成に失敗:', 'Creation failed')
      expect(mockCharacterNotificationService.notifyCharacterCreation).not.toHaveBeenCalled()
    })

    it('should handle notification failure gracefully', async () => {
      const mockDetectionResult = {
        success: true,
        shouldCreateCharacter: true,
        context: {
          channel: mockTextChannel,
          categoryId: 'test-category-id',
          creatorId: 'test-user-id'
        }
      }

      const mockCreationResult = {
        success: true,
        characterId: 'test-character-id',
        characterName: 'test-character'
      }

      mockChannelDetectionService.detectCharacterChannel.mockResolvedValue(mockDetectionResult)
      mockCharacterCreationService.createCharacter.mockResolvedValue(mockCreationResult)
      mockCharacterNotificationService.notifyCharacterCreation.mockRejectedValue(new Error('Notification failed'))

      const loggerSpy = jest.spyOn(Logger.prototype, 'error')

      await service.execute(mockTextChannel)

      expect(loggerSpy).toHaveBeenCalledWith('チャンネル作成処理で予期しないエラーが発生:', expect.any(Error))
    })

    it('should handle missing context gracefully', async () => {
      const mockDetectionResult = {
        success: true,
        shouldCreateCharacter: true,
        context: undefined
      }

      mockChannelDetectionService.detectCharacterChannel.mockResolvedValue(mockDetectionResult)

      await service.execute(mockTextChannel)

      expect(mockCharacterCreationService.createCharacter).not.toHaveBeenCalled()
      expect(mockCharacterNotificationService.notifyCharacterCreation).not.toHaveBeenCalled()
    })
  })

  describe('Event Handlers', () => {
    beforeEach(() => {
      // onModuleInitを呼び出してイベントリスナーを登録
      service.onModuleInit()
    })

    describe('handleCharacterCreationCompleted', () => {
      it('should handle character creation success event', async () => {
        const mockCharacter = {
          characterId: 'test-char-id',
          characterName: 'Test Character',
          discordChannelId: 'test-channel-id'
        }

        const payload = {
          character: mockCharacter,
          source: 'character-service',
          timestamp: new Date()
        }

        // イベントハンドラーが登録されていることを確認
        expect(mockTypedEventService.on).toHaveBeenCalledWith('character.creation.completed', expect.any(Function))

        // 登録されたハンドラーを取得して実行
        const registeredHandler = mockTypedEventService.on.mock.calls.find(
          (call) => call[0] === 'character.creation.completed'
        )[1]

        const loggerSpy = jest.spyOn(Logger.prototype, 'log')

        await registeredHandler(payload)

        expect(loggerSpy).toHaveBeenCalledWith('キャラクター作成成功: Test Character (ID: test-char-id)')
        expect(mockCharacterNotificationService.notifyCharacterCreation).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'test-channel-id',
            name: 'test-character'
          }),
          'test-char-id',
          'Test Character'
        )
        expect(loggerSpy).toHaveBeenCalledWith('チャンネル作成処理が正常に完了しました')
      })

      it('should handle channel name synchronization', async () => {
        const mockCharacter = {
          characterId: 'test-char-id',
          characterName: 'Test Character With Spaces!',
          discordChannelId: 'test-channel-id'
        }

        const payload = {
          character: mockCharacter,
          source: 'character-service',
          timestamp: new Date()
        }

        const registeredHandler = mockTypedEventService.on.mock.calls.find(
          (call) => call[0] === 'character.creation.completed'
        )[1]

        // setNameの呼び出しをトリガーするため、異なる名前を設定
        Object.defineProperty(mockTextChannel, 'name', {
          value: 'old-channel-name',
          writable: true,
          configurable: true
        })

        const loggerSpy = jest.spyOn(Logger.prototype, 'log')

        await registeredHandler(payload)

        expect(mockTextChannel.setName).toHaveBeenCalledWith(
          'test-character-with-spaces',
          'キャラクター名を反映: Test Character With Spaces!'
        )
        expect(loggerSpy).toHaveBeenCalledWith(
          'チャンネル名をキャラクター名に同期しました: Test Character With Spaces! → test-character-with-spaces'
        )
      })

      it('should handle missing channel gracefully', async () => {
        const mockCharacter = {
          characterId: 'test-char-id',
          characterName: 'Test Character',
          discordChannelId: 'non-existent-channel-id'
        }

        const payload = {
          character: mockCharacter,
          source: 'character-service',
          timestamp: new Date()
        }

        // DiscordClientServiceが存在しないチャンネルを返すように設定
        const mockClient = {
          channels: {
            cache: {
              get: jest.fn().mockReturnValue(null)
            }
          }
        }
        mockDiscordClientService.getClient.mockReturnValue(mockClient)

        const registeredHandler = mockTypedEventService.on.mock.calls.find(
          (call) => call[0] === 'character.creation.completed'
        )[1]

        const loggerSpy = jest.spyOn(Logger.prototype, 'warn')

        await registeredHandler(payload)

        expect(loggerSpy).toHaveBeenCalledWith('チャンネルが見つかりません: non-existent-channel-id')
        expect(mockCharacterNotificationService.notifyCharacterCreation).not.toHaveBeenCalled()
      })
    })

    describe('handleCharacterCreationFailed', () => {
      it('should handle character creation failure event', async () => {
        const payload = {
          createData: {
            characterName: 'Failed Character',
            discordChannelId: 'test-channel-id'
          },
          error: 'Database connection error',
          source: 'character-service',
          timestamp: new Date()
        }

        expect(mockTypedEventService.on).toHaveBeenCalledWith('character.creation.failed', expect.any(Function))

        const registeredHandler = mockTypedEventService.on.mock.calls.find(
          (call) => call[0] === 'character.creation.failed'
        )[1]

        const loggerSpy = jest.spyOn(Logger.prototype, 'error')
        const debugSpy = jest.spyOn(Logger.prototype, 'debug')

        await registeredHandler(payload)

        expect(loggerSpy).toHaveBeenCalledWith('キャラクター作成失敗: Database connection error')
        expect(debugSpy).toHaveBeenCalledWith('失敗した作成データ:', payload.createData)
      })
    })
  })

  describe('sanitizeChannelName', () => {
    it('should sanitize channel name according to Discord constraints', () => {
      // privateメソッドのテストのため、any型でアクセス
      const sanitize = (service as any).sanitizeChannelName.bind(service)

      // 基本的なサニタイゼーション
      expect(sanitize('Test Character')).toBe('test-character')
      expect(sanitize('Test Character!')).toBe('test-character')
      expect(sanitize('テスト キャラクター')).toBe('テスト-キャラクター')

      // 長い文字列の切り詰め
      const longName = 'a'.repeat(150)
      expect(sanitize(longName).length).toBeLessThanOrEqual(100)

      // 短すぎる文字列の処理
      expect(sanitize('a')).toBe('character-a')
      expect(sanitize('')).toBe('character')

      // ハイフンの処理
      expect(sanitize('---test---')).toBe('test')
      expect(sanitize('---')).toBe('character')
    })
  })
})
