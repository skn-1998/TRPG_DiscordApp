import { createMockButtonInteraction } from '@discord-test-utils'
import type { EmbedBuilder } from 'discord.js'
import { DiceRollPaginationService } from 'src/discord/features/diceRoll/services/pagination/dice-roll-pagination.service'
import { DicePageNextButtonService } from './dice-page-next-button.adapter'

// このアダプタは DiceRollPaginationService に「ページ計算・状態取得・コントロール生成」を委譲し、
// interaction(I/O 境界)へ deferUpdate / editReply / followUp を呼ぶオーケストレーター。
// 検証対象は「customId から messageId/channelId を取り出し、委譲メソッドへ渡すか」「委譲結果の
// 有無で editReply / followUp のどちらへ分岐するか」。pagination の中身は別テスト済みなのでモックする。
type PaginationMock = {
  updatePage: jest.Mock
  getPaginationState: jest.Mock
  createPaginationControls: jest.Mock
}

// editReply に渡る embeds の中身は問わないため、ダミーの EmbedBuilder として扱う
const dummyPage = {} as EmbedBuilder

describe('DicePageNextButtonService', () => {
  let pagination: PaginationMock
  let service: DicePageNextButtonService

  beforeEach(() => {
    pagination = {
      updatePage: jest.fn(),
      getPaginationState: jest.fn(),
      createPaginationControls: jest.fn().mockResolvedValue([])
    }
    service = new DicePageNextButtonService(pagination as unknown as DiceRollPaginationService)
  })

  it('customId から channelId/messageId を取り出し、updatePage に next 方向を渡す', async () => {
    // Arrange
    pagination.updatePage.mockReturnValue(dummyPage)
    pagination.getPaginationState.mockReturnValue({ totalPages: 3 })
    const interaction = createMockButtonInteraction({ customId: 'dice-page-next*msg1*ch1' })

    // Act
    await service.execute(interaction)

    // Assert
    expect(interaction.deferUpdate).toHaveBeenCalledTimes(1)
    expect(pagination.updatePage).toHaveBeenCalledWith('ch1', 'msg1', 'next')
  })

  it('新しいページが得られたら editReply で embed とコントロールを反映する', async () => {
    // Arrange
    pagination.updatePage.mockReturnValue(dummyPage)
    pagination.getPaginationState.mockReturnValue({ totalPages: 5 })
    pagination.createPaginationControls.mockResolvedValue(['row'])
    const interaction = createMockButtonInteraction({ customId: 'dice-page-next*msg1*ch1' })

    // Act
    await service.execute(interaction)

    // Assert
    expect(pagination.createPaginationControls).toHaveBeenCalledWith('msg1', 'ch1', 5)
    expect(interaction.editReply).toHaveBeenCalledWith({ embeds: [dummyPage], components: ['row'] })
    expect(interaction.followUp).not.toHaveBeenCalled()
  })

  it('customId に messageId/channelId が欠けるとき followUp で警告し委譲しない', async () => {
    // Arrange: '*' で分割しても messageId が空になる customId
    const interaction = createMockButtonInteraction({ customId: 'dice-page-next' })

    // Act
    await service.execute(interaction)

    // Assert
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('エラー'), ephemeral: true })
    )
    expect(pagination.updatePage).not.toHaveBeenCalled()
    expect(interaction.editReply).not.toHaveBeenCalled()
  })

  it('既に最後のページ(updatePage が null)のとき followUp で通知し editReply しない', async () => {
    // Arrange
    pagination.updatePage.mockReturnValue(null)
    const interaction = createMockButtonInteraction({ customId: 'dice-page-next*msg1*ch1' })

    // Act
    await service.execute(interaction)

    // Assert
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('最後のページ'), ephemeral: true })
    )
    expect(interaction.editReply).not.toHaveBeenCalled()
  })

  it('ページ状態の取得に失敗(getPaginationState が null)したら followUp で通知し editReply しない', async () => {
    // Arrange
    pagination.updatePage.mockReturnValue(dummyPage)
    pagination.getPaginationState.mockReturnValue(null)
    const interaction = createMockButtonInteraction({ customId: 'dice-page-next*msg1*ch1' })

    // Act
    await service.execute(interaction)

    // Assert
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('ページ状態'), ephemeral: true })
    )
    expect(interaction.editReply).not.toHaveBeenCalled()
  })

  it('途中で例外が発生しても catch で握り、followUp のエラー通知に留める', async () => {
    // Arrange: editReply 直前まで進めてから editReply で投げさせる
    pagination.updatePage.mockReturnValue(dummyPage)
    pagination.getPaginationState.mockReturnValue({ totalPages: 2 })
    const interaction = createMockButtonInteraction({ customId: 'dice-page-next*msg1*ch1' })
    ;(interaction.editReply as jest.Mock).mockRejectedValueOnce(new Error('boom'))

    // Act & Assert: 例外を外へ漏らさない
    await expect(service.execute(interaction)).resolves.toBeUndefined()
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('エラー'), ephemeral: true })
    )
  })
})
