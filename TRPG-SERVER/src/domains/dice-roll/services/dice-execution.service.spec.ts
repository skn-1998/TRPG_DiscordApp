import { Logger } from '@nestjs/common'
import { DiceExecutionService } from './dice-execution.service'
import dice from './bcdice.util'

// dice モジュール(BCDice ローダ)は副作用の境界として丸ごとモックし、
// 出目を固定して executeDiceRoll の成功/失敗/gameSystemId 分岐を決定的に検証する
// （dice-roll-logic.service.spec.ts と同じモック方式）。
jest.mock('./bcdice.util')

const mockedDice = dice as jest.MockedFunction<typeof dice>

/**
 * DiceExecutionService は BCDice 実行コア（E-6e で DiceRollLogicService から移設）。
 * - 式クリーニング → BCDice eval → 結果抽出（rands 合算 / text フォールバック）を固定する。
 * - 注入依存を持たないため直接 new する。副作用の境界は dice() のみ。
 */
describe('DiceExecutionService', () => {
  let service: DiceExecutionService

  // BCDice 風の結果を作るヘルパ(rands から total を計算する経路)。
  // 実 Result 型は本サービスが参照する text/rands 以外のフィールドも要求するため、
  // テストでは使用フィールドのみ与えて dice の戻り型へキャストする。
  type DiceReturn = Awaited<ReturnType<typeof dice>>
  const diceResult = (text: string, rands: number[][] = []): DiceReturn => ({ text, rands }) as unknown as DiceReturn

  beforeEach(() => {
    service = new DiceExecutionService()
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.clearAllMocks()
  })

  describe('executeDiceRoll', () => {
    it('rands の各出目を合算して total とし、text を details に返す', async () => {
      // Arrange
      mockedDice.mockResolvedValue(diceResult('(2D6) ＞ 7[3,4]', [[3], [4]]))

      // Act
      const result = await service.executeDiceRoll('2d6')

      // Assert
      expect(result).toEqual({ total: 7, details: '(2D6) ＞ 7[3,4]' })
    })

    it('gameSystemId 未指定時はクリーンアップ済みの式のみで dice を呼ぶ（既定 DiceBot）', async () => {
      // Arrange: 大文字・空白入りの式は正規化されて渡る
      mockedDice.mockResolvedValue(diceResult('(1D100) ＞ 73', [[73]]))

      // Act
      await service.executeDiceRoll(' 1D100 ')

      // Assert: gameSystemId は undefined のまま渡し、bcdice.util 側の既定に委ねる
      expect(mockedDice).toHaveBeenCalledWith('1d100', undefined)
    })

    it('gameSystemId 指定時はその id を dice へ渡す', async () => {
      // Arrange
      mockedDice.mockResolvedValue(diceResult('(1D100) ＞ 10', [[10]]))

      // Act
      await service.executeDiceRoll('1d100', 'Cthulhu')

      // Assert
      expect(mockedDice).toHaveBeenCalledWith('1d100', 'Cthulhu')
    })

    it('rands が無い場合は text の "＞ N" から total を抽出する', async () => {
      // Arrange
      mockedDice.mockResolvedValue(diceResult('(1D100) ＞ 42'))

      // Act
      const result = await service.executeDiceRoll('1d100')

      // Assert
      expect(result.total).toBe(42)
    })

    it.each([
      { roll: 42, outcome: '成功' },
      { roll: 85, outcome: '失敗' }
    ])('末尾比較 1d100<=70 は左辺だけをロールし、出目 $roll を $outcome と表示する', async ({ roll, outcome }) => {
      mockedDice.mockResolvedValue(diceResult(`(1D100) ＞ ${roll}`, [[roll]]))

      const result = await service.executeDiceRoll('1d100<=70')

      expect(mockedDice).toHaveBeenCalledWith('1d100', undefined)
      expect(result).toEqual({
        total: roll,
        details: `(1D100) ＞ ${roll} ≤ 70 → ${outcome}`
      })
    })

    it.each([
      {
        expression: '2d6+3>=10',
        rollExpression: '2d6+3',
        text: '(2D6+3) ＞ 7[3,4]+3 ＞ 10',
        rands: [[3], [4]],
        legacyTotal: 7,
        details: '(2D6+3) ＞ 7[3,4]+3 ＞ 10 ≥ 10 → 成功'
      },
      {
        expression: '(1d6+2)*2<=10',
        rollExpression: '(1d6+2)*2',
        text: '((1D6+2)*2) ＞ (3[3]+2)*2 ＞ 10',
        rands: [[3]],
        legacyTotal: 3,
        details: '((1D6+2)*2) ＞ (3[3]+2)*2 ＞ 10 ≤ 10 → 成功'
      },
      {
        expression: '3d6*5>=50',
        rollExpression: '3d6*5',
        text: '(3D6*5) ＞ 11[2,4,5]*5 ＞ 55',
        rands: [[2], [4], [5]],
        legacyTotal: 11,
        details: '(3D6*5) ＞ 11[2,4,5]*5 ＞ 55 ≥ 50 → 成功'
      }
    ])(
      '$expression は legacy total を保ち、評価済み最終値で比較する',
      async ({ expression, rollExpression, text, rands, legacyTotal, details }) => {
        mockedDice.mockResolvedValue(diceResult(text, rands))

        const result = await service.executeDiceRoll(expression)

        expect(mockedDice).toHaveBeenCalledWith(rollExpression, undefined)
        expect(result).toEqual({ total: legacyTotal, details })
      }
    )

    it('従来の NdM+K 式は変更せず BCDice へ渡し、既存の詳細表現を維持する', async () => {
      mockedDice.mockResolvedValue(diceResult('(2D6+3) ＞ 7[3,4]+3 ＞ 10', [[3], [4]]))

      const result = await service.executeDiceRoll('2d6+3')

      expect(mockedDice).toHaveBeenCalledWith('2d6+3', undefined)
      expect(result.details).toBe('(2D6+3) ＞ 7[3,4]+3 ＞ 10')
    })

    it('dice の結果が空(textなし)の場合は実行失敗エラーを throw する', async () => {
      // Arrange
      mockedDice.mockResolvedValue(null as any)

      // Act & Assert
      await expect(service.executeDiceRoll('1d100')).rejects.toThrow('ダイスロールの実行に失敗しました: 1d100')
    })

    it('dice が reject した場合も実行失敗エラーに変換する', async () => {
      // Arrange
      mockedDice.mockRejectedValue(new Error('loader failed'))

      // Act & Assert
      await expect(service.executeDiceRoll('1d100')).rejects.toThrow('ダイスロールの実行に失敗しました: 1d100')
    })

    it('未対応記法は dice を呼ばず、元の式を含む明示エラーになる', async () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation()
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation()

      await expect(service.executeDiceRoll('1d100<70')).rejects.toThrow('未対応のダイス記法です: 1d100<70')
      expect(mockedDice).not.toHaveBeenCalled()
      expect(warnSpy).toHaveBeenCalledWith('Unsupported dice notation: 1d100<70')
      expect(errorSpy).not.toHaveBeenCalled()
    })

    it.each(['1d100<=9007199254740991.1', '1d100>=-9007199254740991.1'])(
      '安全整数境界を小数で超える目標値 %s は丸めた details を返さず拒否する',
      async (expression) => {
        const rejection: unknown = await service.executeDiceRoll(expression).catch((error: unknown) => error)

        expect(rejection).toMatchObject({
          name: 'UnsupportedDiceNotationError',
          message: `未対応のダイス記法です: ${expression}`
        })
        expect(rejection).not.toHaveProperty('details')
        expect(mockedDice).not.toHaveBeenCalled()
      }
    )
  })

  describe('executeEvaluatedDiceRoll', () => {
    it('BCDice text の最後の評価値を total とし、3d6*5 の修飾子を反映する', async () => {
      mockedDice.mockResolvedValue(diceResult('(3D6*5) ＞ 11[2,4,5]*5 ＞ 55', [[2], [4], [5]]))

      const result = await service.executeEvaluatedDiceRoll('3d6*5', 'Cthulhu7th')

      expect(mockedDice).toHaveBeenCalledWith('3d6*5', 'Cthulhu7th')
      expect(result).toEqual({ total: 55, details: '(3D6*5) ＞ 11[2,4,5]*5 ＞ 55' })
    })

    it('BCDice text の最後の小数評価値を実在フィールドから抽出する', async () => {
      mockedDice.mockResolvedValue(diceResult('(1D6/2) ＞ 3[3]/2 ＞ 1.5', [[3]]))

      const result = await service.executeEvaluatedDiceRoll('1d6/2')

      expect(result.total).toBe(1.5)
    })

    it('末尾比較では評価済み最終値を対象に成否を表示する', async () => {
      mockedDice.mockResolvedValue(diceResult('(3D6*5) ＞ 11[2,4,5]*5 ＞ 55'))

      const result = await service.executeEvaluatedDiceRoll('3d6*5>=50')

      expect(mockedDice).toHaveBeenCalledWith('3d6*5', undefined)
      expect(result).toEqual({
        total: 55,
        details: '(3D6*5) ＞ 11[2,4,5]*5 ＞ 55 ≥ 50 → 成功'
      })
    })
  })

  describe('cleanDiceExpression', () => {
    it('大文字・空白を正規化する', () => {
      expect(service.cleanDiceExpression(' 1D100 ')).toBe('1d100')
    })

    it.each(['1d100<70', '1d100=70', '1d100<=70+1', '1d100;rm', '@@@'])(
      '未対応文字を含む %s は黙って削除せず throw する',
      (expression) => {
        expect(() => service.cleanDiceExpression(expression)).toThrow(`未対応のダイス記法です: ${expression}`)
      }
    )

    it('末尾の <=N / >=N は比較記法として正規化して保持する', () => {
      expect(service.cleanDiceExpression(' 1D100 <= 70 ')).toBe('1d100<=70')
      expect(service.cleanDiceExpression('1d20 >= 12')).toBe('1d20>=12')
    })

    it('小数の目標値を比較記法として受理する', () => {
      expect(service.cleanDiceExpression('1d100<=70.5')).toBe('1d100<=70.5')
    })

    it.each(['1d100<=9007199254740991', '1d100>=-9007199254740991'])(
      '安全整数境界の目標値 %s を受理する',
      (expression) => {
        expect(service.cleanDiceExpression(expression)).toBe(expression)
      }
    )

    it.each([
      '1d100<=9007199254740991.1',
      '1d100>=-9007199254740991.1',
      '1d100<=9007199254740992',
      '1d100>=-9007199254740992'
    ])('安全整数境界を超える目標値 %s を明示拒否する', (expression) => {
      expect(() => service.cleanDiceExpression(expression)).toThrow(`未対応のダイス記法です: ${expression}`)
    })

    it('修飾子付きの式(2d6+3)はそのまま通す', () => {
      expect(service.cleanDiceExpression('2d6+3')).toBe('2d6+3')
    })

    it('空の入力は無効なダイス式として throw する', () => {
      expect(() => service.cleanDiceExpression('   ')).toThrow('無効なダイス式:    ')
    })
  })
})
