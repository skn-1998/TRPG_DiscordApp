import { Test } from '@nestjs/testing'
import { DiscordChannelManagerService } from './discord-channel-manager.service'
import { AppConfigService } from '../../config/config.service'
import { MessageManagerService, ChannelCacheService, ChannelCreatorService } from './channel'

/**
 * DiscordChannelManagerService は MessageManager / ChannelCache / ChannelCreator の
 * 3 専門サービスを束ねる委譲オーケストレーター。
 * 各専門サービスを mock し、委譲・try/catch によるエラー時 null 返却・getStats 集約・
 * initialize の冪等性・sendMessageWithReply の直 fetch 分岐を検証する。
 */
describe('DiscordChannelManagerService', () => {
  let service: DiscordChannelManagerService
  let messageManager: jest.Mocked<Pick<MessageManagerService, 'sendMessage' | 'editMessage' | 'deleteMessages'>>
  let channelCache: jest.Mocked<Pick<ChannelCacheService, 'getChannel' | 'getCacheStats' | 'performMaintenance'>>
  let channelCreator: jest.Mocked<
    Pick<ChannelCreatorService, 'checkChannelPermissions' | 'getChannelInfo' | 'createChannel'>
  >

  const client = {} as never

  beforeEach(async () => {
    messageManager = {
      sendMessage: jest.fn(),
      editMessage: jest.fn(),
      deleteMessages: jest.fn().mockResolvedValue(undefined)
    }
    channelCache = {
      getChannel: jest.fn(),
      getCacheStats: jest.fn().mockReturnValue({
        channelCacheSize: 3,
        totalMessagesCached: 12,
        memoryUsageEstimate: 1024
      }),
      performMaintenance: jest.fn().mockResolvedValue(undefined)
    }
    channelCreator = {
      checkChannelPermissions: jest.fn(),
      getChannelInfo: jest.fn(),
      createChannel: jest.fn()
    }

    const moduleRef = await Test.createTestingModule({
      providers: [
        DiscordChannelManagerService,
        { provide: AppConfigService, useValue: { get: jest.fn() } },
        { provide: MessageManagerService, useValue: messageManager },
        { provide: ChannelCacheService, useValue: channelCache },
        { provide: ChannelCreatorService, useValue: channelCreator }
      ]
    }).compile()

    service = moduleRef.get(DiscordChannelManagerService)
  })

  describe('initialize / isInitialized', () => {
    it('初回は未初期化から初期化済みへ遷移する', async () => {
      // Arrange & Assert (前)
      expect(service.isInitialized()).toBe(false)

      // Act
      await service.initialize(client)

      // Assert
      expect(service.isInitialized()).toBe(true)
    })

    it('2 回目の initialize は冪等で状態を変えない', async () => {
      // Act
      await service.initialize(client)
      await service.initialize(client)

      // Assert
      expect(service.isInitialized()).toBe(true)
    })
  })

  describe('委譲メソッド', () => {
    it('getChannel は channelCache.getChannel に委譲する', async () => {
      // Arrange
      const channel = { id: 'c1' } as never
      channelCache.getChannel.mockResolvedValue(channel)

      // Act
      const result = await service.getChannel(client, 'c1')

      // Assert
      expect(result).toBe(channel)
      expect(channelCache.getChannel).toHaveBeenCalledWith(client, 'c1')
    })

    it('checkChannelPermissions は channelCreator の結果を整形して返す', async () => {
      // Arrange
      channelCreator.checkChannelPermissions.mockResolvedValue({
        hasAccess: true,
        permissions: { VIEW: true }
      } as never)

      // Act
      const result = await service.checkChannelPermissions(client, 'c1', 'u1', ['VIEW'])

      // Assert
      expect(result).toEqual({ hasAccess: true, permissions: { VIEW: true } })
      expect(channelCreator.checkChannelPermissions).toHaveBeenCalledWith(client, 'c1', 'u1', ['VIEW'])
    })

    it('getChannelInfo は channelCreator.getChannelInfo に委譲する', async () => {
      // Arrange
      const info = { id: 'c1', name: 'general', type: 'text' }
      channelCreator.getChannelInfo.mockResolvedValue(info as never)

      // Act
      const result = await service.getChannelInfo(client, 'c1')

      // Assert
      expect(result).toBe(info)
    })

    it('createChannel は channelCreator.createChannel に委譲する', async () => {
      // Arrange
      const created = { id: 'new' } as never
      channelCreator.createChannel.mockResolvedValue(created)

      // Act
      const result = await service.createChannel(client, 'g1', 'name')

      // Assert
      expect(result).toBe(created)
      expect(channelCreator.createChannel).toHaveBeenCalledWith(client, 'g1', 'name', undefined)
    })

    it('deleteMessages は messageManager.deleteMessages に委譲する', async () => {
      // Act
      await service.deleteMessages(client, 'c1', ['m1', 'm2'], 'cleanup')

      // Assert
      expect(messageManager.deleteMessages).toHaveBeenCalledWith(client, 'c1', ['m1', 'm2'], 'cleanup')
    })
  })

  describe('sendMessage（try/catch）', () => {
    it('成功時は messageManager の戻り値をそのまま返す', async () => {
      // Arrange
      const message = { id: 'm1' } as never
      messageManager.sendMessage.mockResolvedValue(message)

      // Act
      const result = await service.sendMessage(client, 'c1', 'hello')

      // Assert
      expect(result).toBe(message)
      expect(messageManager.sendMessage).toHaveBeenCalledWith(client, 'c1', 'hello', undefined)
    })

    it('messageManager が例外を投げた場合は null を返す', async () => {
      // Arrange
      messageManager.sendMessage.mockRejectedValue(new Error('send failed'))

      // Act
      const result = await service.sendMessage(client, 'c1', 'hello')

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('editMessage（try/catch）', () => {
    it('成功時は messageManager の戻り値を返す', async () => {
      // Arrange
      const message = { id: 'm1' } as never
      messageManager.editMessage.mockResolvedValue(message)

      // Act
      const result = await service.editMessage(client, 'c1', 'm1', 'new content')

      // Assert
      expect(result).toBe(message)
    })

    it('例外時は null を返す', async () => {
      // Arrange
      messageManager.editMessage.mockRejectedValue(new Error('edit failed'))

      // Act
      const result = await service.editMessage(client, 'c1', 'm1')

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('sendMessageWithReply（直 fetch 分岐）', () => {
    it('チャンネルが取得できない場合は null を返す', async () => {
      // Arrange
      channelCache.getChannel.mockResolvedValue(null)

      // Act
      const result = await service.sendMessageWithReply(client, 'c1', 'reply', 'm1')

      // Assert
      expect(result).toBeNull()
    })

    it('対象メッセージを fetch して reply した結果を返す', async () => {
      // Arrange
      const replyResult = { id: 'reply-msg' }
      const replyMessage = { reply: jest.fn().mockResolvedValue(replyResult) }
      const channel = { messages: { fetch: jest.fn().mockResolvedValue(replyMessage) } }
      channelCache.getChannel.mockResolvedValue(channel as never)

      // Act
      const result = await service.sendMessageWithReply(client, 'c1', 'reply text', 'm1')

      // Assert
      expect(channel.messages.fetch).toHaveBeenCalledWith('m1')
      expect(replyMessage.reply).toHaveBeenCalledWith('reply text')
      expect(result).toBe(replyResult)
    })

    it('fetch / reply で例外が発生した場合は null を返す', async () => {
      // Arrange
      const channel = { messages: { fetch: jest.fn().mockRejectedValue(new Error('not found')) } }
      channelCache.getChannel.mockResolvedValue(channel as never)

      // Act
      const result = await service.sendMessageWithReply(client, 'c1', 'reply', 'm1')

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('cleanup / getStats / 直接アクセサ', () => {
    it('cleanup は channelCache.performMaintenance を呼ぶ', async () => {
      // Act
      await service.cleanup()

      // Assert
      expect(channelCache.performMaintenance).toHaveBeenCalledTimes(1)
    })

    it('getStats はキャッシュ統計とサービス状態を集約して返す', async () => {
      // Act
      const stats = service.getStats()

      // Assert
      expect(stats.cache).toEqual({
        channelCacheSize: 3,
        totalMessagesCached: 12,
        memoryUsageEstimate: 1024
      })
      expect(stats.status.initialized).toBe(false)
      expect(stats.status.services).toEqual({
        messageManager: true,
        channelCache: true,
        channelCreator: true
      })
    })

    it('getStats の initialized は initialize 後 true になる', async () => {
      // Arrange
      await service.initialize(client)

      // Act
      const stats = service.getStats()

      // Assert
      expect(stats.status.initialized).toBe(true)
    })

    it('専門サービスへの直接アクセサは各インスタンスを返す', () => {
      // Act & Assert
      expect(service.getMessageManager()).toBe(messageManager)
      expect(service.getChannelCache()).toBe(channelCache)
      expect(service.getChannelCreator()).toBe(channelCreator)
    })
  })
})
