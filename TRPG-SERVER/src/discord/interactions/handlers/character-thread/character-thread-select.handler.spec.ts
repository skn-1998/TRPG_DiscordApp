import { createMockSelectMenuInteraction } from '@discord-test-utils'
import { CharacterThreadSelectHandler } from './character-thread-select.handler'
import { CharacterThreadSelectService } from '../../select/character-thread-select.service'

describe('CharacterThreadSelectHandler', () => {
  const mockService = { execute: jest.fn().mockResolvedValue(undefined) }
  let handler: CharacterThreadSelectHandler

  beforeEach(() => {
    jest.clearAllMocks()
    handler = new CharacterThreadSelectHandler(mockService as unknown as CharacterThreadSelectService)
  })

  it('select タイプを返す', () => {
    // Act & Assert
    expect(handler.getInteractionType()).toBe('select')
  })

  it('customId パターン（正規表現）が 3 種の customId にマッチする', () => {
    // Act
    const pattern = handler.getCustomIdPattern()
    // Assert
    expect(pattern).toBeInstanceOf(RegExp)
    const regExp = pattern as RegExp
    expect(regExp.test('character-thread-select')).toBe(true)
    expect(regExp.test('character-thread-select-with-thread')).toBe(true)
    expect(regExp.test('character-thread-select-current')).toBe(true)
  })

  it('customId パターン（正規表現）は無関係な customId にマッチしない', () => {
    // Act
    const regExp = handler.getCustomIdPattern() as RegExp
    // Assert
    expect(regExp.test('character-thread-create-select')).toBe(false)
    expect(regExp.test('character-thread-select-unknown')).toBe(false)
  })

  it('execute は委譲先 execute へ interaction をそのまま渡す', async () => {
    // Arrange
    const interaction = createMockSelectMenuInteraction({
      customId: 'character-thread-select',
      values: ['char-id-abc']
    })
    // Act
    await handler.execute(interaction)
    // Assert
    expect(mockService.execute).toHaveBeenCalledWith(interaction)
    expect(mockService.execute).toHaveBeenCalledTimes(1)
  })
})
