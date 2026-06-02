import { createMockSelectMenuInteraction } from '@discord-test-utils'
import { DiceCharacterSelectHandler } from './dice-character-select.handler'
import { DiceCharacterSelectService } from '../../../features/diceRoll/adapters/dice-character-select.adapter'

describe('DiceCharacterSelectHandler', () => {
  const mockService = { execute: jest.fn().mockResolvedValue(undefined) }
  let handler: DiceCharacterSelectHandler

  beforeEach(() => {
    jest.clearAllMocks()
    handler = new DiceCharacterSelectHandler(mockService as unknown as DiceCharacterSelectService)
  })

  it('select タイプを返す', () => {
    expect(handler.getInteractionType()).toBe('select')
  })

  it('customId パターンが dice-char-select', () => {
    expect(handler.getCustomIdPattern()).toBe('dice-char-select')
  })

  it('execute は委譲先 execute へ interaction を渡す', async () => {
    // Arrange
    const interaction = createMockSelectMenuInteraction({
      customId: 'dice-char-select*message123*channel123',
      values: ['char-id-123']
    })
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
    const interaction = createMockSelectMenuInteraction({
      customId: 'dice-char-select*message123*channel123'
    })
    // Act & Assert
    await expect(handler.execute(interaction)).rejects.toBe(error)
  })
})
