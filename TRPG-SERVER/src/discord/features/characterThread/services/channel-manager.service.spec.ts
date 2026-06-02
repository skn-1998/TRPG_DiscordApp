// 本サービスは instanceof TextChannel/ThreadChannel・ChannelType・StringSelectMenuOptionBuilder
// など実 discord.js の挙動に依存するため、グローバル jest-setup の discord.js モックを無効化し実挙動を使う。
jest.unmock('discord.js')
jest.mock('discord.js', () => jest.requireActual('discord.js'))

import { ChannelType, Guild, TextChannel, ThreadChannel } from 'discord.js'
import { ChannelManagerService } from './channel-manager.service'
import { AppConfigService } from '../../../../config/config.service'
import { Character } from '../../../../domains/character/models/character.model'

/**
 * ChannelManagerService の characterization / 単体テスト。
 *
 * Discord I/O（guild.channels.fetch / guild.channels.cache）と instanceof 判定は
 * 実 discord.js の prototype を使ったフェイクで再現する。
 * 純選別ロジックは channel-manager.util.ts へ抽出済みのため、本 spec は seam（副作用境界）
 * とフォールバック挙動の固定に専念する。
 */

const CHARACTER_CATEGORY = 'キャラクターカテゴリ'

// 実 TextChannel.prototype を継承させ instanceof TextChannel を成立させる軽量フェイク
const makeTextChannel = (props: Record<string, unknown>): TextChannel => {
  const ch = Object.create(TextChannel.prototype)
  return Object.assign(ch, { type: ChannelType.GuildText, ...props })
}

const makeThreadChannel = (props: Record<string, unknown>): ThreadChannel => {
  const ch = Object.create(ThreadChannel.prototype)
  return Object.assign(ch, { type: ChannelType.PublicThread, ...props })
}

// instanceof いずれにも該当しない素のチャンネル
const makePlainChannel = (props: Record<string, unknown>) => ({ ...props })

interface CacheEntry {
  id: string
  name: string
  type: ChannelType
  parentId?: string | null
  createdTimestamp?: number
}

/**
 * guild.channels.cache（find/filter）と guild.channels.fetch を再現する Guild フェイクを作る。
 * cache は discord.js Collection 互換の find/filter/values/size を最小実装する。
 */
const makeGuild = (opts: { cache?: CacheEntry[]; fetchResult?: unknown; fetchError?: Error }): Guild => {
  const cacheArr = opts.cache ?? []

  const collectionLike = {
    find: (predicate: (c: CacheEntry) => boolean) => cacheArr.find(predicate),
    filter: (predicate: (c: CacheEntry) => boolean) => {
      const filtered = cacheArr.filter(predicate)
      return {
        size: filtered.length,
        values: () => filtered.values()
      }
    }
  }

  const fetch = jest.fn(async () => {
    if (opts.fetchError) throw opts.fetchError
    return opts.fetchResult ?? null
  })

  return {
    channels: {
      cache: collectionLike,
      fetch
    }
  } as unknown as Guild
}

const buildCharacter = (overrides: Partial<Character> = {}): Character =>
  ({
    characterId: 'char-1',
    characterName: 'テスト探索者',
    discordChannelId: 'channel-1',
    ...overrides
  }) as unknown as Character

describe('ChannelManagerService', () => {
  let service: ChannelManagerService
  let appConfig: jest.Mocked<Pick<AppConfigService, 'get'>>

  beforeEach(() => {
    appConfig = {
      get: jest.fn().mockReturnValue(CHARACTER_CATEGORY)
    } as unknown as jest.Mocked<Pick<AppConfigService, 'get'>>
    service = new ChannelManagerService(appConfig as unknown as AppConfigService)
  })

  describe('createCharacterThread', () => {
    it('TextChannel が取得できればその threads.create を name=characterName/PublicThread で呼び返す', async () => {
      // Arrange
      const created = { id: 'thread-99' }
      const threadsCreate = jest.fn().mockResolvedValue(created)
      const target = makeTextChannel({ id: 'channel-1', threads: { create: threadsCreate } })
      const guild = makeGuild({ fetchResult: target })

      // Act
      const result = await service.createCharacterThread(guild, 'channel-1', buildCharacter())

      // Assert
      expect(guild.channels.fetch).toHaveBeenCalledWith('channel-1')
      expect(threadsCreate).toHaveBeenCalledWith({
        name: 'テスト探索者',
        type: ChannelType.PublicThread
      })
      expect(result).toBe(created)
    })

    it('取得結果が TextChannel でなければ throw する', async () => {
      // Arrange: ThreadChannel は TextChannel ではない
      const guild = makeGuild({ fetchResult: makeThreadChannel({ id: 'channel-1' }) })

      // Act / Assert
      await expect(service.createCharacterThread(guild, 'channel-1', buildCharacter())).rejects.toThrow(
        'キャラクターのチャンネルが見つかりません'
      )
    })

    it('取得結果が null なら throw する', async () => {
      const guild = makeGuild({ fetchResult: null })
      await expect(service.createCharacterThread(guild, 'channel-1', buildCharacter())).rejects.toThrow(
        'キャラクターのチャンネルが見つかりません'
      )
    })
  })

  describe('getCharacterChannelOptions', () => {
    it('カテゴリが見つからなければ no-category オプションを1件返す', () => {
      // Arrange: カテゴリ未登録
      const guild = makeGuild({ cache: [] })

      // Act
      const options = service.getCharacterChannelOptions(guild)

      // Assert
      expect(options).toHaveLength(1)
      expect(options[0].data.label).toBe('カテゴリが見つかりません')
      expect(options[0].data.value).toBe('no-category')
    })

    it('カテゴリ内テキストチャンネルが0件なら no-channels オプションを1件返す', () => {
      // Arrange: カテゴリのみ、テキストチャンネルなし
      const guild = makeGuild({
        cache: [{ id: 'cat-1', name: CHARACTER_CATEGORY, type: ChannelType.GuildCategory }]
      })

      // Act
      const options = service.getCharacterChannelOptions(guild)

      // Assert
      expect(options).toHaveLength(1)
      expect(options[0].data.label).toBe('チャンネルが見つかりません')
      expect(options[0].data.value).toBe('no-channels')
    })

    it('複数チャンネルを createdTimestamp 降順・最大25件・label=name/value=id で返す', () => {
      // Arrange: カテゴリ + 古い順に登録した30件のテキストチャンネル
      const cache: CacheEntry[] = [{ id: 'cat-1', name: CHARACTER_CATEGORY, type: ChannelType.GuildCategory }]
      for (let i = 0; i < 30; i++) {
        cache.push({
          id: `ch-${i}`,
          name: `name-${i}`,
          type: ChannelType.GuildText,
          parentId: 'cat-1',
          createdTimestamp: i // i が大きいほど新しい
        })
      }
      const guild = makeGuild({ cache })

      // Act
      const options = service.getCharacterChannelOptions(guild)

      // Assert: 最大25件、降順（新しい ch-29 が先頭）
      expect(options).toHaveLength(25)
      expect(options[0].data.label).toBe('name-29')
      expect(options[0].data.value).toBe('ch-29')
      expect(options[24].data.value).toBe('ch-5')
    })

    it('親カテゴリが異なるテキストチャンネルは除外する', () => {
      const guild = makeGuild({
        cache: [
          { id: 'cat-1', name: CHARACTER_CATEGORY, type: ChannelType.GuildCategory },
          { id: 'ch-in', name: 'in', type: ChannelType.GuildText, parentId: 'cat-1', createdTimestamp: 1 },
          { id: 'ch-out', name: 'out', type: ChannelType.GuildText, parentId: 'other', createdTimestamp: 2 }
        ]
      })

      const options = service.getCharacterChannelOptions(guild)

      expect(options).toHaveLength(1)
      expect(options[0].data.value).toBe('ch-in')
    })

    it('例外が発生すると error オプションを1件返す', () => {
      // Arrange: cache アクセスで例外
      const guild = {
        channels: {
          cache: {
            find: () => {
              throw new Error('cache error')
            }
          }
        }
      } as unknown as Guild

      // Act
      const options = service.getCharacterChannelOptions(guild)

      // Assert
      expect(options).toHaveLength(1)
      expect(options[0].data.label).toBe('エラーが発生しました')
      expect(options[0].data.value).toBe('error')
    })
  })

  describe('validateCharacterCategory', () => {
    it('カテゴリが見つかれば isValid:true と categoryChannel を返す', () => {
      const category = { id: 'cat-1', name: CHARACTER_CATEGORY, type: ChannelType.GuildCategory }
      const guild = makeGuild({ cache: [category] })

      const result = service.validateCharacterCategory(guild)

      expect(result.isValid).toBe(true)
      expect(result.categoryChannel).toBe(category)
    })

    it('カテゴリが無ければ isValid:false と undefined を返す', () => {
      const guild = makeGuild({ cache: [] })

      const result = service.validateCharacterCategory(guild)

      expect(result.isValid).toBe(false)
      expect(result.categoryChannel).toBeUndefined()
    })
  })

  describe('validateTextChannel', () => {
    it('TextChannel ならそのまま返す', async () => {
      const channel = makeTextChannel({ id: 'ch-1' })
      const guild = makeGuild({ fetchResult: channel })

      await expect(service.validateTextChannel(guild, 'ch-1')).resolves.toBe(channel)
    })

    it('TextChannel でなければ null を返す', async () => {
      const guild = makeGuild({ fetchResult: makePlainChannel({ id: 'ch-1' }) })

      await expect(service.validateTextChannel(guild, 'ch-1')).resolves.toBeNull()
    })

    it('fetch が例外を投げたら null を返す', async () => {
      const guild = makeGuild({ fetchError: new Error('fetch failed') })

      await expect(service.validateTextChannel(guild, 'ch-1')).resolves.toBeNull()
    })
  })

  describe('validateThread', () => {
    it('ThreadChannel ならそのまま返す', async () => {
      const thread = makeThreadChannel({ id: 'th-1' })
      const guild = makeGuild({ fetchResult: thread })

      await expect(service.validateThread(guild, 'th-1')).resolves.toBe(thread)
    })

    it('ThreadChannel でなければ null を返す', async () => {
      const guild = makeGuild({ fetchResult: makeTextChannel({ id: 'th-1' }) })

      await expect(service.validateThread(guild, 'th-1')).resolves.toBeNull()
    })

    it('fetch が例外を投げたら null を返す', async () => {
      const guild = makeGuild({ fetchError: new Error('fetch failed') })

      await expect(service.validateThread(guild, 'th-1')).resolves.toBeNull()
    })
  })

  describe('logChannelInfo', () => {
    it('例外を投げずに完了する', () => {
      const channel = makeTextChannel({ id: 'ch-1', name: 'log-target', parentId: 'cat-1' })

      expect(() => service.logChannelInfo(channel)).not.toThrow()
    })
  })
})
