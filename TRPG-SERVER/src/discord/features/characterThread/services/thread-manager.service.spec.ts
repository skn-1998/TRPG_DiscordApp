// 本サービスは ChannelType.GuildText / channel.isThread() / ThreadAutoArchiveDuration など
// 実 discord.js の値・挙動に依存するため、グローバル jest-setup の discord.js モックを無効化し実挙動を使う。
jest.unmock('discord.js')
jest.mock('discord.js', () => jest.requireActual('discord.js'))

import { ChannelType } from 'discord.js'
import { ThreadManagerService, CreateThreadRequest } from './thread-manager.service'
import { DiscordClientService } from '../../../services/discord-client.service'
import { Character } from '../../../../domains/character/models/character.model'

/**
 * ThreadManagerService の characterization / 単体テスト。
 *
 * 副作用境界（DiscordClientService 経由の client / Date.now / setTimeout 待機）を
 * seam として差し替え、公開 API の外部挙動（戻り値）を固定する。
 * （E-3f: スレッド作成完了イベントの dead emit 撤去に伴い
 *   TypedEventService 依存は削除された）
 *
 * setTimeout 待機はサービスへ注入した sleep seam を 0 遅延フェイクに差し替えることで
 * テストを遅延させない（本番のタイミング挙動自体は不変）。
 */

const GUILD_ID = 'guild-1'
const CHANNEL_ID = 'channel-1'

const buildRequest = (overrides: Partial<CreateThreadRequest> = {}): CreateThreadRequest => ({
  characterId: 'char-1',
  characterName: 'テスト探索者',
  channelId: CHANNEL_ID,
  creatorId: 'creator-1',
  guildId: GUILD_ID,
  ...overrides
})

const buildCharacter = (overrides: Partial<Character> = {}): Character =>
  ({
    characterId: 'char-1',
    characterName: 'テスト探索者',
    ...overrides
  }) as unknown as Character

/**
 * discord.js Client を模した最小フェイクを作る。
 * - guilds.fetch / guild.channels.fetch / channel.threads.create / channels.fetch を差し替え可能に。
 */
interface ClientFakeOpts {
  guildFetch?: jest.Mock
  channelFetch?: jest.Mock
  threadsCreate?: jest.Mock
  clientChannelsFetch?: jest.Mock
}

const makeClient = (opts: ClientFakeOpts) => {
  const guild = {
    channels: {
      fetch: opts.channelFetch ?? jest.fn()
    }
  }

  return {
    user: { id: 'bot-1' },
    guilds: {
      fetch: opts.guildFetch ?? jest.fn().mockResolvedValue(guild)
    },
    channels: {
      fetch: opts.clientChannelsFetch ?? jest.fn()
    }
  }
}

/** GuildText チャンネル（threads.create を持つ）フェイク */
const makeTextChannel = (threadsCreate: jest.Mock) => ({
  id: CHANNEL_ID,
  type: ChannelType.GuildText,
  permissionsFor: jest.fn().mockReturnValue({ toArray: () => [] }),
  threads: { create: threadsCreate }
})

const makeThread = (id: string) => ({
  id,
  name: `🎭thread`,
  type: ChannelType.PublicThread,
  archived: false,
  parentId: CHANNEL_ID,
  memberCount: 1
})

/** isThread() を持つ thread チャンネル */
const makeThreadChannel = (isThread: boolean) => ({
  id: 'thread-1',
  isThread: () => isThread,
  setArchived: jest.fn().mockResolvedValue(undefined)
})

describe('ThreadManagerService', () => {
  const createService = (client: unknown): ThreadManagerService => {
    const discordClientService = {
      getClient: jest.fn().mockReturnValue(client)
    } as unknown as DiscordClientService
    const service = new ThreadManagerService(discordClientService)
    // sleep seam を 0 遅延に差し替え（タイミング挙動の検証はしないが、テストを遅延させない）
    ;(service as unknown as { sleep: (ms: number) => Promise<void> }).sleep = () => Promise.resolve()
    return service
  }

  describe('createCharacterThread', () => {
    it('成功すると createDiscordThread を実行し {success,threadId,threadUrl} を返す（E-3f: dead な completed emit は撤去）', async () => {
      // Arrange
      const thread = makeThread('thread-99')
      const threadsCreate = jest.fn().mockResolvedValue(thread)
      const textChannel = makeTextChannel(threadsCreate)
      const channelFetch = jest.fn().mockResolvedValue(textChannel)
      const guild = { channels: { fetch: channelFetch } }
      const client = makeClient({
        guildFetch: jest.fn().mockResolvedValue(guild),
        clientChannelsFetch: jest.fn().mockResolvedValue(thread)
      })
      const service = createService(client)

      // Act
      const result = await service.createCharacterThread(buildRequest(), buildCharacter())

      // Assert
      expect(result).toEqual({
        success: true,
        threadId: 'thread-99',
        threadUrl: `https://discord.com/channels/${GUILD_ID}/thread-99`
      })
      expect(threadsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '🎭テスト探索者',
          type: ChannelType.PublicThread
        })
      )
    })

    it('guild 取得失敗（null）→ {success:false,error} を返す', async () => {
      const client = makeClient({ guildFetch: jest.fn().mockResolvedValue(null) })
      const service = createService(client)

      const result = await service.createCharacterThread(buildRequest(), buildCharacter())

      expect(result.success).toBe(false)
      expect(result.error).toContain(GUILD_ID)
    })

    it('channel が GuildText でない → {success:false} を返す', async () => {
      const nonText = { id: CHANNEL_ID, type: ChannelType.GuildVoice }
      const guild = { channels: { fetch: jest.fn().mockResolvedValue(nonText) } }
      const client = makeClient({ guildFetch: jest.fn().mockResolvedValue(guild) })
      const service = createService(client)

      const result = await service.createCharacterThread(buildRequest(), buildCharacter())

      expect(result.success).toBe(false)
    })
  })

  describe('getThreadChannel', () => {
    it('fetch が thread を返せばそのまま返す', async () => {
      const thread = makeThreadChannel(true)
      const client = makeClient({ clientChannelsFetch: jest.fn().mockResolvedValue(thread) })
      const service = createService(client)

      const result = await service.getThreadChannel('thread-1')

      expect(result).toBe(thread)
    })

    it('fetch が非 thread を返せば null', async () => {
      const nonThread = makeThreadChannel(false)
      const client = makeClient({ clientChannelsFetch: jest.fn().mockResolvedValue(nonThread) })
      const service = createService(client)

      const result = await service.getThreadChannel('thread-1')

      expect(result).toBeNull()
    })

    it('例外時は retryCount まで再試行し最終的に null', async () => {
      const fetch = jest.fn().mockRejectedValue(new Error('boom'))
      const client = makeClient({ clientChannelsFetch: fetch })
      const service = createService(client)

      const result = await service.getThreadChannel('thread-1', 3, 10)

      expect(result).toBeNull()
      expect(fetch).toHaveBeenCalledTimes(3)
    })
  })

  describe('waitForThreadAvailability', () => {
    it('取得できれば thread を返す', async () => {
      const thread = makeThreadChannel(true)
      const client = makeClient({ clientChannelsFetch: jest.fn().mockResolvedValue(thread) })
      const service = createService(client)

      const result = await service.waitForThreadAvailability('thread-1', 5000, 10)

      expect(result).toBe(thread)
    })

    it('maxWaitMs 内に取得できなければ null', async () => {
      const nonThread = makeThreadChannel(false)
      const client = makeClient({ clientChannelsFetch: jest.fn().mockResolvedValue(nonThread) })
      const service = createService(client)
      // now seam を進めて即タイムアウトさせる（待機は 0 遅延 sleep）
      let t = 0
      ;(service as unknown as { now: () => number }).now = () => {
        const v = t
        t += 10000
        return v
      }

      const result = await service.waitForThreadAvailability('thread-1', 5000, 10)

      expect(result).toBeNull()
    })
  })

  describe('threadExists', () => {
    it('thread が取得できれば true', async () => {
      const thread = makeThreadChannel(true)
      const client = makeClient({ clientChannelsFetch: jest.fn().mockResolvedValue(thread) })
      const service = createService(client)

      await expect(service.threadExists('thread-1')).resolves.toBe(true)
    })

    it('取得できなければ false', async () => {
      const nonThread = makeThreadChannel(false)
      const client = makeClient({ clientChannelsFetch: jest.fn().mockResolvedValue(nonThread) })
      const service = createService(client)

      await expect(service.threadExists('thread-1')).resolves.toBe(false)
    })
  })

  describe('archiveThread / unarchiveThread', () => {
    it('archiveThread: thread があれば setArchived(true) を呼び true', async () => {
      const thread = makeThreadChannel(true)
      const client = makeClient({ clientChannelsFetch: jest.fn().mockResolvedValue(thread) })
      const service = createService(client)

      const result = await service.archiveThread('thread-1')

      expect(result).toBe(true)
      expect(thread.setArchived).toHaveBeenCalledWith(true)
    })

    it('archiveThread: thread が無ければ false', async () => {
      const nonThread = makeThreadChannel(false)
      const client = makeClient({ clientChannelsFetch: jest.fn().mockResolvedValue(nonThread) })
      const service = createService(client)

      await expect(service.archiveThread('thread-1')).resolves.toBe(false)
    })

    it('unarchiveThread: thread があれば setArchived(false) を呼び true', async () => {
      const thread = makeThreadChannel(true)
      const client = makeClient({ clientChannelsFetch: jest.fn().mockResolvedValue(thread) })
      const service = createService(client)

      const result = await service.unarchiveThread('thread-1')

      expect(result).toBe(true)
      expect(thread.setArchived).toHaveBeenCalledWith(false)
    })

    it('unarchiveThread: thread が無ければ false', async () => {
      const nonThread = makeThreadChannel(false)
      const client = makeClient({ clientChannelsFetch: jest.fn().mockResolvedValue(nonThread) })
      const service = createService(client)

      await expect(service.unarchiveThread('thread-1')).resolves.toBe(false)
    })
  })
})
