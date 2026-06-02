// 本サービスは StringSelectMenuOptionBuilder の data getter・ChannelType・instanceof TextChannel など
// 実 discord.js の挙動に依存するため、グローバル jest-setup の discord.js モックを無効化し実挙動を使う。
jest.unmock('discord.js')
jest.mock('discord.js', () => jest.requireActual('discord.js'))

import { Test } from '@nestjs/testing'
import {
  AnySelectMenuInteraction,
  ChannelType,
  CommandInteraction,
  Guild,
  TextChannel,
  ThreadChannel
} from 'discord.js'
import { CharacterChannelService } from './character-channel.service'
import { AppConfigService } from '../../../config/config.service'
import { TypedEventEmitter } from '../../../core/events/typed-event.service'
import { Character } from '../../../domains/character/models/character.model'

/**
 * CharacterChannelService の単体テスト。
 *
 * - AppConfigService.get / TypedEventEmitter.requestCharacterSearch を副作用境界としてモック。
 * - guild.channels.cache（find/filter）・guild.channels.fetch・thread.send は最小スタブで再現。
 * - instanceof TextChannel / ChannelType / StringSelectMenuOptionBuilder の data getter は
 *   実 discord.js を使う（jest.unmock 済み）。
 * - execute は Phase3 で無効化されているため「イベント発行 + メンテナンス reply + return」までを固定する。
 * - embed/button の構築内容は脆く低価値なため、postCharacterEmbeds / createDiceButtons / postThreadCreationReply は
 *   「send が呼ばれる」レベルの代表ケースに留める。
 */

const CHARACTER_CATEGORY = 'キャラクターカテゴリ'

interface CacheEntry {
  id: string
  name: string
  type: ChannelType
  parentId?: string | null
  createdTimestamp?: number
}

// guild.channels.cache（find/filter）と guild.channels.fetch を再現する Guild フェイク
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

// 実 TextChannel.prototype を継承させ instanceof TextChannel を成立させる軽量フェイク
const makeTextChannel = (props: Record<string, unknown>): TextChannel => {
  const ch = Object.create(TextChannel.prototype)
  return Object.assign(ch, { type: ChannelType.GuildText, ...props })
}

// 最小の ThreadChannel スタブ（send だけ持てばよい）
const makeThreadStub = () => ({ name: 'thread-name', send: jest.fn().mockResolvedValue(undefined) })

// CommandInteraction の最小スタブ
const makeCommandInteraction = (opts: { guild?: Guild | null; userName?: string } = {}) =>
  ({
    guild: 'guild' in opts ? opts.guild : makeGuild({ cache: [] }),
    reply: jest.fn().mockResolvedValue(undefined),
    user: { displayName: opts.userName ?? 'PL太郎' }
  }) as unknown as CommandInteraction

// AnySelectMenuInteraction の最小スタブ
const makeSelectInteraction = (opts: { guild?: Guild | null; values?: string[]; channel?: unknown } = {}) =>
  ({
    guild: 'guild' in opts ? opts.guild : makeGuild({ cache: [] }),
    values: opts.values ?? ['discord-channel-1'],
    channel: opts.channel ?? null,
    replied: false,
    user: { displayName: 'TestUser' },
    reply: jest.fn().mockResolvedValue(undefined),
    deleteReply: jest.fn().mockResolvedValue(undefined)
  }) as unknown as AnySelectMenuInteraction

const buildCharacter = (overrides: Partial<Character> = {}): Character =>
  ({
    characterId: 'char-1',
    characterName: 'テスト探索者',
    discordChannelId: 'channel-1',
    discordUserId: 'user-1',
    gameSystemId: 'coc',
    status: {},
    parameter: {},
    skill: {},
    item: {},
    description: {},
    ...overrides
  }) as unknown as Character

describe('CharacterChannelService', () => {
  let service: CharacterChannelService
  let appConfig: jest.Mocked<Pick<AppConfigService, 'get'>>
  let eventEmitter: jest.Mocked<Pick<TypedEventEmitter, 'requestCharacterSearch'>>

  beforeEach(async () => {
    appConfig = {
      get: jest.fn().mockReturnValue(CHARACTER_CATEGORY)
    } as unknown as jest.Mocked<Pick<AppConfigService, 'get'>>
    eventEmitter = {
      requestCharacterSearch: jest.fn().mockResolvedValue(undefined)
    } as unknown as jest.Mocked<Pick<TypedEventEmitter, 'requestCharacterSearch'>>

    const moduleRef = await Test.createTestingModule({
      providers: [
        CharacterChannelService,
        { provide: AppConfigService, useValue: appConfig },
        { provide: TypedEventEmitter, useValue: eventEmitter }
      ]
    }).compile()

    service = moduleRef.get(CharacterChannelService)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('getAndSetChannelOption', () => {
    it('guild が無い場合は no-guild オプションを設定して返す', () => {
      // Arrange
      const interaction = makeCommandInteraction({ guild: null })

      // Act
      const menu = service.getAndSetChannelOption(interaction)

      // Assert
      expect(service.channelOptions).toHaveLength(1)
      expect(service.channelOptions[0].data.label).toBe('サーバー情報が取得できません')
      expect(service.channelOptions[0].data.value).toBe('no-guild')
      // data getter が channelOptions を反映する
      expect(menu.options[0].data.value).toBe('no-guild')
    })

    it('カテゴリが見つからない場合は no-category オプションを設定して返す', () => {
      // Arrange: カテゴリ未登録
      const interaction = makeCommandInteraction({ guild: makeGuild({ cache: [] }) })

      // Act
      service.getAndSetChannelOption(interaction)

      // Assert
      expect(service.channelOptions).toHaveLength(1)
      expect(service.channelOptions[0].data.label).toBe('カテゴリが見つかりません')
      expect(service.channelOptions[0].data.value).toBe('no-category')
    })

    it('カテゴリ配下のテキストチャンネルが0件なら no-channels オプションを設定する', () => {
      // Arrange: カテゴリのみ、テキストチャンネルなし
      const interaction = makeCommandInteraction({
        guild: makeGuild({
          cache: [{ id: 'cat-1', name: CHARACTER_CATEGORY, type: ChannelType.GuildCategory }]
        })
      })

      // Act
      service.getAndSetChannelOption(interaction)

      // Assert
      expect(service.channelOptions).toHaveLength(1)
      expect(service.channelOptions[0].data.label).toBe('チャンネルが見つかりません')
      expect(service.channelOptions[0].data.value).toBe('no-channels')
    })

    it('複数チャンネルを createdTimestamp 降順・最大25件・label=name/value=id で設定する', () => {
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
      const interaction = makeCommandInteraction({ guild: makeGuild({ cache }) })

      // Act
      service.getAndSetChannelOption(interaction)

      // Assert: 最大25件、降順（新しい ch-29 が先頭）
      expect(service.channelOptions).toHaveLength(25)
      expect(service.channelOptions[0].data.label).toBe('name-29')
      expect(service.channelOptions[0].data.value).toBe('ch-29')
      expect(service.channelOptions[24].data.value).toBe('ch-5')
    })

    it('親カテゴリが異なるテキストチャンネルは除外する', () => {
      // Arrange
      const interaction = makeCommandInteraction({
        guild: makeGuild({
          cache: [
            { id: 'cat-1', name: CHARACTER_CATEGORY, type: ChannelType.GuildCategory },
            { id: 'ch-in', name: 'in', type: ChannelType.GuildText, parentId: 'cat-1', createdTimestamp: 1 },
            { id: 'ch-out', name: 'out', type: ChannelType.GuildText, parentId: 'other', createdTimestamp: 2 }
          ]
        })
      })

      // Act
      service.getAndSetChannelOption(interaction)

      // Assert
      expect(service.channelOptions).toHaveLength(1)
      expect(service.channelOptions[0].data.value).toBe('ch-in')
    })

    it('例外が発生した場合は error オプションを設定して返す', () => {
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
      const interaction = makeCommandInteraction({ guild })

      // Act
      service.getAndSetChannelOption(interaction)

      // Assert
      expect(service.channelOptions).toHaveLength(1)
      expect(service.channelOptions[0].data.label).toBe('エラーが発生しました')
      expect(service.channelOptions[0].data.value).toBe('error')
    })
  })

  describe('execute (Phase3 無効化)', () => {
    it('guild が無い場合はサーバー内専用メッセージを reply する', async () => {
      // Arrange
      const interaction = makeSelectInteraction({ guild: null })

      // Act
      await service.execute(interaction)

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith({
        content: 'このコマンドはサーバー内でのみ使用できます',
        ephemeral: true
      })
      expect(eventEmitter.requestCharacterSearch).not.toHaveBeenCalled()
    })

    it('カテゴリが無い場合はカテゴリ未検出メッセージを reply する', async () => {
      // Arrange: カテゴリ未登録
      const interaction = makeSelectInteraction({ guild: makeGuild({ cache: [] }) })

      // Act
      await service.execute(interaction)

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith({
        content: 'カテゴリが見つかりませんでした',
        ephemeral: true
      })
      expect(eventEmitter.requestCharacterSearch).not.toHaveBeenCalled()
    })

    it('カテゴリ有の場合は requestCharacterSearch を発行しメンテナンス中メッセージを reply して return する', async () => {
      // Arrange: カテゴリ存在 + 選択値
      const interaction = makeSelectInteraction({
        guild: makeGuild({
          cache: [{ id: 'cat-1', name: CHARACTER_CATEGORY, type: ChannelType.GuildCategory }]
        }),
        values: ['discord-channel-99']
      })

      // Act
      await service.execute(interaction)

      // Assert: イベント発行 + メンテナンス reply（スレッドは作成しない）
      expect(eventEmitter.requestCharacterSearch).toHaveBeenCalledWith(
        'discord-channel-99',
        'character-channel-service'
      )
      expect(interaction.reply).toHaveBeenCalledWith({
        content:
          '⚠️ キャラクタースレッド作成機能は現在メンテナンス中です。Phase 3移行作業が完了するまでお待ちください。',
        ephemeral: true
      })
    })
  })

  describe('createCharacterThread', () => {
    it('guild が無い場合はサーバー内専用メッセージを reply してスレッドを作らない', async () => {
      // Arrange
      const interaction = makeCommandInteraction({ guild: null })

      // Act
      await service.createCharacterThread(interaction, buildCharacter())

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith({
        content: 'このコマンドはサーバー内でのみ使用できます',
        ephemeral: true
      })
    })

    it('character にチャンネルIDが無い場合は未設定メッセージを reply する', async () => {
      // Arrange
      const interaction = makeCommandInteraction({ guild: makeGuild({ cache: [] }) })

      // Act
      await service.createCharacterThread(interaction, buildCharacter({ discordChannelId: undefined }))

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith({
        content: 'キャラクターにチャンネルが設定されていません',
        ephemeral: true
      })
    })

    it('取得したチャンネルが TextChannel でなければチャンネル未検出メッセージを reply する', async () => {
      // Arrange: fetch が TextChannel 以外（null）を返す
      const guild = makeGuild({ fetchResult: null })
      const interaction = makeCommandInteraction({ guild })

      // Act
      await service.createCharacterThread(interaction, buildCharacter())

      // Assert
      expect(guild.channels.fetch).toHaveBeenCalledWith('channel-1')
      expect(interaction.reply).toHaveBeenCalledWith({
        content: 'キャラクターのチャンネルが見つかりません',
        ephemeral: true
      })
    })

    it('TextChannel が取得できればスレッドを作成し reply・postCharacterEmbeds を呼ぶ', async () => {
      // Arrange
      const thread = makeThreadStub()
      const threadsCreate = jest.fn().mockResolvedValue(thread)
      const target = makeTextChannel({ id: 'channel-1', threads: { create: threadsCreate } })
      const guild = makeGuild({ fetchResult: target })
      const interaction = makeCommandInteraction({ guild, userName: 'PL花子' })
      const postSpy = jest.spyOn(service, 'postCharacterEmbeds').mockResolvedValue(undefined)
      const character = buildCharacter()

      // Act
      await service.createCharacterThread(interaction, character)

      // Assert: name=characterName / PublicThread でスレッド作成
      expect(threadsCreate).toHaveBeenCalledWith({
        name: 'テスト探索者',
        type: ChannelType.PublicThread
      })
      expect(interaction.reply).toHaveBeenCalledWith({
        content: 'テスト探索者のスレッドを作成しました',
        ephemeral: true
      })
      expect(postSpy).toHaveBeenCalledWith(thread, character, 'PL花子')
    })
  })

  describe('deleteSelectMenu', () => {
    it('interaction.deleteReply を呼ぶ', async () => {
      // Arrange
      const interaction = makeSelectInteraction()

      // Act
      await service.deleteSelectMenu(interaction)

      // Assert
      expect(interaction.deleteReply).toHaveBeenCalledTimes(1)
    })
  })

  describe('postCharacterEmbeds', () => {
    it('最小キャラクターでも thread.send を呼ぶ（基本情報 Embed 送信）', async () => {
      // Arrange
      const thread = makeThreadStub()
      jest.spyOn(service, 'createDiceButtons').mockResolvedValue(undefined)

      // Act
      await service.postCharacterEmbeds(thread as unknown as ThreadChannel, buildCharacter(), 'PL太郎')

      // Assert: 少なくとも1回の send（最初の embeds 送信）
      expect(thread.send).toHaveBeenCalled()
    })

    it('item と description があれば 4 Embed 以上となり send を2回呼ぶ', async () => {
      // Arrange: embeds が 3 を超えるよう item / description を付与
      const thread = makeThreadStub()
      jest.spyOn(service, 'createDiceButtons').mockResolvedValue(undefined)
      const character = buildCharacter({
        item: { 拳銃: { values: { base: 1 } } } as never,
        description: { 背景: '探索者の背景', メモ: '補足' } as never
      })

      // Act
      await service.postCharacterEmbeds(thread as unknown as ThreadChannel, character, 'PL太郎')

      // Assert: slice(0,3) と slice(3) で計2回 send
      expect(thread.send).toHaveBeenCalledTimes(2)
    })
  })

  describe('createDiceButtons', () => {
    it('discordUserId が null なら何も送信せず return する', async () => {
      // Arrange
      const thread = makeThreadStub()

      // Act
      await service.createDiceButtons(thread as unknown as ThreadChannel, buildCharacter({ discordUserId: undefined }))

      // Assert
      expect(thread.send).not.toHaveBeenCalled()
    })

    it('discordUserId があれば技能・能力値・ダイスの3メッセージを送信する', async () => {
      // Arrange
      const thread = makeThreadStub()
      const character = buildCharacter({
        skill: { 目星: { values: { base: 70 } } } as never,
        parameter: { STR: { values: { base: 12 } } } as never
      })

      // Act
      await service.createDiceButtons(thread as unknown as ThreadChannel, character)

      // Assert: 技能ロール / 能力値ロール / ダイスロール の3送信
      expect(thread.send).toHaveBeenCalledTimes(3)
    })
  })

  describe('postThreadCreationReply', () => {
    it('未応答なら reply・thread.send・postCharacterEmbeds を呼ぶ', async () => {
      // Arrange
      const thread = makeThreadStub()
      const interaction = makeSelectInteraction()
      const postSpy = jest.spyOn(service, 'postCharacterEmbeds').mockResolvedValue(undefined)
      const character = buildCharacter()

      // Act
      await service.postThreadCreationReply(interaction, thread as unknown as ThreadChannel, character)

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith('キャラクターダイス用のスレッドを作成しました')
      expect(thread.send).toHaveBeenCalledWith('Welcome to thread-name')
      expect(postSpy).toHaveBeenCalledWith(thread, character, 'TestUser')
    })
  })
})
