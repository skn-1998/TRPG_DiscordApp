import { createMockButtonInteraction } from '@discord-test-utils'
import { CharacterEditCreateHandler } from './character-edit-create.handler'
import { EnhancedCharacterEditService } from '../enhanced-character-edit.service'

describe('CharacterEditCreateHandler', () => {
  const mockService = { handleCreate: jest.fn().mockResolvedValue(undefined) }
  let handler: CharacterEditCreateHandler

  beforeEach(() => {
    jest.clearAllMocks()
    handler = new CharacterEditCreateHandler(mockService as unknown as EnhancedCharacterEditService)
  })

  it('button タイプを返す', () => {
    expect(handler.getInteractionType()).toBe('button')
  })

  it('customId パターンが /^character-create-(basic|cancel)-/ で basic/cancel にマッチする', () => {
    const pattern = handler.getCustomIdPattern()
    expect(pattern).toBeInstanceOf(RegExp)
    expect(pattern.test('character-create-basic-channel123')).toBe(true)
    expect(pattern.test('character-create-cancel-channel123')).toBe(true)
  })

  it('execute は handleCreate へ interaction を委譲する', async () => {
    const interaction = createMockButtonInteraction({ customId: 'character-create-basic-channel123' })

    await handler.execute(interaction)

    expect(mockService.handleCreate).toHaveBeenCalledWith(interaction)
    expect(mockService.handleCreate).toHaveBeenCalledTimes(1)
  })
})
