import { createMockButtonInteraction } from '@discord-test-utils'
import { CharacterEditRefreshHandler } from './character-edit-refresh.handler'
import { EnhancedCharacterEditService } from '../enhanced-character-edit.service'

describe('CharacterEditRefreshHandler', () => {
  const mockService = { handleRefresh: jest.fn().mockResolvedValue(undefined) }
  let handler: CharacterEditRefreshHandler

  beforeEach(() => {
    jest.clearAllMocks()
    handler = new CharacterEditRefreshHandler(mockService as unknown as EnhancedCharacterEditService)
  })

  it('button タイプを返す', () => {
    expect(handler.getInteractionType()).toBe('button')
  })

  it('customId パターンが前方一致 "character-refresh-"', () => {
    const pattern = handler.getCustomIdPattern()
    expect(pattern).toBe('character-refresh-')
    expect(handler.getMatchScore('character-refresh-char123')).toBeGreaterThan(0)
  })

  it('execute は handleRefresh へ interaction を委譲する', async () => {
    const interaction = createMockButtonInteraction({ customId: 'character-refresh-char123' })

    await handler.execute(interaction)

    expect(mockService.handleRefresh).toHaveBeenCalledWith(interaction)
    expect(mockService.handleRefresh).toHaveBeenCalledTimes(1)
  })
})
