jest.unmock('discord.js')
jest.mock('discord.js', () => jest.requireActual('discord.js'))

import { MessageFlags } from 'discord.js'
import { respondEphemeralError } from './interaction-error-response.util'

describe('respondEphemeralError', () => {
  const buildInteraction = (state: { replied?: boolean; deferred?: boolean } = {}) => ({
    replied: state.replied ?? false,
    deferred: state.deferred ?? false,
    reply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined)
  })

  it('replied 済みでは ephemeral followUp を使う', async () => {
    const interaction = buildInteraction({ replied: true })

    await respondEphemeralError(interaction, 'error')

    expect(interaction.followUp).toHaveBeenCalledWith({
      content: 'error',
      flags: MessageFlags.Ephemeral
    })
    expect(interaction.editReply).not.toHaveBeenCalled()
    expect(interaction.reply).not.toHaveBeenCalled()
  })

  it('replied と deferred がともに true なら followUp を優先する', async () => {
    const interaction = buildInteraction({ replied: true, deferred: true })

    await respondEphemeralError(interaction, 'error')

    expect(interaction.followUp).toHaveBeenCalledTimes(1)
    expect(interaction.editReply).not.toHaveBeenCalled()
  })

  it('deferred 済みでは既定で editReply を使う', async () => {
    const interaction = buildInteraction({ deferred: true })

    await respondEphemeralError(interaction, 'error')

    expect(interaction.editReply).toHaveBeenCalledWith({ content: 'error' })
    expect(interaction.followUp).not.toHaveBeenCalled()
    expect(interaction.reply).not.toHaveBeenCalled()
  })

  it('deferredStrategy=followUp なら deferred 済みでも ephemeral followUp を使う', async () => {
    const interaction = buildInteraction({ deferred: true })

    await respondEphemeralError(interaction, 'error', { deferredStrategy: 'followUp' })

    expect(interaction.followUp).toHaveBeenCalledWith({
      content: 'error',
      flags: MessageFlags.Ephemeral
    })
    expect(interaction.editReply).not.toHaveBeenCalled()
    expect(interaction.reply).not.toHaveBeenCalled()
  })

  it('未応答では ephemeral reply を使う', async () => {
    const interaction = buildInteraction()

    await respondEphemeralError(interaction, 'error')

    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'error',
      flags: MessageFlags.Ephemeral
    })
    expect(interaction.editReply).not.toHaveBeenCalled()
    expect(interaction.followUp).not.toHaveBeenCalled()
  })

  it('通知失敗を握り潰さず呼び出し元へ伝播する', async () => {
    const notificationError = new Error('notification failed')
    const interaction = buildInteraction()
    interaction.reply.mockRejectedValue(notificationError)

    await expect(respondEphemeralError(interaction, 'error')).rejects.toBe(notificationError)
  })
})
