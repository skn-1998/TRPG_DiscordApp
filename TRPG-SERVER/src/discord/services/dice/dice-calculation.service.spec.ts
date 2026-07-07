import { ChannelType } from 'discord.js'
import { Character } from 'src/domains/character/models/character.model'
import { AttributeValue } from 'src/core/types/attribute.types'
import dice from 'src/domains/dice-roll/services/bcdice.util'
import { DiceCalculationService } from './dice-calculation.service'

// 外部の bcdice ローダ依存を遮断し、ダイス結果を決定的にする
jest.mock('src/domains/dice-roll/services/bcdice.util')

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

  beforeEach(() => {
    service = new DiceCalculationService()
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
      // mockResolvedValue であること自体が回帰テスト: 実装の await が漏れると
      // diceResult に Promise が入り toBe(sentinel) が RED になる
      mockedDice.mockResolvedValue(sentinel as never)

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
