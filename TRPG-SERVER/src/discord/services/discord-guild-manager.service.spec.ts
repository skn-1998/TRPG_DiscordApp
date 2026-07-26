import { Logger } from '@nestjs/common'
import { Test } from '@nestjs/testing'

// --- discord.js モックのローカル上書き ---
// グローバル jest-setup.ts の discord.js モックは ChannelType の数値逆引きを再現しないため、
// 本サービスのテストでは enum 名を返す供給形式まで再現したモックに差し替える。
// 本体（discord-guild-manager.service.ts）が import する ChannelType / PermissionsBitField と
// 同一参照になるようにここで定義し、convertChannelType / 権限判定を本物の値で検証できるようにする。
jest.mock('discord.js', () => ({
  ChannelType: {
    0: 'GuildText',
    2: 'GuildVoice',
    4: 'GuildCategory',
    5: 'GuildAnnouncement',
    13: 'GuildStageVoice',
    14: 'GuildDirectory',
    15: 'GuildForum',
    16: 'GuildMedia',
    GuildText: 0,
    GuildVoice: 2,
    GuildCategory: 4,
    GuildAnnouncement: 5,
    GuildStageVoice: 13,
    GuildDirectory: 14,
    GuildForum: 15,
    GuildMedia: 16
  },
  PermissionsBitField: {
    Flags: {
      ManageChannels: 16n,
      ManageRoles: 268435456n,
      ManageMessages: 8192n,
      ViewChannel: 1024n
    }
  },
  // parent 検査の not-found 分類（Unknown Channel / GuildChannelUnowned）検証用。
  // 実 discord.js のエラーコード enum と同じ値を提供する。
  RESTJSONErrorCodes: {
    UnknownChannel: 10003
  },
  DiscordjsErrorCodes: {
    GuildChannelUnowned: 'GuildChannelUnowned'
  }
}))

// ErrorHandler.handleError をスタブ化（静的・async）。
// 本体は handleError 呼び出し後に元の error を throw する現挙動を保つため、
// handleError 自体は副作用なし（resolve）にしておき、各メソッドの throw は .rejects で確認する。
jest.mock('../../core/http/error-handler', () => ({
  ErrorHandler: {
    handleError: jest.fn().mockResolvedValue(undefined)
  }
}))

import { ChannelType, PermissionsBitField } from 'discord.js'
import { DiscordGuildManagerService } from './discord-guild-manager.service'
import { AppConfigService } from '../../config/config.service'
import { ErrorHandler } from '../../core/http/error-handler'
import { GUILD_CATEGORY_TYPE } from '../interfaces/guild-channel-type.constant'

const handleErrorMock = ErrorHandler.handleError as jest.Mock

/**
 * DiscordGuildManagerService は Guild/Channel 操作を Client 経由で行い、guildCache(Map)+TTL で
 * キャッシュする。注入は AppConfigService のみ。多くのメソッドは client を引数で受ける。
 * - 副作用境界（client.guilds.fetch / guild.channels.fetch / channel.send 等）は最小スタブでモック
 * - 時刻は Date.now を spyOn で固定し TTL を決定化
 * - ErrorHandler.handleError はモジュールモックでスタブ化し、呼び出しと throw 現挙動を検証
 */
describe('DiscordGuildManagerService', () => {
  let service: DiscordGuildManagerService

  // 固定時刻（TTL=300000 の境界判定に使用）
  const FIXED_NOW = 1_000_000_000

  beforeEach(async () => {
    jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW)

    const moduleRef = await Test.createTestingModule({
      providers: [DiscordGuildManagerService, { provide: AppConfigService, useValue: { get: jest.fn() } }]
    }).compile()

    service = moduleRef.get(DiscordGuildManagerService)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  // --- テスト用スタブ生成ヘルパ ---

  /** GuildChannel 風スタブ */
  const makeChannel = (id: string, name = `ch-${id}`, type: number = ChannelType.GuildText) =>
    ({ id, name, type }) as never

  /** guild.channels.fetch が返す Map（id -> channel） */
  const makeChannelCollection = (entries: Array<[string, unknown]>) => new Map(entries)

  /** client スタブ */
  const makeClient = (overrides: Record<string, unknown> = {}) =>
    ({
      guilds: { fetch: jest.fn() },
      channels: { fetch: jest.fn() },
      ...overrides
    }) as never

  describe('initialize / isInitialized', () => {
    it('初回 initialize で初期化済みになる', async () => {
      // Arrange
      const client = makeClient()
      expect(service.isInitialized()).toBe(false)

      // Act
      await service.initialize(client)

      // Assert
      expect(service.isInitialized()).toBe(true)
    })

    it('2 回目の initialize は即 return し冪等（client を差し替えない）', async () => {
      // Arrange
      const client1 = makeClient()
      const client2 = makeClient()

      // Act
      await service.initialize(client1)
      await service.initialize(client2)

      // Assert
      expect(service.isInitialized()).toBe(true)
    })
  })

  describe('convertChannelType（private を型アサーションで直接呼ぶ）', () => {
    // 文字列 -> ChannelType の対応表（網羅）
    const cases: Array<[string, number]> = [
      ['text', ChannelType.GuildText],
      ['voice', ChannelType.GuildVoice],
      ['category', ChannelType.GuildCategory],
      ['news', ChannelType.GuildAnnouncement],
      ['stage', ChannelType.GuildStageVoice],
      ['forum', ChannelType.GuildForum]
    ]

    it.each(cases)('"%s" は対応する ChannelType を返す', (input, expected) => {
      // Act
      const result = (service as never as { convertChannelType(t: string): number }).convertChannelType(input)

      // Assert
      expect(result).toBe(expected)
    })

    it('大文字や混在ケースも小文字化して判定する', () => {
      // Act
      const result = (service as never as { convertChannelType(t: string): number }).convertChannelType('VOICE')

      // Assert
      expect(result).toBe(ChannelType.GuildVoice)
    })

    it('未知のタイプは GuildText にフォールバックする', () => {
      // Act
      const result = (service as never as { convertChannelType(t: string): number }).convertChannelType('unknown')

      // Assert
      expect(result).toBe(ChannelType.GuildText)
    })
  })

  describe('getGuildChannels', () => {
    it('TTL 内のキャッシュがあれば fetch せずキャッシュを返す', async () => {
      // Arrange: 先に 1 回 fetch させてキャッシュを作る
      const channel = makeChannel('c1')
      const guild = { channels: { fetch: jest.fn().mockResolvedValue(makeChannelCollection([['c1', channel]])) } }
      const client = makeClient({ guilds: { fetch: jest.fn().mockResolvedValue(guild) } })

      await service.getGuildChannels(client, 'g1') // 1 回目: fetch される
      ;(client as { guilds: { fetch: jest.Mock } }).guilds.fetch.mockClear()
      guild.channels.fetch.mockClear()

      // Act: 2 回目（同一時刻 = TTL 内）
      const result = await service.getGuildChannels(client, 'g1')

      // Assert: fetch されずキャッシュ内容が返る
      expect((client as { guilds: { fetch: jest.Mock } }).guilds.fetch).not.toHaveBeenCalled()
      expect(guild.channels.fetch).not.toHaveBeenCalled()
      expect(result).toEqual([channel])
    })

    it('TTL 超過のキャッシュは無効化され再 fetch する', async () => {
      // Arrange
      const channel = makeChannel('c1')
      const guild = { channels: { fetch: jest.fn().mockResolvedValue(makeChannelCollection([['c1', channel]])) } }
      const client = makeClient({ guilds: { fetch: jest.fn().mockResolvedValue(guild) } })

      await service.getGuildChannels(client, 'g1') // キャッシュ作成（lastUpdate=FIXED_NOW）

      // 時刻を TTL(300000) 超過に進める
      ;(Date.now as jest.Mock).mockReturnValue(FIXED_NOW + 300001)

      // Act
      await service.getGuildChannels(client, 'g1')

      // Assert: guild.fetch が 2 回呼ばれる（再 fetch）
      expect((client as { guilds: { fetch: jest.Mock } }).guilds.fetch).toHaveBeenCalledTimes(2)
    })

    it('未キャッシュなら fetch し、null チャンネルを除外して Map 化する', async () => {
      // Arrange: null を含むコレクション
      const channel = makeChannel('c1')
      const guild = {
        channels: {
          fetch: jest.fn().mockResolvedValue(
            makeChannelCollection([
              ['c1', channel],
              ['c2', null]
            ])
          )
        }
      }
      const client = makeClient({ guilds: { fetch: jest.fn().mockResolvedValue(guild) } })

      // Act
      const result = await service.getGuildChannels(client, 'g1')

      // Assert: null は除外され c1 のみ
      expect(result).toEqual([channel])
      expect((client as { guilds: { fetch: jest.Mock } }).guilds.fetch).toHaveBeenCalledWith('g1')
    })

    it('guild が無い場合は ErrorHandler を経由して throw する', async () => {
      // Arrange
      const client = makeClient({ guilds: { fetch: jest.fn().mockResolvedValue(null) } })

      // Act & Assert
      await expect(service.getGuildChannels(client, 'g1')).rejects.toThrow('Guild not found: g1')
      expect(handleErrorMock).toHaveBeenCalledWith(expect.any(Error), {
        context: 'get-guild-channels',
        guildId: 'g1'
      })
    })
  })

  describe('cleanup', () => {
    it('TTL 超過のキャッシュエントリを削除し、有効なものは残す', async () => {
      // Arrange: g1 を FIXED_NOW でキャッシュ
      const guild = {
        channels: { fetch: jest.fn().mockResolvedValue(makeChannelCollection([['c1', makeChannel('c1')]])) }
      }
      const client = makeClient({ guilds: { fetch: jest.fn().mockResolvedValue(guild) } })
      await service.getGuildChannels(client, 'g1')

      // 時刻を進めて g2 を新しくキャッシュ
      ;(Date.now as jest.Mock).mockReturnValue(FIXED_NOW + 400000)
      await service.getGuildChannels(client, 'g2')

      // Act: 現在時刻は FIXED_NOW+400000。g1 は TTL 超過、g2 は新しい
      service.cleanup()

      // Assert: g1 は削除（再取得で fetch される）、g2 は残る
      const stats = service.getCacheStats()
      expect(stats.cachedGuilds).toBe(1)
    })
  })

  describe('createChannel', () => {
    const dto = { guildId: 'g1', name: 'new-channel', type: 'text' } as never

    const makeGuildWithPermission = (hasPermission: boolean, created: unknown) => ({
      members: { me: { permissions: { has: jest.fn().mockReturnValue(hasPermission) } } },
      channels: { create: jest.fn().mockResolvedValue(created) }
    })

    it('guild が無い場合は throw し ErrorHandler を呼ぶ', async () => {
      // Arrange
      const client = makeClient({ guilds: { fetch: jest.fn().mockResolvedValue(null) } })

      // Act & Assert
      await expect(service.createChannel(client, dto)).rejects.toThrow('Guild not found: g1')
      expect(handleErrorMock).toHaveBeenCalledWith(expect.any(Error), {
        context: 'create-channel',
        channelName: 'new-channel',
        guildId: 'g1'
      })
    })

    it('ManageChannels 権限が無い場合は throw する', async () => {
      // Arrange
      const guild = makeGuildWithPermission(false, makeChannel('new'))
      const client = makeClient({ guilds: { fetch: jest.fn().mockResolvedValue(guild) } })

      // Act & Assert
      await expect(service.createChannel(client, dto)).rejects.toThrow('Bot lacks permission to manage channels')
      expect(guild.members.me.permissions.has).toHaveBeenCalledWith(PermissionsBitField.Flags.ManageChannels)
    })

    it('権限ありなら guild.channels.create を呼び作成チャンネルを返す', async () => {
      // Arrange
      const created = makeChannel('new')
      const guild = makeGuildWithPermission(true, created)
      const client = makeClient({ guilds: { fetch: jest.fn().mockResolvedValue(guild) } })

      // Act
      const result = await service.createChannel(client, dto)

      // Assert: 戻り値 + create 呼び出し（type は変換済み）
      expect(result).toBe(created)
      expect(guild.channels.create).toHaveBeenCalledWith({
        name: 'new-channel',
        type: ChannelType.GuildText,
        parent: undefined,
        topic: undefined
      })
    })
  })

  describe('sendMessage', () => {
    const baseDto = { channelId: 'c1', content: 'hello' } as never

    it('content が無い場合は throw する', async () => {
      // Arrange
      const client = makeClient()

      // Act & Assert
      await expect(service.sendMessage(client, { channelId: 'c1', content: '' } as never)).rejects.toThrow(
        'Content is required for sending message'
      )
    })

    it('テキストチャンネルでない場合は throw する', async () => {
      // Arrange: channels.fetch は isTextBased=false のチャンネルを返す
      const channel = { isTextBased: jest.fn().mockReturnValue(false) }
      const client = makeClient({ channels: { fetch: jest.fn().mockResolvedValue(channel) } })

      // Act & Assert
      await expect(service.sendMessage(client, baseDto)).rejects.toThrow('Text channel not found or not accessible: c1')
    })

    it('テキストチャンネルなら channel.send を呼ぶ', async () => {
      // Arrange
      const send = jest.fn().mockResolvedValue({})
      const channel = { isTextBased: jest.fn().mockReturnValue(true), send }
      const client = makeClient({ channels: { fetch: jest.fn().mockResolvedValue(channel) } })

      // Act
      await service.sendMessage(client, baseDto)

      // Assert
      expect(send).toHaveBeenCalledWith({ content: 'hello' })
    })
  })

  describe('getGuildInfo', () => {
    it('Discord.js の GuildCategory 逆引き名は共有カテゴリ型契約と一致する', () => {
      const actualChannelType = jest.requireActual<typeof import('discord.js')>('discord.js').ChannelType

      expect(actualChannelType[actualChannelType.GuildCategory]).toBe(GUILD_CATEGORY_TYPE)
    })

    it('guild が無い場合は throw し ErrorHandler を呼ぶ', async () => {
      // Arrange
      const client = makeClient({ guilds: { fetch: jest.fn().mockResolvedValue(null) } })

      // Act & Assert
      await expect(service.getGuildInfo(client, 'g1')).rejects.toThrow('Guild not found: g1')
      expect(handleErrorMock).toHaveBeenCalledWith(expect.any(Error), {
        context: 'get-guild-info',
        guildId: 'g1'
      })
    })

    it('guild/channels/members を取得し整形した情報を返す（null channel 除外）', async () => {
      // Arrange
      const textChannel = makeChannel('c1', 'general', ChannelType.GuildText)
      const guild = {
        id: 'g1',
        name: 'My Guild',
        channels: {
          fetch: jest.fn().mockResolvedValue(
            makeChannelCollection([
              ['c1', textChannel],
              ['c2', null]
            ])
          )
        },
        members: {
          fetch: jest.fn().mockResolvedValue(
            new Map([
              ['m1', {}],
              ['m2', {}]
            ])
          )
        }
      }
      const client = makeClient({ guilds: { fetch: jest.fn().mockResolvedValue(guild) } })

      // Act
      const result = await service.getGuildInfo(client, 'g1')

      // Assert
      expect(result).toEqual({
        id: 'g1',
        name: 'My Guild',
        memberCount: 2,
        channels: [{ id: 'c1', name: 'general', type: ChannelType[ChannelType.GuildText] }]
      })
    })
  })

  describe('getChannelFromCache（sendMessage 経由で挙動確認）', () => {
    it('キャッシュ巡回でヒットした場合は client.channels.fetch しない', async () => {
      // Arrange: getGuildChannels でキャッシュを作る（c1 を保持）
      const cachedChannel = {
        id: 'c1',
        isTextBased: jest.fn().mockReturnValue(true),
        send: jest.fn().mockResolvedValue({})
      }
      const guild = { channels: { fetch: jest.fn().mockResolvedValue(makeChannelCollection([['c1', cachedChannel]])) } }
      const channelsFetch = jest.fn()
      const client = makeClient({
        guilds: { fetch: jest.fn().mockResolvedValue(guild) },
        channels: { fetch: channelsFetch }
      })
      await service.getGuildChannels(client, 'g1')

      // Act: c1 へ送信 → キャッシュからヒットするはず
      await service.sendMessage(client, { channelId: 'c1', content: 'hi' } as never)

      // Assert: 直 fetch は呼ばれない
      expect(channelsFetch).not.toHaveBeenCalled()
      expect(cachedChannel.send).toHaveBeenCalledWith({ content: 'hi' })
    })

    it('キャッシュに無ければ client.channels.fetch で取得する', async () => {
      // Arrange
      const fetched = { id: 'c9', isTextBased: jest.fn().mockReturnValue(true), send: jest.fn().mockResolvedValue({}) }
      const client = makeClient({ channels: { fetch: jest.fn().mockResolvedValue(fetched) } })

      // Act
      await service.sendMessage(client, { channelId: 'c9', content: 'hi' } as never)

      // Assert
      expect((client as { channels: { fetch: jest.Mock } }).channels.fetch).toHaveBeenCalledWith('c9')
      expect(fetched.send).toHaveBeenCalled()
    })
  })

  describe('clearCache / getCacheStats', () => {
    const seedTwoGuilds = async () => {
      const guild1 = {
        channels: { fetch: jest.fn().mockResolvedValue(makeChannelCollection([['c1', makeChannel('c1')]])) }
      }
      const guild2 = {
        channels: {
          fetch: jest.fn().mockResolvedValue(
            makeChannelCollection([
              ['c2', makeChannel('c2')],
              ['c3', makeChannel('c3')]
            ])
          )
        }
      }
      const client = makeClient({
        guilds: { fetch: jest.fn().mockResolvedValueOnce(guild1).mockResolvedValueOnce(guild2) }
      })
      await service.getGuildChannels(client, 'g1')
      await service.getGuildChannels(client, 'g2')
      return client
    }

    it('guildId 指定で該当ギルドのキャッシュのみ削除する', async () => {
      // Arrange
      await seedTwoGuilds()

      // Act
      service.clearCache('g1')

      // Assert
      const stats = service.getCacheStats()
      expect(stats.cachedGuilds).toBe(1)
    })

    it('引数なしで全キャッシュを削除する', async () => {
      // Arrange
      await seedTwoGuilds()

      // Act
      service.clearCache()

      // Assert
      const stats = service.getCacheStats()
      expect(stats.cachedGuilds).toBe(0)
      expect(stats.totalChannels).toBe(0)
    })

    it('getCacheStats は cachedGuilds/totalChannels/oldestCache を集計する', async () => {
      // Arrange: g1 を FIXED_NOW で作成
      const guild1 = {
        channels: { fetch: jest.fn().mockResolvedValue(makeChannelCollection([['c1', makeChannel('c1')]])) }
      }
      const guild2 = {
        channels: {
          fetch: jest.fn().mockResolvedValue(
            makeChannelCollection([
              ['c2', makeChannel('c2')],
              ['c3', makeChannel('c3')]
            ])
          )
        }
      }
      const client = makeClient({
        guilds: { fetch: jest.fn().mockResolvedValueOnce(guild1).mockResolvedValueOnce(guild2) }
      })
      await service.getGuildChannels(client, 'g1') // lastUpdate=FIXED_NOW
      ;(Date.now as jest.Mock).mockReturnValue(FIXED_NOW + 1000)
      await service.getGuildChannels(client, 'g2') // lastUpdate=FIXED_NOW+1000

      // 現在時刻を進めて oldestCache を確認
      ;(Date.now as jest.Mock).mockReturnValue(FIXED_NOW + 5000)

      // Act
      const stats = service.getCacheStats()

      // Assert
      expect(stats.cachedGuilds).toBe(2)
      expect(stats.totalChannels).toBe(3) // c1 + c2 + c3
      expect(stats.oldestCache).toBe(5000) // now - 最古(FIXED_NOW)
    })
  })

  describe('verifyChannelAccess', () => {
    it('channel が無い場合は hasAccess:false / reason:Channel not found', async () => {
      // Arrange
      const client = makeClient({ channels: { fetch: jest.fn().mockResolvedValue(null) } })

      // Act
      const result = await service.verifyChannelAccess(client, 'c1', 'u1')

      // Assert
      expect(result).toEqual({ hasAccess: false, reason: 'Channel not found' })
    })

    it('テキストベースでない場合は reason:Channel is not text-based', async () => {
      // Arrange
      const channel = { isTextBased: jest.fn().mockReturnValue(false) }
      const client = makeClient({ channels: { fetch: jest.fn().mockResolvedValue(channel) } })

      // Act
      const result = await service.verifyChannelAccess(client, 'c1', 'u1')

      // Assert
      expect(result).toEqual({ hasAccess: false, reason: 'Channel is not text-based' })
    })

    it('guild に属さない場合は reason:Channel is not in a guild', async () => {
      // Arrange: guild プロパティが無い（DM など）
      const channel = { isTextBased: jest.fn().mockReturnValue(true) }
      const client = makeClient({ channels: { fetch: jest.fn().mockResolvedValue(channel) } })

      // Act
      const result = await service.verifyChannelAccess(client, 'c1', 'u1')

      // Assert
      expect(result).toEqual({ hasAccess: false, reason: 'Channel is not in a guild' })
    })

    it('permissionsFor が無い場合は reason:Cannot check permissions for this channel type', async () => {
      // Arrange: guild あり member あり、ただし permissionsFor なし
      const member = {}
      const guild = { members: { fetch: jest.fn().mockResolvedValue(member) } }
      const channel = { isTextBased: jest.fn().mockReturnValue(true), guild }
      const client = makeClient({ channels: { fetch: jest.fn().mockResolvedValue(channel) } })

      // Act
      const result = await service.verifyChannelAccess(client, 'c1', 'u1')

      // Assert
      expect(result).toEqual({ hasAccess: false, reason: 'Cannot check permissions for this channel type' })
    })

    it('ViewChannel 権限が無い場合は reason:User lacks permission to view channel', async () => {
      // Arrange
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
      const member = {}
      const guild = { members: { fetch: jest.fn().mockResolvedValue(member) } }
      const channel = {
        isTextBased: jest.fn().mockReturnValue(true),
        guild,
        permissionsFor: jest.fn().mockReturnValue({ has: jest.fn().mockReturnValue(false) })
      }
      const client = makeClient({ channels: { fetch: jest.fn().mockResolvedValue(channel) } })

      // Act
      const result = await service.verifyChannelAccess(client, 'c1', 'u1')

      // Assert
      expect(result).toEqual({ hasAccess: false, reason: 'User lacks permission to view channel' })
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('reason=User lacks permission to view channel'))
    })

    it('ViewChannel 権限があれば hasAccess:true', async () => {
      // Arrange
      const member = {}
      const guild = { members: { fetch: jest.fn().mockResolvedValue(member) } }
      const has = jest.fn().mockReturnValue(true)
      const channel = {
        isTextBased: jest.fn().mockReturnValue(true),
        guild,
        permissionsFor: jest.fn().mockReturnValue({ has })
      }
      const client = makeClient({ channels: { fetch: jest.fn().mockResolvedValue(channel) } })

      // Act
      const result = await service.verifyChannelAccess(client, 'c1', 'u1')

      // Assert
      expect(result).toEqual({ hasAccess: true })
      expect(has).toHaveBeenCalledWith(PermissionsBitField.Flags.ViewChannel)
    })

    it('例外発生時は hasAccess:false / reason:Error verifying access', async () => {
      // Arrange
      const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
      const client = makeClient({ channels: { fetch: jest.fn().mockRejectedValue(new Error('boom')) } })

      // Act
      const result = await service.verifyChannelAccess(client, 'c1', 'u1')

      // Assert
      expect(result).toEqual({ hasAccess: false, reason: 'Error verifying access' })
      expect(error).toHaveBeenCalledWith(expect.stringContaining('reason=Discord API error: boom'))
    })
  })

  describe('verifyGuildAccess', () => {
    it('guild が無い場合は hasAccess:false / reason:Guild not found', async () => {
      // Arrange
      const client = makeClient({ guilds: { fetch: jest.fn().mockResolvedValue(null) } })

      // Act
      const result = await service.verifyGuildAccess(client, 'g1', 'u1')

      // Assert
      expect(result).toEqual({ hasAccess: false, reason: 'Guild not found' })
    })

    it('member が無い場合は reason:User is not a member of the guild', async () => {
      // Arrange
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
      const guild = { members: { fetch: jest.fn().mockResolvedValue(null) } }
      const client = makeClient({ guilds: { fetch: jest.fn().mockResolvedValue(guild) } })

      // Act
      const result = await service.verifyGuildAccess(client, 'g1', 'u1')

      // Assert
      expect(result).toEqual({ hasAccess: false, reason: 'User is not a member of the guild' })
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('reason=User is not a member of the guild'))
    })

    it('guild と member が揃えば hasAccess:true', async () => {
      // Arrange
      const guild = { members: { fetch: jest.fn().mockResolvedValue({ id: 'u1' }) } }
      const client = makeClient({ guilds: { fetch: jest.fn().mockResolvedValue(guild) } })

      // Act
      const result = await service.verifyGuildAccess(client, 'g1', 'u1')

      // Assert
      expect(result).toEqual({ hasAccess: true })
    })

    it('例外発生時は hasAccess:false / reason:Error verifying access', async () => {
      // Arrange
      const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
      const client = makeClient({ guilds: { fetch: jest.fn().mockRejectedValue(new Error('boom')) } })

      // Act
      const result = await service.verifyGuildAccess(client, 'g1', 'u1')

      // Assert
      expect(result).toEqual({ hasAccess: false, reason: 'Error verifying access' })
      expect(error).toHaveBeenCalledWith(expect.stringContaining('reason=Discord API error: boom'))
    })
  })

  describe('verifyGuildManagePermission', () => {
    it('ManageChannels 権限があれば hasPermission:true', async () => {
      // Arrange
      const has = jest.fn().mockReturnValue(true)
      const member = { permissions: { has } }
      const guild = { members: { fetch: jest.fn().mockResolvedValue(member) } }
      const client = makeClient({ guilds: { fetch: jest.fn().mockResolvedValue(guild) } })

      // Act
      const result = await service.verifyGuildManagePermission(client, 'g1', 'u1')

      // Assert
      expect(result).toEqual({ hasPermission: true })
      expect(has).toHaveBeenCalledWith(PermissionsBitField.Flags.ManageChannels)
    })

    it('ManageChannels 権限が無ければ permission-denied として拒否する', async () => {
      // Arrange
      const has = jest.fn().mockReturnValue(false)
      const member = { permissions: { has } }
      const guild = { members: { fetch: jest.fn().mockResolvedValue(member) } }
      const client = makeClient({ guilds: { fetch: jest.fn().mockResolvedValue(guild) } })

      // Act
      const result = await service.verifyGuildManagePermission(client, 'g1', 'u1')

      // Assert
      expect(result).toEqual({
        hasPermission: false,
        denial: 'permission-denied',
        reason: 'User lacks permission to manage channels'
      })
      expect(has).toHaveBeenCalledWith(PermissionsBitField.Flags.ManageChannels)
    })

    it('guild が無ければ permission-denied として拒否する', async () => {
      const client = makeClient({ guilds: { fetch: jest.fn().mockResolvedValue(null) } })

      const result = await service.verifyGuildManagePermission(client, 'g1', 'u1')

      expect(result).toEqual({
        hasPermission: false,
        denial: 'permission-denied',
        reason: 'Guild not found'
      })
    })

    it('parent カテゴリの overwrite で ManageChannels が拒否されれば permission-denied として拒否する', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
      const baseHas = jest.fn().mockReturnValue(true)
      const parentHas = jest.fn().mockReturnValue(false)
      const member = { permissions: { has: baseHas } }
      const parent = {
        type: ChannelType.GuildCategory,
        permissionsFor: jest.fn().mockReturnValue({ has: parentHas })
      }
      const guild = {
        members: { fetch: jest.fn().mockResolvedValue(member) },
        channels: { fetch: jest.fn().mockResolvedValue(parent) }
      }
      const client = makeClient({ guilds: { fetch: jest.fn().mockResolvedValue(guild) } })

      const result = await service.verifyGuildManagePermission(client, 'g1', 'u1', 'parent1')

      expect(result).toEqual({
        hasPermission: false,
        denial: 'permission-denied',
        reason: 'User lacks permission to manage channels in parent category'
      })
      expect(baseHas).toHaveBeenCalledWith(PermissionsBitField.Flags.ManageChannels)
      expect(parent.permissionsFor).toHaveBeenCalledWith(member)
      expect(parentHas).toHaveBeenCalledWith(PermissionsBitField.Flags.ManageChannels)
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('reason=User lacks permission to manage channels in parent category')
      )
    })

    it('parent がカテゴリ以外なら parent-not-category として拒否する', async () => {
      const member = { permissions: { has: jest.fn().mockReturnValue(true) } }
      const parent = { type: ChannelType.GuildText, permissionsFor: jest.fn() }
      const guild = {
        members: { fetch: jest.fn().mockResolvedValue(member) },
        channels: { fetch: jest.fn().mockResolvedValue(parent) }
      }
      const client = makeClient({ guilds: { fetch: jest.fn().mockResolvedValue(guild) } })

      const result = await service.verifyGuildManagePermission(client, 'g1', 'u1', 'parent1')

      expect(result).toEqual({
        hasPermission: false,
        denial: 'parent-not-category',
        reason: 'Parent channel is not a category'
      })
      expect(parent.permissionsFor).not.toHaveBeenCalled()
    })

    // 実 discord.js の guild.channels.fetch は不在時に null を返さず throw するため、
    // not-found 分類は throw されたエラーコードで検証する
    it.each([
      ['DiscordAPIError の Unknown Channel (10003)', Object.assign(new Error('Unknown Channel'), { code: 10003 })],
      [
        'GuildChannelUnowned（他 guild のチャンネル）',
        Object.assign(new Error('channel not owned'), { code: 'GuildChannelUnowned' })
      ]
    ])('parent fetch が %s を throw したら parent-not-found として拒否する', async (_label, thrown) => {
      const member = { permissions: { has: jest.fn().mockReturnValue(true) } }
      const guild = {
        members: { fetch: jest.fn().mockResolvedValue(member) },
        channels: { fetch: jest.fn().mockRejectedValue(thrown) }
      }
      const client = makeClient({ guilds: { fetch: jest.fn().mockResolvedValue(guild) } })

      const result = await service.verifyGuildManagePermission(client, 'g1', 'u1', 'parent1')

      expect(result).toEqual({
        hasPermission: false,
        denial: 'parent-not-found',
        reason: 'Parent category not found'
      })
    })

    it('parentId 未指定時は Unknown Channel コードでも基盤障害として伝播する', async () => {
      const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
      const failure = Object.assign(new Error('Unknown Channel'), { code: 10003 })
      const client = makeClient({ guilds: { fetch: jest.fn().mockRejectedValue(failure) } })

      await expect(service.verifyGuildManagePermission(client, 'g1', 'u1')).rejects.toBe(failure)
      expect(error).toHaveBeenCalledWith(expect.stringContaining('reason=Discord API error: Unknown Channel'))
    })

    it('parent 以外（guilds.fetch）が Unknown Channel コードで throw しても parent-not-found へ誤分類せず伝播する', async () => {
      const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
      const failure = Object.assign(new Error('Unknown Channel'), { code: 10003 })
      const client = makeClient({ guilds: { fetch: jest.fn().mockRejectedValue(failure) } })

      await expect(service.verifyGuildManagePermission(client, 'g1', 'u1', 'parent1')).rejects.toBe(failure)
      expect(error).toHaveBeenCalledWith(expect.stringContaining('reason=Discord API error: Unknown Channel'))
    })

    it('parent 以外（members.fetch）が GuildChannelUnowned コードで throw しても parent-not-found へ誤分類せず伝播する', async () => {
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
      const failure = Object.assign(new Error('channel not owned'), { code: 'GuildChannelUnowned' })
      const guild = {
        members: { fetch: jest.fn().mockRejectedValue(failure) },
        channels: { fetch: jest.fn() }
      }
      const client = makeClient({ guilds: { fetch: jest.fn().mockResolvedValue(guild) } })

      await expect(service.verifyGuildManagePermission(client, 'g1', 'u1', 'parent1')).rejects.toBe(failure)
      expect(guild.channels.fetch).not.toHaveBeenCalled()
    })

    it('基底権限と parent カテゴリ権限の両方があれば hasPermission:true', async () => {
      const baseHas = jest.fn().mockReturnValue(true)
      const parentHas = jest.fn().mockReturnValue(true)
      const member = { permissions: { has: baseHas } }
      const parent = {
        type: ChannelType.GuildCategory,
        permissionsFor: jest.fn().mockReturnValue({ has: parentHas })
      }
      const guild = {
        members: { fetch: jest.fn().mockResolvedValue(member) },
        channels: { fetch: jest.fn().mockResolvedValue(parent) }
      }
      const client = makeClient({ guilds: { fetch: jest.fn().mockResolvedValue(guild) } })

      const result = await service.verifyGuildManagePermission(client, 'g1', 'u1', 'parent1')

      expect(result).toEqual({ hasPermission: true })
    })

    it('Discord API例外は権限なしへ変換せず上位へ伝播する', async () => {
      // Arrange
      const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
      const failure = new Error('boom')
      const client = makeClient({ guilds: { fetch: jest.fn().mockRejectedValue(failure) } })

      // Act & Assert
      await expect(service.verifyGuildManagePermission(client, 'g1', 'u1')).rejects.toBe(failure)
      expect(error).toHaveBeenCalledWith(expect.stringContaining('reason=Discord API error: boom'))
    })

    // --- 非空 overwrite の caller-holds 検証（requestedOverwritePermissionKeys 第5引数） ---
    // 契約: undefined=非空 overwrite なし（従来要求のみ）/ 配列（空含む）=ManageRoles＋各キー保持を追加要求
    describe('非空 overwrite の caller-holds 検証', () => {
      const FLAGS = PermissionsBitField.Flags

      /** 指定 bigint フラグだけを保持する member スタブ（has は単一引数＝checkAdmin 既定を検証可能） */
      const makeMemberWithFlags = (...granted: bigint[]) => ({
        permissions: { has: jest.fn((flag: bigint) => granted.includes(flag)) }
      })

      const makeClientWithMember = (member: unknown) => {
        const guild = { members: { fetch: jest.fn().mockResolvedValue(member) } }
        return makeClient({ guilds: { fetch: jest.fn().mockResolvedValue(guild) } })
      }

      it('requestedKeys 未指定（undefined）なら ManageRoles 無しでも従来どおり許可する', async () => {
        const member = makeMemberWithFlags(FLAGS.ManageChannels)
        const client = makeClientWithMember(member)

        const result = await service.verifyGuildManagePermission(client, 'g1', 'u1')

        expect(result).toEqual({ hasPermission: true })
      })

      it('falsifier: ManageChannels のみの呼出者は deny:[ManageMessages] 要求で permission-denied（ManageRoles 不足）', async () => {
        const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
        const member = makeMemberWithFlags(FLAGS.ManageChannels)
        const client = makeClientWithMember(member)

        const result = await service.verifyGuildManagePermission(client, 'g1', 'u1', undefined, ['ManageMessages'])

        expect(result).toEqual({
          hasPermission: false,
          denial: 'permission-denied',
          reason: 'User lacks permission to manage roles'
        })
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('reason=User lacks permission to manage roles'))
      })

      it('空配列（キー無しの非空 overwrite）でも ManageRoles を要求する', async () => {
        const member = makeMemberWithFlags(FLAGS.ManageChannels)
        const client = makeClientWithMember(member)

        const result = await service.verifyGuildManagePermission(client, 'g1', 'u1', undefined, [])

        expect(result).toMatchObject({ hasPermission: false, denial: 'permission-denied' })
      })

      it('ManageRoles はあるが要求キーを保持しない場合は、不足キー名を warn に出して permission-denied', async () => {
        const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
        const member = makeMemberWithFlags(FLAGS.ManageChannels, FLAGS.ManageRoles)
        const client = makeClientWithMember(member)

        const result = await service.verifyGuildManagePermission(client, 'g1', 'u1', undefined, ['ManageMessages'])

        expect(result).toEqual({
          hasPermission: false,
          denial: 'permission-denied',
          reason: 'User lacks requested overwrite permissions: ManageMessages'
        })
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('ManageMessages'))
      })

      it('falsifier: ManageRoles＋ManageMessages を保持していれば成功する（has は checkAdmin 既定のまま呼ぶ）', async () => {
        const member = makeMemberWithFlags(FLAGS.ManageChannels, FLAGS.ManageRoles, FLAGS.ManageMessages)
        const client = makeClientWithMember(member)

        const result = await service.verifyGuildManagePermission(client, 'g1', 'u1', undefined, ['ManageMessages'])

        expect(result).toEqual({ hasPermission: true })
        // Administrator の暗黙包含を有効に保つため、checkAdmin=false を渡していないこと（単一引数）を固定する
        expect(member.permissions.has).toHaveBeenCalledWith(FLAGS.ManageMessages)
      })

      it('falsifier: Administrator（PermissionsBitField.has の暗黙包含で常に true）はすべて成功する', async () => {
        const member = { permissions: { has: jest.fn().mockReturnValue(true) } }
        const client = makeClientWithMember(member)

        const result = await service.verifyGuildManagePermission(client, 'g1', 'u1', undefined, [
          'ManageMessages',
          'ViewChannel'
        ])

        expect(result).toEqual({ hasPermission: true })
      })

      it('重複キーは除去して判定する（同一キーの has 呼び出しは1回）', async () => {
        const member = makeMemberWithFlags(FLAGS.ManageChannels, FLAGS.ManageRoles, FLAGS.ManageMessages)
        const client = makeClientWithMember(member)

        const result = await service.verifyGuildManagePermission(client, 'g1', 'u1', undefined, [
          'ManageMessages',
          'ManageMessages'
        ])

        expect(result).toEqual({ hasPermission: true })
        const manageMessagesCalls = (member.permissions.has as jest.Mock).mock.calls.filter(
          ([flag]) => flag === FLAGS.ManageMessages
        )
        expect(manageMessagesCalls).toHaveLength(1)
      })

      it('Flags に無い未知キーは fail-closed で拒否し、raw 値を reason/warn へ出さない', async () => {
        const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
        const member = { permissions: { has: jest.fn().mockReturnValue(true) } }
        const client = makeClientWithMember(member)

        const result = await service.verifyGuildManagePermission(client, 'g1', 'u1', undefined, [
          'TotallyUnknownKey' as never
        ])

        expect(result).toMatchObject({ hasPermission: false, denial: 'permission-denied' })
        expect(JSON.stringify(result)).not.toContain('TotallyUnknownKey')
        for (const [message] of warn.mock.calls) {
          expect(String(message)).not.toContain('TotallyUnknownKey')
        }
      })

      it('parent 指定時はカテゴリ実効権限でも ManageRoles を要求する', async () => {
        // 基底は ManageChannels＋ManageRoles を保持、カテゴリ実効では ManageRoles が拒否される
        const member = makeMemberWithFlags(FLAGS.ManageChannels, FLAGS.ManageRoles, FLAGS.ManageMessages)
        const parentHas = jest.fn((flag: bigint) => flag === FLAGS.ManageChannels)
        const parent = {
          type: ChannelType.GuildCategory,
          permissionsFor: jest.fn().mockReturnValue({ has: parentHas })
        }
        const guild = {
          members: { fetch: jest.fn().mockResolvedValue(member) },
          channels: { fetch: jest.fn().mockResolvedValue(parent) }
        }
        const client = makeClient({ guilds: { fetch: jest.fn().mockResolvedValue(guild) } })

        const result = await service.verifyGuildManagePermission(client, 'g1', 'u1', 'parent1', ['ManageMessages'])

        expect(result).toEqual({
          hasPermission: false,
          denial: 'permission-denied',
          reason: 'User lacks permission to manage roles in parent category'
        })
      })

      it('parent 指定時の要求キー保持はカテゴリ実効権限で判定する（基底保持でも実効不足なら拒否）', async () => {
        const member = makeMemberWithFlags(FLAGS.ManageChannels, FLAGS.ManageRoles, FLAGS.ManageMessages)
        const parentHas = jest.fn((flag: bigint) => flag === FLAGS.ManageChannels || flag === FLAGS.ManageRoles)
        const parent = {
          type: ChannelType.GuildCategory,
          permissionsFor: jest.fn().mockReturnValue({ has: parentHas })
        }
        const guild = {
          members: { fetch: jest.fn().mockResolvedValue(member) },
          channels: { fetch: jest.fn().mockResolvedValue(parent) }
        }
        const client = makeClient({ guilds: { fetch: jest.fn().mockResolvedValue(guild) } })

        const result = await service.verifyGuildManagePermission(client, 'g1', 'u1', 'parent1', ['ManageMessages'])

        expect(result).toEqual({
          hasPermission: false,
          denial: 'permission-denied',
          reason: 'User lacks requested overwrite permissions: ManageMessages'
        })
        expect(parentHas).toHaveBeenCalledWith(FLAGS.ManageMessages)
      })

      it('parent 指定時にカテゴリ実効で全要求を満たせば成功する', async () => {
        const member = makeMemberWithFlags(FLAGS.ManageChannels, FLAGS.ManageRoles)
        const parentHas = jest.fn().mockReturnValue(true)
        const parent = {
          type: ChannelType.GuildCategory,
          permissionsFor: jest.fn().mockReturnValue({ has: parentHas })
        }
        const guild = {
          members: { fetch: jest.fn().mockResolvedValue(member) },
          channels: { fetch: jest.fn().mockResolvedValue(parent) }
        }
        const client = makeClient({ guilds: { fetch: jest.fn().mockResolvedValue(guild) } })

        const result = await service.verifyGuildManagePermission(client, 'g1', 'u1', 'parent1', ['ManageMessages'])

        expect(result).toEqual({ hasPermission: true })
      })
    })
  })
})
