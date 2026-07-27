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

/** ダイス計算で参照する属性セクションだけを持つ最小 Character を作る */
const makeCharacter = (overrides: {
  characterName?: string
  parameter?: Record<string, AttributeValue>
  status?: Record<string, AttributeValue>
  skill?: Record<string, AttributeValue>
}): Character =>
  ({
    characterName: overrides.characterName,
    parameter: overrides.parameter,
    status: overrides.status,
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
      const result = await service.calculateAndRoll('50')

      // Assert
      expect(result.success).toBe(true)
      expect(result.targetValue).toBe(50)
      expect(result.description).toBe('50 = 50')
      expect(mockedDice).toHaveBeenCalledWith('50b10')
    })

    it('負の修正値は符号なしで連結される（= 値表記）', async () => {
      // Act: 20 * 1 + (-4) = 16
      const result = await service.calculateAndRoll('20', 1, -4)

      // Assert
      expect(result.targetValue).toBe(16)
      expect(result.description).toBe('20 -4 = 16')
      expect(mockedDice).toHaveBeenCalledWith('16b10')
    })

    it('算術式は先頭整数へ切り詰めず、式全体を評価する', async () => {
      // Act
      const result = await service.calculateAndRoll('10+5')

      // Assert
      expect(result.targetValue).toBe(15)
      expect(result.description).toBe('10+5 = 15')
      expect(mockedDice).toHaveBeenCalledWith('15b10')
    })

    it.each([
      ['1/0', undefined],
      ['0/0', undefined],
      ['STR÷2', makeCharacter({ parameter: { str: attr(25) } })],
      ['0', undefined],
      ['-5', undefined]
    ])('ダイス個数として使えない値になる式 %s はロール前に拒否する', async (formula, character) => {
      // Act
      const result = await service.calculateAndRoll(formula, 1, 0, character)

      // Assert: diceResult が無いため、呼び出し元の履歴保存条件も満たさない
      expect(result.success).toBe(false)
      expect(result.description).toContain('ダイス個数として使えない値')
      expect(result.diceResult).toBeUndefined()
      expect(mockedDice).not.toHaveBeenCalled()
    })

    it('算術式が上限を超えるダイス個数になった場合はロール前に拒否する', async () => {
      // Act
      const result = await service.calculateAndRoll('9**9')

      // Assert
      expect(result.success).toBe(false)
      expect(result.description).toContain('ダイス個数として使えない値')
      expect(mockedDice).not.toHaveBeenCalled()
    })

    it.each(['2d6', 'abc+1'])('未対応文字を含む式 %s は文字を削除せず拒否する', async (formula) => {
      // Act
      const result = await service.calculateAndRoll(formula)

      // Assert
      expect(result).toEqual({
        success: false,
        description: `未対応のダイス記法です: ${formula}`,
        characterName: 'プレイヤー'
      })
      expect(mockedDice).not.toHaveBeenCalled()
    })

    it('キャラクター名がある場合は characterName に反映される', async () => {
      // Arrange
      const character = makeCharacter({ characterName: '探索者A' })

      // Act
      const result = await service.calculateAndRoll('10', 1, 0, character)

      // Assert
      expect(result.characterName).toBe('探索者A')
    })

    it('小文字キーのキャラクターパラメータ(str)を STR として解決する', async () => {
      // Arrange
      const character = makeCharacter({ characterName: 'クトゥルフ卿', parameter: { str: attr(15) } })

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

    it.each([
      ['STR×2-1', 29, '29b10'],
      ['STR÷3', 5, '5b10']
    ])('`×` は入力例で案内され、`÷` は対称性のため受け入れる: %s', async (formula, targetValue, diceCommand) => {
      // Arrange
      const character = makeCharacter({ characterName: '探索者A', parameter: { str: attr(15) } })

      // Act
      const result = await service.calculateAndRoll(formula, 1, 0, character)

      // Assert
      expect(result.success).toBe(true)
      expect(result.targetValue).toBe(targetValue)
      expect(mockedDice).toHaveBeenCalledWith(diceCommand)
    })

    it('status の hp / mp をセクション横断で解決する', async () => {
      // Arrange
      const character = makeCharacter({ status: { hp: attr(12), mp: attr(8) } })

      // Act
      const result = await service.calculateAndRoll('HP+MP', 1, 0, character)

      // Assert
      expect(result.success).toBe(true)
      expect(result.targetValue).toBe(20)
      expect(mockedDice).toHaveBeenCalledWith('20b10')
    })

    it.each([
      ['キー dodge・name 無し', { dodge: { values: { base: 40 } } }],
      ['キー dodge・name 空文字', { dodge: { name: '', values: { base: 40 } } }],
      ['キー dodge・表示名 回避', { dodge: { name: '回避', values: { base: 40 } } }],
      ['キー 回避', { 回避: attr(40) }]
    ])('dodge は %s の技能属性から解決する', async (_caseName, skill) => {
      // Arrange
      const character = makeCharacter({ skill })

      // Act
      const result = await service.calculateAndRoll('dodge', 1, 0, character)

      // Assert
      expect(result.success).toBe(true)
      expect(result.targetValue).toBe(40)
      expect(mockedDice).toHaveBeenCalledWith('40b10')
    })

    it('他のマッピングでも式の別名と表示名の両方向で保存キーを解決する', async () => {
      // Arrange: strength（式の別名）→ STR（表示名キー）、HP（表示名）→ hp（別名キー）
      const character = makeCharacter({
        parameter: { STR: attr(15) },
        status: { hp: attr(12) }
      })

      // Act
      const result = await service.calculateAndRoll('strength+HP', 1, 0, character)

      // Assert
      expect(result.success).toBe(true)
      expect(result.targetValue).toBe(27)
      expect(mockedDice).toHaveBeenCalledWith('27b10')
    })

    it('values を持たない dice 属性は数値として解決しない', async () => {
      // Arrange
      const character = makeCharacter({ status: { hp: { name: 'HP', dice: '0' } } })

      // Act
      const result = await service.calculateAndRoll('HP', 1, 0, character)

      // Assert
      expect(result.success).toBe(false)
      expect(result.description).toBe('キャラクターに HP が見つかりません')
      expect(mockedDice).not.toHaveBeenCalled()
    })

    it('空の values は未解決として後続セクションを探索する', async () => {
      // Arrange
      const character = makeCharacter({
        parameter: { hp: { name: 'HP', values: {} } },
        status: { hp: attr(12) }
      })

      // Act
      const result = await service.calculateAndRoll('HP', 1, 0, character)

      // Assert
      expect(result.success).toBe(true)
      expect(result.targetValue).toBe(12)
      expect(mockedDice).toHaveBeenCalledWith('12b10')
    })

    it('キャラクター値が未解決なら 0 にせずロール前に拒否する', async () => {
      // Arrange
      const character = makeCharacter({ parameter: {}, status: {}, skill: {} })

      // Act
      const result = await service.calculateAndRoll('STR', 1, 0, character)

      // Assert: diceResult が無いため、呼び出し元の履歴保存条件も満たさない
      expect(result).toEqual({
        success: false,
        description: 'キャラクターに STR が見つかりません',
        characterName: 'プレイヤー'
      })
      expect(mockedDice).not.toHaveBeenCalled()
    })

    it('負のキャラクター値は括弧付きで置換し、二重マイナスを減算として評価する', async () => {
      // Arrange
      const character = makeCharacter({ parameter: { str: attr(-3) }, status: { hp: attr(12) } })

      // Act: 12 - (-3) = 15
      const result = await service.calculateAndRoll('HP-STR', 1, 0, character)

      // Assert
      expect(result.success).toBe(true)
      expect(result.targetValue).toBe(15)
      expect(result.description).toBe('HP(12)-STR(-3) = 15')
      expect(mockedDice).toHaveBeenCalledWith('15b10')
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

    it('dice() が null を返すと executeBasicNotation と同じく実行失敗にする', async () => {
      // Arrange
      mockedDice.mockResolvedValue(null as never)

      // Act
      const result = await service.calculateAndRoll('10')

      // Assert
      expect(mockedDice).toHaveBeenCalledWith('10b10')
      expect(result).toEqual({
        success: false,
        description: 'ダイスロール実行失敗: 10b10',
        characterName: 'プレイヤー'
      })
    })

    it('サニタイズ後に空になる式は 1 にフォールバックせず明示的な失敗を返す', async () => {
      // Arrange
      const character = makeCharacter({ characterName: '探索者A' })

      // Act
      const result = await service.calculateAndRoll('abc', 1, 0, character)

      // Assert
      expect(result).toEqual({
        success: false,
        description: '未対応のダイス記法です: abc',
        characterName: '探索者A'
      })
      expect(result.targetValue).toBeUndefined()
      expect(mockedDice).not.toHaveBeenCalled()
    })

    it('構文エラーの式は失敗として呼び出し元へ返す', async () => {
      // Arrange
      const character = makeCharacter({ parameter: { STR: attr(15) } })

      // Act
      const result = await service.calculateAndRoll('STR +', 1, 0, character)

      // Assert
      expect(result.success).toBe(false)
      expect(result.description).toBe('未対応のダイス記法です: STR +')
      expect(result.targetValue).toBeUndefined()
      expect(mockedDice).not.toHaveBeenCalled()
    })
  })

  describe('getResultEmoji', () => {
    it('diceResult が無い場合は通常絵文字を返す', () => {
      expect(service.getResultEmoji(undefined)).toBe('🎲')
      expect(service.getResultEmoji({})).toBe('🎲')
    })

    it.each([
      [{ critical: true, success: true, rands: [[100], [100]] }, '🌟'],
      [{ fumble: true, failure: true, rands: [[1], [1]] }, '💥'],
      [{ success: true, rands: [[100], [100]] }, '✅'],
      [{ failure: true, rands: [[1], [1]] }, '❌']
    ])('BCDice の判定フラグを対応する絵文字へ変換する', (diceResult, expected) => {
      expect(service.getResultEmoji(diceResult)).toBe(expected)
    })

    it('BCDice の判定フラグが無い単一ダイスは出目にかかわらず🎲', () => {
      expect(service.getResultEmoji({ rands: [[3]] })).toBe('🎲')
      expect(service.getResultEmoji({ rands: [[98]] })).toBe('🎲')
    })

    it('BCDice の判定フラグが無い複数ダイスは出目と個数にかかわらず🎲', () => {
      expect(service.getResultEmoji({ rands: [[9], [8]] })).toBe('🎲')
      expect(service.getResultEmoji({ rands: [[1], [2], [3], [4], [9]] })).toBe('🎲')
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
