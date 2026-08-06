import { Test, TestingModule } from '@nestjs/testing'
import { Logger } from '@nestjs/common'
import { TextChannel } from 'discord.js'
import { ChannelCreateOrchestratorService } from './channel-create-orchestrator.service'
import { ChannelDetectionService } from './channel-detection.service'
import { CharacterNotificationService } from './character-notification.service'
import { TypedEventService } from '../../../../core/events/typed-event.service'
import { DiscordClientService } from '../../../services/discord-client.service'

describe('ChannelCreateOrchestratorService', () => {
  let service: ChannelCreateOrchestratorService
  let module: TestingModule
  let channelDetectionService: ChannelDetectionService
  let characterNotificationService: CharacterNotificationService
  let typedEventService: TypedEventService
  let discordClientService: DiscordClientService

  const mockTextChannel = {
    id: 'test-channel-id',
    name: 'test-character',
    setName: jest.fn().mockResolvedValue(undefined)
  } as unknown as TextChannel

  const mockChannelDetectionService = {
    detectCharacterChannel: jest.fn(),
    isBotManagedChannel: jest.fn()
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
    getClient: jest.fn<any, []>(() => ({
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
    characterNotificationService = moduleRef.get<CharacterNotificationService>(CharacterNotificationService)
    typedEventService = moduleRef.get<TypedEventService>(TypedEventService)
    discordClientService = moduleRef.get<DiscordClientService>(DiscordClientService)
    module = moduleRef

    // Reset mocks
    jest.clearAllMocks()
    mockChannelDetectionService.isBotManagedChannel.mockReturnValue(false)

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
      expect(mockTypedEventService.emit).toHaveBeenCalledWith(
        'character.creation.requested',
        expect.objectContaining({
          createData: {
            characterName: 'test-character',
            gameSystemId: '', // デフォルト値
            discordUserId: 'test-user-id',
            discordChannelId: 'test-channel-id'
          },
          userId: 'test-user-id',
          source: 'channel-create-orchestrator',
          timestamp: expect.any(Date)
        })
      )

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
      expect(mockCharacterNotificationService.notifyCharacterCreation).not.toHaveBeenCalled()
    })

    it('should skip processing when should not create character', async () => {
      const mockDetectionResult = {
        success: true,
        shouldCreateCharacter: false
      }

      mockChannelDetectionService.detectCharacterChannel.mockResolvedValue(mockDetectionResult)

      await service.execute(mockTextChannel)

      expect(mockCharacterNotificationService.notifyCharacterCreation).not.toHaveBeenCalled()
    })

    it('should delegate creation to event handlers (no direct creation/notification calls)', async () => {
      // 現アーキテクチャ: execute はイベント発火のみ。
      // createCharacter / notifyCharacterCreation は File-based Event Handlers 側で実行される。
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

      await service.execute(mockTextChannel)

      expect(mockTypedEventService.emit).toHaveBeenCalledWith('character.creation.requested', expect.any(Object))
      expect(mockCharacterNotificationService.notifyCharacterCreation).not.toHaveBeenCalled()
    })

    it('should handle event emission failure gracefully', async () => {
      // emit が失敗した場合、execute は catch して予期しないエラーログを出す（再スローしない）。
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
      mockTypedEventService.emit.mockRejectedValue(new Error('Emit failed'))

      const loggerSpy = jest.spyOn(Logger.prototype, 'error')

      await service.execute(mockTextChannel)

      expect(loggerSpy).toHaveBeenCalledWith('チャンネル作成処理で予期しないエラーが発生:', expect.any(Error))
    })

    it('suppression登録済みのチャンネルではキャラクター作成イベントを発火しない', async () => {
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
      mockChannelDetectionService.isBotManagedChannel.mockReturnValue(true)
      const loggerSpy = jest.spyOn(Logger.prototype, 'log')

      await service.execute(mockTextChannel)

      expect(mockChannelDetectionService.isBotManagedChannel).toHaveBeenCalledWith('test-channel-id')
      expect(mockTypedEventService.emit).not.toHaveBeenCalled()
      expect(loggerSpy).toHaveBeenCalledWith(
        'Bot管理チャンネルのため自動キャラクター作成イベントをスキップ: test-channel-id'
      )
    })

    it('should log CHARACTER_ALREADY_EXISTS as a warning', async () => {
      const mockDetectionResult = {
        success: true,
        shouldCreateCharacter: true,
        context: {
          channel: mockTextChannel,
          categoryId: 'test-category-id',
          creatorId: 'test-user-id'
        }
      }
      const alreadyExistsError = Object.assign(new Error('Character already exists'), {
        code: 'CHARACTER_ALREADY_EXISTS'
      })
      mockChannelDetectionService.detectCharacterChannel.mockResolvedValue(mockDetectionResult)
      mockTypedEventService.emit.mockRejectedValue(alreadyExistsError)
      const loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn')
      const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error')

      await service.execute(mockTextChannel)

      expect(loggerWarnSpy).toHaveBeenCalledWith('同一チャンネルのキャラクターは既に存在するため、自動作成を終了します')
      expect(loggerErrorSpy).not.toHaveBeenCalledWith('チャンネル作成処理で予期しないエラーが発生:', alreadyExistsError)
    })

    it('should handle missing context gracefully', async () => {
      const mockDetectionResult = {
        success: true,
        shouldCreateCharacter: true,
        context: undefined
      }

      mockChannelDetectionService.detectCharacterChannel.mockResolvedValue(mockDetectionResult)

      await service.execute(mockTextChannel)

      expect(mockCharacterNotificationService.notifyCharacterCreation).not.toHaveBeenCalled()
    })
  })

  describe('onModuleInit', () => {
    it('should skip event listener registration (migrated to File-based Event Handlers)', () => {
      // 現アーキテクチャ: イベントリスナー登録は File-based Event Handlers に移行済みのため
      // onModuleInit では TypedEventService.on を呼ばない。
      service.onModuleInit()

      expect(mockTypedEventService.on).not.toHaveBeenCalled()
    })
  })

  describe('Event Handlers (private methods)', () => {
    // onModuleInit でリスナー登録されないため、private ハンドラーを直接呼び出して検証する。
    const setClientFetch = (channel: unknown): void => {
      mockDiscordClientService.getClient.mockReturnValue({
        channels: {
          fetch: jest.fn().mockResolvedValue(channel)
        }
      })
    }

    describe('handleCharacterCreationCompleted', () => {
      it('should handle character creation success event', async () => {
        Object.defineProperty(mockTextChannel, 'name', {
          value: 'test-character',
          writable: true,
          configurable: true
        })
        ;(mockTextChannel as unknown as { isTextBased: () => boolean }).isTextBased = jest.fn(() => true)
        setClientFetch(mockTextChannel)

        const handler = (service as any).handleCharacterCreationCompleted.bind(service)

        const payload = {
          character: {
            characterId: 'test-char-id',
            characterName: 'test-character',
            discordChannelId: 'test-channel-id'
          },
          source: 'character-service',
          timestamp: new Date()
        }

        const loggerSpy = jest.spyOn(Logger.prototype, 'log')

        await handler(payload)

        expect(loggerSpy).toHaveBeenCalledWith('キャラクター作成成功: test-character (ID: test-char-id)')
        expect(mockCharacterNotificationService.notifyCharacterCreation).toHaveBeenCalledWith(
          mockTextChannel,
          'test-char-id',
          'test-character'
        )
      })

      it('should handle channel name synchronization', async () => {
        Object.defineProperty(mockTextChannel, 'name', {
          value: 'old-channel-name',
          writable: true,
          configurable: true
        })
        ;(mockTextChannel as unknown as { isTextBased: () => boolean }).isTextBased = jest.fn(() => true)
        setClientFetch(mockTextChannel)

        const handler = (service as any).handleCharacterCreationCompleted.bind(service)

        const payload = {
          character: {
            characterId: 'test-char-id',
            characterName: 'Test Character With Spaces!',
            discordChannelId: 'test-channel-id'
          },
          source: 'character-service',
          timestamp: new Date()
        }

        const loggerSpy = jest.spyOn(Logger.prototype, 'log')

        await handler(payload)

        expect(mockTextChannel.setName).toHaveBeenCalledWith(
          'test-character-with-spaces',
          'キャラクター名を反映: Test Character With Spaces!'
        )
        expect(loggerSpy).toHaveBeenCalledWith(
          'チャンネル名をキャラクター名に同期しました: Test Character With Spaces! → test-character-with-spaces'
        )
      })

      it('should handle missing channel gracefully', async () => {
        setClientFetch(null)

        const handler = (service as any).handleCharacterCreationCompleted.bind(service)

        const payload = {
          character: {
            characterId: 'test-char-id',
            characterName: 'Test Character',
            discordChannelId: 'non-existent-channel-id'
          },
          source: 'character-service',
          timestamp: new Date()
        }

        const loggerSpy = jest.spyOn(Logger.prototype, 'warn')

        await handler(payload)

        expect(loggerSpy).toHaveBeenCalledWith('チャンネルが見つかりません: non-existent-channel-id')
        expect(mockCharacterNotificationService.notifyCharacterCreation).not.toHaveBeenCalled()
      })
    })

    // 注: handleCharacterCreationFailed の describe は、メソッド本体が E-3 残骸
    //     （listener 未登録・dead contract 型参照のみ）として E-4a で削除されたため撤去した。
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
