import { createMockButtonInteraction } from '@discord-test-utils'
import { DiceRollCustomHandler } from './dice-roll-custom.handler'
import { CharacterDiceOrchestratorService } from '../../services/character-dice-orchestrator.service'

describe('DiceRollCustomHandler', () => {
  const mockService = { execute: jest.fn().mockResolvedValue(undefined) }
  let handler: DiceRollCustomHandler

  beforeEach(() => {
    jest.clearAllMocks()
    handler = new DiceRollCustomHandler(mockService as unknown as CharacterDiceOrchestratorService)
  })

  it('button タイプを返す', () => {
    expect(handler.getInteractionType()).toBe('button')
  })

  it('customId パターンが roll*custom', () => {
    expect(handler.getCustomIdPattern()).toBe('roll*custom')
  })

  it('execute は委譲先 execute へ interaction を渡す', async () => {
    // Arrange
    const interaction = createMockButtonInteraction({ customId: 'roll*custom' })
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
    const interaction = createMockButtonInteraction({ customId: 'roll*custom' })
    // Act & Assert
    await expect(handler.execute(interaction)).rejects.toBe(error)
  })
})
