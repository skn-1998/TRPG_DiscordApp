import { createMockButtonInteraction } from '@discord-test-utils'
import { DicePageFirstHandler } from './dice-page-first.handler'
import { DicePageFirstButtonService } from '../../../features/diceRoll/adapters/dice-page-first-button.adapter'

describe('DicePageFirstHandler', () => {
  const mockService = { execute: jest.fn().mockResolvedValue(undefined) }
  let handler: DicePageFirstHandler

  beforeEach(() => {
    jest.clearAllMocks()
    handler = new DicePageFirstHandler(mockService as unknown as DicePageFirstButtonService)
  })

  it('button タイプを返す', () => {
    expect(handler.getInteractionType()).toBe('button')
  })

  it('customId パターンが dice-page-first', () => {
    expect(handler.getCustomIdPattern()).toBe('dice-page-first')
  })

  it('execute は委譲先 execute へ interaction を渡す', async () => {
    // Arrange
    const interaction = createMockButtonInteraction({ customId: 'dice-page-first' })
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
    const interaction = createMockButtonInteraction({ customId: 'dice-page-first' })
    // Act & Assert
    await expect(handler.execute(interaction)).rejects.toBe(error)
  })
})
