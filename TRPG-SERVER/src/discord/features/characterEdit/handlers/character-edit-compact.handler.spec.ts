import { createMockButtonInteraction } from '@discord-test-utils'
import { CharacterEditCompactHandler } from './character-edit-compact.handler'
import { EnhancedCharacterEditService } from '../enhanced-character-edit.service'

describe('CharacterEditCompactHandler', () => {
  const mockService = { handleCompact: jest.fn().mockResolvedValue(undefined) }
  let handler: CharacterEditCompactHandler

  beforeEach(() => {
    jest.clearAllMocks()
    handler = new CharacterEditCompactHandler(mockService as unknown as EnhancedCharacterEditService)
  })

  it('button タイプを返す', () => {
    expect(handler.getInteractionType()).toBe('button')
  })

  it('customId パターンが前方一致 "character-compact-view-"', () => {
    const pattern = handler.getCustomIdPattern()
    expect(pattern).toBe('character-compact-view-')
    expect(handler.getMatchScore('character-compact-view-char123')).toBeGreaterThan(0)
  })

  it('execute は handleCompact へ interaction を委譲する', async () => {
    const interaction = createMockButtonInteraction({ customId: 'character-compact-view-char123' })

    await handler.execute(interaction)

    expect(mockService.handleCompact).toHaveBeenCalledWith(interaction)
    expect(mockService.handleCompact).toHaveBeenCalledTimes(1)
  })
})
