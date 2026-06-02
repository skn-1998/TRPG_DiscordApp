import { createMockSelectMenuInteraction } from '@discord-test-utils'
import { FlexibleDiceSelectHandler } from './flexible-dice-select.handler'
import { DiceRollLogicService } from '../../button/dice-roll-logic.service'

describe('FlexibleDiceSelectHandler', () => {
  const mockDiceRollLogicService = {
    handleDiceRoll: jest.fn().mockResolvedValue({ success: true, total: 7, diceType: '1d6', details: '1d6 → 5' })
  }
  let handler: FlexibleDiceSelectHandler

  beforeEach(() => {
    jest.clearAllMocks()
    handler = new FlexibleDiceSelectHandler(mockDiceRollLogicService as unknown as DiceRollLogicService)
  })

  it('select タイプを返す', () => {
    // Act & Assert
    expect(handler.getInteractionType()).toBe('select')
  })

  it('customId パターンとして前方一致文字列 "flexible_dice_" を返す', () => {
    // Act
    const pattern = handler.getCustomIdPattern()
    // Assert
    expect(pattern).toBe('flexible_dice_')
  })

  it('通常のダイスタイプ選択時は channelId をパースして handleDiceRoll に委譲する', async () => {
    // Arrange
    const interaction = createMockSelectMenuInteraction({
      customId: 'flexible_dice_channel-789',
      values: ['2d6']
    })
    // Act
    await handler.execute(interaction)
    // Assert: UI更新せず応答し、選択値を request として委譲
    expect(interaction.deferUpdate).toHaveBeenCalledTimes(1)
    expect(mockDiceRollLogicService.handleDiceRoll).toHaveBeenCalledWith(interaction, {
      channelId: 'channel-789',
      diceType: '2d6',
      reason: 'フレキシブルダイス (2d6)',
      userId: interaction.user.id
    })
  })

  it('custom_dice 選択時はモーダルを表示し、handleDiceRoll を呼ばない', async () => {
    // Arrange
    const interaction = createMockSelectMenuInteraction({
      customId: 'flexible_dice_channel-789',
      values: ['custom_dice']
    })
    // Act
    await handler.execute(interaction)
    // Assert
    expect(interaction.showModal).toHaveBeenCalledTimes(1)
    expect(mockDiceRollLogicService.handleDiceRoll).not.toHaveBeenCalled()
    expect(interaction.deferUpdate).not.toHaveBeenCalled()
  })

  it('ダイスロール失敗時はエラーを followUp で通知する', async () => {
    // Arrange
    mockDiceRollLogicService.handleDiceRoll.mockResolvedValueOnce({ success: false, error: 'ダイス式エラー' })
    const interaction = createMockSelectMenuInteraction({
      customId: 'flexible_dice_channel-789',
      values: ['1d100']
    })
    // Act
    await handler.execute(interaction)
    // Assert
    expect(interaction.followUp).toHaveBeenCalledWith({
      content: '❌ ダイスロールに失敗しました: ダイス式エラー',
      ephemeral: true
    })
  })
})
