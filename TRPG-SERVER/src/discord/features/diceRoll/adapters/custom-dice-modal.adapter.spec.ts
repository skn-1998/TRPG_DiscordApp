// dice() は bcdice を介する副作用境界なのでモックする。検証対象は
// 「入力値のバリデーション分岐」「正規化したコマンドを dice に渡すか」「コメント整形」「異常系の reply」。
jest.mock('src/discord/utils/dice')

import { createMockModalInteraction } from '@discord-test-utils'
import dice from 'src/discord/utils/dice'
import { CustomDiceModalService } from './custom-dice-modal.adapter'

const mockDice = dice as jest.MockedFunction<typeof dice>

describe('CustomDiceModalService', () => {
  let service: CustomDiceModalService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new CustomDiceModalService()
  })

  it('有効なダイス式を正規化して dice に渡し、結果をそのまま reply する', async () => {
    // Arrange
    mockDice.mockResolvedValue({ text: '(2D6+3) ＞ 10' } as Awaited<ReturnType<typeof dice>>)
    const interaction = createMockModalInteraction({
      customId: 'custom-dice-modal',
      fields: { 'dice-command': '2d6+3', 'dice-comment': '' }
    })

    // Act
    await service.execute(interaction)

    // Assert: 正規化後の "2d6+3" が渡る（バリデータは numDdice/size を組み直す）
    expect(mockDice).toHaveBeenCalledWith('2d6+3')
    expect(interaction.reply).toHaveBeenCalledWith({ content: '(2D6+3) ＞ 10' })
  })

  it('コメントがある場合は【コメント】を結果の先頭に付与して reply する', async () => {
    // Arrange
    mockDice.mockResolvedValue({ text: '(1D100) ＞ 50' } as Awaited<ReturnType<typeof dice>>)
    const interaction = createMockModalInteraction({
      customId: 'custom-dice-modal',
      fields: { 'dice-command': '1d100', 'dice-comment': '幸運判定' }
    })

    // Act
    await service.execute(interaction)

    // Assert
    expect(interaction.reply).toHaveBeenCalledWith({ content: '【幸運判定】 (1D100) ＞ 50' })
  })

  it('無効なダイスコマンドのときエラーメッセージを返し dice を呼ばない', async () => {
    // Arrange: パターンに合致しない入力
    const interaction = createMockModalInteraction({
      customId: 'custom-dice-modal',
      fields: { 'dice-command': 'not-a-dice', 'dice-comment': '' }
    })

    // Act
    await service.execute(interaction)

    // Assert
    expect(mockDice).not.toHaveBeenCalled()
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('無効なダイスコマンド'), ephemeral: true })
    )
  })

  it('ダイス個数が上限(100)を超える式は無効として弾き dice を呼ばない', async () => {
    // Arrange: numDice > 100 はバリデータで null
    const interaction = createMockModalInteraction({
      customId: 'custom-dice-modal',
      fields: { 'dice-command': '101d6', 'dice-comment': '' }
    })

    // Act
    await service.execute(interaction)

    // Assert
    expect(mockDice).not.toHaveBeenCalled()
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('無効なダイスコマンド'), ephemeral: true })
    )
  })

  it('dice の結果が空(text なし)のときロール失敗メッセージを返す', async () => {
    // Arrange
    mockDice.mockResolvedValue(null as Awaited<ReturnType<typeof dice>>)
    const interaction = createMockModalInteraction({
      customId: 'custom-dice-modal',
      fields: { 'dice-command': '1d6', 'dice-comment': '' }
    })

    // Act
    await service.execute(interaction)

    // Assert
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('ダイスロールに失敗'), ephemeral: true })
    )
  })

  it('処理中に例外が発生し未応答のときエラーメッセージを reply する', async () => {
    // Arrange
    mockDice.mockRejectedValue(new Error('boom'))
    const interaction = createMockModalInteraction({
      customId: 'custom-dice-modal',
      fields: { 'dice-command': '1d6', 'dice-comment': '' }
    })

    // Act
    await service.execute(interaction)

    // Assert
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('エラーが発生しました'), ephemeral: true })
    )
  })
})
