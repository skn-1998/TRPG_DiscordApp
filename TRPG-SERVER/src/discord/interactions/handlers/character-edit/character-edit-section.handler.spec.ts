import { createMockSelectMenuInteraction } from '@discord-test-utils'
import { CharacterEditSectionHandler } from './character-edit-section.handler'
import { EnhancedCharacterEditService } from '../../../features/characterEdit/enhanced-character-edit.service'

describe('CharacterEditSectionHandler', () => {
  const mockService = { handleSelectMenuInteraction: jest.fn().mockResolvedValue(undefined) }
  let handler: CharacterEditSectionHandler

  beforeEach(() => {
    jest.clearAllMocks()
    handler = new CharacterEditSectionHandler(mockService as unknown as EnhancedCharacterEditService)
  })

  it('select タイプを返す', () => {
    expect(handler.getInteractionType()).toBe('select')
  })

  it('customId パターンが /^character-(edit-section|section-select)-/ で両系統にマッチする', () => {
    const pattern = handler.getCustomIdPattern()
    expect(pattern).toBeInstanceOf(RegExp)
    expect((pattern as RegExp).test('character-edit-section-char123')).toBe(true)
    expect((pattern as RegExp).test('character-section-select-char123')).toBe(true)
  })

  it('execute は handleSelectMenuInteraction へ interaction を委譲する', async () => {
    const interaction = createMockSelectMenuInteraction({ customId: 'character-edit-section-char123' })

    await handler.execute(interaction)

    expect(mockService.handleSelectMenuInteraction).toHaveBeenCalledWith(interaction)
    expect(mockService.handleSelectMenuInteraction).toHaveBeenCalledTimes(1)
  })
})
