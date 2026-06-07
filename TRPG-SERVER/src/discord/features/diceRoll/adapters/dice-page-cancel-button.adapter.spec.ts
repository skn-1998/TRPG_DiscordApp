import { createMockButtonInteraction } from '@discord-test-utils'
import { DiceRollPaginationService } from 'src/discord/features/diceRoll/services/pagination/dice-roll-pagination.service'
import { DicePageCancelButtonService } from './dice-page-cancel-button.adapter'

// DiceRollPaginationService.cancelPagination へ委譲し、成否で deleteReply / followUp を出し分ける。
// deleteReply が失敗したときは editReply によるフォールバック更新へ落ちる、という二段の分岐を検証する。
type PaginationMock = {
  cancelPagination: jest.Mock
}

describe('DicePageCancelButtonService', () => {
  let pagination: PaginationMock
  let service: DicePageCancelButtonService

  beforeEach(() => {
    pagination = { cancelPagination: jest.fn() }
    service = new DicePageCancelButtonService(pagination as unknown as DiceRollPaginationService)
  })

  it('customId から channelId/messageId を取り出して cancelPagination に渡し、成功時は deleteReply する', async () => {
    // Arrange
    pagination.cancelPagination.mockReturnValue(true)
    const interaction = createMockButtonInteraction({ customId: 'dice-page-cancel*msg1*ch1' })

    // Act
    await service.execute(interaction)

    // Assert
    expect(interaction.deferUpdate).toHaveBeenCalledTimes(1)
    expect(pagination.cancelPagination).toHaveBeenCalledWith('ch1', 'msg1')
    expect(interaction.deleteReply).toHaveBeenCalledTimes(1)
    expect(interaction.followUp).not.toHaveBeenCalled()
  })

  it('deleteReply が失敗したら editReply でキャンセル済み表示にフォールバックする', async () => {
    // Arrange
    pagination.cancelPagination.mockReturnValue(true)
    const interaction = createMockButtonInteraction({ customId: 'dice-page-cancel*msg1*ch1' })
    ;(interaction.deleteReply as jest.Mock).mockRejectedValueOnce(new Error('cannot delete'))

    // Act
    await service.execute(interaction)

    // Assert
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('キャンセル'), embeds: [], components: [] })
    )
  })

  it('customId に messageId/channelId が欠けるとき followUp で警告し cancelPagination を呼ばない', async () => {
    // Arrange
    const interaction = createMockButtonInteraction({ customId: 'dice-page-cancel' })

    // Act
    await service.execute(interaction)

    // Assert
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('エラー'), ephemeral: true })
    )
    expect(pagination.cancelPagination).not.toHaveBeenCalled()
    expect(interaction.deleteReply).not.toHaveBeenCalled()
  })

  it('状態が見つからず cancelPagination が false のとき followUp で通知し deleteReply しない', async () => {
    // Arrange
    pagination.cancelPagination.mockReturnValue(false)
    const interaction = createMockButtonInteraction({ customId: 'dice-page-cancel*msg1*ch1' })

    // Act
    await service.execute(interaction)

    // Assert
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('見つかりませんでした'), ephemeral: true })
    )
    expect(interaction.deleteReply).not.toHaveBeenCalled()
  })

  it('deferUpdate で例外が発生しても catch で握り followUp のエラー通知に留める', async () => {
    // Arrange
    const interaction = createMockButtonInteraction({ customId: 'dice-page-cancel*msg1*ch1' })
    ;(interaction.deferUpdate as jest.Mock).mockRejectedValueOnce(new Error('boom'))

    // Act & Assert
    await expect(service.execute(interaction)).resolves.toBeUndefined()
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('エラー'), ephemeral: true })
    )
  })
})
