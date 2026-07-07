import { MessageFlags } from 'discord.js'
import { createMockSelectMenuInteraction } from '@discord-test-utils'
import { DiceRollPaginationService } from 'src/discord/features/diceRoll/services/pagination/dice-roll-pagination.service'
import { DiceCharacterSelectService } from './dice-character-select.adapter'

// キャラクター選択メニューで選んだキャラに履歴を絞り込むオーケストレーター。
// StringSelectMenu でなければ即 return し、customId 検証 → updateCharacter 委譲 → editReply の順に進む。
// pagination の中身は別テスト済みなのでモックし、ここではガード・委譲・分岐を検証する。
type PaginationMock = {
  updateCharacter: jest.Mock
  createPaginationControls: jest.Mock
}

const firstPage = {} as unknown

describe('DiceCharacterSelectService', () => {
  let pagination: PaginationMock
  let service: DiceCharacterSelectService

  beforeEach(() => {
    pagination = {
      updateCharacter: jest.fn(),
      createPaginationControls: jest.fn().mockResolvedValue([])
    }
    service = new DiceCharacterSelectService(pagination as unknown as DiceRollPaginationService)
  })

  it('選択されたキャラ ID で updateCharacter に委譲し、先頭ページを editReply で反映する', async () => {
    // Arrange
    pagination.updateCharacter.mockResolvedValue({ pages: [firstPage], totalPages: 4 })
    pagination.createPaginationControls.mockResolvedValue(['row'])
    const interaction = createMockSelectMenuInteraction({
      customId: 'dice-char-select*msg1*ch1',
      values: ['char-1']
    })

    // Act
    await service.execute(interaction)

    // Assert
    expect(interaction.deferUpdate).toHaveBeenCalledTimes(1)
    expect(pagination.updateCharacter).toHaveBeenCalledWith('ch1', 'msg1', 'char-1')
    expect(pagination.createPaginationControls).toHaveBeenCalledWith('msg1', 'ch1', 4)
    expect(interaction.editReply).toHaveBeenCalledWith({ embeds: [firstPage], components: ['row'] })
  })

  it('StringSelectMenu でない場合は何もせず即 return する', async () => {
    // Arrange: isStringSelectMenu を false に上書きしてガードを発火させる
    // （型述語メソッドのため jest.Mock への直接キャストは不可。unknown を経由する）
    const interaction = createMockSelectMenuInteraction({ customId: 'dice-char-select*msg1*ch1', values: ['char-1'] })
    ;(interaction.isStringSelectMenu as unknown as jest.Mock).mockReturnValue(false)

    // Act
    await service.execute(interaction)

    // Assert
    expect(interaction.deferUpdate).not.toHaveBeenCalled()
    expect(pagination.updateCharacter).not.toHaveBeenCalled()
  })

  it('customId に messageId/channelId が欠けるとき followUp で警告し updateCharacter を呼ばない', async () => {
    // Arrange
    const interaction = createMockSelectMenuInteraction({ customId: 'dice-char-select', values: ['char-1'] })

    // Act
    await service.execute(interaction)

    // Assert
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('エラー'), flags: MessageFlags.Ephemeral })
    )
    expect(pagination.updateCharacter).not.toHaveBeenCalled()
  })

  it('履歴が見つからない（updateCharacter が pages 空）とき followUp で通知し editReply しない', async () => {
    // Arrange
    pagination.updateCharacter.mockResolvedValue({ pages: [], totalPages: 0 })
    const interaction = createMockSelectMenuInteraction({ customId: 'dice-char-select*msg1*ch1', values: ['char-1'] })

    // Act
    await service.execute(interaction)

    // Assert
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('履歴が見つかりませんでした'),
        flags: MessageFlags.Ephemeral
      })
    )
    expect(interaction.editReply).not.toHaveBeenCalled()
  })

  it('updateCharacter が null を返すとき followUp で通知し editReply しない', async () => {
    // Arrange
    pagination.updateCharacter.mockResolvedValue(null)
    const interaction = createMockSelectMenuInteraction({ customId: 'dice-char-select*msg1*ch1', values: ['char-1'] })

    // Act
    await service.execute(interaction)

    // Assert
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('履歴が見つかりませんでした'),
        flags: MessageFlags.Ephemeral
      })
    )
    expect(interaction.editReply).not.toHaveBeenCalled()
  })

  it('途中で例外が発生しても catch で握り followUp のエラー通知に留める', async () => {
    // Arrange
    pagination.updateCharacter.mockRejectedValueOnce(new Error('boom'))
    const interaction = createMockSelectMenuInteraction({ customId: 'dice-char-select*msg1*ch1', values: ['char-1'] })

    // Act & Assert
    await expect(service.execute(interaction)).resolves.toBeUndefined()
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('エラー'), flags: MessageFlags.Ephemeral })
    )
  })
})
