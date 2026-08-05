import { createMockSelectMenuInteraction } from '@discord-test-utils'
import { CharacterEditFieldHandler } from './character-edit-field.handler'
import { EnhancedCharacterEditService } from '../enhanced-character-edit.service'

describe('CharacterEditFieldHandler', () => {
  const mockService = { handleFieldSelect: jest.fn().mockResolvedValue(undefined) }
  let handler: CharacterEditFieldHandler

  beforeEach(() => {
    jest.clearAllMocks()
    handler = new CharacterEditFieldHandler(mockService as unknown as EnhancedCharacterEditService)
  })

  it('select タイプを返す', () => {
    expect(handler.getInteractionType()).toBe('select')
  })

  it('customId パターンが前方一致 "character-field-"', () => {
    const pattern = handler.getCustomIdPattern()
    expect(pattern).toBe('character-field-')
    expect(handler.getMatchScore('character-field-status-char123')).toBeGreaterThan(0)
  })

  it('execute は handleFieldSelect へ interaction を委譲する', async () => {
    const interaction = createMockSelectMenuInteraction({ customId: 'character-field-status-char123' })

    await handler.execute(interaction)

    expect(mockService.handleFieldSelect).toHaveBeenCalledWith(interaction)
    expect(mockService.handleFieldSelect).toHaveBeenCalledTimes(1)
  })
})
