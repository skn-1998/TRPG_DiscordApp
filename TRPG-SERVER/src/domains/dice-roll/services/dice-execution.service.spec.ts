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

    it('クリーンアップで無効と判定された式は dice を呼ばずに実行失敗エラーになる', async () => {
      // Act & Assert: cleanDiceExpression の throw が catch され実行失敗エラーへ変換される
      await expect(service.executeDiceRoll('@@@')).rejects.toThrow('ダイスロールの実行に失敗しました: @@@')
      expect(mockedDice).not.toHaveBeenCalled()
    })
  })

  describe('cleanDiceExpression', () => {
    it('大文字・空白を正規化する', () => {
      expect(service.cleanDiceExpression(' 1D100 ')).toBe('1d100')
    })

    it('危険な文字を除去して基本形へ整える', () => {
      expect(service.cleanDiceExpression('1d100;rm')).toBe('1d100')
    })

    it('修飾子付きの式(2d6+3)はそのまま通す', () => {
      expect(service.cleanDiceExpression('2d6+3')).toBe('2d6+3')
    })

    it('クリーンアップ後に空文字となる入力は throw する', () => {
      expect(() => service.cleanDiceExpression('@@@')).toThrow('無効なダイス式: @@@')
    })
  })
})
