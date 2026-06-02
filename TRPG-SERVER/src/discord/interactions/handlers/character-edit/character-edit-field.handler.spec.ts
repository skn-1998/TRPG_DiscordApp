import { createMockSelectMenuInteraction } from '@discord-test-utils'
import { CharacterEditFieldHandler } from './character-edit-field.handler'
import { EnhancedCharacterEditService } from '../../../features/characterEdit/enhanced-character-edit.service'

describe('CharacterEditFieldHandler', () => {
  const mockService = { handleSelectMenuInteraction: jest.fn().mockResolvedValue(undefined) }
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
    expect(handler.matches('character-field-status-char123')).toBe(true)
  })

  it('execute は handleSelectMenuInteraction へ interaction を委譲する', async () => {
    const interaction = createMockSelectMenuInteraction({ customId: 'character-field-status-char123' })

    await handler.execute(interaction)

    expect(mockService.handleSelectMenuInteraction).toHaveBeenCalledWith(interaction)
    expect(mockService.handleSelectMenuInteraction).toHaveBeenCalledTimes(1)
  })
})
