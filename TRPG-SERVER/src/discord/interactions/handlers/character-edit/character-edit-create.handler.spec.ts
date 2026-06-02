import { createMockButtonInteraction } from '@discord-test-utils'
import { CharacterEditCreateHandler } from './character-edit-create.handler'
import { EnhancedCharacterEditService } from '../../../features/characterEdit/enhanced-character-edit.service'

describe('CharacterEditCreateHandler', () => {
  const mockService = { handleButtonInteraction: jest.fn().mockResolvedValue(undefined) }
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
    expect((pattern as RegExp).test('character-create-basic-channel123')).toBe(true)
    expect((pattern as RegExp).test('character-create-cancel-channel123')).toBe(true)
  })

  it('execute は handleButtonInteraction へ interaction を委譲する', async () => {
    const interaction = createMockButtonInteraction({ customId: 'character-create-basic-channel123' })

    await handler.execute(interaction)

    expect(mockService.handleButtonInteraction).toHaveBeenCalledWith(interaction)
    expect(mockService.handleButtonInteraction).toHaveBeenCalledTimes(1)
  })
})
