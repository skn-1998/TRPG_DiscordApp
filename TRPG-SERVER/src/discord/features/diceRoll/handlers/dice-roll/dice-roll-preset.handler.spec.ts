import { createMockButtonInteraction } from '@discord-test-utils'
import { DiceRollPresetHandler } from './dice-roll-preset.handler'
import { CharacterDiceOrchestratorService } from '../../../../interactions/button/character-dice-orchestrator.service'

describe('DiceRollPresetHandler', () => {
  const mockService = { execute: jest.fn().mockResolvedValue(undefined) }
  let handler: DiceRollPresetHandler

  beforeEach(() => {
    jest.clearAllMocks()
    handler = new DiceRollPresetHandler(mockService as unknown as CharacterDiceOrchestratorService)
  })

  it('button タイプを返す', () => {
    expect(handler.getInteractionType()).toBe('button')
  })

  it('customId パターンが preset-dice*', () => {
    expect(handler.getCustomIdPattern()).toBe('preset-dice*')
  })

  it('execute は委譲先 execute へ interaction を渡す', async () => {
    // Arrange
    const interaction = createMockButtonInteraction({ customId: 'preset-dice*preset1_char123' })
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
    const interaction = createMockButtonInteraction({ customId: 'preset-dice*preset1_char123' })
    // Act & Assert
    await expect(handler.execute(interaction)).rejects.toBe(error)
  })
})
