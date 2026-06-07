import { createMockButtonInteraction } from '@discord-test-utils'
import { DicePageLastHandler } from './dice-page-last.handler'
import { DicePageLastButtonService } from '../../adapters/dice-page-last-button.adapter'

describe('DicePageLastHandler', () => {
  const mockService = { execute: jest.fn().mockResolvedValue(undefined) }
  let handler: DicePageLastHandler

  beforeEach(() => {
    jest.clearAllMocks()
    handler = new DicePageLastHandler(mockService as unknown as DicePageLastButtonService)
  })

  it('button タイプを返す', () => {
    expect(handler.getInteractionType()).toBe('button')
  })

  it('customId パターンが dice-page-last', () => {
    expect(handler.getCustomIdPattern()).toBe('dice-page-last')
  })

  it('execute は委譲先 execute へ interaction を渡す', async () => {
    // Arrange
    const interaction = createMockButtonInteraction({ customId: 'dice-page-last' })
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
    const interaction = createMockButtonInteraction({ customId: 'dice-page-last' })
    // Act & Assert
    await expect(handler.execute(interaction)).rejects.toBe(error)
  })
})
