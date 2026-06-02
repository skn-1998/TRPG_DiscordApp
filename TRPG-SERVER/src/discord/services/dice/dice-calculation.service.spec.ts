import { ChannelType } from 'discord.js'
import { Character } from 'src/domains/character/models/character.model'
import { AttributeValue } from 'src/core/types/attribute.types'
import { CharacterService } from 'src/domains/character/character.service'
import dice from 'src/discord/utils/dice'
import { DiceCalculationService } from './dice-calculation.service'

// 外部の bcdice ローダ依存を遮断し、ダイス結果を決定的にする
jest.mock('src/discord/utils/dice')

const mockedDice = dice as jest.MockedFunction<typeof dice>

/** values.base に数値を持つ最小の AttributeValue を作る */
const attr = (value: number): AttributeValue => ({ values: { base: value } })

/** parameter / skill のみを持つ最小 Character を作る */
const makeCharacter = (overrides: {
  characterName?: string
  parameter?: Record<string, AttributeValue>
  skill?: Record<string, AttributeValue>
}): Character =>
  ({
    characterName: overrides.characterName,
    parameter: overrides.parameter,
    skill: overrides.skill
  }) as Character

describe('DiceCalculationService', () => {
  let service: DiceCalculationService
  // calculateAndRoll / parseAndCalculate のパスでは CharacterService は呼ばれないため空モックで十分
  const characterService = {} as unknown as CharacterService

  beforeEach(() => {
    service = new DiceCalculationService(characterService)
    // dice() の戻り値はテスト個別で設定するが、未設定時の既定も用意
    mockedDice.mockResolvedValue({ rands: [] } as never)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('calculateAndRoll', () => {
    it('数値式に乗数・修正値を適用し targetValue と diceコマンドを決定する', async () => {
      // Arrange
      const sentinel = { rands: [[3]] }
      mockedDice.mockReturnValue(sentinel as never)

      // Act: 10 * 2 + 3 = 23
      const result = await service.calculateAndRoll('10', 2, 3)

      // Assert
      expect(result.success).toBe(true)
      expect(result.targetValue).toBe(23)
      expect(result.diceResult).toBe(sentinel)
      expect(result.characterName).toBe('プレイヤー')
      expect(mockedDice).toHaveBeenCalledWith('23b10')
    })

    it('乗数1・修正値0のときは説明に乗数/修正の表記を付けない', async () => {
      // Act
      const result = await service.calculateAndRoll('15')

      // Assert
      expect(result.success).toBe(true)
      expect(result.targetValue).toBe(15)
      expect(result.description).toBe('15 = 15')
      expect(mockedDice).toHaveBeenCalledWith('15b10')
    })

    it('負の修正値は符号なしで連結される（= 値表記）', async () => {
      // Act: 20 * 1 + (-4) = 16
      const result = await service.calculateAndRoll('20', 1, -4)

      // Assert
      expect(result.targetValue).toBe(16)
      expect(result.description).toBe('20 -4 = 16')
      expect(mockedDice).toHaveBeenCalledWith('16b10')
    })

    it('キャラクター名がある場合は characterName に反映される', async () => {
      // Arrange
      const character = makeCharacter({ characterName: '探索者A' })

      // Act
      const result = await service.calculateAndRoll('10', 1, 0, character)

      // Assert
      expect(result.characterName).toBe('探索者A')
    })

    it('キャラクターのパラメータ(STR)を式に代入して計算する', async () => {
      // Arrange
      const character = makeCharacter({ characterName: 'クトゥルフ卿', parameter: { STR: attr(15) } })

      // Act: STR(15) * 3 = 45（修正値0）
      const result = await service.calculateAndRoll('STR', 3, 0, character)

      // Assert
      expect(result.success).toBe(true)
      expect(result.targetValue).toBe(45)
      expect(result.description).toContain('STR(15)')
      expect(result.description).toContain('× 3')
      expect(result.description).toContain('= 45')
      expect(mockedDice).toHaveBeenCalledWith('45b10')
    })

    it('dice() が例外を投げると success:false とエラー説明を返す', async () => {
      // Arrange
      mockedDice.mockImplementation(() => {
        throw new Error('boom')
      })

      // Act
      const result = await service.calculateAndRoll('10')

      // Assert
      expect(result.success).toBe(false)
      expect(result.description).toBe('計算エラー: 10')
      expect(result.targetValue).toBeUndefined()
    })
  })

  describe('parseAndCalculate', () => {
    it('単純な数値式を評価し diceCommand を生成する', async () => {
      // Act
      const result = await service.parseAndCalculate('12')

      // Assert
      expect(result.result).toBe(12)
      expect(result.diceCommand).toBe('12b10')
      expect(result.originalFormula).toBe('12')
      expect(result.processedFormula).toBe('12')
      expect(result.characterUsed).toBe(false)
    })

    it('式は小文字化・trim されて処理される', async () => {
      // Act: '  5+3  ' → '5+3' = 8
      const result = await service.parseAndCalculate('  5+3  ')

      // Assert
      expect(result.processedFormula).toBe('5+3')
      expect(result.result).toBe(8)
      expect(result.diceCommand).toBe('8b10')
    })

    it('キャラクター値(STR)を代入し characterUsed:true を返す', async () => {
      // Arrange
      const character = makeCharacter({ parameter: { STR: attr(14) } })

      // Act: str → 14
      const result = await service.parseAndCalculate('str', 1, 0, character)

      // Assert
      expect(result.result).toBe(14)
      expect(result.characterUsed).toBe(true)
      expect(result.description).toContain('STR(14)')
      expect(result.diceCommand).toBe('14b10')
    })

    it('乗数と修正値を適用して入れ子の式を評価する', async () => {
      // Act: (10) * 2 = 20, さらに + 5 = 25
      const result = await service.parseAndCalculate('10', 2, 5)

      // Assert
      expect(result.processedFormula).toBe('((10) * 2) + 5')
      expect(result.result).toBe(25)
      expect(result.diceCommand).toBe('25b10')
      expect(result.description).toContain('× 2')
      expect(result.description).toContain('+5')
    })

    it('負の修正値を適用する', async () => {
      // Act: (10) - 3 = 7
      const result = await service.parseAndCalculate('10', 1, -3)

      // Assert
      expect(result.processedFormula).toBe('(10)  -3')
      expect(result.result).toBe(7)
      expect(result.diceCommand).toBe('7b10')
    })

    it('評価不能な式は計算エラーとしてフォールバック(1b10)を返す', async () => {
      // Arrange: 許可外文字が除去された結果 evaluateFormula が Function 構文エラー → catch
      // 'a-' は sanitize で '-' のみ残り 'return (-)' が SyntaxError になる
      const result = await service.parseAndCalculate('a-')

      // Assert: evaluateFormula 内 catch で 1 が返るため、計算は成功扱いで result:1
      expect(result.result).toBe(1)
      expect(result.diceCommand).toBe('1b10')
    })
  })

  describe('evaluateFormula 挙動固定 (characterization: 旧 Function 評価との一致)', () => {
    // private evaluateFormula は範囲チェック・丸めを行わず生の数値を返す。
    // parseAndCalculate(formula, 1, 0) は processedFormula を toLowerCase().trim() した上で
    // evaluateFormula にそのまま渡すため、result が evaluateFormula の生値となる。
    // 旧実装 Function('"use strict"; return (' + sanitized + ')')() と同一結果であることを固定する。
    const evalRaw = async (formula: string): Promise<number> => {
      const r = await service.parseAndCalculate(formula)
      return r.result
    }

    it.each<[string, number]>([
      ['(50) * 3', 150],
      ['1+2*3', 7],
      ['(5+5)/2', 5],
      ['(100) + -5', 95],
      ['2.5*4', 10],
      [' ( 3 ) ', 3],
      ['1-2-3', -4], // 範囲チェック無しのため負値もそのまま
      ['10001', 10001], // 範囲チェック無しのため >10000 もそのまま
      ['2*3+4*5', 26],
      ['100', 100]
    ])('式 %p の生の評価結果は %p（範囲チェック/丸め無し）', async (formula, expected) => {
      await expect(evalRaw(formula)).resolves.toBe(expected)
    })

    it('小数は丸めず生値を返す（10/3 = 3.333...）', async () => {
      await expect(evalRaw('10/3')).resolves.toBeCloseTo(3.3333333333333335, 12)
    })

    it('0除算は JS と同じく Infinity を返す（範囲チェック無し）', async () => {
      // 旧実装は Function 評価で Infinity → そのまま返す（dice-calc には妥当性チェック無し）
      await expect(evalRaw('1/0')).resolves.toBe(Infinity)
    })

    it('空文字（trim後空）は評価不能として catch で 1 を返す', async () => {
      await expect(evalRaw('   ')).resolves.toBe(1)
    })

    it('サニタイズ後に構文不正となる式は catch で 1 を返す（a- → -）', async () => {
      // 'a-' は sanitize で '-' のみ残り、評価不能 → catch → 1
      await expect(evalRaw('a-')).resolves.toBe(1)
    })
  })

  describe('getResultEmoji', () => {
    it('diceResult が無い場合は通常絵文字を返す', () => {
      expect(service.getResultEmoji(undefined, 50)).toBe('🎲')
      expect(service.getResultEmoji({}, 50)).toBe('🎲')
    })

    it('成功数0はファンブル(💥)', () => {
      // Arrange: 2個とも目標値(rollResult)を超える出目
      const diceResult = { rands: [[9], [8]] }

      // Act / Assert: rollResult=5 → どちらも > 5 で成功0
      expect(service.getResultEmoji(diceResult, 5)).toBe('💥')
    })

    it('全て成功は大成功(✨)', () => {
      // Arrange: 2個とも目標値以下
      const diceResult = { rands: [[1], [2]] }

      // Act / Assert
      expect(service.getResultEmoji(diceResult, 5)).toBe('✨')
    })

    it('成功率80%以上は成功(🎯)', () => {
      // Arrange: 5個中4個成功 = 80%
      const diceResult = { rands: [[1], [2], [3], [4], [9]] }

      // Act / Assert
      expect(service.getResultEmoji(diceResult, 5)).toBe('🎯')
    })

    it('成功率が80%未満かつ0でも全成功でもない場合は通常(🎲)', () => {
      // Arrange: 5個中3個成功 = 60%
      const diceResult = { rands: [[1], [2], [3], [9], [9]] }

      // Act / Assert
      expect(service.getResultEmoji(diceResult, 5)).toBe('🎲')
    })
  })

  describe('sendToParentChannel', () => {
    it('PublicThread かつ parent があれば親チャンネルへ送信する', async () => {
      // Arrange
      const send = jest.fn().mockResolvedValue(undefined)
      const interaction = {
        channel: {
          type: ChannelType.PublicThread,
          parent: { send }
        }
      }

      // Act
      await service.sendToParentChannel(interaction, 'メッセージ')

      // Assert
      expect(send).toHaveBeenCalledWith('メッセージ')
    })

    it('スレッド以外のチャンネルでは送信しない', async () => {
      // Arrange
      const send = jest.fn()
      const interaction = {
        channel: {
          type: ChannelType.GuildText,
          parent: { send }
        }
      }

      // Act
      await service.sendToParentChannel(interaction, 'メッセージ')

      // Assert
      expect(send).not.toHaveBeenCalled()
    })

    it('送信中に例外が発生しても throw せず握りつぶす', async () => {
      // Arrange
      const send = jest.fn().mockRejectedValue(new Error('network'))
      const interaction = {
        channel: {
          type: ChannelType.PublicThread,
          parent: { send }
        }
      }

      // Act / Assert: 例外が伝播しないこと
      await expect(service.sendToParentChannel(interaction, 'メッセージ')).resolves.toBeUndefined()
    })
  })
})
