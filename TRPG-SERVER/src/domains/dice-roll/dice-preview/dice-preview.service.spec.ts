import { BadRequestException, HttpException, UnprocessableEntityException } from '@nestjs/common'
import { STANDALONE_ROLL_EXPRESSION_MAX_LENGTH, STANDALONE_ROLL_LITERAL_DICE_MAX_COUNT } from '@trpg/sheet-engine'
import { DiceExecutionService } from '../services/dice-execution.service'
import { DicePreviewService, INVALID_DICE_NOTATION_MESSAGE } from './dice-preview.service'

/**
 * dice preview の静的検査と BCDice 実行エラーの HTTP status 境界を検証する。
 * DiceExecutionService は既存挙動を変更せず、戻り値または rejection だけを固定する。
 */
describe('DicePreviewService', () => {
  let diceExecutionService: jest.Mocked<Pick<DiceExecutionService, 'executeDiceRoll'>>
  let service: DicePreviewService

  beforeEach(() => {
    diceExecutionService = { executeDiceRoll: jest.fn() }
    service = new DicePreviewService(diceExecutionService as unknown as DiceExecutionService)
  })

  it('正常な単式は gameSystemId とともに既存実行 service へ委譲し、戻り値を変えない', async () => {
    const result = { total: 9, details: '(2D6+1) ＞ 8[3,5]+1 ＞ 9' }
    diceExecutionService.executeDiceRoll.mockResolvedValue(result)

    await expect(service.preview({ notation: '2d6+1', gameSystemId: 'Cthulhu7th' })).resolves.toBe(result)
    expect(diceExecutionService.executeDiceRoll).toHaveBeenCalledWith('2d6+1', 'Cthulhu7th')
  })

  it.each([
    ['10', 'standalone roll expression must contain at least one literal dice term'],
    ['1d8{derived.db}', 'standalone roll expression must not contain placeholders']
  ])('engine が %s を拒否すると message 配列の 400 にする', async (notation, expectedMessage) => {
    const exception = await service.preview({ notation }).catch((error: unknown) => error)

    expectException(exception, BadRequestException, 400, [expectedMessage])
    expect(diceExecutionService.executeDiceRoll).not.toHaveBeenCalled()
  })

  it('257文字の式を engine 上限違反として 400 にする', async () => {
    const notation = `1d6${' '.repeat(STANDALONE_ROLL_EXPRESSION_MAX_LENGTH - 2)}`
    expect(notation).toHaveLength(STANDALONE_ROLL_EXPRESSION_MAX_LENGTH + 1)

    const exception = await service.preview({ notation }).catch((error: unknown) => error)

    expectException(exception, BadRequestException, 400, [
      `standalone roll expression must be ${STANDALONE_ROLL_EXPRESSION_MAX_LENGTH} characters or fewer`
    ])
  })

  it('合計101個のダイスを engine 上限違反として 400 にする', async () => {
    const diceCount = STANDALONE_ROLL_LITERAL_DICE_MAX_COUNT + 1
    const exception = await service.preview({ notation: `${diceCount}d6` }).catch((error: unknown) => error)

    expect(exception).toBeInstanceOf(BadRequestException)
    expectException(exception, BadRequestException, 400, [
      `literal dice count limit exceeded: ${diceCount} > ${STANDALONE_ROLL_LITERAL_DICE_MAX_COUNT}`
    ])
  })

  it('BCDice が式を拒否すると path を含めず invalid notation 配列の 422 にする', async () => {
    diceExecutionService.executeDiceRoll.mockRejectedValue(new Error('BCDice rejected command'))

    const exception = await service.preview({ notation: '1d6' }).catch((error: unknown) => error)

    expect(exception).toBeInstanceOf(UnprocessableEntityException)
    expectException(exception, UnprocessableEntityException, 422, [INVALID_DICE_NOTATION_MESSAGE])
  })

  it('無効な gameSystemId による BCDice rejection も 422 にする', async () => {
    diceExecutionService.executeDiceRoll.mockRejectedValue(new Error('Unknown game system'))

    const exception = await service
      .preview({ notation: '1d6', gameSystemId: 'NotExistingSystem' })
      .catch((error: unknown) => error)

    expectException(exception, UnprocessableEntityException, 422, [INVALID_DICE_NOTATION_MESSAGE])
    expect(diceExecutionService.executeDiceRoll).toHaveBeenCalledWith('1d6', 'NotExistingSystem')
  })
})

function expectException(
  exception: unknown,
  expectedType: typeof BadRequestException | typeof UnprocessableEntityException,
  expectedStatus: number,
  expectedMessages: string[]
): void {
  expect(exception).toBeInstanceOf(expectedType)
  const httpException = exception as HttpException
  expect(httpException.getStatus()).toBe(expectedStatus)
  expect(httpException.getResponse()).toMatchObject({ message: expectedMessages })
}
