import { ChannelType } from 'discord.js'
import { sendToParentChannel } from './parent-channel.util'

/**
 * C-4: 5 handler（ability-roll / character-skill-roll / dice-generic / flexible-dice-select /
 * preset-dice-quick-roll）の private sendToParentChannel を集約した共通ヘルパの契約を固定する。
 * - スレッド（Public/PrivateThread）内 → 親チャンネルへ send して true
 * - 非スレッド / channel なし / parentId なし / 親が text-based でない → 送信せず false
 * - fetch / send 失敗 → warn ログのみで握り潰して false（throw しない）
 */
describe('sendToParentChannel', () => {
  let logger: { warn: jest.Mock }
  let parentSend: jest.Mock
  let fetch: jest.Mock

  const buildInteraction = (channel: unknown): any => ({
    channel,
    client: { channels: { fetch } }
  })

  beforeEach(() => {
    logger = { warn: jest.fn() }
    parentSend = jest.fn().mockResolvedValue(undefined)
    fetch = jest.fn().mockResolvedValue({ isTextBased: () => true, send: parentSend })
  })

  it('PublicThread 内なら親チャンネルへ送信して true を返す', async () => {
    const interaction = buildInteraction({ type: ChannelType.PublicThread, parentId: 'parent-1' })

    await expect(sendToParentChannel(interaction, '1d6 → 4', logger)).resolves.toBe(true)

    expect(fetch).toHaveBeenCalledWith('parent-1')
    expect(parentSend).toHaveBeenCalledWith({ content: '1d6 → 4' })
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('PrivateThread 内でも親チャンネルへ送信して true を返す', async () => {
    const interaction = buildInteraction({ type: ChannelType.PrivateThread, parentId: 'parent-2' })

    await expect(sendToParentChannel(interaction, 'msg', logger)).resolves.toBe(true)

    expect(parentSend).toHaveBeenCalledWith({ content: 'msg' })
  })

  it('非スレッド（GuildText）では送信せず false を返す', async () => {
    const interaction = buildInteraction({ type: ChannelType.GuildText, parentId: 'parent-1' })

    await expect(sendToParentChannel(interaction, 'msg', logger)).resolves.toBe(false)

    expect(fetch).not.toHaveBeenCalled()
    expect(parentSend).not.toHaveBeenCalled()
  })

  it('channel が null なら送信せず false を返す', async () => {
    const interaction = buildInteraction(null)

    await expect(sendToParentChannel(interaction, 'msg', logger)).resolves.toBe(false)

    expect(fetch).not.toHaveBeenCalled()
  })

  it('parentId が無ければ fetch せず false を返す', async () => {
    const interaction = buildInteraction({ type: ChannelType.PublicThread, parentId: null })

    await expect(sendToParentChannel(interaction, 'msg', logger)).resolves.toBe(false)

    expect(fetch).not.toHaveBeenCalled()
  })

  it('親チャンネルが text-based でなければ送信せず false を返す', async () => {
    fetch.mockResolvedValue({ isTextBased: () => false, send: parentSend })
    const interaction = buildInteraction({ type: ChannelType.PublicThread, parentId: 'parent-1' })

    await expect(sendToParentChannel(interaction, 'msg', logger)).resolves.toBe(false)

    expect(parentSend).not.toHaveBeenCalled()
  })

  it('fetch が失敗しても throw せず warn ログを出して false を返す', async () => {
    fetch.mockRejectedValue(new Error('fetch failed'))
    const interaction = buildInteraction({ type: ChannelType.PublicThread, parentId: 'parent-1' })

    await expect(sendToParentChannel(interaction, 'msg', logger)).resolves.toBe(false)

    expect(logger.warn).toHaveBeenCalledWith('Failed to send result to parent channel', expect.any(Error))
    expect(parentSend).not.toHaveBeenCalled()
  })

  it('send が失敗しても throw せず warn ログを出して false を返す', async () => {
    parentSend.mockRejectedValue(new Error('send failed'))
    const interaction = buildInteraction({ type: ChannelType.PublicThread, parentId: 'parent-1' })

    await expect(sendToParentChannel(interaction, 'msg', logger)).resolves.toBe(false)

    expect(logger.warn).toHaveBeenCalledWith('Failed to send result to parent channel', expect.any(Error))
  })
})
