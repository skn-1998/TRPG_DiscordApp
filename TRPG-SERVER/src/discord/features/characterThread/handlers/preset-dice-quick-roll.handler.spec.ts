import { ChannelType } from 'discord.js'
import { PresetDiceQuickRollHandler } from './preset-dice-quick-roll.handler'

/**
 * P1-D 後続: 未routing だった dice_{coc7,dnd5e,sw25}_ preset ボタンを配線した handler の wiring spec。
 * parse → system 既定 notation + action ラベル解決 → DiceRollLogicService.handleDiceRoll を正しい引数で呼ぶ、を固定。
 */
describe('PresetDiceQuickRollHandler', () => {
  let handler: PresetDiceQuickRollHandler
  let diceRollLogicService: { handleDiceRoll: jest.Mock }
  let parentSend: jest.Mock

  const buildInteraction = (customId: string): any => {
    parentSend = jest.fn().mockResolvedValue(undefined)
    return {
      customId,
      user: { id: 'user-1' },
      deferUpdate: jest.fn().mockResolvedValue(undefined),
      reply: jest.fn().mockResolvedValue(undefined),
      followUp: jest.fn().mockResolvedValue(undefined),
      channel: { type: ChannelType.PublicThread, parentId: 'parent-1' },
      client: {
        channels: {
          fetch: jest.fn().mockResolvedValue({ isTextBased: () => true, send: parentSend })
        }
      }
    }
  }

  beforeEach(() => {
    diceRollLogicService = {
      handleDiceRoll: jest.fn().mockResolvedValue({ success: true, total: 42, details: '1d100 → 42' })
    }
    handler = new PresetDiceQuickRollHandler(diceRollLogicService as any)
  })

  it('pattern は /^dice_(coc7|dnd5e|sw25)_/ / type は button', () => {
    expect(handler.getCustomIdPattern()).toEqual(/^dice_(coc7|dnd5e|sw25)_/)
    expect(handler.getInteractionType()).toBe('button')
  })

  it('coc7 sanity → 1d100 + SAN値判定（簡易）で handleDiceRoll を呼び成功時は親チャンネルへ投稿', async () => {
    const interaction = buildInteraction('dice_coc7_sanity_chan123')

    await handler.execute(interaction)

    expect(interaction.deferUpdate).toHaveBeenCalled()
    expect(diceRollLogicService.handleDiceRoll).toHaveBeenCalledWith(interaction, {
      channelId: 'chan123',
      diceType: '1d100',
      reason: 'SAN値判定（簡易）',
      userId: 'user-1'
    })
    expect(parentSend).toHaveBeenCalledWith({ content: '1d100 → 42' })
  })

  it('dnd5e 1d20（base）→ 1d20 + d20攻撃', async () => {
    const interaction = buildInteraction('dice_dnd5e_1d20_chan123')

    await handler.execute(interaction)

    expect(diceRollLogicService.handleDiceRoll).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({ channelId: 'chan123', diceType: '1d20', reason: 'd20攻撃' })
    )
  })

  it('sw25 magic → 2d6 + 魔法行使（簡易）', async () => {
    const interaction = buildInteraction('dice_sw25_magic_chan123')

    await handler.execute(interaction)

    expect(diceRollLogicService.handleDiceRoll).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({ channelId: 'chan123', diceType: '2d6', reason: '魔法行使（簡易）' })
    )
  })

  it('不正な customId（未対応 system）は reply でエラー・defer も roll もしない', async () => {
    const interaction = buildInteraction('dice_pathfinder_attack_chan123')

    await handler.execute(interaction)

    expect(interaction.reply).toHaveBeenCalled()
    expect(interaction.deferUpdate).not.toHaveBeenCalled()
    expect(diceRollLogicService.handleDiceRoll).not.toHaveBeenCalled()
  })

  it('handleDiceRoll が success:false の場合は followUp でエラー・親チャンネル投稿はしない', async () => {
    diceRollLogicService.handleDiceRoll.mockResolvedValue({ success: false, error: 'roll error' })
    const interaction = buildInteraction('dice_coc7_1d100_chan123')

    await handler.execute(interaction)

    expect(interaction.followUp).toHaveBeenCalled()
    expect(parentSend).not.toHaveBeenCalled()
  })

  it('handleDiceRoll が throw しても catch して followUp で通知', async () => {
    diceRollLogicService.handleDiceRoll.mockRejectedValue(new Error('boom'))
    const interaction = buildInteraction('dice_coc7_1d100_chan123')

    await expect(handler.execute(interaction)).resolves.toBeUndefined()
    expect(interaction.followUp).toHaveBeenCalled()
  })

  it('スレッド外（親チャンネル投稿不可）の成功時は fallback の followUp 通知を行う', async () => {
    const interaction = buildInteraction('dice_coc7_1d100_chan123')
    interaction.channel.type = ChannelType.GuildText // スレッドでない → sendToParentChannel は false

    await handler.execute(interaction)

    expect(diceRollLogicService.handleDiceRoll).toHaveBeenCalled()
    expect(parentSend).not.toHaveBeenCalled()
    expect(interaction.followUp).toHaveBeenCalled()
  })
})
