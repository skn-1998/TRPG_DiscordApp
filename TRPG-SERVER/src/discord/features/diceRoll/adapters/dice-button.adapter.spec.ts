// このアダプタは実ロジック型: dice('1d100') でロールし、PublicThread 内のボタンなら親 GuildText
// チャンネルへ結果を送る。検証対象は「ガード分岐(diceRoll が null / 非 PublicThread / parentId なし)で
// 中断するか」「条件を満たすとき親チャンネルへ diceRoll.text を送るか」。
//
// 副作用境界は dice() と Discord I/O の 2 つ。dice はモジュールモック、interaction は @discord-test-utils
// のファクトリ生成物をベースに channel/client を上書きして組む(ゼロからの as any 捏造はしない)。
// adapter は ChannelType.GuildText(0) と PublicThread(11) を両方使うが、グローバル jest-setup の
// discord.js スタブは PublicThread しか持たないため、実 discord.js の ChannelType を使う。
jest.unmock('discord.js')
jest.mock('discord.js', () => jest.requireActual('discord.js'))
jest.mock('src/discord/utils/dice')

import { createMockButtonInteraction } from '@discord-test-utils'
import { ChannelType, type ButtonInteraction } from 'discord.js'
import dice from 'src/discord/utils/dice'
import { DiceButtonService } from './dice-button.adapter'

const mockDice = dice as jest.MockedFunction<typeof dice>

/**
 * ファクトリ生成のボタン interaction をベースに、channel(種別・parentId) と
 * client.channels.cache.get を差し込んで PublicThread シナリオを組み立てる。
 */
function buildThreadInteraction(options: {
  channelType?: number
  parentId?: string | null
  parentChannel?: { type: number; send: jest.Mock } | undefined
}): { interaction: ButtonInteraction; parentSend: jest.Mock | undefined } {
  const { channelType = ChannelType.PublicThread, parentId = 'parent-ch', parentChannel } = options
  const base = createMockButtonInteraction({ customId: 'dice_button' })

  const cacheGet = jest.fn().mockReturnValue(parentChannel)

  // ファクトリ生成物のプロパティを上書き（channel と client を実シナリオに合わせる）
  const interaction = base as unknown as Record<string, unknown>
  interaction.channel = { type: channelType, parentId }
  interaction.client = { channels: { cache: { get: cacheGet } } }

  return { interaction: base, parentSend: parentChannel?.send }
}

describe('DiceButtonService', () => {
  let service: DiceButtonService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new DiceButtonService()
    // 既定では成功ロールを返す（個別テストで上書き）
    mockDice.mockResolvedValue({ text: '(1D100) ＞ 50' } as Awaited<ReturnType<typeof dice>>)
  })

  it('PublicThread 内かつ親が GuildText のとき、親チャンネルへロール結果を送信する', async () => {
    // Arrange
    const parentSendMock = jest.fn().mockResolvedValue(undefined)
    const { interaction, parentSend } = buildThreadInteraction({
      parentChannel: { type: ChannelType.GuildText, send: parentSendMock }
    })

    // Act
    await service.execute(interaction)

    // Assert
    expect(mockDice).toHaveBeenCalledWith('1d100')
    expect(interaction.deferUpdate).toHaveBeenCalledTimes(1)
    expect(parentSend).toHaveBeenCalledWith('(1D100) ＞ 50')
  })

  it('ダイスロールが null のとき即 return し deferUpdate も送信もしない', async () => {
    // Arrange
    mockDice.mockResolvedValue(null as Awaited<ReturnType<typeof dice>>)
    const parentSendMock = jest.fn()
    const { interaction } = buildThreadInteraction({
      parentChannel: { type: ChannelType.GuildText, send: parentSendMock }
    })

    // Act
    await service.execute(interaction)

    // Assert
    expect(interaction.deferUpdate).not.toHaveBeenCalled()
    expect(parentSendMock).not.toHaveBeenCalled()
  })

  it('チャンネルが PublicThread でないとき即 return し deferUpdate しない', async () => {
    // Arrange: GuildText チャンネル上のボタン（スレッドではない）
    const parentSendMock = jest.fn()
    const { interaction } = buildThreadInteraction({
      channelType: ChannelType.GuildText,
      parentChannel: { type: ChannelType.GuildText, send: parentSendMock }
    })

    // Act
    await service.execute(interaction)

    // Assert
    expect(interaction.deferUpdate).not.toHaveBeenCalled()
    expect(parentSendMock).not.toHaveBeenCalled()
  })

  it('PublicThread だが parentId が null のとき即 return し deferUpdate しない', async () => {
    // Arrange
    const parentSendMock = jest.fn()
    const { interaction } = buildThreadInteraction({
      parentId: null,
      parentChannel: { type: ChannelType.GuildText, send: parentSendMock }
    })

    // Act
    await service.execute(interaction)

    // Assert
    expect(interaction.deferUpdate).not.toHaveBeenCalled()
    expect(parentSendMock).not.toHaveBeenCalled()
  })

  it('親チャンネルがキャッシュに無いとき deferUpdate はするが送信はしない', async () => {
    // Arrange: cache.get が undefined を返す
    const { interaction } = buildThreadInteraction({ parentChannel: undefined })

    // Act
    await service.execute(interaction)

    // Assert
    expect(interaction.deferUpdate).toHaveBeenCalledTimes(1)
    // 送信先が無いので send は発生しない（例外も出ない）
  })

  it('親チャンネルが GuildText でない（例: スレッド）とき送信しない', async () => {
    // Arrange: 親が別のスレッド種別
    const parentSendMock = jest.fn()
    const { interaction } = buildThreadInteraction({
      parentChannel: { type: ChannelType.PublicThread, send: parentSendMock }
    })

    // Act
    await service.execute(interaction)

    // Assert
    expect(interaction.deferUpdate).toHaveBeenCalledTimes(1)
    expect(parentSendMock).not.toHaveBeenCalled()
  })
})
