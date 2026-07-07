import { MessageFlags } from 'discord.js'
import { createMockButtonInteraction } from '@discord-test-utils'
import { DiceGenericHandler } from './dice-generic.handler'
import { DiceRollLogicService } from 'src/discord/services/dice/dice-roll-logic.service'

describe('DiceGenericHandler', () => {
  const mockDiceRollLogicService = {
    handleDiceRoll: jest.fn().mockResolvedValue({ success: true, total: 10, diceType: '1d6', details: '1d6 → 4' })
  }
  let handler: DiceGenericHandler

  beforeEach(() => {
    jest.clearAllMocks()
    handler = new DiceGenericHandler(mockDiceRollLogicService as unknown as DiceRollLogicService)
  })

  it('button タイプを返す', () => {
    // Act & Assert
    expect(handler.getInteractionType()).toBe('button')
  })

  it('customId パターンとして前方一致文字列 "dice_generic_" を返す', () => {
    // Act
    const pattern = handler.getCustomIdPattern()
    // Assert
    expect(pattern).toBe('dice_generic_')
  })

  it('正しい customId なら diceType と channelId をパースして handleDiceRoll に委譲する', async () => {
    // Arrange
    const interaction = createMockButtonInteraction({ customId: 'dice_generic_1d6_channel-789' })
    // Act
    await handler.execute(interaction)
    // Assert: UI更新せず応答し、パース結果を request として委譲
    expect(interaction.deferUpdate).toHaveBeenCalledTimes(1)
    expect(mockDiceRollLogicService.handleDiceRoll).toHaveBeenCalledWith(interaction, {
      channelId: 'channel-789',
      diceType: '1d6',
      reason: '汎用ダイス (1d6)',
      userId: interaction.user.id
    })
  })

  it('customId の要素数が不足する場合はエラー応答し、handleDiceRoll を呼ばない', async () => {
    // Arrange: parts が 4 未満（dice / generic / 1d6 の 3 要素）
    const interaction = createMockButtonInteraction({ customId: 'dice_generic_1d6' })
    // Act
    await handler.execute(interaction)
    // Assert
    expect(interaction.reply).toHaveBeenCalledWith({
      content: '❌ ダイスボタンの形式が不正です。',
      flags: MessageFlags.Ephemeral
    })
    expect(mockDiceRollLogicService.handleDiceRoll).not.toHaveBeenCalled()
    expect(interaction.deferUpdate).not.toHaveBeenCalled()
  })

  it('ダイスロール失敗時はエラーを followUp で通知する', async () => {
    // Arrange
    mockDiceRollLogicService.handleDiceRoll.mockResolvedValueOnce({ success: false, error: 'ダイス式エラー' })
    const interaction = createMockButtonInteraction({ customId: 'dice_generic_2d6_channel-789' })
    // Act
    await handler.execute(interaction)
    // Assert
    expect(interaction.followUp).toHaveBeenCalledWith({
      content: '❌ ダイスロールに失敗しました: ダイス式エラー',
      flags: MessageFlags.Ephemeral
    })
  })

  it('handleDiceRoll が例外を投げてもエラーメッセージを followUp で通知する', async () => {
    // Arrange
    mockDiceRollLogicService.handleDiceRoll.mockRejectedValueOnce(new Error('予期せぬ失敗'))
    const interaction = createMockButtonInteraction({ customId: 'dice_generic_1d20_channel-789' })
    // Act
    await handler.execute(interaction)
    // Assert
    expect(interaction.followUp).toHaveBeenCalledWith({ content: '❌ 予期せぬ失敗', flags: MessageFlags.Ephemeral })
  })
})
