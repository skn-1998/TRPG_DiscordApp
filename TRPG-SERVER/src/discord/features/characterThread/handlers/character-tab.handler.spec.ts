import { createMockButtonInteraction } from '@discord-test-utils'
import { CharacterTabHandler } from './character-tab.handler'
import { CharacterTabButtonsService } from '../character-tab-buttons.service'

describe('CharacterTabHandler', () => {
  const mockService = { execute: jest.fn().mockResolvedValue(undefined) }
  let handler: CharacterTabHandler

  beforeEach(() => {
    jest.clearAllMocks()
    handler = new CharacterTabHandler(mockService as unknown as CharacterTabButtonsService)
  })

  it('button タイプを返す', () => {
    // Act & Assert
    expect(handler.getInteractionType()).toBe('button')
  })

  it('customId パターンとして前方一致文字列 "character-tab*" を返す', () => {
    // Act
    const pattern = handler.getCustomIdPattern()
    // Assert
    expect(pattern).toBe('character-tab*')
  })

  it('execute は委譲先 execute へ interaction をそのまま渡す', async () => {
    // Arrange
    const interaction = createMockButtonInteraction({ customId: 'character-tab*channel-123*status' })
    // Act
    await handler.execute(interaction)
    // Assert
    expect(mockService.execute).toHaveBeenCalledWith(interaction)
    expect(mockService.execute).toHaveBeenCalledTimes(1)
  })
})
