import { createMockButtonInteraction } from '@discord-test-utils'
import { DicePageCancelHandler } from './dice-page-cancel.handler'
import { DicePageCancelButtonService } from '../../../features/diceRoll/adapters/dice-page-cancel-button.adapter'

describe('DicePageCancelHandler', () => {
  const mockService = { execute: jest.fn().mockResolvedValue(undefined) }
  let handler: DicePageCancelHandler

  beforeEach(() => {
    jest.clearAllMocks()
    handler = new DicePageCancelHandler(mockService as unknown as DicePageCancelButtonService)
  })

  it('button タイプを返す', () => {
    expect(handler.getInteractionType()).toBe('button')
  })

  it('customId パターンが dice-page-cancel', () => {
    expect(handler.getCustomIdPattern()).toBe('dice-page-cancel')
  })

  it('execute は委譲先 execute へ interaction を渡す', async () => {
    // Arrange
    const interaction = createMockButtonInteraction({ customId: 'dice-page-cancel' })
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
    const interaction = createMockButtonInteraction({ customId: 'dice-page-cancel' })
    // Act & Assert
    await expect(handler.execute(interaction)).rejects.toBe(error)
  })
})
