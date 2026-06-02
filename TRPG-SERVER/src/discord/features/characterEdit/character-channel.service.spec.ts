/// <reference types="jest" />

import { Test, TestingModule } from '@nestjs/testing'
import { CharacterChannelService } from '../characterThread/character-channel.service'
import { AppConfigService } from '../../../config/config.service'
import { TypedEventEmitter } from '../../../core/events/typed-event.service'
import { Character } from '../../../domains/character/models/character.model'
import { AttributeValue } from '../../../core/types/attribute.types'
// 本サービスは StringSelectMenuOptionBuilder の data getter・ChannelType・instanceof TextChannel・
// EmbedBuilder/ButtonBuilder の実構築に依存するため、グローバル jest-setup の discord.js モックを
// 無効化し実挙動を使う（緑な characterThread/character-channel.service.spec.ts と同方針）。
jest.unmock('discord.js')
jest.mock('discord.js', () => jest.requireActual('discord.js'))

import { ChannelType, StringSelectMenuBuilder, TextChannel } from 'discord.js'

describe('CharacterChannelService', () => {
  let service: CharacterChannelService
  let eventEmitter: jest.Mocked<Pick<TypedEventEmitter, 'requestCharacterSearch'>>
  let appConfigService: jest.Mocked<AppConfigService>

  // Mock objects
  const mockCharacter: Character = {
    characterId: 'character-id',
    characterName: 'Test Character',
    discordUserId: 'user-123',
    discordChannelId: 'channel-456',
    gameSystemId: 'CoC',
    description: {
      職業: { description: 'Detective' } as AttributeValue,
      年齢: { description: '30' } as AttributeValue,
      背景: { description: 'A skilled detective with years of experience' } as AttributeValue
    },
    status: {
      HP: { values: { base: 50 } } as AttributeValue,
      MP: { values: { base: 30 } } as AttributeValue,
      SAN: { values: { base: 65 } } as AttributeValue,
      幸運: { values: { base: 60 } } as AttributeValue,
      アイデア: { values: { base: 70 } } as AttributeValue,
      知識: { values: { base: 80 } } as AttributeValue
    },
    parameter: {
      STR: { values: { base: 60 } } as AttributeValue,
      DEX: { values: { base: 70 } } as AttributeValue,
      INT: { values: { base: 80 } } as AttributeValue,
      CON: { values: { base: 65 } } as AttributeValue,
      APP: { values: { base: 50 } } as AttributeValue
    },
    skill: {
      目星: { values: { base: 85 } } as AttributeValue,
      聞き耳: { values: { base: 75 } } as AttributeValue,
      心理学: { values: { base: 65 } } as AttributeValue,
      図書館: { values: { base: 80 } } as AttributeValue,
      応急手当: { values: { base: 40 } } as AttributeValue
    },
    item: {
      ノート: { description: '調査用のノート' } as AttributeValue,
      拳銃: { description: '警察官用の拳銃' } as AttributeValue,
      懐中電灯: { description: '小型の懐中電灯' } as AttributeValue
    }
  }

  interface CacheEntry {
    id: string
    name: string
    type: ChannelType
    parentId?: string | null
    createdTimestamp?: number
  }

  // discord.js Collection の find/filter（predicate 受け取り）を再現する軽量フェイク。
  // 本体は guild.channels.cache.find(...) / .filter(...) を使うため Map ではなくこれを使う。
  const makeCollection = (entries: CacheEntry[]) => ({
    find: (predicate: (c: CacheEntry) => boolean) => entries.find(predicate),
    filter: (predicate: (c: CacheEntry) => boolean) => {
      const filtered = entries.filter(predicate)
      return {
        size: filtered.length,
        values: () => filtered.values()
      }
    }
  })

  const defaultCacheEntries: CacheEntry[] = [
    { id: 'category-id', name: 'キャラクター', type: ChannelType.GuildCategory },
    {
      id: 'text-channel-1',
      name: 'test-channel-1',
      type: ChannelType.GuildText,
      parentId: 'category-id',
      createdTimestamp: 1000000
    },
    {
      id: 'text-channel-2',
      name: 'test-channel-2',
      type: ChannelType.GuildText,
      parentId: 'category-id',
      createdTimestamp: 2000000
    }
  ]

  const mockGuild = {
    id: 'guild-123',
    channels: {
      cache: makeCollection(defaultCacheEntries),
      fetch: jest.fn()
    }
  }

  // instanceof TextChannel を成立させるため実 TextChannel.prototype を継承させる
  const mockTextChannel = Object.assign(Object.create(TextChannel.prototype), {
    id: 'text-channel-1',
    name: 'test-channel',
    type: ChannelType.GuildText,
    isTextBased: jest.fn().mockReturnValue(true),
    threads: {
      create: jest.fn()
    }
  }) as TextChannel & { threads: { create: jest.Mock }; isTextBased: jest.Mock }

  const mockThread = {
    id: 'thread-123',
    name: 'Test Character',
    send: jest.fn().mockResolvedValue(undefined)
  }

  const mockUser = {
    id: 'user-123',
    displayName: 'TestUser'
  }

  const mockSelectMenuInteraction = {
    guild: mockGuild,
    channel: mockTextChannel,
    values: ['channel-456'],
    replied: false,
    user: mockUser,
    reply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    deleteReply: jest.fn().mockResolvedValue(undefined),
    isRepliable: jest.fn().mockReturnValue(true)
  }

  const mockCommandInteraction = {
    guild: mockGuild,
    user: mockUser,
    reply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined)
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CharacterChannelService,
        {
          provide: AppConfigService,
          useValue: {
            get: jest.fn()
          }
        },
        {
          provide: TypedEventEmitter,
          useValue: {
            requestCharacterSearch: jest.fn().mockResolvedValue(undefined)
          }
        }
      ]
    }).compile()

    service = module.get<CharacterChannelService>(CharacterChannelService)
    appConfigService = module.get(AppConfigService)
    eventEmitter = module.get(TypedEventEmitter)

    // Setup default mocks
    appConfigService.get.mockReturnValue('キャラクター')
    mockTextChannel.threads.create.mockResolvedValue(mockThread)
    mockGuild.channels.fetch.mockResolvedValue(mockTextChannel)
  })

  afterEach(() => {
    jest.clearAllMocks()
    // Reset mock implementations to default behavior
    mockTextChannel.threads.create.mockResolvedValue(mockThread)
    mockGuild.channels.fetch.mockResolvedValue(mockTextChannel)
    mockThread.send.mockResolvedValue(undefined)
    mockSelectMenuInteraction.reply.mockResolvedValue(undefined)
    mockSelectMenuInteraction.followUp.mockResolvedValue(undefined)
    mockSelectMenuInteraction.deleteReply.mockResolvedValue(undefined)
    mockCommandInteraction.reply.mockResolvedValue(undefined)
    mockCommandInteraction.followUp.mockResolvedValue(undefined)
    appConfigService.get.mockReturnValue('キャラクター')
  })

  describe('基本機能', () => {
    it('should be defined', () => {
      expect(service).toBeDefined()
    })

    it('should have all required methods', () => {
      expect(service.execute).toBeDefined()
      expect(service.createCharacterThread).toBeDefined()
      expect(service.getAndSetChannelOption).toBeDefined()
      expect(service.deleteSelectMenu).toBeDefined()
      expect(service.postThreadCreationReply).toBeDefined()
    })

    it('should have data property', () => {
      expect(service.data).toBeDefined()
      expect(service.data).toBeInstanceOf(StringSelectMenuBuilder)
    })

    it('should initialize with default channelOptions', () => {
      expect(service.channelOptions).toBeDefined()
      expect(service.channelOptions).toHaveLength(1)
    })
  })

  describe('data getter', () => {
    it('should return StringSelectMenuBuilder with correct configuration', () => {
      const data = service.data

      expect(data).toBeInstanceOf(StringSelectMenuBuilder)
      // 実 discord.js の構築結果を data プロパティで検証
      expect(data.data.custom_id).toBe('thread-create-character')
      expect(data.data.placeholder).toBe('キャラクターを選択')
      expect(data.options.length).toBeGreaterThan(0)
    })
  })

  describe('execute method', () => {
    it('should handle guild not found', async () => {
      const interactionWithoutGuild = {
        ...mockSelectMenuInteraction,
        guild: null
      }

      await service.execute(interactionWithoutGuild as any)

      expect(interactionWithoutGuild.reply).toHaveBeenCalledWith({
        content: 'このコマンドはサーバー内でのみ使用できます',
        ephemeral: true
      })
    })

    it('should handle category not found', async () => {
      const guildWithoutCategory = {
        ...mockGuild,
        channels: {
          cache: makeCollection([])
        }
      }

      const interaction = {
        ...mockSelectMenuInteraction,
        guild: guildWithoutCategory
      }

      await service.execute(interaction as any)

      expect(interaction.reply).toHaveBeenCalledWith({
        content: 'カテゴリが見つかりませんでした',
        ephemeral: true
      })
    })

    // 【PHASE3】 カテゴリ有の場合は requestCharacterSearch を発行し、
    // スレッド作成は行わずメンテナンス中メッセージを reply して return する。
    it('should emit requestCharacterSearch and reply maintenance message when category exists', async () => {
      await service.execute(mockSelectMenuInteraction as any)

      // 選択値 channel-456 で型安全イベントを発行
      expect(eventEmitter.requestCharacterSearch).toHaveBeenCalledWith('channel-456', 'character-channel-service')
      // メンテナンス中メッセージを ephemeral reply
      expect(mockSelectMenuInteraction.reply).toHaveBeenCalledWith({
        content:
          '⚠️ キャラクタースレッド作成機能は現在メンテナンス中です。Phase 3移行作業が完了するまでお待ちください。',
        ephemeral: true
      })
      // スレッド作成・セレクトメニュー削除は行わない（Phase3 で無効化済み）
      expect(mockTextChannel.threads.create).not.toHaveBeenCalled()
      expect(mockSelectMenuInteraction.deleteReply).not.toHaveBeenCalled()
    })

    it('should not emit requestCharacterSearch when category not found', async () => {
      const guildWithoutCategory = {
        ...mockGuild,
        channels: {
          cache: makeCollection([])
        }
      }

      const interaction = {
        ...mockSelectMenuInteraction,
        guild: guildWithoutCategory
      }

      await service.execute(interaction as any)

      expect(eventEmitter.requestCharacterSearch).not.toHaveBeenCalled()
    })
  })

  describe('createCharacterThread method', () => {
    it('should handle guild not found', async () => {
      const interactionWithoutGuild = {
        ...mockCommandInteraction,
        guild: null
      }

      await service.createCharacterThread(interactionWithoutGuild as any, mockCharacter)

      expect(interactionWithoutGuild.reply).toHaveBeenCalledWith({
        content: 'このコマンドはサーバー内でのみ使用できます',
        ephemeral: true
      })
    })

    it('should handle character without channel', async () => {
      const characterWithoutChannel = {
        ...mockCharacter,
        discordChannelId: ''
      }

      await service.createCharacterThread(mockCommandInteraction as any, characterWithoutChannel)

      expect(mockCommandInteraction.reply).toHaveBeenCalledWith({
        content: 'キャラクターにチャンネルが設定されていません',
        ephemeral: true
      })
    })

    it('should handle channel not found', async () => {
      mockGuild.channels.fetch.mockResolvedValue(null)

      await service.createCharacterThread(mockCommandInteraction as any, mockCharacter)

      expect(mockCommandInteraction.reply).toHaveBeenCalledWith({
        content: 'キャラクターのチャンネルが見つかりません',
        ephemeral: true
      })
    })

    it('should create thread successfully', async () => {
      await service.createCharacterThread(mockCommandInteraction as any, mockCharacter)

      expect(mockGuild.channels.fetch).toHaveBeenCalledWith('channel-456')
      expect(mockTextChannel.threads.create).toHaveBeenCalledWith({
        name: 'Test Character',
        type: ChannelType.PublicThread
      })
      expect(mockCommandInteraction.reply).toHaveBeenCalledWith({
        content: 'Test Characterのスレッドを作成しました',
        ephemeral: true
      })
    })

    it('should handle thread creation error', async () => {
      mockTextChannel.threads.create.mockRejectedValue(new Error('Thread creation failed'))

      await service.createCharacterThread(mockCommandInteraction as any, mockCharacter)

      expect(mockCommandInteraction.reply).toHaveBeenCalledWith({
        content: 'スレッドの作成中にエラーが発生しました',
        ephemeral: true
      })
    })
  })

  describe('getAndSetChannelOption method', () => {
    it('should handle guild not found', () => {
      const interactionWithoutGuild = {
        ...mockCommandInteraction,
        guild: null
      }

      const result = service.getAndSetChannelOption(interactionWithoutGuild as any)

      expect(result).toBeInstanceOf(StringSelectMenuBuilder)
      expect(service.channelOptions).toHaveLength(1)
      expect(service.channelOptions[0].data.label).toBe('サーバー情報が取得できません')
    })

    it('should handle category not found', () => {
      const guildWithoutCategory = {
        ...mockGuild,
        channels: {
          cache: makeCollection([])
        }
      }

      const interaction = {
        ...mockCommandInteraction,
        guild: guildWithoutCategory
      }

      const result = service.getAndSetChannelOption(interaction as any)

      expect(result).toBeInstanceOf(StringSelectMenuBuilder)
      expect(service.channelOptions).toHaveLength(1)
      expect(service.channelOptions[0].data.label).toBe('カテゴリが見つかりません')
    })

    it('should handle no channels found', () => {
      const guildWithCategoryButNoChannels = {
        ...mockGuild,
        channels: {
          cache: makeCollection([{ id: 'category-id', name: 'キャラクター', type: ChannelType.GuildCategory }])
        }
      }

      const interaction = {
        ...mockCommandInteraction,
        guild: guildWithCategoryButNoChannels
      }

      const result = service.getAndSetChannelOption(interaction as any)

      expect(result).toBeInstanceOf(StringSelectMenuBuilder)
      expect(service.channelOptions).toHaveLength(1)
      expect(service.channelOptions[0].data.label).toBe('チャンネルが見つかりません')
    })

    it('should set channel options successfully', () => {
      const result = service.getAndSetChannelOption(mockCommandInteraction as any)

      expect(result).toBeInstanceOf(StringSelectMenuBuilder)
      expect(service.channelOptions).toHaveLength(2)
      // createdTimestamp 降順: text-channel-2(2000000) が先頭
      expect(service.channelOptions[0].data.label).toBe('test-channel-2')
      expect(service.channelOptions[0].data.value).toBe('text-channel-2')
    })

    it('should handle more than 25 channels', () => {
      const manyChannels: CacheEntry[] = [{ id: 'category-id', name: 'キャラクター', type: ChannelType.GuildCategory }]

      // Create 30 channels
      for (let i = 0; i < 30; i++) {
        manyChannels.push({
          id: `channel-${i}`,
          name: `test-channel-${i}`,
          type: ChannelType.GuildText,
          parentId: 'category-id',
          createdTimestamp: 1000000 + i
        })
      }

      const guildWithManyChannels = {
        ...mockGuild,
        channels: {
          cache: makeCollection(manyChannels)
        }
      }

      const interaction = {
        ...mockCommandInteraction,
        guild: guildWithManyChannels
      }

      const result = service.getAndSetChannelOption(interaction as any)

      expect(result).toBeInstanceOf(StringSelectMenuBuilder)
      expect(service.channelOptions).toHaveLength(25) // Limited to 25
    })

    it('should handle errors gracefully', () => {
      appConfigService.get.mockImplementation(() => {
        throw new Error('Config error')
      })

      const result = service.getAndSetChannelOption(mockCommandInteraction as any)

      expect(result).toBeInstanceOf(StringSelectMenuBuilder)
      expect(service.channelOptions).toHaveLength(1)
      expect(service.channelOptions[0].data.label).toBe('エラーが発生しました')
    })
  })

  describe('deleteSelectMenu method', () => {
    it('should delete select menu successfully', async () => {
      await service.deleteSelectMenu(mockSelectMenuInteraction as any)

      expect(mockSelectMenuInteraction.deleteReply).toHaveBeenCalled()
    })
  })

  describe('postCharacterEmbeds method', () => {
    it('should post character embeds successfully', async () => {
      // createDiceButtons は別メソッドとして検証済みなので spy して送信回数の干渉を除く
      jest.spyOn(service, 'createDiceButtons').mockResolvedValue(undefined)

      await service.postCharacterEmbeds(mockThread as any, mockCharacter, 'TestPlayer')

      // item / description があるため embeds が 3 を超え、slice(0,3) と slice(3) で計2回 send
      expect(mockThread.send).toHaveBeenCalledTimes(2)
    })

    it('should handle character without optional fields', async () => {
      jest.spyOn(service, 'createDiceButtons').mockResolvedValue(undefined)

      const minimalCharacter = {
        ...mockCharacter,
        status: {},
        parameter: {},
        skill: {},
        item: {},
        description: {}
      }

      await service.postCharacterEmbeds(mockThread as any, minimalCharacter, 'TestPlayer')

      // baseInfo / parameter / skill のみ（3 Embed 以下）なので send は1回
      expect(mockThread.send).toHaveBeenCalledTimes(1)
    })

    it('should handle embed creation errors gracefully', async () => {
      mockThread.send.mockImplementationOnce(() => {
        throw new Error('Send failed')
      })

      // This should not throw because the service catches errors
      await expect(service.postCharacterEmbeds(mockThread as any, mockCharacter, 'TestPlayer')).resolves.not.toThrow()
    })
  })

  describe('createDiceButtons method', () => {
    it('should create dice buttons successfully', async () => {
      await service.createDiceButtons(mockThread as any, mockCharacter)

      expect(mockThread.send).toHaveBeenCalledTimes(3) // skill, ability, dice buttons
    })

    it('should handle character with undefined discordUserId', async () => {
      // 本体は discordUserId == null（null/undefined）で早期 return する
      const characterWithoutUserId = {
        ...mockCharacter,
        discordUserId: undefined as any
      }

      await service.createDiceButtons(mockThread as any, characterWithoutUserId)

      expect(mockThread.send).not.toHaveBeenCalled()
    })

    it('should handle character with null discordUserId', async () => {
      const characterWithNullUserId = {
        ...mockCharacter,
        discordUserId: null as any
      }

      await service.createDiceButtons(mockThread as any, characterWithNullUserId)

      expect(mockThread.send).not.toHaveBeenCalled()
    })

    it('should handle character without skills', async () => {
      const characterWithoutSkills = {
        ...mockCharacter,
        skill: {}
      }

      await service.createDiceButtons(mockThread as any, characterWithoutSkills)

      expect(mockThread.send).toHaveBeenCalledTimes(3) // Still sends all button types
    })

    it('should handle button creation errors gracefully', async () => {
      mockThread.send.mockImplementationOnce(() => {
        throw new Error('Button creation failed')
      })

      // This should not throw because the service catches errors
      await expect(service.createDiceButtons(mockThread as any, mockCharacter)).resolves.not.toThrow()
    })
  })

  describe('postThreadCreationReply method', () => {
    it('should post thread creation reply successfully', async () => {
      await service.postThreadCreationReply(mockSelectMenuInteraction as any, mockThread as any, mockCharacter)

      expect(mockSelectMenuInteraction.reply).toHaveBeenCalledWith('キャラクターダイス用のスレッドを作成しました')
      expect(mockThread.send).toHaveBeenCalledWith('Welcome to Test Character')
    })

    it('should handle undefined character', async () => {
      await service.postThreadCreationReply(mockSelectMenuInteraction as any, mockThread as any, undefined as any)

      expect(mockSelectMenuInteraction.reply).toHaveBeenCalledWith('キャラクターダイス用のスレッドを作成しました')
      expect(mockThread.send).toHaveBeenCalledWith('Welcome to Test Character')
    })

    it('should handle errors gracefully', async () => {
      mockThread.send.mockImplementationOnce(() => {
        throw new Error('Thread send failed')
      })

      // This should not throw because the service catches errors
      await expect(
        service.postThreadCreationReply(mockSelectMenuInteraction as any, mockThread as any, mockCharacter)
      ).resolves.not.toThrow()
    })
  })

  describe('エラーハンドリング統合テスト', () => {
    // 【PHASE3】 execute の try ブロック内（イベント発行〜reply）で例外が起きた場合、
    // 未応答なら catch で 'スレッドの作成中にエラーが発生しました' を reply する。
    it('should reply error message when requestCharacterSearch rejects in execute', async () => {
      eventEmitter.requestCharacterSearch.mockRejectedValueOnce(new Error('Event bus error'))

      await service.execute(mockSelectMenuInteraction as any)

      expect(mockSelectMenuInteraction.reply).toHaveBeenCalledWith({
        content: 'スレッドの作成中にエラーが発生しました',
        ephemeral: true
      })
    })

    it('should handle reply errors gracefully', async () => {
      // メンテナンス reply 自体が失敗しても execute は throw しない
      mockSelectMenuInteraction.reply.mockRejectedValueOnce(new Error('Reply failed'))

      await expect(service.execute(mockSelectMenuInteraction as any)).resolves.not.toThrow()
      expect(eventEmitter.requestCharacterSearch).toHaveBeenCalled()
    })

    it('should handle complex error chain', async () => {
      const complexErrorInteraction = {
        ...mockSelectMenuInteraction,
        replied: false,
        isRepliable: jest.fn().mockReturnValue(false),
        reply: jest.fn().mockRejectedValue(new Error('Reply failed')),
        followUp: jest.fn().mockRejectedValue(new Error('FollowUp failed'))
      }

      mockThread.send.mockImplementationOnce(() => {
        throw new Error('Thread send failed')
      })

      // This should not throw because the service catches errors
      await expect(
        service.postThreadCreationReply(complexErrorInteraction as any, mockThread as any, mockCharacter)
      ).resolves.not.toThrow()
    })
  })

  describe('パフォーマンスと制限テスト', () => {
    it('should handle large character data efficiently', async () => {
      const largeCharacter = {
        ...mockCharacter,
        skill: {}
      }

      // Create 100 skills
      for (let i = 0; i < 100; i++) {
        largeCharacter.skill[`skill-${i}`] = { values: { base: i } } as AttributeValue
      }

      await service.postCharacterEmbeds(mockThread as any, largeCharacter, 'TestPlayer')

      expect(mockThread.send).toHaveBeenCalled()
    })

    it('should handle Discord field limits', async () => {
      const characterWithLongDescription = {
        ...mockCharacter,
        description: {
          背景: { description: 'A'.repeat(2000) } as AttributeValue, // Exceeds Discord limit
          メモ: { description: 'B'.repeat(2000) } as AttributeValue
        }
      }

      await service.postCharacterEmbeds(mockThread as any, characterWithLongDescription, 'TestPlayer')

      expect(mockThread.send).toHaveBeenCalled()
    })
  })
})
