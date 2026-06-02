import { createMockButtonInteraction } from '@discord-test-utils'
import { DicePageNextHandler } from './dice-page-next.handler'
import { DicePageNextButtonService } from '../../../features/diceRoll/adapters/dice-page-next-button.adapter'

describe('DicePageNextHandler', () => {
  const mockService = { execute: jest.fn().mockResolvedValue(undefined) }
  let handler: DicePageNextHandler

  beforeEach(() => {
    jest.clearAllMocks()
    handler = new DicePageNextHandler(mockService as unknown as DicePageNextButtonService)
  })

  it('button タイプを返す', () => {
    expect(handler.getInteractionType()).toBe('button')
  })

  it('customId パターンが dice-page-next', () => {
    expect(handler.getCustomIdPattern()).toBe('dice-page-next')
  })

  it('execute は委譲先 execute へ interaction を渡す', async () => {
    // Arrange
    const interaction = createMockButtonInteraction({ customId: 'dice-page-next' })
    // Act
    await handler.execute(interaction)
    // Assert
    expect(mockService.execute).toHaveBeenCalledWith(interaction)
    expect(mockService.execute).toHaveBeenCalledTimes(1)
  })

  it('委譲先がrejectした場合はそのエラーを伝播する', async () => {
    // Arrange
    const error = new Error('delegate failed')
    mockService.execute.mockRejectedValueOnce(error)
    const interaction = createMockButtonInteraction({ customId: 'dice-page-next' })
    // Act & Assert
    await expect(handler.execute(interaction)).rejects.toBe(error)
  })
})
