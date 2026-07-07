import { createMockButtonInteraction } from '@discord-test-utils'
import type { EmbedBuilder } from 'discord.js'
import { MessageFlags } from 'discord.js'
import { DiceRollPaginationService } from 'src/discord/features/diceRoll/services/pagination/dice-roll-pagination.service'
import { DicePageLastButtonService } from './dice-page-last-button.adapter'

// DiceRollPaginationService へ「末尾ページ計算・状態取得・コントロール生成」を委譲するオーケストレーター。
// pagination の中身は別テスト済みなのでモックし、ここでは委譲と分岐(editReply / followUp)を検証する。
type PaginationMock = {
  updatePage: jest.Mock
  getPaginationState: jest.Mock
  createPaginationControls: jest.Mock
}

const dummyPage = {} as EmbedBuilder

describe('DicePageLastButtonService', () => {
  let pagination: PaginationMock
  let service: DicePageLastButtonService

  beforeEach(() => {
    pagination = {
      updatePage: jest.fn(),
      getPaginationState: jest.fn(),
      createPaginationControls: jest.fn().mockResolvedValue([])
    }
    service = new DicePageLastButtonService(pagination as unknown as DiceRollPaginationService)
  })

  it('customId から channelId/messageId を取り出し、updatePage に last 方向を渡す', async () => {
    // Arrange
    pagination.updatePage.mockReturnValue(dummyPage)
    pagination.getPaginationState.mockReturnValue({ totalPages: 3 })
    const interaction = createMockButtonInteraction({ customId: 'dice-page-last*msg1*ch1' })

    // Act
    await service.execute(interaction)

    // Assert
    expect(interaction.deferUpdate).toHaveBeenCalledTimes(1)
    expect(pagination.updatePage).toHaveBeenCalledWith('ch1', 'msg1', 'last')
  })

  it('新しいページが得られたら editReply で embed とコントロールを反映する', async () => {
    // Arrange
    pagination.updatePage.mockReturnValue(dummyPage)
    pagination.getPaginationState.mockReturnValue({ totalPages: 5 })
    pagination.createPaginationControls.mockResolvedValue(['row'])
    const interaction = createMockButtonInteraction({ customId: 'dice-page-last*msg1*ch1' })

    // Act
    await service.execute(interaction)

    // Assert
    expect(pagination.createPaginationControls).toHaveBeenCalledWith('msg1', 'ch1', 5)
    expect(interaction.editReply).toHaveBeenCalledWith({ embeds: [dummyPage], components: ['row'] })
    expect(interaction.followUp).not.toHaveBeenCalled()
  })

  it('customId に messageId/channelId が欠けるとき followUp で警告し委譲しない', async () => {
    // Arrange
    const interaction = createMockButtonInteraction({ customId: 'dice-page-last' })

    // Act
    await service.execute(interaction)

    // Assert
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('エラー'), flags: MessageFlags.Ephemeral })
    )
    expect(pagination.updatePage).not.toHaveBeenCalled()
    expect(interaction.editReply).not.toHaveBeenCalled()
  })

  it('既に最後のページ(updatePage が null)のとき followUp で通知し editReply しない', async () => {
    // Arrange
    pagination.updatePage.mockReturnValue(null)
    const interaction = createMockButtonInteraction({ customId: 'dice-page-last*msg1*ch1' })

    // Act
    await service.execute(interaction)

    // Assert
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('既に最後のページ'), flags: MessageFlags.Ephemeral })
    )
    expect(interaction.editReply).not.toHaveBeenCalled()
  })

  it('ページ状態の取得に失敗(getPaginationState が null)したら followUp で通知し editReply しない', async () => {
    // Arrange
    pagination.updatePage.mockReturnValue(dummyPage)
    pagination.getPaginationState.mockReturnValue(null)
    const interaction = createMockButtonInteraction({ customId: 'dice-page-last*msg1*ch1' })

    // Act
    await service.execute(interaction)

    // Assert
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('ページ状態'), flags: MessageFlags.Ephemeral })
    )
    expect(interaction.editReply).not.toHaveBeenCalled()
  })

  it('途中で例外が発生しても catch で握り、followUp のエラー通知に留める', async () => {
    // Arrange
    pagination.updatePage.mockReturnValue(dummyPage)
    pagination.getPaginationState.mockReturnValue({ totalPages: 2 })
    const interaction = createMockButtonInteraction({ customId: 'dice-page-last*msg1*ch1' })
    ;(interaction.editReply as jest.Mock).mockRejectedValueOnce(new Error('boom'))

    // Act & Assert
    await expect(service.execute(interaction)).resolves.toBeUndefined()
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('エラー'), flags: MessageFlags.Ephemeral })
    )
  })
})
