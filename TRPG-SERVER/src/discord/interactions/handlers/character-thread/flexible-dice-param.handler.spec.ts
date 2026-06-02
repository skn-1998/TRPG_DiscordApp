import { createMockSelectMenuInteraction } from '@discord-test-utils'
import { FlexibleDiceParamHandler } from './flexible-dice-param.handler'
import { CharacterThreadSelectService } from '../../select/character-thread-select.service'

describe('FlexibleDiceParamHandler', () => {
  const mockService = { execute: jest.fn().mockResolvedValue(undefined) }
  let handler: FlexibleDiceParamHandler

  beforeEach(() => {
    jest.clearAllMocks()
    handler = new FlexibleDiceParamHandler(mockService as unknown as CharacterThreadSelectService)
  })

  it('select タイプを返す', () => {
    // Act & Assert
    expect(handler.getInteractionType()).toBe('select')
  })

  it('customId パターンとして前方一致文字列 "flexible-dice-param*" を返す', () => {
    // Act
    const pattern = handler.getCustomIdPattern()
    // Assert
    expect(pattern).toBe('flexible-dice-param*')
  })

  it('execute は委譲先 execute へ interaction をそのまま渡す', async () => {
    // Arrange
    const interaction = createMockSelectMenuInteraction({
      customId: 'flexible-dice-param*char-123',
      values: ['STR']
    })
    // Act
    await handler.execute(interaction)
    // Assert
    expect(mockService.execute).toHaveBeenCalledWith(interaction)
    expect(mockService.execute).toHaveBeenCalledTimes(1)
  })
})
