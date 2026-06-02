/// <reference types="jest" />

import { Test, TestingModule } from '@nestjs/testing'
import { Logger } from '@nestjs/common'
import { DiscordFacadeService } from './discord-facade.service'
import { DiscordClientService } from './services/discord-client.service'
import { InteractionsService } from './interactions/interactions.service'
import { CommandsService } from './commands/commands.service'
import { AppConfigService } from '../config/config.service'
import { CommandManagerService } from './services/command-manager.service'
import { TypedEventEmitter } from '../core/events/typed-event.service'
import { DiscordInteractionHandlerService } from './services/discord-interaction-handler.service'
import { DiscordGuildManagerService } from './services/discord-guild-manager.service'
import { DiscordChannelManagerService } from './services/discord-channel-manager.service'
import { PerformanceOrchestratorService } from './services/monitoring/performance-orchestrator.service'

describe('DiscordFacadeService', () => {
  let service: DiscordFacadeService

  // Discord クライアントのスタブ（getClient が返す実体）
  let clientStub: Record<string, unknown>

  // 注入する依存（すべて副作用の境界＝モック）
  let discordClientService: jest.Mocked<Pick<DiscordClientService, 'getClient' | 'initializeClient'>>
  let interactionsService: jest.Mocked<Pick<InteractionsService, 'loadClient'>>
  let commandsService: jest.Mocked<Pick<CommandsService, 'loadClient'>>
  let interactionHandler: jest.Mocked<Pick<DiscordInteractionHandlerService, 'initialize' | 'isInitialized'>>
  let guildManager: jest.Mocked<
    Pick<
      DiscordGuildManagerService,
      'initialize' | 'isInitialized' | 'verifyChannelAccess' | 'verifyGuildAccess' | 'getGuildInfo' | 'cleanup'
    >
  >
  let channelManager: jest.Mocked<
    Pick<
      DiscordChannelManagerService,
      'initialize' | 'isInitialized' | 'getChannelInfo' | 'sendMessage' | 'createChannel' | 'cleanup'
    >
  >
  let performanceOrchestrator: jest.Mocked<
    Pick<PerformanceOrchestratorService, 'startDiscordApiMonitoring' | 'getPerformanceSummary' | 'getSystemHealth'>
  >

  // metrics ラッパ（startDiscordApiMonitoring の戻り値）
  let metricsEnd: jest.Mock

  beforeEach(async () => {
    clientStub = { tag: 'client-stub' }

    discordClientService = {
      getClient: jest.fn().mockReturnValue(clientStub),
      initializeClient: jest.fn().mockResolvedValue(undefined)
    }
    interactionsService = { loadClient: jest.fn().mockResolvedValue(undefined) }
    commandsService = { loadClient: jest.fn().mockResolvedValue(undefined) }
    interactionHandler = {
      initialize: jest.fn().mockResolvedValue(undefined),
      isInitialized: jest.fn().mockReturnValue(false)
    }
    guildManager = {
      initialize: jest.fn().mockResolvedValue(undefined),
      isInitialized: jest.fn().mockReturnValue(false),
      verifyChannelAccess: jest.fn(),
      verifyGuildAccess: jest.fn(),
      getGuildInfo: jest.fn(),
      cleanup: jest.fn().mockResolvedValue(undefined)
    }
    channelManager = {
      initialize: jest.fn().mockResolvedValue(undefined),
      isInitialized: jest.fn().mockReturnValue(false),
      getChannelInfo: jest.fn(),
      sendMessage: jest.fn(),
      createChannel: jest.fn(),
      cleanup: jest.fn().mockResolvedValue(undefined)
    }

    // metrics ラッパは end を記録できるようモック化
    metricsEnd = jest.fn()
    performanceOrchestrator = {
      startDiscordApiMonitoring: jest.fn().mockReturnValue({ end: metricsEnd }),
      getPerformanceSummary: jest.fn(),
      getSystemHealth: jest.fn()
    }

    const typedEventEmitter = {} as TypedEventEmitter

    // ログ出力は副作用なので抑制（テスト出力を汚さない）
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        DiscordFacadeService,
        { provide: DiscordClientService, useValue: discordClientService },
        { provide: InteractionsService, useValue: interactionsService },
        { provide: CommandsService, useValue: commandsService },
        { provide: AppConfigService, useValue: {} },
        { provide: CommandManagerService, useValue: {} },
        { provide: TypedEventEmitter, useValue: typedEventEmitter },
        { provide: DiscordInteractionHandlerService, useValue: interactionHandler },
        { provide: DiscordGuildManagerService, useValue: guildManager },
        { provide: DiscordChannelManagerService, useValue: channelManager },
        { provide: PerformanceOrchestratorService, useValue: performanceOrchestrator }
      ]
    }).compile()

    service = moduleRef.get(DiscordFacadeService)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('constructor / getClient', () => {
    it('生成時に discordClientService.getClient の結果を保持し getClient で返す', () => {
      // Arrange / Act
      const client = service.getClient()

      // Assert
      expect(discordClientService.getClient).toHaveBeenCalledTimes(1)
      expect(client).toBe(clientStub)
    })
  })

  describe('initializeDiscord', () => {
    it('全サービスを並列初期化し client に typedEventEmitter をアタッチして end(true) を呼ぶ', async () => {
      // Arrange
      const typedEventEmitter = service['typedEventEmitter']

      // Act
      await service.initializeDiscord()

      // Assert: 各 loadClient/initialize へ client が渡る
      expect(interactionsService.loadClient).toHaveBeenCalledWith(clientStub)
      expect(commandsService.loadClient).toHaveBeenCalledWith(clientStub)
      expect(interactionHandler.initialize).toHaveBeenCalledWith(clientStub)
      expect(guildManager.initialize).toHaveBeenCalledWith(clientStub)
      expect(channelManager.initialize).toHaveBeenCalledWith(clientStub)
      // Discord Client 初期化
      expect(discordClientService.initializeClient).toHaveBeenCalledTimes(1)
      // typedEventEmitter のアタッチ
      expect((clientStub as Record<string, unknown>)['typedEventEmitter']).toBe(typedEventEmitter)
      // 成功メトリクス
      expect(performanceOrchestrator.startDiscordApiMonitoring).toHaveBeenCalledWith('discord.initialize', 'INIT')
      expect(metricsEnd).toHaveBeenCalledWith(true)
      expect(service.isInitialized()).toBe(true)
    })

    it('2回目の呼び出しは冪等で初期化処理を行わない', async () => {
      // Arrange
      await service.initializeDiscord()
      jest.clearAllMocks()

      // Act
      await service.initializeDiscord()

      // Assert: 何も呼ばれない
      expect(discordClientService.initializeClient).not.toHaveBeenCalled()
      expect(interactionsService.loadClient).not.toHaveBeenCalled()
      expect(performanceOrchestrator.startDiscordApiMonitoring).not.toHaveBeenCalled()
    })

    it('途中のサービス初期化が失敗するとエラーを再スローし initialized は false のまま', async () => {
      // Arrange
      const failure = new Error('init failed')
      guildManager.initialize.mockRejectedValue(failure)

      // Act / Assert
      await expect(service.initializeDiscord()).rejects.toBe(failure)
      expect(service.isInitialized()).toBe(false)
      // 失敗時は end(true) を呼ばない（initMetrics.end(true) には到達しない）
      expect(metricsEnd).not.toHaveBeenCalledWith(true)
    })
  })

  describe('verifyChannelAccess', () => {
    it('guildManager.verifyChannelAccess の hasAccess を返し end(true) を呼ぶ', async () => {
      // Arrange
      guildManager.verifyChannelAccess.mockResolvedValue({ hasAccess: true } as any)

      // Act
      const result = await service.verifyChannelAccess('ch1', 'user1')

      // Assert
      expect(result).toBe(true)
      expect(guildManager.verifyChannelAccess).toHaveBeenCalledWith(clientStub, 'ch1', 'user1')
      expect(metricsEnd).toHaveBeenCalledWith(true)
    })

    it('例外時は end(false) を呼びエラーを再スローする', async () => {
      // Arrange
      const failure = new Error('boom')
      guildManager.verifyChannelAccess.mockRejectedValue(failure)

      // Act / Assert
      await expect(service.verifyChannelAccess('ch1', 'user1')).rejects.toBe(failure)
      expect(metricsEnd).toHaveBeenCalledWith(false)
    })
  })

  describe('verifyGuildAccess', () => {
    it('guildManager.verifyGuildAccess の hasAccess を返し end(true) を呼ぶ', async () => {
      // Arrange
      guildManager.verifyGuildAccess.mockResolvedValue({ hasAccess: false } as any)

      // Act
      const result = await service.verifyGuildAccess('g1', 'user1')

      // Assert
      expect(result).toBe(false)
      expect(guildManager.verifyGuildAccess).toHaveBeenCalledWith(clientStub, 'g1', 'user1')
      expect(metricsEnd).toHaveBeenCalledWith(true)
    })

    it('例外時は end(false) を呼びエラーを再スローする', async () => {
      // Arrange
      const failure = new Error('boom')
      guildManager.verifyGuildAccess.mockRejectedValue(failure)

      // Act / Assert
      await expect(service.verifyGuildAccess('g1', 'user1')).rejects.toBe(failure)
      expect(metricsEnd).toHaveBeenCalledWith(false)
    })
  })

  describe('getChannelInfo', () => {
    it('channelManager.getChannelInfo が null なら null を返し end(true) を呼ぶ', async () => {
      // Arrange
      channelManager.getChannelInfo.mockResolvedValue(null as any)

      // Act
      const result = await service.getChannelInfo('ch1')

      // Assert
      expect(result).toBeNull()
      expect(metricsEnd).toHaveBeenCalledWith(true)
      expect(guildManager.getGuildInfo).not.toHaveBeenCalled()
    })

    it('guildId がある場合は guildManager.getGuildInfo で guild 情報をマージして返す', async () => {
      // Arrange
      channelManager.getChannelInfo.mockResolvedValue({
        id: 'ch1',
        name: 'general',
        type: 'text',
        guildId: 'g1'
      } as any)
      guildManager.getGuildInfo.mockResolvedValue({ id: 'g1', name: 'My Guild' } as any)

      // Act
      const result = await service.getChannelInfo('ch1')

      // Assert
      expect(result).toEqual({
        id: 'ch1',
        name: 'general',
        type: 'text',
        guild: { id: 'g1', name: 'My Guild' }
      })
      expect(guildManager.getGuildInfo).toHaveBeenCalledWith(clientStub, 'g1')
      expect(metricsEnd).toHaveBeenCalledWith(true)
    })

    it('guildId が無い場合は Error を投げ end(false) を呼ぶ（DMチャンネル等）', async () => {
      // Arrange
      channelManager.getChannelInfo.mockResolvedValue({
        id: 'ch1',
        name: 'dm',
        type: 'dm'
      } as any)

      // Act / Assert
      await expect(service.getChannelInfo('ch1')).rejects.toThrow('Channel is not in a guild')
      expect(metricsEnd).toHaveBeenCalledWith(false)
    })

    it('channelManager.getChannelInfo が例外を投げると end(false) を呼びエラーを再スローする', async () => {
      // Arrange
      const failure = new Error('boom')
      channelManager.getChannelInfo.mockRejectedValue(failure)

      // Act / Assert
      await expect(service.getChannelInfo('ch1')).rejects.toBe(failure)
      expect(metricsEnd).toHaveBeenCalledWith(false)
    })
  })

  describe('getGuildInfo', () => {
    it('guildManager.getGuildInfo の結果を返し end(true) を呼ぶ', async () => {
      // Arrange
      const guildInfo = { id: 'g1', name: 'g', memberCount: 3, channels: [] }
      guildManager.getGuildInfo.mockResolvedValue(guildInfo as any)

      // Act
      const result = await service.getGuildInfo('g1')

      // Assert
      expect(result).toBe(guildInfo)
      expect(guildManager.getGuildInfo).toHaveBeenCalledWith(clientStub, 'g1')
      expect(metricsEnd).toHaveBeenCalledWith(true)
    })

    it('例外時は end(false) を呼びエラーを再スローする', async () => {
      // Arrange
      const failure = new Error('boom')
      guildManager.getGuildInfo.mockRejectedValue(failure)

      // Act / Assert
      await expect(service.getGuildInfo('g1')).rejects.toBe(failure)
      expect(metricsEnd).toHaveBeenCalledWith(false)
    })
  })

  describe('sendMessage', () => {
    it('channelManager.sendMessage に委譲し結果を返して end(true) を呼ぶ', async () => {
      // Arrange
      const sent = { id: 'msg1' }
      channelManager.sendMessage.mockResolvedValue(sent as any)
      const options = { embeds: [] }

      // Act
      const result = await service.sendMessage('ch1', 'hello', options)

      // Assert
      expect(result).toBe(sent)
      expect(channelManager.sendMessage).toHaveBeenCalledWith(clientStub, 'ch1', 'hello', options)
      expect(metricsEnd).toHaveBeenCalledWith(true)
    })

    it('例外時は end(false) を呼びエラーを再スローする', async () => {
      // Arrange
      const failure = new Error('boom')
      channelManager.sendMessage.mockRejectedValue(failure)

      // Act / Assert
      await expect(service.sendMessage('ch1', 'hi')).rejects.toBe(failure)
      expect(metricsEnd).toHaveBeenCalledWith(false)
    })
  })

  describe('createChannel', () => {
    it('channelManager.createChannel に委譲し結果を返して end(true) を呼ぶ', async () => {
      // Arrange
      const created = { id: 'ch-new' }
      channelManager.createChannel.mockResolvedValue(created as any)
      const options = { type: 0 }

      // Act
      const result = await service.createChannel('g1', 'new-ch', options)

      // Assert
      expect(result).toBe(created)
      expect(channelManager.createChannel).toHaveBeenCalledWith(clientStub, 'g1', 'new-ch', options)
      expect(metricsEnd).toHaveBeenCalledWith(true)
    })

    it('例外時は end(false) を呼びエラーを再スローする', async () => {
      // Arrange
      const failure = new Error('boom')
      channelManager.createChannel.mockRejectedValue(failure)

      // Act / Assert
      await expect(service.createChannel('g1', 'new-ch')).rejects.toBe(failure)
      expect(metricsEnd).toHaveBeenCalledWith(false)
    })
  })

  describe('getPerformanceStats', () => {
    it('performanceOrchestrator.getPerformanceSummary().discord を返す', () => {
      // Arrange
      const discordStats = { global: {}, endpoints: [], alerts: [] }
      performanceOrchestrator.getPerformanceSummary.mockReturnValue({ discord: discordStats } as any)

      // Act
      const result = service.getPerformanceStats()

      // Assert
      expect(result).toBe(discordStats)
    })
  })

  describe('getHealthStatus', () => {
    it('getSystemHealth の status と各サービスの初期化状態を集約する', () => {
      // Arrange
      performanceOrchestrator.getSystemHealth.mockReturnValue({
        status: 'warning',
        issues: ['high latency'],
        metrics: {
          discord: { avgResponseTime: 120, errorRate: 0.5 },
          alerts: { active: 2 }
        }
      } as any)
      interactionHandler.isInitialized.mockReturnValue(true)
      guildManager.isInitialized.mockReturnValue(true)
      channelManager.isInitialized.mockReturnValue(false)

      // Act
      const result = service.getHealthStatus()

      // Assert
      expect(result.status).toBe('warning')
      // client は initialized && client。未初期化なので false
      expect(result.services).toEqual({
        client: false,
        interactions: true,
        guilds: true,
        channels: false
      })
      expect(result.issues).toEqual(['high latency'])
      expect(result.metrics).toEqual({
        avgResponseTime: 120,
        errorRate: 0.5,
        activeAlerts: 2
      })
    })

    it('初期化済みかつ client 有なら services.client が true になる', async () => {
      // Arrange
      performanceOrchestrator.getSystemHealth.mockReturnValue({
        status: 'healthy',
        issues: [],
        metrics: { discord: {}, alerts: {} }
      } as any)
      await service.initializeDiscord()

      // Act
      const result = service.getHealthStatus()

      // Assert: client true、欠損メトリクスは 0 にフォールバック
      expect(result.services.client).toBe(true)
      expect(result.metrics).toEqual({
        avgResponseTime: 0,
        errorRate: 0,
        activeAlerts: 0
      })
    })
  })

  describe('performMaintenance', () => {
    it('guildManager/channelManager の cleanup を並列実行する', async () => {
      // Act
      await service.performMaintenance()

      // Assert
      expect(guildManager.cleanup).toHaveBeenCalledTimes(1)
      expect(channelManager.cleanup).toHaveBeenCalledTimes(1)
    })

    it('cleanup が例外を投げても握り潰して throw しない', async () => {
      // Arrange
      channelManager.cleanup.mockRejectedValue(new Error('cleanup failed'))

      // Act / Assert
      await expect(service.performMaintenance()).resolves.toBeUndefined()
    })
  })

  describe('isInitialized', () => {
    it('初期化前は false、初期化後は true を返す', async () => {
      // Assert (前)
      expect(service.isInitialized()).toBe(false)

      // Act
      await service.initializeDiscord()

      // Assert (後)
      expect(service.isInitialized()).toBe(true)
    })
  })
})
