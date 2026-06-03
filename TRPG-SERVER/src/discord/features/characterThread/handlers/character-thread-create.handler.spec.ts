import { createMockSelectMenuInteraction } from '@discord-test-utils'
import { CharacterThreadCreateHandler } from './character-thread-create.handler'
import { CharacterThreadSelectService } from '../services/character-thread-select.service'

describe('CharacterThreadCreateHandler', () => {
  const mockService = { execute: jest.fn().mockResolvedValue(undefined) }
  let handler: CharacterThreadCreateHandler

  beforeEach(() => {
    jest.clearAllMocks()
    handler = new CharacterThreadCreateHandler(mockService as unknown as CharacterThreadSelectService)
  })

  it('select タイプを返す', () => {
    // Act & Assert
    expect(handler.getInteractionType()).toBe('select')
  })

  it('customId パターンとして文字列 "character-thread-create-select" を返す', () => {
    // Act
    const pattern = handler.getCustomIdPattern()
    // Assert
    expect(pattern).toBe('character-thread-create-select')
  })

  it('execute は委譲先 execute へ interaction をそのまま渡す', async () => {
    // Arrange
    const interaction = createMockSelectMenuInteraction({
      customId: 'character-thread-create-select',
      values: ['char-id-abc']
    })
    // Act
    await handler.execute(interaction)
    // Assert
    expect(mockService.execute).toHaveBeenCalledWith(interaction)
    expect(mockService.execute).toHaveBeenCalledTimes(1)
  })
})
