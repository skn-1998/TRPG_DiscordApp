import { createMockModalInteraction } from '@discord-test-utils'
import { DiceRollModalHandler } from './dice-roll-modal.handler'
import { CustomDiceModalService } from '../../modal/custom-dice-modal.service'

describe('DiceRollModalHandler', () => {
  const mockService = { execute: jest.fn().mockResolvedValue(undefined) }
  let handler: DiceRollModalHandler

  beforeEach(() => {
    jest.clearAllMocks()
    handler = new DiceRollModalHandler(mockService as unknown as CustomDiceModalService)
  })

  it('modal タイプを返す', () => {
    expect(handler.getInteractionType()).toBe('modal')
  })

  it('customId パターンは custom/param ダイスモーダルにマッチする正規表現', () => {
    // Arrange
    const pattern = handler.getCustomIdPattern()
    // Assert
    expect(pattern).toBeInstanceOf(RegExp)
    expect(pattern.test('custom-dice-modal')).toBe(true)
    expect(pattern.test('param-dice-modal*char123')).toBe(true)
    expect(pattern.test('other-modal')).toBe(false)
  })

  it('execute は委譲先 execute へ interaction を渡す', async () => {
    // Arrange
    const interaction = createMockModalInteraction({
      customId: 'custom-dice-modal',
      fields: { 'dice-input': '2d6+3' }
    })
    // Act
    await handler.execute(interaction)
    // Assert
    expect(mockService.execute).toHaveBeenCalledWith(interaction)
    expect(mockService.execute).toHaveBeenCalledTimes(1)
  })

  it('委譲先がrejectした場合はそのエラーを伝播する', async () => {
    // Arrange
    const error = new Error('delegate failed')
    mockService.execute.mockRejectedValueOnce(error)
    const interaction = createMockModalInteraction({ customId: 'custom-dice-modal' })
    // Act & Assert
    await expect(handler.execute(interaction)).rejects.toBe(error)
  })
})
