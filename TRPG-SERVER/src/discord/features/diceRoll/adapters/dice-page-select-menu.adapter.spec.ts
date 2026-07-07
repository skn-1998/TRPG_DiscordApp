import { createMockSelectMenuInteraction } from '@discord-test-utils'
import type { EmbedBuilder } from 'discord.js'
import { MessageFlags } from 'discord.js'
import { DiceRollPaginationService } from 'src/discord/features/diceRoll/services/pagination/dice-roll-pagination.service'
import { DicePageSelectMenuService } from './dice-page-select-menu.adapter'

// セレクトメニューで選んだページ番号へジャンプするオーケストレーター。
// 選択値の検証(空 / prev-25・next-25 / NaN / 数値)で分岐し、有効なときだけ jumpToPage に委譲する。
// pagination の中身は別テスト済みなのでモックし、ここでは分岐と委譲を検証する。
type PaginationMock = {
  jumpToPage: jest.Mock
  getPaginationState: jest.Mock
  createPaginationControls: jest.Mock
}

const dummyPage = {} as EmbedBuilder

describe('DicePageSelectMenuService', () => {
  let pagination: PaginationMock
  let service: DicePageSelectMenuService

  beforeEach(() => {
    pagination = {
      jumpToPage: jest.fn(),
      getPaginationState: jest.fn(),
      createPaginationControls: jest.fn().mockResolvedValue([])
    }
    service = new DicePageSelectMenuService(pagination as unknown as DiceRollPaginationService)
  })

  it('選択されたページ番号で jumpToPage に委譲し、editReply で反映する', async () => {
    // Arrange
    pagination.jumpToPage.mockReturnValue(dummyPage)
    pagination.getPaginationState.mockReturnValue({ totalPages: 7 })
    pagination.createPaginationControls.mockResolvedValue(['row'])
    const interaction = createMockSelectMenuInteraction({ customId: 'dice-page-select*msg1*ch1', values: ['3'] })

    // Act
    await service.execute(interaction)

    // Assert
    expect(interaction.deferUpdate).toHaveBeenCalledTimes(1)
    expect(pagination.jumpToPage).toHaveBeenCalledWith('ch1', 'msg1', 3)
    expect(interaction.editReply).toHaveBeenCalledWith({ embeds: [dummyPage], components: ['row'] })
  })

  it('customId に messageId/channelId が欠けるとき followUp で警告し jumpToPage を呼ばない', async () => {
    // Arrange
    const interaction = createMockSelectMenuInteraction({ customId: 'dice-page-select', values: ['1'] })

    // Act
    await service.execute(interaction)

    // Assert
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('エラー'), flags: MessageFlags.Ephemeral })
    )
    expect(pagination.jumpToPage).not.toHaveBeenCalled()
  })

  it('prev-25 / next-25 は開発中メッセージを返し jumpToPage を呼ばない', async () => {
    // Arrange
    const interaction = createMockSelectMenuInteraction({ customId: 'dice-page-select*msg1*ch1', values: ['next-25'] })

    // Act
    await service.execute(interaction)

    // Assert
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('開発中'), flags: MessageFlags.Ephemeral })
    )
    expect(pagination.jumpToPage).not.toHaveBeenCalled()
  })

  it('数値に変換できない選択値のとき無効なページ番号として followUp し jumpToPage を呼ばない', async () => {
    // Arrange
    const interaction = createMockSelectMenuInteraction({ customId: 'dice-page-select*msg1*ch1', values: ['abc'] })

    // Act
    await service.execute(interaction)

    // Assert
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('無効なページ番号'), flags: MessageFlags.Ephemeral })
    )
    expect(pagination.jumpToPage).not.toHaveBeenCalled()
  })

  it('jumpToPage が null（移動不可）のとき followUp で通知し editReply しない', async () => {
    // Arrange
    pagination.jumpToPage.mockReturnValue(null)
    const interaction = createMockSelectMenuInteraction({ customId: 'dice-page-select*msg1*ch1', values: ['3'] })

    // Act
    await service.execute(interaction)

    // Assert
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('移動できませんでした'),
        flags: MessageFlags.Ephemeral
      })
    )
    expect(interaction.editReply).not.toHaveBeenCalled()
  })

  it('途中で例外が発生しても catch で握り followUp のエラー通知に留める', async () => {
    // Arrange
    pagination.jumpToPage.mockReturnValue(dummyPage)
    pagination.getPaginationState.mockReturnValue({ totalPages: 7 })
    const interaction = createMockSelectMenuInteraction({ customId: 'dice-page-select*msg1*ch1', values: ['3'] })
    ;(interaction.editReply as jest.Mock).mockRejectedValueOnce(new Error('boom'))

    // Act & Assert
    await expect(service.execute(interaction)).resolves.toBeUndefined()
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('エラー'), flags: MessageFlags.Ephemeral })
    )
  })
})
