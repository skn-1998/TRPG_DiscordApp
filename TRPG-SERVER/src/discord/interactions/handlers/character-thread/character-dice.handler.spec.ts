import { createMockButtonInteraction } from '@discord-test-utils'
import { CharacterDiceHandler } from './character-dice.handler'
import { CharacterDiceButtonsService } from '../../button/character-dice-buttons.service'

describe('CharacterDiceHandler', () => {
  const mockService = { execute: jest.fn().mockResolvedValue(undefined) }
  let handler: CharacterDiceHandler

  beforeEach(() => {
    jest.clearAllMocks()
    handler = new CharacterDiceHandler(mockService as unknown as CharacterDiceButtonsService)
  })

  it('button タイプを返す', () => {
    // Act & Assert
    expect(handler.getInteractionType()).toBe('button')
  })

  it('customId パターンとして文字列 "character-dice" を返す', () => {
    // Act
    const pattern = handler.getCustomIdPattern()
    // Assert
    expect(pattern).toBe('character-dice')
  })

  it('execute は委譲先 execute へ interaction をそのまま渡す', async () => {
    // Arrange
    const interaction = createMockButtonInteraction({ customId: 'character-dice*roll*char-123' })
    // Act
    await handler.execute(interaction)
    // Assert
    expect(mockService.execute).toHaveBeenCalledWith(interaction)
    expect(mockService.execute).toHaveBeenCalledTimes(1)
  })
})
