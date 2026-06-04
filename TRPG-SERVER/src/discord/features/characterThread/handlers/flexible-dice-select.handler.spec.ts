// modal の field 構造（custom_id）を検証するため、global jest-setup の discord.js スタブモックを
// 解除し実体を使う（dice-button-ui.service.spec.ts と同方針）。createMockSelectMenuInteraction は
// discord.js を type-only import のため unmock の影響を受けない。
jest.unmock('discord.js')
jest.mock('discord.js', () => jest.requireActual('discord.js'))

import { createMockSelectMenuInteraction } from '@discord-test-utils'
import { FlexibleDiceSelectHandler } from './flexible-dice-select.handler'
import { DiceRollLogicService } from 'src/discord/services/dice/dice-roll-logic.service'

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

  it('S-2: custom_dice モーダルは custom-dice-modal*{channelId} と canonical field(dice-command/dice-comment)で構築する', async () => {
    // 受け手 CustomDiceModalService は custom 経路で `dice-command` と `dice-comment` を読む。
    // 生成側が別名(dice-reason 等)だと getTextInputValue('dice-comment') が throw して送信が失敗するため、
    // field 名を canonical に固定する（S-2 modal field 名統一）。
    // Arrange
    const interaction = createMockSelectMenuInteraction({
      customId: 'flexible_dice_channel-789',
      values: ['custom_dice']
    })
    // Act
    await handler.execute(interaction)
    // Assert
    const modal = (interaction.showModal as jest.Mock).mock.calls[0][0]
    const json = modal.toJSON()
    const fieldIds = json.components.flatMap((row: { components: { custom_id: string }[] }) =>
      row.components.map((c) => c.custom_id)
    )
    expect(json.custom_id).toBe('custom-dice-modal*channel-789')
    expect(fieldIds).toEqual(['dice-command', 'dice-comment'])
    expect(fieldIds).not.toContain('dice-reason')
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
