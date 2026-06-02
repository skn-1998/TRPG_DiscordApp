/// <reference types="jest" />

import { Test, TestingModule } from '@nestjs/testing'
import { Logger } from '@nestjs/common'
import { DiscordService } from './discord.service'
import { DiscordFacadeService } from './discord-facade.service'

/**
 * DiscordService は後方互換のための薄いラッパー（deprecated）。
 * 実処理は DiscordFacadeService に委譲するため、本 spec は「委譲が正しく行われるか」のみを検証する。
 *
 * かつての登録系（registerButton/registerModal/registerSelectMenu）や interactionCreate
 * イベントハンドリングはこのクラスから除去済みで、責務は以下へ移設された:
 *   - DiscordFacadeService.initializeDiscord（discord-facade.service.spec.ts でカバー）
 *   - DiscordInteractionHandlerService（discord-interaction-handler.service.spec.ts でカバー）
 *   - InteractionsService（interactions/interactions.service.spec.ts でカバー）
 * そのため旧責務を検証していた陳腐ケースは削除した。
 */
describe('DiscordService (deprecated facade wrapper)', () => {
  let service: DiscordService
  let discordFacade: jest.Mocked<DiscordFacadeService>

  beforeEach(async () => {
    const facadeMock: Partial<jest.Mocked<DiscordFacadeService>> = {
      initializeDiscord: jest.fn().mockResolvedValue(undefined),
      verifyChannelAccess: jest.fn().mockResolvedValue(true),
      verifyGuildAccess: jest.fn().mockResolvedValue(true),
      sendMessage: jest.fn().mockResolvedValue({ id: 'message-id' }),
      createChannel: jest.fn().mockResolvedValue({ id: 'channel-id' }),
      getGuildInfo: jest.fn().mockResolvedValue({ id: 'guild-id', name: 'Guild', memberCount: 1, channels: [] }),
      getChannelInfo: jest.fn().mockResolvedValue({
        id: 'channel-id',
        name: 'channel',
        type: 'text',
        guild: { id: 'guild-id', name: 'Guild' }
      }),
      getClient: jest.fn().mockReturnValue({
        guilds: { cache: { size: 2 } },
        users: { cache: { size: 5 } },
        ws: { ping: 42 },
        uptime: 1000
      } as any),
      isInitialized: jest.fn().mockReturnValue(true),
      getPerformanceStats: jest.fn().mockReturnValue({ stat: 1 } as any),
      getHealthStatus: jest.fn().mockReturnValue({
        status: 'healthy',
        services: { client: true, interactions: true, guilds: true, channels: true },
        issues: [],
        metrics: { avgResponseTime: 0, errorRate: 0, activeAlerts: 0 }
      } as any)
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscordService,
        {
          provide: DiscordFacadeService,
          useValue: facadeMock
        }
      ]
    }).compile()

    // deprecation 警告のログ出力を抑制
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)

    service = module.get<DiscordService>(DiscordService)
    discordFacade = module.get(DiscordFacadeService)
  })

  afterEach(() => {
    jest.clearAllMocks()
    jest.restoreAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('委譲メソッド', () => {
    it('initializeDiscord は facade に委譲する', async () => {
      await service.initializeDiscord()
      expect(discordFacade.initializeDiscord).toHaveBeenCalledTimes(1)
    })

    it('verifyChannelAccess は facade に委譲し結果を返す', async () => {
      const result = await service.verifyChannelAccess('ch-1', 'user-1')
      expect(discordFacade.verifyChannelAccess).toHaveBeenCalledWith('ch-1', 'user-1')
      expect(result).toBe(true)
    })

    it('verifyGuildAccess は facade に委譲し結果を返す', async () => {
      const result = await service.verifyGuildAccess('guild-1', 'user-1')
      expect(discordFacade.verifyGuildAccess).toHaveBeenCalledWith('guild-1', 'user-1')
      expect(result).toBe(true)
    })

    it('sendMessage は DTO を facade 引数に展開して委譲する', async () => {
      await service.sendMessage({
        channelId: 'ch-1',
        content: 'hello',
        embeds: ['embed'] as any,
        components: ['component'] as any
      })
      expect(discordFacade.sendMessage).toHaveBeenCalledWith('ch-1', 'hello', {
        embeds: ['embed'],
        components: ['component']
      })
    })

    it('sendMessage は content 未指定時に空文字を渡す', async () => {
      await service.sendMessage({ channelId: 'ch-1' } as any)
      expect(discordFacade.sendMessage).toHaveBeenCalledWith('ch-1', '', {
        embeds: undefined,
        components: undefined
      })
    })

    it('createChannel は DTO を facade 引数に展開して委譲する', async () => {
      await service.createChannel({
        guildId: 'guild-1',
        name: 'new-channel',
        type: 0 as any,
        parentId: 'parent-1',
        topic: 'topic',
        permissions: ['perm'] as any
      })
      expect(discordFacade.createChannel).toHaveBeenCalledWith('guild-1', 'new-channel', {
        type: 0,
        parent: 'parent-1',
        topic: 'topic',
        permissions: ['perm']
      })
    })

    it('getGuildInfo は facade に委譲する', async () => {
      const result = await service.getGuildInfo('guild-1')
      expect(discordFacade.getGuildInfo).toHaveBeenCalledWith('guild-1')
      expect(result.id).toBe('guild-id')
    })

    it('getChannelInfo は facade に委譲し結果を返す', async () => {
      const result = await service.getChannelInfo('channel-id')
      expect(discordFacade.getChannelInfo).toHaveBeenCalledWith('channel-id')
      expect(result.id).toBe('channel-id')
    })

    it('getChannelInfo は facade が null を返したら例外を投げる', async () => {
      discordFacade.getChannelInfo.mockResolvedValueOnce(null as any)
      await expect(service.getChannelInfo('missing')).rejects.toThrow('Channel not found: missing')
    })

    it('getClient は facade に委譲する', () => {
      const client = service.getClient()
      expect(discordFacade.getClient).toHaveBeenCalledTimes(1)
      expect(client).toBeDefined()
    })

    it('isInitialized は facade に委譲する', () => {
      expect(service.isInitialized()).toBe(true)
      expect(discordFacade.isInitialized).toHaveBeenCalledTimes(1)
    })

    it('getPerformanceStats は facade に委譲する', () => {
      expect(service.getPerformanceStats()).toEqual({ stat: 1 })
      expect(discordFacade.getPerformanceStats).toHaveBeenCalledTimes(1)
    })

    it('getHealthStatus は facade に委譲する', () => {
      const result = service.getHealthStatus()
      expect(discordFacade.getHealthStatus).toHaveBeenCalledTimes(1)
      expect(result.status).toBe('healthy')
    })
  })

  describe('deprecated 互換メソッド', () => {
    it('getBotStatus は health/client 情報を集約して返す', async () => {
      const status = await service.getBotStatus()
      expect(discordFacade.getHealthStatus).toHaveBeenCalled()
      expect(discordFacade.getClient).toHaveBeenCalled()
      expect(status).toEqual({
        online: true,
        guilds: 2,
        users: 5,
        ping: 42,
        uptime: 1000
      })
    })

    it('verifyGuildManagePermission は verifyGuildAccess に委譲する', async () => {
      const result = await service.verifyGuildManagePermission('guild-1', 'user-1')
      expect(discordFacade.verifyGuildAccess).toHaveBeenCalledWith('guild-1', 'user-1')
      expect(result).toBe(true)
    })

    it('verifyGuildManagePermission は facade 失敗時に false を返す', async () => {
      discordFacade.verifyGuildAccess.mockRejectedValueOnce(new Error('boom'))
      const result = await service.verifyGuildManagePermission('guild-1', 'user-1')
      expect(result).toBe(false)
    })

    it('createCharacterEmbed は廃止済みで例外を投げる', async () => {
      await expect(service.createCharacterEmbed({} as any, 'guild-1')).rejects.toThrow(
        'Method deprecated. Use features/ architecture instead.'
      )
    })

    it('createOrUpdateCharacterEmbed は廃止済みで例外を投げる', async () => {
      await expect(service.createOrUpdateCharacterEmbed({} as any, 'channel-1')).rejects.toThrow(
        'Method deprecated. Use CharacterDisplayService instead.'
      )
    })
  })
})
