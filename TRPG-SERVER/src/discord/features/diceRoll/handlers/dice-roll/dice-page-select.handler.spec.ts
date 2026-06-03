import { createMockSelectMenuInteraction } from '@discord-test-utils'
import { DicePageSelectHandler } from './dice-page-select.handler'
import { DicePageSelectMenuService } from '../../adapters/dice-page-select-menu.adapter'

describe('DicePageSelectHandler', () => {
  const mockService = { execute: jest.fn().mockResolvedValue(undefined) }
  let handler: DicePageSelectHandler

  beforeEach(() => {
    jest.clearAllMocks()
    handler = new DicePageSelectHandler(mockService as unknown as DicePageSelectMenuService)
  })

  it('select タイプを返す', () => {
    expect(handler.getInteractionType()).toBe('select')
  })

  it('customId パターンが dice-page-select', () => {
    expect(handler.getCustomIdPattern()).toBe('dice-page-select')
  })

  it('execute は委譲先 execute へ interaction を渡す', async () => {
    // Arrange
    const interaction = createMockSelectMenuInteraction({
      customId: 'dice-page-select',
      values: ['2']
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
    const interaction = createMockSelectMenuInteraction({ customId: 'dice-page-select' })
    // Act & Assert
    await expect(handler.execute(interaction)).rejects.toBe(error)
  })
})
