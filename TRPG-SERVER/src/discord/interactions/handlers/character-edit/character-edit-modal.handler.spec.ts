import { createMockModalInteraction } from '@discord-test-utils'
import { CharacterEditModalHandler } from './character-edit-modal.handler'
import { EnhancedCharacterEditService } from '../../../features/characterEdit/enhanced-character-edit.service'

describe('CharacterEditModalHandler', () => {
  const mockService = { handleModalSubmitInteraction: jest.fn().mockResolvedValue(undefined) }
  let handler: CharacterEditModalHandler

  beforeEach(() => {
    jest.clearAllMocks()
    handler = new CharacterEditModalHandler(mockService as unknown as EnhancedCharacterEditService)
  })

  it('modal タイプを返す', () => {
    expect(handler.getInteractionType()).toBe('modal')
  })

  it('customId パターンが /^char-edit(-modal)?-/ で char-edit-/char-edit-modal- 双方にマッチする', () => {
    const pattern = handler.getCustomIdPattern()
    expect(pattern).toBeInstanceOf(RegExp)
    expect(pattern.test('char-edit-status-hp-char123')).toBe(true)
    expect(pattern.test('char-edit-modal-char123')).toBe(true)
  })

  it('execute は handleModalSubmitInteraction へ interaction を委譲する', async () => {
    const interaction = createMockModalInteraction({ customId: 'char-edit-status-hp-char123' })

    await handler.execute(interaction)

    expect(mockService.handleModalSubmitInteraction).toHaveBeenCalledWith(interaction)
    expect(mockService.handleModalSubmitInteraction).toHaveBeenCalledTimes(1)
  })
})
