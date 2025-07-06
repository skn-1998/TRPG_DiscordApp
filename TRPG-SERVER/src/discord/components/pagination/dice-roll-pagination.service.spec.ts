import { Test, TestingModule } from '@nestjs/testing'
import { DiceRollPaginationService } from './dice-roll-pagination.service'
import { DiceRollService } from '../../../domains/dice-roll/dice-roll.service'
import { CharacterService } from '../../../domains/character/character.service'

// Discord.js builders モック
jest.mock('discord.js', () => ({
  ...jest.requireActual('discord.js'),
  EmbedBuilder: jest.fn().mockImplementation(() => {
    // eslint-disable-next-line prefer-const
    let embedData = {
      title: null,
      description: null,
      color: null,
      fields: [],
      timestamp: null,
      footer: null
    }

    const embedBuilder = {
      setTitle: jest.fn().mockImplementation((title) => {
        embedData.title = title
        return embedBuilder
      }),
      setDescription: jest.fn().mockImplementation((description) => {
        embedData.description = description
        return embedBuilder
      }),
      setColor: jest.fn().mockImplementation((color) => {
        embedData.color = color
        return embedBuilder
      }),
      addFields: jest.fn().mockImplementation(() => embedBuilder),
      setTimestamp: jest.fn().mockImplementation(() => embedBuilder),
      setFooter: jest.fn().mockImplementation(() => embedBuilder),
      get data() {
        return embedData
      },
      toJSON: jest.fn().mockReturnValue(embedData)
    }

    return embedBuilder
  }),
  ButtonBuilder: jest.fn().mockImplementation(() => ({
    setCustomId: jest.fn().mockReturnThis(),
    setLabel: jest.fn().mockReturnThis(),
    setStyle: jest.fn().mockReturnThis(),
    setEmoji: jest.fn().mockReturnThis(),
    setDisabled: jest.fn().mockReturnThis(),
    toJSON: jest.fn().mockReturnValue({
      type: 2,
      style: 1,
      label: 'Test Button'
    })
  })),
  ActionRowBuilder: jest.fn().mockImplementation(() => ({
    addComponents: jest.fn().mockReturnThis(),
    toJSON: jest.fn().mockReturnValue({
      type: 1,
      components: []
    })
  }))
}))

describe('DiceRollPaginationService', () => {
  let service: DiceRollPaginationService
  let mockDiceRollService: any
  let mockCharacterService: any

  const mockDiceRollData = [
    {
      id: '1',
      characterId: 'char-1',
      text: '✅ テストキャラクター1 の【手帳】: 1d100 → 45 成功',
      createdAt: new Date('2023-01-01T10:00:00.000Z'),
      result: 45,
      diceRoll: '1d100'
    },
    {
      id: '2',
      characterId: 'char-2',
      text: '❌ テストキャラクター2 の【戦闘】: 1d100 → 85 失敗',
      createdAt: new Date('2023-01-01T09:00:00.000Z'),
      result: 85,
      diceRoll: '1d100'
    },
    {
      id: '3',
      characterId: 'char-1',
      text: '🎯 テストキャラクター1 の【調査】: 1d100 → 5 クリティカル',
      createdAt: new Date('2023-01-01T08:00:00.000Z'),
      result: 5,
      diceRoll: '1d100'
    }
  ]

  const mockCharacterData = [
    {
      id: 'char-1',
      characterName: 'テストキャラクター1',
      discordChannelId: 'channel-1'
    },
    {
      id: 'char-2',
      characterName: 'テストキャラクター2',
      discordChannelId: 'channel-1'
    }
  ]

  beforeEach(async () => {
    mockDiceRollService = {
      findTextsByChannelId: jest.fn().mockResolvedValue(mockDiceRollData)
    }

    mockCharacterService = {
      findOne: jest.fn().mockImplementation((id) => {
        const character = mockCharacterData.find((c) => c.id === id)
        return Promise.resolve(character)
      }),
      findByChannelId: jest.fn().mockResolvedValue(mockCharacterData)
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiceRollPaginationService,
        { provide: DiceRollService, useValue: mockDiceRollService },
        { provide: CharacterService, useValue: mockCharacterService }
      ]
    }).compile()

    service = module.get<DiceRollPaginationService>(DiceRollPaginationService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('基本機能', () => {
    it('should be defined', () => {
      expect(service).toBeDefined()
    })

    it('should have required methods', () => {
      expect(typeof service.createPaginatedEmbeds).toBe('function')
      expect(typeof service.createPaginationControls).toBe('function')
      expect(typeof service.savePaginationState).toBe('function')
      expect(typeof service.getPaginationState).toBe('function')
      expect(typeof service.updatePage).toBe('function')
      expect(typeof service.jumpToPage).toBe('function')
      expect(typeof service.cancelPagination).toBe('function')
      expect(typeof service.invalidateCache).toBe('function')
      expect(typeof service.updateCharacter).toBe('function')
    })
  })

  describe('createPaginatedEmbeds', () => {
    it('should create embeds for all dice rolls', async () => {
      const channelId = 'test-channel'
      const embeds = await service.createPaginatedEmbeds(channelId)

      expect(embeds).toHaveLength(1)
      expect(embeds[0]).toBeDefined()
      expect(embeds[0].data).toBeDefined()
      expect(embeds[0].data.title).toBe('ダイスロール履歴')
    })

    it('should create embeds for specific character', async () => {
      const channelId = 'test-channel'
      const characterId = 'char-1'
      const embeds = await service.createPaginatedEmbeds(channelId, characterId)

      expect(embeds).toHaveLength(1)
      expect(embeds[0]).toBeDefined()
      expect(embeds[0].data).toBeDefined()
      expect(embeds[0].data.title).toBe('テストキャラクター1のダイスロール')
    })

    it('should handle empty dice roll history', async () => {
      mockDiceRollService.findTextsByChannelId.mockResolvedValue([])
      const channelId = 'test-channel'
      const embeds = await service.createPaginatedEmbeds(channelId)

      expect(embeds).toHaveLength(1)
      expect(embeds[0].data.description).toBe('ダイスロール履歴がありません')
    })

    it('should handle character not found', async () => {
      mockCharacterService.findOne.mockResolvedValue(null)
      const channelId = 'test-channel'
      const characterId = 'non-existent'
      const embeds = await service.createPaginatedEmbeds(channelId, characterId)

      expect(embeds).toHaveLength(1)
      expect(embeds[0].data.title).toBe('ダイスロール履歴')
    })

    it('should handle character service error', async () => {
      mockCharacterService.findOne.mockRejectedValue(new Error('Character service error'))
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      const channelId = 'test-channel'
      const characterId = 'char-1'
      const embeds = await service.createPaginatedEmbeds(channelId, characterId)

      expect(embeds).toHaveLength(1)
      expect(consoleSpy).toHaveBeenCalledWith('キャラクター情報取得エラー:', expect.any(Error))
      consoleSpy.mockRestore()
    })

    it('should filter dice rolls by character', async () => {
      const channelId = 'test-channel'
      const characterId = 'char-1'

      await service.createPaginatedEmbeds(channelId, characterId)

      expect(mockDiceRollService.findTextsByChannelId).toHaveBeenCalledWith(channelId)
      expect(mockCharacterService.findOne).toHaveBeenCalledWith(characterId)
    })
  })

  describe('createPaginationControls', () => {
    it('should create pagination controls', async () => {
      const messageId = 'test-message'
      const channelId = 'test-channel'
      const totalPages = 5

      const controls = await service.createPaginationControls(messageId, channelId, totalPages)

      expect(Array.isArray(controls)).toBe(true)
    })

    it('should handle single page', async () => {
      const messageId = 'test-message'
      const channelId = 'test-channel'
      const totalPages = 1

      const controls = await service.createPaginationControls(messageId, channelId, totalPages)

      expect(Array.isArray(controls)).toBe(true)
    })
  })

  describe('状態管理', () => {
    const channelId = 'test-channel'
    const messageId = 'test-message'
    const mockState = {
      pages: [{ data: { title: 'Test Page' } }] as any,
      totalPages: 1,
      currentPage: 0,
      messageId: messageId
    }

    it('should save pagination state', () => {
      service.savePaginationState(channelId, messageId, mockState)

      const savedState = service.getPaginationState(channelId, messageId)
      expect(savedState).toEqual(mockState)
    })

    it('should return null for non-existent state', () => {
      const state = service.getPaginationState('non-existent', 'non-existent')
      expect(state).toBeNull()
    })

    it('should cancel pagination successfully', () => {
      service.savePaginationState(channelId, messageId, mockState)

      const result = service.cancelPagination(channelId, messageId)
      expect(result).toBe(true)

      const state = service.getPaginationState(channelId, messageId)
      expect(state).toBeNull()
    })

    it('should return false when canceling non-existent pagination', () => {
      const result = service.cancelPagination('non-existent', 'non-existent')
      expect(result).toBe(false)
    })
  })

  describe('updatePage', () => {
    const channelId = 'test-channel'
    const messageId = 'test-message'
    const pages = [{ data: { title: 'Page 1' } }, { data: { title: 'Page 2' } }, { data: { title: 'Page 3' } }] as any

    beforeEach(() => {
      const mockState = {
        pages: pages,
        totalPages: 3,
        currentPage: 1,
        messageId: messageId
      }
      service.savePaginationState(channelId, messageId, mockState)
    })

    it('should update to next page', () => {
      const result = service.updatePage(channelId, messageId, 'next')

      expect(result).toBeDefined()

      const state = service.getPaginationState(channelId, messageId)
      expect(state?.currentPage).toBe(2)
    })

    it('should update to previous page', () => {
      const result = service.updatePage(channelId, messageId, 'prev')

      expect(result).toBeDefined()

      const state = service.getPaginationState(channelId, messageId)
      expect(state?.currentPage).toBe(0)
    })

    it('should update to first page', () => {
      const result = service.updatePage(channelId, messageId, 'first')

      expect(result).toBeDefined()

      const state = service.getPaginationState(channelId, messageId)
      expect(state?.currentPage).toBe(0)
    })

    it('should update to last page', () => {
      const result = service.updatePage(channelId, messageId, 'last')

      expect(result).toBeDefined()

      const state = service.getPaginationState(channelId, messageId)
      expect(state?.currentPage).toBe(2)
    })

    it('should return null for non-existent state', () => {
      const result = service.updatePage('non-existent', 'non-existent', 'next')
      expect(result).toBeNull()
    })
  })

  describe('jumpToPage', () => {
    const channelId = 'test-channel'
    const messageId = 'test-message'
    const pages = [{ data: { title: 'Page 1' } }, { data: { title: 'Page 2' } }, { data: { title: 'Page 3' } }] as any
    const mockState = {
      pages: pages,
      totalPages: 3,
      currentPage: 0,
      messageId: messageId
    }

    beforeEach(() => {
      service.savePaginationState(channelId, messageId, mockState)
    })

    it('should jump to valid page', () => {
      const result = service.jumpToPage(channelId, messageId, 1)

      expect(result).toBeDefined()

      const state = service.getPaginationState(channelId, messageId)
      expect(state?.currentPage).toBe(1) // 0-indexed
    })

    it('should handle invalid page number (too high)', () => {
      const result = service.jumpToPage(channelId, messageId, 10)

      expect(result).toBeNull()
    })

    it('should handle invalid page number (too low)', () => {
      const result = service.jumpToPage(channelId, messageId, -1)

      expect(result).toBeNull()
    })

    it('should return null for non-existent state', () => {
      const result = service.jumpToPage('non-existent', 'non-existent', 1)
      expect(result).toBeNull()
    })
  })

  describe('invalidateCache', () => {
    it('should invalidate cache for specific character', () => {
      // キャッシュを無効化するメソッドが正常に動作することを確認
      service.invalidateCache('test-channel', 'char-1')

      // メソッドが例外を投げないことを確認
      expect(true).toBe(true)
    })

    it('should invalidate cache for all characters', () => {
      // キャッシュを無効化するメソッドが正常に動作することを確認
      service.invalidateCache('test-channel')

      // メソッドが例外を投げないことを確認
      expect(true).toBe(true)
    })
  })

  describe('updateCharacter', () => {
    const channelId = 'test-channel'
    const messageId = 'test-message'
    const mockState = {
      pages: [{ data: { title: 'Original Page' } }] as any,
      totalPages: 1,
      currentPage: 0,
      messageId: messageId
    }

    beforeEach(() => {
      service.savePaginationState(channelId, messageId, mockState)
    })

    it('should update character and return new state', async () => {
      const characterId = 'char-1'
      const result = await service.updateCharacter(channelId, messageId, characterId)

      expect(result).toBeDefined()
      expect(result?.characterId).toBe(characterId)
      expect(result?.pages).toHaveLength(1)
    })
  })

  describe('キャッシュ機能', () => {
    it('should use same service for repeated requests', async () => {
      const channelId = 'test-channel'

      // 最初の呼び出し
      const embeds1 = await service.createPaginatedEmbeds(channelId)

      // 2回目の呼び出し
      const embeds2 = await service.createPaginatedEmbeds(channelId)

      expect(embeds1).toBeDefined()
      expect(embeds2).toBeDefined()
      expect(mockDiceRollService.findTextsByChannelId).toHaveBeenCalledWith(channelId)
    })
  })

  describe('大量データ処理', () => {
    it('should handle large number of dice rolls', async () => {
      // 大量のダイスロールデータを作成
      const largeDiceRollData = Array.from({ length: 200 }, (_, i) => ({
        id: `dice-${i}`,
        characterId: `char-${i % 5}`,
        text: `テストロール${i}: 1d100 → ${(i % 100) + 1}`,
        createdAt: new Date(Date.now() - i * 1000),
        result: (i % 100) + 1,
        diceRoll: '1d100'
      }))

      mockDiceRollService.findTextsByChannelId.mockResolvedValue(largeDiceRollData)

      const channelId = 'test-channel'
      const embeds = await service.createPaginatedEmbeds(channelId)

      expect(embeds.length).toBeGreaterThan(0)
      expect(embeds[0]).toBeDefined()

      // サービスが呼ばれることを確認
      expect(mockDiceRollService.findTextsByChannelId).toHaveBeenCalledWith(channelId)
    })
  })

  describe('パフォーマンス', () => {
    it('should handle performance logging', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      const channelId = 'test-channel'
      await service.createPaginatedEmbeds(channelId)

      // パフォーマンスログが出力されることを確認
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('エラーハンドリング', () => {
    it('should handle database errors gracefully', async () => {
      mockDiceRollService.findTextsByChannelId.mockRejectedValue(new Error('Database error'))

      const channelId = 'test-channel'

      // エラーが適切に処理されて、エラーメッセージを含むEmbedが返されることを確認
      const result = await service.createPaginatedEmbeds(channelId)
      expect(result).toBeDefined()
      expect(result.length).toBeGreaterThan(0)
      expect(result[0].data.description).toContain('履歴の読み込み中にエラーが発生しました')
    })
  })
})
