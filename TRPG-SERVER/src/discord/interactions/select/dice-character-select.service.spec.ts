import { createMockSelectMenuInteraction } from '@discord-test-utils'
import { DiceCharacterSelectService } from './dice-character-select.service'
import { DiceRollPaginationService } from 'src/discord/components/pagination/dice-roll-pagination.service'

// キャラクター選択メニューで選んだキャラに履歴を絞り込むオーケストレーター。
// StringSelectMenu でなければ即 return、customId(*区切り) 検証 → updateCharacter 委譲 →
// createPaginationControls → editReply の順。pagination は副作用境界としてモックし、
// ガード・委譲引数・分岐・異常系を検証する。
type PaginationMock = {
  updateCharacter: jest.Mock
  createPaginationControls: jest.Mock
}

const firstPage = {} as unknown

describe('DiceCharacterSelectService', () => {
  let pagination: PaginationMock
  let service: DiceCharacterSelectService

  beforeEach(() => {
    jest.clearAllMocks()
    pagination = {
      updateCharacter: jest.fn(),
      createPaginationControls: jest.fn().mockResolvedValue([])
    }
    service = new DiceCharacterSelectService(pagination as unknown as DiceRollPaginationService)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('選択キャラ ID で updateCharacter に委譲し、先頭ページを editReply で反映する', async () => {
    // Arrange
    pagination.updateCharacter.mockResolvedValue({ pages: [firstPage], totalPages: 4 })
    pagination.createPaginationControls.mockResolvedValue(['row'])
    const interaction = createMockSelectMenuInteraction({
      customId: 'dice-char-select*msg1*ch1',
      values: ['char-1']
    })

    // Act
    await service.execute(interaction)

    // Assert: customId は '*' 区切りで [_, messageId, channelId]
    expect(interaction.deferUpdate).toHaveBeenCalledTimes(1)
    expect(pagination.updateCharacter).toHaveBeenCalledWith('ch1', 'msg1', 'char-1')
    expect(pagination.createPaginationControls).toHaveBeenCalledWith('msg1', 'ch1', 4)
    expect(interaction.editReply).toHaveBeenCalledWith({ embeds: [firstPage], components: ['row'] })
  })

  it('StringSelectMenu でない場合は何もせず即 return する', async () => {
    // Arrange: 型述語メソッドのため unknown 経由で false に上書き
    const interaction = createMockSelectMenuInteraction({
      customId: 'dice-char-select*msg1*ch1',
      values: ['char-1']
    })
    ;(interaction.isStringSelectMenu as unknown as jest.Mock).mockReturnValue(false)

    // Act
    await service.execute(interaction)

    // Assert
    expect(interaction.deferUpdate).not.toHaveBeenCalled()
    expect(pagination.updateCharacter).not.toHaveBeenCalled()
  })

  it('customId に messageId/channelId が欠けるとき followUp で警告し updateCharacter を呼ばない', async () => {
    // Arrange: '*' 区切りが足りない
    const interaction = createMockSelectMenuInteraction({ customId: 'dice-char-select', values: ['char-1'] })

    // Act
    await service.execute(interaction)

    // Assert
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('エラー'), ephemeral: true })
    )
    expect(pagination.updateCharacter).not.toHaveBeenCalled()
  })

  it('updateCharacter が pages 空を返すとき followUp で通知し editReply しない', async () => {
    // Arrange
    pagination.updateCharacter.mockResolvedValue({ pages: [], totalPages: 0 })
    const interaction = createMockSelectMenuInteraction({
      customId: 'dice-char-select*msg1*ch1',
      values: ['char-1']
    })

    // Act
    await service.execute(interaction)

    // Assert
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('履歴が見つかりませんでした'), ephemeral: true })
    )
    expect(interaction.editReply).not.toHaveBeenCalled()
  })

  it('updateCharacter が null を返すとき followUp で通知し editReply しない', async () => {
    // Arrange
    pagination.updateCharacter.mockResolvedValue(null)
    const interaction = createMockSelectMenuInteraction({
      customId: 'dice-char-select*msg1*ch1',
      values: ['char-1']
    })

    // Act
    await service.execute(interaction)

    // Assert
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('履歴が見つかりませんでした'), ephemeral: true })
    )
    expect(interaction.editReply).not.toHaveBeenCalled()
  })

  it("選択値が 'all' のときも updateCharacter にそのまま委譲する", async () => {
    // Arrange
    pagination.updateCharacter.mockResolvedValue({ pages: [firstPage], totalPages: 1 })
    const interaction = createMockSelectMenuInteraction({
      customId: 'dice-char-select*msg1*ch1',
      values: ['all']
    })

    // Act
    await service.execute(interaction)

    // Assert
    expect(pagination.updateCharacter).toHaveBeenCalledWith('ch1', 'msg1', 'all')
    expect(interaction.editReply).toHaveBeenCalled()
  })

  it('途中で例外が発生しても catch で握り followUp のエラー通知に留める', async () => {
    // Arrange
    pagination.updateCharacter.mockRejectedValueOnce(new Error('boom'))
    const interaction = createMockSelectMenuInteraction({
      customId: 'dice-char-select*msg1*ch1',
      values: ['char-1']
    })

    // Act & Assert
    await expect(service.execute(interaction)).resolves.toBeUndefined()
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('エラー'), ephemeral: true })
    )
  })
})
