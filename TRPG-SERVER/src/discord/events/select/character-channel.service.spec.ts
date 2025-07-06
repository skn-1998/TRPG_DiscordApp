/// <reference types="jest" />

import { Test, TestingModule } from '@nestjs/testing'
import { Logger } from '@nestjs/common'
import { CharacterChannelService } from './character-channel.service'
import { CharacterService } from '../../../domains/character/character.service'
import { AppConfigService } from '../../../config/config.service'
import { Character } from '../../../domains/character/models/character.model'
import { CharacterAttribute } from '../../../domains/character/dto/create-character.dto'
import {
  ChannelType,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js'

// Mock Discord.js modules
jest.mock('discord.js', () => ({
  ChannelType: {
    GuildCategory: 4,
    GuildText: 0,
    PublicThread: 11
  },
  StringSelectMenuBuilder: jest.fn().mockImplementation(() => ({
    setCustomId: jest.fn().mockReturnThis(),
    setPlaceholder: jest.fn().mockReturnThis(),
    addOptions: jest.fn().mockReturnThis()
  })),
  StringSelectMenuOptionBuilder: jest.fn().mockImplementation(() => ({
    setLabel: jest.fn().mockReturnThis(),
    setValue: jest.fn().mockReturnThis()
  })),
  EmbedBuilder: jest.fn().mockImplementation(() => ({
    setTitle: jest.fn().mockReturnThis(),
    setColor: jest.fn().mockReturnThis(),
    addFields: jest.fn().mockReturnThis()
  })),
  ActionRowBuilder: jest.fn().mockImplementation(() => ({
    addComponents: jest.fn().mockReturnThis()
  })),
  ButtonBuilder: jest.fn().mockImplementation(() => ({
    setCustomId: jest.fn().mockReturnThis(),
    setLabel: jest.fn().mockReturnThis(),
    setStyle: jest.fn().mockReturnThis()
  })),
  ButtonStyle: {
    Primary: 1,
    Secondary: 2,
    Success: 3,
    Danger: 4
  }
}))

// Mock lodash
jest.mock('lodash', () => ({
  isNil: jest.fn((value) => value === null || value === undefined),
  isNull: jest.fn((value) => value === null),
  isUndefined: jest.fn((value) => value === undefined)
}))

describe('CharacterChannelService', () => {
  let service: CharacterChannelService
  let characterService: jest.Mocked<CharacterService>
  let appConfigService: jest.Mocked<AppConfigService>

  // Mock objects
  const mockCharacter: Character = {
    characterId: 'character-id',
    characterName: 'Test Character',
    discordUserId: 'user-123',
    discordChannelId: 'channel-456',
    gameSystemId: 'CoC',
    description: {
      職業: 'Detective',
      年齢: '30',
      背景: 'A skilled detective with years of experience'
    },
    status: {
      HP: { value: 50 } as CharacterAttribute,
      MP: { value: 30 } as CharacterAttribute,
      SAN: { value: 65 } as CharacterAttribute,
      幸運: 60,
      アイデア: 70,
      知識: 80
    },
    parameter: {
      STR: { value: 60 } as CharacterAttribute,
      DEX: { value: 70 } as CharacterAttribute,
      INT: { value: 80 } as CharacterAttribute,
      CON: { value: 65 } as CharacterAttribute,
      APP: { value: 50 } as CharacterAttribute
    },
    skill: {
      目星: { value: 85 } as CharacterAttribute,
      聞き耳: { value: 75 } as CharacterAttribute,
      心理学: { value: 65 } as CharacterAttribute,
      図書館: { value: 80 } as CharacterAttribute,
      応急手当: { value: 40 } as CharacterAttribute
    },
    item: {
      ノート: '調査用のノート',
      拳銃: '警察官用の拳銃',
      懐中電灯: '小型の懐中電灯'
    }
  }

  const mockGuild = {
    id: 'guild-123',
    channels: {
      cache: new Map([
        [
          'category-id',
          {
            id: 'category-id',
            name: 'キャラクター',
            type: ChannelType.GuildCategory
          }
        ],
        [
          'text-channel-1',
          {
            id: 'text-channel-1',
            name: 'test-channel-1',
            type: ChannelType.GuildText,
            parentId: 'category-id',
            createdTimestamp: 1000000
          }
        ],
        [
          'text-channel-2',
          {
            id: 'text-channel-2',
            name: 'test-channel-2',
            type: ChannelType.GuildText,
            parentId: 'category-id',
            createdTimestamp: 2000000
          }
        ]
      ]),
      fetch: jest.fn()
    }
  }

  const mockTextChannel = {
    id: 'text-channel-1',
    name: 'test-channel',
    type: ChannelType.GuildText,
    isTextBased: jest.fn().mockReturnValue(true),
    threads: {
      create: jest.fn()
    }
  }

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
          provide: CharacterService,
          useValue: {
            findByChannelId: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            remove: jest.fn()
          }
        },
        {
          provide: AppConfigService,
          useValue: {
            get: jest.fn()
          }
        }
      ]
    }).compile()

    service = module.get<CharacterChannelService>(CharacterChannelService)
    characterService = module.get(CharacterService)
    appConfigService = module.get(AppConfigService)

    // Setup default mocks
    appConfigService.get.mockReturnValue('キャラクター')
    characterService.findByChannelId.mockResolvedValue(mockCharacter)
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
    characterService.findByChannelId.mockResolvedValue(mockCharacter)
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
      expect(data.setCustomId).toHaveBeenCalledWith('thread-create-character')
      expect(data.setPlaceholder).toHaveBeenCalledWith('キャラクターを選択')
      expect(data.addOptions).toHaveBeenCalled()
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
          cache: new Map()
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

    it('should handle character not found', async () => {
      characterService.findByChannelId.mockResolvedValue(null)

      await service.execute(mockSelectMenuInteraction as any)

      expect(mockSelectMenuInteraction.reply).toHaveBeenCalledWith({
        content: 'キャラクター情報が見つかりませんでした',
        ephemeral: true
      })
    })

    it('should handle channel not found', async () => {
      const interactionWithoutChannel = {
        ...mockSelectMenuInteraction,
        channel: null
      }

      await service.execute(interactionWithoutChannel as any)

      expect(interactionWithoutChannel.reply).toHaveBeenCalledWith({
        content: 'チャンネルが見つかりませんでした',
        ephemeral: true
      })
    })

    it('should handle non-text channel', async () => {
      const nonTextChannel = {
        ...mockTextChannel,
        isTextBased: jest.fn().mockReturnValue(false)
      }

      const interaction = {
        ...mockSelectMenuInteraction,
        channel: nonTextChannel
      }

      await service.execute(interaction as any)

      expect(interaction.reply).toHaveBeenCalledWith({
        content: 'チャンネルが見つかりませんでした',
        ephemeral: true
      })
    })

    it('should create thread successfully', async () => {
      await service.execute(mockSelectMenuInteraction as any)

      expect(mockTextChannel.threads.create).toHaveBeenCalledWith({
        name: 'Test Character',
        type: ChannelType.PublicThread
      })
      expect(mockSelectMenuInteraction.deleteReply).toHaveBeenCalled()
    })

    it('should handle thread creation error', async () => {
      mockTextChannel.threads.create.mockRejectedValue(new Error('Thread creation failed'))

      await service.execute(mockSelectMenuInteraction as any)

      expect(mockSelectMenuInteraction.reply).toHaveBeenCalledWith({
        content: 'スレッド作成中にエラーが発生しました',
        ephemeral: true
      })
    })

    it('should handle already replied interaction', async () => {
      const repliedInteraction = {
        ...mockSelectMenuInteraction,
        replied: true
      }

      mockTextChannel.threads.create.mockRejectedValue(new Error('Test error'))

      await service.execute(repliedInteraction as any)

      expect(repliedInteraction.followUp).toHaveBeenCalledWith({
        content: 'スレッド作成中にエラーが発生しました',
        ephemeral: true
      })
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
      expect(service.channelOptions[0].setLabel).toHaveBeenCalledWith('サーバー情報が取得できません')
    })

    it('should handle category not found', () => {
      const guildWithoutCategory = {
        ...mockGuild,
        channels: {
          cache: new Map()
        }
      }

      const interaction = {
        ...mockCommandInteraction,
        guild: guildWithoutCategory
      }

      const result = service.getAndSetChannelOption(interaction as any)

      expect(result).toBeInstanceOf(StringSelectMenuBuilder)
      expect(service.channelOptions).toHaveLength(1)
      expect(service.channelOptions[0].setLabel).toHaveBeenCalledWith('カテゴリが見つかりません')
    })

    it('should handle no channels found', () => {
      const guildWithCategoryButNoChannels = {
        ...mockGuild,
        channels: {
          cache: new Map([
            [
              'category-id',
              {
                id: 'category-id',
                name: 'キャラクター',
                type: ChannelType.GuildCategory
              }
            ]
          ])
        }
      }

      const interaction = {
        ...mockCommandInteraction,
        guild: guildWithCategoryButNoChannels
      }

      const result = service.getAndSetChannelOption(interaction as any)

      expect(result).toBeInstanceOf(StringSelectMenuBuilder)
      expect(service.channelOptions).toHaveLength(1)
      expect(service.channelOptions[0].setLabel).toHaveBeenCalledWith('チャンネルが見つかりません')
    })

    it('should set channel options successfully', () => {
      const result = service.getAndSetChannelOption(mockCommandInteraction as any)

      expect(result).toBeInstanceOf(StringSelectMenuBuilder)
      expect(service.channelOptions).toHaveLength(2)
      expect(service.channelOptions[1].setLabel).toHaveBeenCalledWith('test-channel-2')
      expect(service.channelOptions[1].setValue).toHaveBeenCalledWith('text-channel-2')
    })

    it('should handle more than 25 channels', () => {
      const manyChannels = new Map()
      manyChannels.set('category-id', {
        id: 'category-id',
        name: 'キャラクター',
        type: ChannelType.GuildCategory
      })

      // Create 30 channels
      for (let i = 0; i < 30; i++) {
        manyChannels.set(`channel-${i}`, {
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
          cache: manyChannels
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
      expect(service.channelOptions[0].setLabel).toHaveBeenCalledWith('エラーが発生しました')
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
      await service.postCharacterEmbeds(mockThread as any, mockCharacter, 'TestPlayer')

      expect(mockThread.send).toHaveBeenCalledTimes(3) // Basic embeds + additional embeds + dice buttons
      expect(EmbedBuilder).toHaveBeenCalledTimes(5) // baseInfo, parameter, skill, item, description
    })

    it('should handle character without optional fields', async () => {
      const minimalCharacter = {
        ...mockCharacter,
        status: {},
        parameter: {},
        skill: {},
        item: {},
        description: {}
      }

      await service.postCharacterEmbeds(mockThread as any, minimalCharacter, 'TestPlayer')

      expect(mockThread.send).toHaveBeenCalledTimes(2) // Basic embeds + dice buttons
      expect(EmbedBuilder).toHaveBeenCalledTimes(3) // baseInfo, parameter, skill only
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
      expect(ActionRowBuilder).toHaveBeenCalledTimes(3)
      expect(ButtonBuilder).toHaveBeenCalled()
    })

    it('should handle character without discordUserId', async () => {
      const characterWithoutUserId = {
        ...mockCharacter,
        discordUserId: ''
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
    it('should handle multiple error scenarios in execute', async () => {
      characterService.findByChannelId.mockRejectedValueOnce(new Error('Database error'))

      await service.execute(mockSelectMenuInteraction as any)

      expect(mockSelectMenuInteraction.reply).toHaveBeenCalledWith({
        content: 'スレッド作成中にエラーが発生しました',
        ephemeral: true
      })
    })

    it('should handle reply errors gracefully', async () => {
      mockSelectMenuInteraction.reply.mockRejectedValueOnce(new Error('Reply failed'))
      characterService.findByChannelId.mockResolvedValue(null)

      await service.execute(mockSelectMenuInteraction as any)

      // Should not throw error, but handle it gracefully
      expect(characterService.findByChannelId).toHaveBeenCalled()
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
        largeCharacter.skill[`skill-${i}`] = { value: i } as CharacterAttribute
      }

      await service.postCharacterEmbeds(mockThread as any, largeCharacter, 'TestPlayer')

      expect(mockThread.send).toHaveBeenCalled()
    })

    it('should handle Discord field limits', async () => {
      const characterWithLongDescription = {
        ...mockCharacter,
        description: {
          背景: 'A'.repeat(2000), // Exceeds Discord limit
          メモ: 'B'.repeat(2000)
        }
      }

      await service.postCharacterEmbeds(mockThread as any, characterWithLongDescription, 'TestPlayer')

      expect(mockThread.send).toHaveBeenCalled()
    })
  })
})
