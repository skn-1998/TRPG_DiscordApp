import { ChannelType } from 'discord.js'
import { createMockButtonInteraction } from '@discord-test-utils'
import { DiceOrchestratorService } from './dice-orchestrator.service'
import { DiceCalculationService } from './dice-calculation.service'
import { DiceParserService } from './dice-parser.service'
import { DicePresetService } from './dice-preset.service'
import dice from 'src/discord/utils/dice'

// dice ユーティリティ(bcdice ラッパ)は副作用の境界なのでモックする
jest.mock('src/discord/utils/dice')
const diceMock = dice as jest.MockedFunction<typeof dice>

/**
 * DiceOrchestratorService は委譲オーケストレーター。
 * 依存サービスはすべて mock し、「正しい引数で委譲先が呼ばれ、戻り値をそのまま返す」ことを検証する。
 * executeBasicNotation / sendToParentChannelBasic / getBasicResultEmoji /
 * getServiceStats など自前ロジックを持つメソッドは挙動を直接検証する。
 */
describe('DiceOrchestratorService', () => {
  let service: DiceOrchestratorService
  let calculationService: jest.Mocked<DiceCalculationService>
  let parserService: jest.Mocked<DiceParserService>
  let presetService: jest.Mocked<DicePresetService>

  beforeEach(() => {
    // 依存サービスは副作用の境界としてモック(純粋に委譲先呼び出しを検証する)
    calculationService = {
      calculateAndRoll: jest.fn(),
      parseAndCalculate: jest.fn(),
      getResultEmoji: jest.fn(),
      sendToParentChannel: jest.fn()
    } as unknown as jest.Mocked<DiceCalculationService>

    parserService = {
      parseFormula: jest.fn(),
      evaluateFormula: jest.fn(),
      convertToDiceNotation: jest.fn()
    } as unknown as jest.Mocked<DiceParserService>

    presetService = {
      handlePresetDiceRoll: jest.fn(),
      createPresetButton: jest.fn(),
      validatePresetConfig: jest.fn()
    } as unknown as jest.Mocked<DicePresetService>

    service = new DiceOrchestratorService(calculationService, parserService, presetService)
  })

  describe('calculateAndRoll', () => {
    it('既定の multiplier=1, modifier=0 で calculationService に委譲し戻り値を返す', async () => {
      // Arrange
      const expected = { roll: 42 } as never
      calculationService.calculateAndRoll.mockResolvedValue(expected)

      // Act
      const result = await service.calculateAndRoll('1d100')

      // Assert
      expect(calculationService.calculateAndRoll).toHaveBeenCalledWith('1d100', 1, 0, undefined)
      expect(result).toBe(expected)
    })

    it('明示した引数(multiplier/modifier/character)をそのまま委譲する', async () => {
      // Arrange
      const character = { id: 'c1' } as never
      const expected = { roll: 7 } as never
      calculationService.calculateAndRoll.mockResolvedValue(expected)

      // Act
      const result = await service.calculateAndRoll('STR', 2, 3, character)

      // Assert
      expect(calculationService.calculateAndRoll).toHaveBeenCalledWith('STR', 2, 3, character)
      expect(result).toBe(expected)
    })
  })

  describe('parseAndCalculate', () => {
    it('既定値で calculationService.parseAndCalculate に委譲し戻り値を返す', async () => {
      // Arrange
      const expected = { value: 10 } as never
      calculationService.parseAndCalculate.mockResolvedValue(expected)

      // Act
      const result = await service.parseAndCalculate('2d6')

      // Assert
      expect(calculationService.parseAndCalculate).toHaveBeenCalledWith('2d6', 1, 0, undefined)
      expect(result).toBe(expected)
    })

    it('明示した引数をそのまま委譲する', async () => {
      // Arrange
      const character = { id: 'c2' } as never
      calculationService.parseAndCalculate.mockResolvedValue({ value: 1 } as never)

      // Act
      await service.parseAndCalculate('DEX', 4, -2, character)

      // Assert
      expect(calculationService.parseAndCalculate).toHaveBeenCalledWith('DEX', 4, -2, character)
    })
  })

  describe('handlePresetDiceRoll', () => {
    it('presetService.handlePresetDiceRoll に interaction と customId を委譲する', async () => {
      // Arrange
      const interaction = createMockButtonInteraction({ customId: 'preset-1' })
      presetService.handlePresetDiceRoll.mockResolvedValue(undefined)

      // Act
      await service.handlePresetDiceRoll(interaction, 'preset-1')

      // Assert
      expect(presetService.handlePresetDiceRoll).toHaveBeenCalledWith(interaction, 'preset-1')
    })
  })

  describe('parseFormula', () => {
    it('既定値で parserService.parseFormula に委譲し戻り値を返す', () => {
      // Arrange
      const expected = { isValid: true } as never
      parserService.parseFormula.mockReturnValue(expected)

      // Act
      const result = service.parseFormula('12+2')

      // Assert
      expect(parserService.parseFormula).toHaveBeenCalledWith('12+2', undefined, 1, 0)
      expect(result).toBe(expected)
    })

    it('character/multiplier/modifier を指定どおり委譲する', () => {
      // Arrange
      const character = { id: 'c3' } as never
      parserService.parseFormula.mockReturnValue({ isValid: false } as never)

      // Act
      service.parseFormula('STR+1', character, 3, 5)

      // Assert
      expect(parserService.parseFormula).toHaveBeenCalledWith('STR+1', character, 3, 5)
    })
  })

  describe('evaluateFormula', () => {
    it('parserService.evaluateFormula に委譲し戻り値を返す', () => {
      // Arrange
      parserService.evaluateFormula.mockReturnValue(14)

      // Act
      const result = service.evaluateFormula('12+2')

      // Assert
      expect(parserService.evaluateFormula).toHaveBeenCalledWith('12+2')
      expect(result).toBe(14)
    })
  })

  describe('createPresetButton', () => {
    it('既定 multiplier=1 で presetService.createPresetButton に委譲し戻り値を返す', () => {
      // Arrange
      const expected = { customId: 'cid', label: 'lbl' }
      presetService.createPresetButton.mockReturnValue(expected)

      // Act
      const result = service.createPresetButton('char1', 'skill', 'spot', 60)

      // Assert
      expect(presetService.createPresetButton).toHaveBeenCalledWith('char1', 'skill', 'spot', 60, 1)
      expect(result).toBe(expected)
    })

    it('multiplier を指定どおり委譲する', () => {
      // Arrange
      presetService.createPresetButton.mockReturnValue({ customId: 'x', label: 'y' })

      // Act
      service.createPresetButton('char1', 'param', 'STR', 15, 5)

      // Assert
      expect(presetService.createPresetButton).toHaveBeenCalledWith('char1', 'param', 'STR', 15, 5)
    })
  })

  describe('validatePresetConfig', () => {
    it('presetService.validatePresetConfig に委譲し戻り値を返す', () => {
      // Arrange
      presetService.validatePresetConfig.mockReturnValue(true)

      // Act
      const result = service.validatePresetConfig('preset-customId')

      // Assert
      expect(presetService.validatePresetConfig).toHaveBeenCalledWith('preset-customId')
      expect(result).toBe(true)
    })
  })

  describe('getResultEmoji', () => {
    it('calculationService.getResultEmoji に委譲し戻り値を返す', () => {
      // Arrange
      const diceResult = { success: true }
      calculationService.getResultEmoji.mockReturnValue('✅')

      // Act
      const result = service.getResultEmoji(diceResult, 30)

      // Assert
      expect(calculationService.getResultEmoji).toHaveBeenCalledWith(diceResult, 30)
      expect(result).toBe('✅')
    })
  })

  describe('sendToParentChannel', () => {
    it('calculationService.sendToParentChannel に委譲する', async () => {
      // Arrange
      const interaction = { id: 'i1' }
      calculationService.sendToParentChannel.mockResolvedValue(undefined)

      // Act
      await service.sendToParentChannel(interaction, 'hello')

      // Assert
      expect(calculationService.sendToParentChannel).toHaveBeenCalledWith(interaction, 'hello')
    })
  })

  describe('convertToDiceNotation', () => {
    it('parserService.convertToDiceNotation に委譲し戻り値を返す', () => {
      // Arrange
      parserService.convertToDiceNotation.mockReturnValue('1d6')

      // Act
      const result = service.convertToDiceNotation(6)

      // Assert
      expect(parserService.convertToDiceNotation).toHaveBeenCalledWith(6)
      expect(result).toBe('1d6')
    })
  })

  describe('executeBasicNotation', () => {
    it('正規化した記法で dice を実行し success:true と結果を返す', async () => {
      // Arrange: "2D100 +10" -> 正規化 "2d100+10"
      const diceResult = { critical: false, fumble: false }
      diceMock.mockResolvedValue(diceResult as never)

      // Act
      const result = await service.executeBasicNotation('2D100 +10', '探索者A')

      // Assert
      expect(diceMock).toHaveBeenCalledWith('2d100+10', 'Cthulhu')
      expect(result).toEqual({
        success: true,
        diceResult,
        description: '2d100+10',
        characterName: '探索者A'
      })
    })

    it('characterName 未指定なら既定"プレイヤー"を返す', async () => {
      // Arrange
      diceMock.mockResolvedValue({ ok: true } as never)

      // Act
      const result = await service.executeBasicNotation('1d100')

      // Assert
      expect(result.characterName).toBe('プレイヤー')
      expect(result.success).toBe(true)
    })

    it('無効なダイス記法は dice を呼ばず success:false を返す', async () => {
      // Act: "abc" はパターン不一致
      const result = await service.executeBasicNotation('abc', '探索者B')

      // Assert
      expect(diceMock).not.toHaveBeenCalled()
      expect(result).toEqual({
        success: false,
        description: '無効なダイス記法: abc',
        characterName: '探索者B'
      })
    })

    it('ダイス個数が上限超過(101d6)は無効として success:false を返す', async () => {
      // Act
      const result = await service.executeBasicNotation('101d6')

      // Assert
      expect(diceMock).not.toHaveBeenCalled()
      expect(result.success).toBe(false)
      expect(result.description).toContain('無効なダイス記法')
    })

    it('dice が falsy を返した場合は実行失敗として success:false を返す', async () => {
      // Arrange
      diceMock.mockResolvedValue(null as never)

      // Act
      const result = await service.executeBasicNotation('1d100')

      // Assert
      expect(result.success).toBe(false)
      expect(result.description).toContain('ダイスロール実行失敗')
    })

    it('dice が例外を投げた場合は計算エラーとして success:false を返す', async () => {
      // Arrange
      diceMock.mockRejectedValue(new Error('boom'))

      // Act
      const result = await service.executeBasicNotation('1d100', '探索者C')

      // Assert
      expect(result).toEqual({
        success: false,
        description: '計算エラー: boom',
        characterName: '探索者C'
      })
    })
  })

  describe('sendToParentChannelBasic', () => {
    it('PublicThread かつ親チャンネルが取得できれば親チャンネルへ送信する', async () => {
      // Arrange
      const parentSend = jest.fn().mockResolvedValue(undefined)
      const parentChannel = {
        isTextBased: jest.fn().mockReturnValue(true),
        send: parentSend
      }
      const interaction = {
        channel: { type: ChannelType.PublicThread, parentId: 'parent-1' },
        client: { channels: { fetch: jest.fn().mockResolvedValue(parentChannel) } }
      }

      // Act
      await service.sendToParentChannelBasic(interaction, 'msg')

      // Assert
      expect(interaction.client.channels.fetch).toHaveBeenCalledWith('parent-1')
      expect(parentSend).toHaveBeenCalledWith({ content: 'msg' })
    })

    it('スレッドでない場合は何も送信しない', async () => {
      // Arrange
      const fetch = jest.fn()
      const interaction = {
        channel: { type: ChannelType.GuildText, parentId: 'parent-1' },
        client: { channels: { fetch } }
      }

      // Act
      await service.sendToParentChannelBasic(interaction, 'msg')

      // Assert
      expect(fetch).not.toHaveBeenCalled()
    })

    it('parentId が無い場合は送信しない', async () => {
      // Arrange
      const fetch = jest.fn()
      const interaction = {
        channel: { type: ChannelType.PublicThread, parentId: null },
        client: { channels: { fetch } }
      }

      // Act
      await service.sendToParentChannelBasic(interaction, 'msg')

      // Assert
      expect(fetch).not.toHaveBeenCalled()
    })

    it('取得チャンネルが TextBased でなければ送信しない', async () => {
      // Arrange
      const parentSend = jest.fn()
      const parentChannel = { isTextBased: jest.fn().mockReturnValue(false), send: parentSend }
      const interaction = {
        channel: { type: ChannelType.PublicThread, parentId: 'parent-1' },
        client: { channels: { fetch: jest.fn().mockResolvedValue(parentChannel) } }
      }

      // Act
      await service.sendToParentChannelBasic(interaction, 'msg')

      // Assert
      expect(parentSend).not.toHaveBeenCalled()
    })

    it('fetch が例外を投げても throw せず握りつぶす', async () => {
      // Arrange
      const interaction = {
        channel: { type: ChannelType.PublicThread, parentId: 'parent-1' },
        client: { channels: { fetch: jest.fn().mockRejectedValue(new Error('fetch failed')) } }
      }

      // Act / Assert: 例外を投げないこと
      await expect(service.sendToParentChannelBasic(interaction, 'msg')).resolves.toBeUndefined()
    })
  })

  describe('getBasicResultEmoji', () => {
    it('critical なら🌟を返す', () => {
      expect(service.getBasicResultEmoji({ critical: true }, 50)).toBe('🌟')
    })

    it('result<5 なら🌟を返す(critical 扱い)', () => {
      expect(service.getBasicResultEmoji({}, 3)).toBe('🌟')
    })

    it('fumble なら💥を返す', () => {
      expect(service.getBasicResultEmoji({ fumble: true }, 50)).toBe('💥')
    })

    it('result>95 なら💥を返す(fumble 扱い)', () => {
      expect(service.getBasicResultEmoji({}, 98)).toBe('💥')
    })

    it('success なら✅を返す', () => {
      expect(service.getBasicResultEmoji({ success: true }, 50)).toBe('✅')
    })

    it('failure なら❌を返す', () => {
      expect(service.getBasicResultEmoji({ failure: true }, 50)).toBe('❌')
    })

    it('いずれの条件にも該当しなければ🎲を返す', () => {
      expect(service.getBasicResultEmoji({}, 50)).toBe('🎲')
    })
  })

  describe('getServiceStats', () => {
    it('サービス名一覧と status:active を返す', () => {
      // Act
      const stats = service.getServiceStats()

      // Assert
      expect(stats.services).toEqual(['DiceCalculationService', 'DiceParserService', 'DicePresetService'])
      expect(stats.status).toBe('active')
      expect(stats.features.length).toBeGreaterThan(0)
    })
  })

  describe('レガシー互換メソッド', () => {
    it('legacyCalculateAndRoll は calculateAndRoll と同じく委譲する', async () => {
      // Arrange
      const expected = { roll: 1 } as never
      calculationService.calculateAndRoll.mockResolvedValue(expected)

      // Act
      const result = await service.legacyCalculateAndRoll('1d6', 2, 1)

      // Assert
      expect(calculationService.calculateAndRoll).toHaveBeenCalledWith('1d6', 2, 1, undefined)
      expect(result).toBe(expected)
    })

    it('legacyParseAndCalculate は parseAndCalculate と同じく委譲する', async () => {
      // Arrange
      calculationService.parseAndCalculate.mockResolvedValue({ value: 2 } as never)

      // Act
      await service.legacyParseAndCalculate('2d6')

      // Assert
      expect(calculationService.parseAndCalculate).toHaveBeenCalledWith('2d6', 1, 0, undefined)
    })

    it('legacyHandlePresetDiceRoll は handlePresetDiceRoll と同じく委譲する', async () => {
      // Arrange
      const interaction = createMockButtonInteraction({ customId: 'preset-2' })
      presetService.handlePresetDiceRoll.mockResolvedValue(undefined)

      // Act
      await service.legacyHandlePresetDiceRoll(interaction, 'preset-2')

      // Assert
      expect(presetService.handlePresetDiceRoll).toHaveBeenCalledWith(interaction, 'preset-2')
    })

    it('executeNotation は executeBasicNotation に委譲する', async () => {
      // Arrange
      diceMock.mockResolvedValue({ ok: true } as never)

      // Act
      const result = await service.executeNotation('1d100', '探索者D')

      // Assert
      expect(diceMock).toHaveBeenCalledWith('1d100', 'Cthulhu')
      expect(result.success).toBe(true)
      expect(result.characterName).toBe('探索者D')
    })
  })
})
