import { Test, TestingModule } from '@nestjs/testing'
import { CharacterDiceButtonsService } from './character-dice-buttons.service'
import { CharacterService } from '../../../domains/character/character.service'
import { DiceRollService } from '../../../domains/dice-roll/dice-roll.service'
import { DiceRollPaginationService } from '../../components/pagination/dice-roll-pagination.service'

// モック設定
jest.mock('../../../discord/utils/dice', () => jest.fn())
jest.mock('lodash', () => ({
  ...jest.requireActual('lodash'),
  isNull: jest.fn()
}))
jest.mock('../../../utils/error-handler', () => ({
  ErrorHandler: {
    handleDiscordError: jest.fn()
  },
  BackgroundTaskErrorHandler: {
    handleBackgroundError: jest.fn()
  }
}))

describe('CharacterDiceButtonsService', () => {
  let service: CharacterDiceButtonsService
  let mockCharacterService: any
  let mockDiceRollService: any
  let mockPaginationService: any

  beforeEach(async () => {
    // モックサービスの設定
    mockCharacterService = {
      findById: jest.fn(),
      findByChannelId: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    }

    mockDiceRollService = {
      createText: jest.fn().mockResolvedValue({}),
      findTextsByChannelId: jest.fn(),
      createOrGetChannel: jest.fn(),
      updateChannel: jest.fn()
    }

    mockPaginationService = {
      createPaginatedDiceRoll: jest.fn(),
      updatePaginatedDiceRoll: jest.fn(),
      handlePageNavigation: jest.fn()
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CharacterDiceButtonsService,
        { provide: CharacterService, useValue: mockCharacterService },
        { provide: DiceRollService, useValue: mockDiceRollService },
        { provide: DiceRollPaginationService, useValue: mockPaginationService }
      ]
    }).compile()

    service = module.get<CharacterDiceButtonsService>(CharacterDiceButtonsService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('基本機能', () => {
    it('should be defined', () => {
      expect(service).toBeDefined()
    })

    it('should have data property', () => {
      expect(service.data).toBeDefined()
    })

    it('should have execute method', () => {
      expect(typeof service.execute).toBe('function')
    })

    it('should have handleDiceRoll method', () => {
      expect(typeof service.handleDiceRoll).toBe('function')
    })
  })

  describe('getResultStyle (private method)', () => {
    it('should return fumble emoji for critical failure', () => {
      const result = (service as any).getResultStyle({
        critical: false,
        success: false,
        failure: true,
        fumble: true
      })

      expect(result.resultEmoji).toBe('💥')
    })

    it('should return success emoji for normal success', () => {
      const result = (service as any).getResultStyle({
        critical: false,
        success: true,
        failure: false,
        fumble: false
      })

      expect(result.resultEmoji).toBe('✅')
    })

    it('should return failure emoji for normal failure', () => {
      const result = (service as any).getResultStyle({
        critical: false,
        success: false,
        failure: true,
        fumble: false
      })

      expect(result.resultEmoji).toBe('❌')
    })

    it('should return neutral emoji for other results', () => {
      const result = (service as any).getResultStyle({
        critical: false,
        success: false,
        failure: false,
        fumble: false
      })

      expect(result.resultEmoji).toBe('🎲')
    })
  })

  describe('formatResultText (private method)', () => {
    it('should format skill roll result text', () => {
      const result = (service as any).formatResultText('✅', 'テストキャラクター', '手帳', '1d100 → 45')

      expect(result).toContain('✅')
      expect(result).toContain('テストキャラクター')
      expect(result).toContain('手帳')
      expect(result).toContain('1d100 → 45')
    })

    it('should format normal dice roll result text', () => {
      const result = (service as any).formatResultText('🎲', 'テストキャラクター', null, '1d100 → 45')

      expect(result).toContain('🎲')
      expect(result).toContain('テストキャラクター')
      expect(result).toContain('1d100 → 45')
    })
  })

  describe('saveRollResult (private method)', () => {
    it('should save roll result successfully', async () => {
      const characterName = 'テストキャラクター'
      const resultText = '✅ テストキャラクター の手帳: 1d100 → 45'
      const result = 45
      const diceCommand = '1d100'
      const channelId = 'test-channel-id'

      await (service as any).saveRollResult(characterName, resultText, result, diceCommand, channelId)

      expect(mockDiceRollService.createText).toHaveBeenCalledWith(
        expect.objectContaining({
          characterName,
          text: resultText,
          result,
          diceRoll: diceCommand,
          discordChannelId: channelId
        })
      )
    })

    it('should handle save error gracefully', async () => {
      mockDiceRollService.createText.mockRejectedValue(new Error('Save error'))

      // エラーが投げられずに正常に完了することを確認
      await expect(
        (service as any).saveRollResult('テストキャラクター', '結果テキスト', 45, '1d100', 'test-channel-id')
      ).resolves.toBeUndefined()
    })
  })

  describe('getSuccessText (private method)', () => {
    it('should return correct success text for value 1', () => {
      const result = (service as any).getSuccessText(1)
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('should return correct success text for value 2', () => {
      const result = (service as any).getSuccessText(2)
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('should return correct success text for value 3', () => {
      const result = (service as any).getSuccessText(3)
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('should return correct success text for value 4', () => {
      const result = (service as any).getSuccessText(4)
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('should return unknown text for invalid success value', () => {
      const result = (service as any).getSuccessText(99)
      expect(result).toBe('不明')
    })
  })

  describe('handleDiceRoll (public method)', () => {
    let mockInteraction: any
    const mockRequest = {
      diceCommand: '1d100',
      notation: '1d100',
      characterName: 'テストキャラクター'
    }

    beforeEach(() => {
      mockInteraction = {
        editReply: jest.fn()
      }
    })

    it('should handle dice roll request with null result', async () => {
      const dice = jest.requireMock('../../../discord/utils/dice')
      dice.mockResolvedValue(null)

      await service.handleDiceRoll(mockInteraction, mockRequest)

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: 'ダイスロールに失敗しました。コマンドをご確認ください。',
        ephemeral: true
      })
    })
  })

  describe('formatDiceRollResultAsText (private method)', () => {
    const mockResult = {
      text: '1d100 → 45',
      total: 45,
      success: true,
      critical: false,
      fumble: false,
      failure: false
    }

    it('should format dice roll result as text', () => {
      const result = (service as any).formatDiceRollResultAsText(mockResult, {
        diceCommand: '1d100',
        notation: '1d100',
        characterName: 'テストキャラクター'
      })

      expect(result).toContain('テストキャラクター')
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('execute method', () => {
    it('should handle missing channel gracefully', async () => {
      const mockInteraction = {
        customId: 'roll*1d100',
        channel: null,
        deferUpdate: jest.fn(),
        reply: jest.fn(),
        showModal: jest.fn()
      }

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      await service.execute(mockInteraction as any)

      expect(consoleSpy).toHaveBeenCalledWith('インタラクションのチャンネルが存在しません')
      consoleSpy.mockRestore()
    })

    it('should show custom dice modal for custom dice roll', async () => {
      const mockInteraction = {
        customId: 'roll*custom',
        channel: { id: 'test-channel' },
        showModal: jest.fn()
      }

      await service.execute(mockInteraction as any)

      expect(mockInteraction.showModal).toHaveBeenCalled()
    })
  })
})
