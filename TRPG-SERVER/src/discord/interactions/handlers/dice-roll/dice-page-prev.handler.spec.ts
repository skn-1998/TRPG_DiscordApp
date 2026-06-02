import { createMockButtonInteraction } from '@discord-test-utils'
import { DicePagePrevHandler } from './dice-page-prev.handler'
import { DicePagePrevButtonService } from '../../../features/diceRoll/adapters/dice-page-prev-button.adapter'

describe('DicePagePrevHandler', () => {
  const mockService = { execute: jest.fn().mockResolvedValue(undefined) }
  let handler: DicePagePrevHandler

  beforeEach(() => {
    jest.clearAllMocks()
    handler = new DicePagePrevHandler(mockService as unknown as DicePagePrevButtonService)
  })

  it('button タイプを返す', () => {
    expect(handler.getInteractionType()).toBe('button')
  })

  it('customId パターンが dice-page-prev', () => {
    expect(handler.getCustomIdPattern()).toBe('dice-page-prev')
  })

  it('execute は委譲先 execute へ interaction を渡す', async () => {
    // Arrange
    const interaction = createMockButtonInteraction({ customId: 'dice-page-prev' })
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
    const interaction = createMockButtonInteraction({ customId: 'dice-page-prev' })
    // Act & Assert
    await expect(handler.execute(interaction)).rejects.toBe(error)
  })
})
