import { Test } from '@nestjs/testing'
import { ChannelType } from 'discord.js'
import { ChannelCreatorService } from './channel-creator.service'
import { AppConfigService } from '../../../config/config.service'
import { ErrorHandler } from '../../../core/http/error-handler'

/**
 * characterization（特性化）テスト
 *
 * テスタビリティ改善リファクタの「手順0」。現挙動を固定し、構造変更後も同じテストが
 * 緑であることで挙動不変を証明する安全網。
 *
 * 重要な現挙動の注意点:
 * - `ErrorHandler.handleServiceError` は実装上「常に throw する」（HttpException を再スロー）。
 *   そのため catch ブロック内の `return null` / `return false` には到達せず、
 *   各メソッドは catch 時に例外を伝播させる、というのが固定すべき現挙動である。
 * - 本体・テストとも `discord.js` の `ChannelType` を同一の（jest-setup でモックされた）
 *   参照から取得するため、enum 値の比較は一致する。`requireActual` で実 enum を混在させない。
 */
describe('ChannelCreatorService (characterization)', () => {
  let service: ChannelCreatorService

  const buildConfig = () => ({
    get: jest.fn().mockReturnValue(undefined)
  })

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [ChannelCreatorService, { provide: AppConfigService, useValue: buildConfig() }]
    }).compile()

    service = moduleRef.get(ChannelCreatorService)
  })

  // --- getChannelInfo -------------------------------------------------------
  describe('getChannelInfo', () => {
    const makeClient = (channel: unknown) => ({ channels: { fetch: jest.fn().mockResolvedValue(channel) } }) as never

    it('fetch が null を返した場合は null', async () => {
      const result = await service.getChannelInfo(makeClient(null), 'ch')
      expect(result).toBeNull()
    })

    it('name / guildId / parentId / topic を条件付きで組み立てる', async () => {
      const channel = {
        id: 'ch-1',
        type: 0,
        name: 'general',
        guildId: 'g-1',
        parentId: 'p-1',
        topic: 'hello',
        isThread: () => false
      }
      const result = await service.getChannelInfo(makeClient(channel), 'ch-1')
      expect(result).toEqual({
        id: 'ch-1',
        name: 'general',
        type: ChannelType[0] ?? 'Unknown',
        guildId: 'g-1',
        parentId: 'p-1',
        topic: 'hello'
      })
    })

    it("'name' を持たない channel は name='Unknown' になる", async () => {
      const channel = {
        id: 'ch-2',
        type: 99,
        isThread: () => false
      }
      const result = await service.getChannelInfo(makeClient(channel), 'ch-2')
      expect(result?.name).toBe('Unknown')
    })

    it('未設定の guildId/parentId/topic は結果に含めない', async () => {
      const channel = {
        id: 'ch-3',
        type: 0,
        name: 'no-extra',
        guildId: undefined,
        parentId: null,
        topic: '',
        isThread: () => false
      }
      const result = await service.getChannelInfo(makeClient(channel), 'ch-3')
      expect(result).not.toHaveProperty('guildId')
      expect(result).not.toHaveProperty('parentId')
      expect(result).not.toHaveProperty('topic')
    })

    it('isThread() が true のとき memberCount を含める', async () => {
      const channel = {
        id: 'th-1',
        type: 11,
        name: 'thread',
        isThread: () => true,
        memberCount: 7
      }
      const result = await service.getChannelInfo(makeClient(channel), 'th-1')
      expect(result?.memberCount).toBe(7)
    })

    it('fetch が例外を投げた場合は ErrorHandler 経由で握り、現状はスローされる', async () => {
      const client = {
        channels: { fetch: jest.fn().mockRejectedValue(new Error('boom')) }
      } as never
      const spy = jest.spyOn(ErrorHandler, 'handleServiceError')

      await expect(service.getChannelInfo(client, 'errch')).rejects.toBeDefined()
      expect(spy).toHaveBeenCalledTimes(1)
      spy.mockRestore()
    })
  })

  // --- createChannel --------------------------------------------------------
  describe('createChannel', () => {
    const makeClient = (guild: unknown) => ({ guilds: { fetch: jest.fn().mockResolvedValue(guild) } }) as never

    it('guild が取得できない場合は throw する', async () => {
      const spy = jest.spyOn(ErrorHandler, 'handleServiceError')
      await expect(service.createChannel(makeClient(null), 'g-1', 'name')).rejects.toBeDefined()
      spy.mockRestore()
    })

    it('成功時は guild.channels.create の戻り値を返し、option を組み立てる', async () => {
      const created = { id: 'new-ch' }
      const create = jest.fn().mockResolvedValue(created)
      const guild = { channels: { create } }
      const result = await service.createChannel(makeClient(guild), 'g-1', 'name', {
        type: ChannelType.PublicThread,
        parent: 'parent-id',
        topic: 'topic',
        position: 3,
        nsfw: true,
        rateLimitPerUser: 5
      })

      expect(result).toBe(created)
      expect(create).toHaveBeenCalledTimes(1)
      const opts = create.mock.calls[0][0]
      expect(opts.name).toBe('name')
      expect(opts.type).toBe(ChannelType.PublicThread)
      expect(opts.parent).toBe('parent-id')
      expect(opts.topic).toBe('topic')
      expect(opts.position).toBe(3)
      expect(opts.nsfw).toBe(true)
      expect(opts.rateLimitPerUser).toBe(5)
    })

    it('type 未指定なら ChannelType.GuildText がデフォルト', async () => {
      const create = jest.fn().mockResolvedValue({ id: 'x' })
      const guild = { channels: { create } }
      await service.createChannel(makeClient(guild), 'g-1', 'name')
      expect(create.mock.calls[0][0].type).toBe(ChannelType.GuildText)
    })

    it('GuildVoice のとき bitrate / userLimit を組み込む', async () => {
      const create = jest.fn().mockResolvedValue({ id: 'v' })
      const guild = { channels: { create } }
      await service.createChannel(makeClient(guild), 'g-1', 'voice', {
        type: ChannelType.GuildVoice,
        bitrate: 64000,
        userLimit: 10
      })
      const opts = create.mock.calls[0][0]
      expect(opts.bitrate).toBe(64000)
      expect(opts.userLimit).toBe(10)
    })

    it('create が例外を投げた場合はスローされる', async () => {
      const guild = { channels: { create: jest.fn().mockRejectedValue(new Error('x')) } }
      const spy = jest.spyOn(ErrorHandler, 'handleServiceError')
      await expect(service.createChannel(makeClient(guild), 'g-1', 'name')).rejects.toBeDefined()
      spy.mockRestore()
    })
  })

  // --- createThread ---------------------------------------------------------
  describe('createThread', () => {
    const makeClient = (channel: unknown) => ({ channels: { fetch: jest.fn().mockResolvedValue(channel) } }) as never

    it('text 系でない channel は throw → catch で握られスローされる', async () => {
      const channel = { isTextBased: () => false, isThread: () => false }
      const spy = jest.spyOn(ErrorHandler, 'handleServiceError')
      await expect(service.createThread(makeClient(channel), 'ch', 'thread')).rejects.toBeDefined()
      spy.mockRestore()
    })

    it('thread 自体には作成できずスローされる', async () => {
      const channel = { isTextBased: () => true, isThread: () => true }
      const spy = jest.spyOn(ErrorHandler, 'handleServiceError')
      await expect(service.createThread(makeClient(channel), 'ch', 'thread')).rejects.toBeDefined()
      spy.mockRestore()
    })

    it('成功時は thread を返し、option を組み立てる', async () => {
      const thread = { id: 'th-new' }
      const create = jest.fn().mockResolvedValue(thread)
      const channel = {
        isTextBased: () => true,
        isThread: () => false,
        threads: { create }
      }
      const result = await service.createThread(makeClient(channel), 'ch', 'thread', {
        type: ChannelType.PublicThread,
        autoArchiveDuration: 1440,
        reason: 'because'
      })
      expect(result).toBe(thread)
      const opts = create.mock.calls[0][0]
      expect(opts.name).toBe('thread')
      expect(opts.type).toBe(ChannelType.PublicThread)
      expect(opts.autoArchiveDuration).toBe(1440)
      expect(opts.reason).toBe('because')
    })

    it('type 未指定なら ChannelType.PublicThread がデフォルト', async () => {
      const create = jest.fn().mockResolvedValue({ id: 't' })
      const channel = { isTextBased: () => true, isThread: () => false, threads: { create } }
      await service.createThread(makeClient(channel), 'ch', 'thread')
      expect(create.mock.calls[0][0].type).toBe(ChannelType.PublicThread)
    })
  })

  // --- checkChannelPermissions ---------------------------------------------
  describe('checkChannelPermissions', () => {
    it('guild の無い channel は hasAccess:false と全 false map を返す', async () => {
      const client = {
        channels: { fetch: jest.fn().mockResolvedValue({ id: 'ch' }) }
      } as never
      const result = await service.checkChannelPermissions(client, 'ch', 'u', ['ViewChannel', 'SendMessages'])
      expect(result).toEqual({
        hasAccess: false,
        permissions: { ViewChannel: false, SendMessages: false }
      })
    })

    it('member の権限を集計し some(Boolean) で hasAccess を決める', async () => {
      const has = jest.fn((p: string) => p === 'ViewChannel')
      const member = { permissions: { has } }
      const channel = {
        guild: { members: { fetch: jest.fn().mockResolvedValue(member) } }
      }
      const client = {
        channels: { fetch: jest.fn().mockResolvedValue(channel) }
      } as never
      const result = await service.checkChannelPermissions(client, 'ch', 'u', ['ViewChannel', 'SendMessages'])
      expect(result.permissions).toEqual({ ViewChannel: true, SendMessages: false })
      expect(result.hasAccess).toBe(true)
      expect(result.member).toBe(member)
    })

    it('すべて false なら hasAccess:false', async () => {
      const member = { permissions: { has: jest.fn().mockReturnValue(false) } }
      const channel = {
        guild: { members: { fetch: jest.fn().mockResolvedValue(member) } }
      }
      const client = {
        channels: { fetch: jest.fn().mockResolvedValue(channel) }
      } as never
      const result = await service.checkChannelPermissions(client, 'ch', 'u', ['ViewChannel'])
      expect(result.hasAccess).toBe(false)
    })

    it('fetch が例外を投げた場合はスローされる', async () => {
      const client = {
        channels: { fetch: jest.fn().mockRejectedValue(new Error('x')) }
      } as never
      const spy = jest.spyOn(ErrorHandler, 'handleServiceError')
      await expect(service.checkChannelPermissions(client, 'ch', 'u', ['ViewChannel'])).rejects.toBeDefined()
      spy.mockRestore()
    })
  })

  // --- setChannelPermissions ------------------------------------------------
  describe('setChannelPermissions', () => {
    it('permissionOverwrites を持たない channel はスローされる', async () => {
      const client = {
        channels: { fetch: jest.fn().mockResolvedValue({ id: 'ch' }) }
      } as never
      const spy = jest.spyOn(ErrorHandler, 'handleServiceError')
      await expect(service.setChannelPermissions(client, 'ch', 't', { allow: ['ViewChannel'] })).rejects.toBeDefined()
      spy.mockRestore()
    })

    it('成功時は true を返し、allow/deny を組み立てる', async () => {
      const create = jest.fn().mockResolvedValue({})
      const channel = { permissionOverwrites: { create } }
      const client = {
        channels: { fetch: jest.fn().mockResolvedValue(channel) }
      } as never
      const result = await service.setChannelPermissions(client, 'ch', 'target', {
        allow: ['ViewChannel'],
        deny: ['SendMessages']
      })
      expect(result).toBe(true)
      expect(create).toHaveBeenCalledWith('target', {
        allow: ['ViewChannel'],
        deny: ['SendMessages']
      })
    })
  })

  // --- createCategory -------------------------------------------------------
  describe('createCategory', () => {
    const makeClient = (guild: unknown) => ({ guilds: { fetch: jest.fn().mockResolvedValue(guild) } }) as never

    it('guild が取得できない場合はスローされる', async () => {
      const spy = jest.spyOn(ErrorHandler, 'handleServiceError')
      await expect(service.createCategory(makeClient(null), 'g', 'cat')).rejects.toBeDefined()
      spy.mockRestore()
    })

    it('成功時は category を返し、position/permissions を組み立てる', async () => {
      const category = { id: 'cat-1' }
      const create = jest.fn().mockResolvedValue(category)
      const guild = { channels: { create } }
      const result = await service.createCategory(makeClient(guild), 'g', 'cat', {
        position: 2,
        permissions: [{ id: 'x' }] as never
      })
      expect(result).toBe(category)
      const opts = create.mock.calls[0][0]
      expect(opts.name).toBe('cat')
      expect(opts.type).toBe(ChannelType.GuildCategory)
      expect(opts.position).toBe(2)
      expect(opts.permissionOverwrites).toEqual([{ id: 'x' }])
    })
  })

  // --- convertChannelType ---------------------------------------------------
  describe('convertChannelType', () => {
    it('既知の文字列を対応する ChannelType に変換する', () => {
      expect(service.convertChannelType('text')).toBe(ChannelType.GuildText)
      expect(service.convertChannelType('voice')).toBe(ChannelType.GuildVoice)
      expect(service.convertChannelType('category')).toBe(ChannelType.GuildCategory)
      expect(service.convertChannelType('public_thread')).toBe(ChannelType.PublicThread)
    })

    it('大文字でも変換できる（toLowerCase）', () => {
      expect(service.convertChannelType('TEXT')).toBe(ChannelType.GuildText)
    })

    it('未知の文字列は ChannelType.GuildText にフォールバックする', () => {
      expect(service.convertChannelType('unknown-type')).toBe(ChannelType.GuildText)
    })
  })

  // --- updateChannelSettings ------------------------------------------------
  describe('updateChannelSettings', () => {
    it('edit を持たない channel はスローされる', async () => {
      const client = {
        channels: { fetch: jest.fn().mockResolvedValue({ id: 'ch' }) }
      } as never
      const spy = jest.spyOn(ErrorHandler, 'handleServiceError')
      await expect(service.updateChannelSettings(client, 'ch', { name: 'new' })).rejects.toBeDefined()
      spy.mockRestore()
    })

    it('成功時は true を返し、settings を edit に渡す', async () => {
      const edit = jest.fn().mockResolvedValue({})
      const channel = { edit }
      const client = {
        channels: { fetch: jest.fn().mockResolvedValue(channel) }
      } as never
      const settings = { name: 'new', topic: 'updated' }
      const result = await service.updateChannelSettings(client, 'ch', settings)
      expect(result).toBe(true)
      expect(edit).toHaveBeenCalledWith(settings)
    })
  })

  // --- deleteChannel --------------------------------------------------------
  describe('deleteChannel', () => {
    it('delete を持たない channel はスローされる', async () => {
      const client = {
        channels: { fetch: jest.fn().mockResolvedValue({ id: 'ch' }) }
      } as never
      const spy = jest.spyOn(ErrorHandler, 'handleServiceError')
      await expect(service.deleteChannel(client, 'ch')).rejects.toBeDefined()
      spy.mockRestore()
    })

    it('成功時は true を返し、reason を delete に渡す', async () => {
      const del = jest.fn().mockResolvedValue({})
      const channel = { delete: del }
      const client = {
        channels: { fetch: jest.fn().mockResolvedValue(channel) }
      } as never
      const result = await service.deleteChannel(client, 'ch', 'cleanup')
      expect(result).toBe(true)
      expect(del).toHaveBeenCalledWith('cleanup')
    })
  })
})
