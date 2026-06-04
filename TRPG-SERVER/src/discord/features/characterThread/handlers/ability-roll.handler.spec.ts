import { ChannelType } from 'discord.js'
import { AbilityRollHandler } from './ability-roll.handler'

/**
 * S-3: 能力(ability)ロール handler の wiring spec（character-skill-roll.handler.spec.ts のミラー）。
 * parse（ability_{channelId}_{abilityKey}）→ character 解決 → abilityName/abilityValue 解決 →
 * DiceRollLogicService.handleSkillRoll を正しい引数で呼ぶ（skill と同一ロジック再利用）、を固定する。
 * 能力値は character.parameter（skill と同型）から再解決する。
 */
describe('AbilityRollHandler', () => {
  let handler: AbilityRollHandler
  let diceRollLogicService: { handleSkillRoll: jest.Mock }
  let characterService: { findByChannelId: jest.Mock }
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
      handleSkillRoll: jest.fn().mockResolvedValue({ success: true, details: '50 ≤ 50 → 成功' })
    }
    characterService = { findByChannelId: jest.fn() }
    handler = new AbilityRollHandler(diceRollLogicService as any, characterService as any)
  })

  it('pattern は ability_ / type は button', () => {
    expect(handler.getCustomIdPattern()).toBe('ability_')
    expect(handler.getInteractionType()).toBe('button')
  })

  it('ability_{channelId}_{abilityKey} を parse し、解決した abilityName/abilityValue で handleSkillRoll を呼び成功時は親チャンネルへ投稿', async () => {
    characterService.findByChannelId.mockResolvedValue({
      parameter: { str: { name: '筋力', values: { level: 50 } } }
    })
    const interaction = buildInteraction('ability_chan123_str')

    await handler.execute(interaction)

    expect(interaction.deferUpdate).toHaveBeenCalled()
    expect(characterService.findByChannelId).toHaveBeenCalledWith('chan123')
    expect(diceRollLogicService.handleSkillRoll).toHaveBeenCalledWith(interaction, 'chan123', '筋力', 50)
    expect(parentSend).toHaveBeenCalledWith({ content: '50 ≤ 50 → 成功' })
  })

  it('abilityKey に _ を含む場合も残り全体を abilityKey として解決する（数値能力は name=abilityKey・level=数値）', async () => {
    characterService.findByChannelId.mockResolvedValue({ parameter: { dex_mod: 60 } })
    const interaction = buildInteraction('ability_chan123_dex_mod')

    await handler.execute(interaction)

    expect(characterService.findByChannelId).toHaveBeenCalledWith('chan123')
    expect(diceRollLogicService.handleSkillRoll).toHaveBeenCalledWith(interaction, 'chan123', 'dex_mod', 60)
  })

  it('不正な customId（_ 区切りなし）は reply でエラー・defer も roll も行わない', async () => {
    const interaction = buildInteraction('ability_')

    await handler.execute(interaction)

    expect(interaction.reply).toHaveBeenCalled()
    expect(interaction.deferUpdate).not.toHaveBeenCalled()
    expect(diceRollLogicService.handleSkillRoll).not.toHaveBeenCalled()
  })

  it('character が見つからない場合は followUp でエラー・roll は行わない', async () => {
    characterService.findByChannelId.mockResolvedValue(null)
    const interaction = buildInteraction('ability_chan123_str')

    await handler.execute(interaction)

    expect(interaction.deferUpdate).toHaveBeenCalled()
    expect(interaction.followUp).toHaveBeenCalled()
    expect(diceRollLogicService.handleSkillRoll).not.toHaveBeenCalled()
  })

  it('ability が character.parameter に存在しない場合は followUp でエラー・roll は行わない（目標値0誤ロール防止）', async () => {
    characterService.findByChannelId.mockResolvedValue({ parameter: { other: 50 } })
    const interaction = buildInteraction('ability_chan123_str')

    await handler.execute(interaction)

    expect(interaction.followUp).toHaveBeenCalled()
    expect(diceRollLogicService.handleSkillRoll).not.toHaveBeenCalled()
  })

  it('handleSkillRoll が success:false の場合は followUp でエラー・親チャンネル投稿はしない', async () => {
    characterService.findByChannelId.mockResolvedValue({ parameter: { str: 50 } })
    diceRollLogicService.handleSkillRoll.mockResolvedValue({ success: false, error: 'roll error' })
    const interaction = buildInteraction('ability_chan123_str')

    await handler.execute(interaction)

    expect(interaction.followUp).toHaveBeenCalled()
    expect(parentSend).not.toHaveBeenCalled()
  })

  it('handleSkillRoll が throw しても catch して followUp で通知する', async () => {
    characterService.findByChannelId.mockResolvedValue({ parameter: { str: 50 } })
    diceRollLogicService.handleSkillRoll.mockRejectedValue(new Error('boom'))
    const interaction = buildInteraction('ability_chan123_str')

    await expect(handler.execute(interaction)).resolves.toBeUndefined()
    expect(interaction.followUp).toHaveBeenCalled()
  })

  it('スレッド外（親チャンネルへ投稿不可）の成功時は fallback の followUp 通知を行う', async () => {
    characterService.findByChannelId.mockResolvedValue({ parameter: { str: 50 } })
    const interaction = buildInteraction('ability_chan123_str')
    interaction.channel.type = ChannelType.GuildText // スレッドでない → sendToParentChannel は false

    await handler.execute(interaction)

    expect(diceRollLogicService.handleSkillRoll).toHaveBeenCalled()
    expect(parentSend).not.toHaveBeenCalled()
    expect(interaction.followUp).toHaveBeenCalled()
  })
})
