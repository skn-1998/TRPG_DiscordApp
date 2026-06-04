import { ChannelType } from 'discord.js'
import { CharacterSkillRollHandler } from './character-skill-roll.handler'

/**
 * P1-D slice2: 未routing だった skill_ ボタンを配線した handler の wiring spec。
 * parse（skill_{channelId}_{skillKey}）→ character 解決 → skillName/skillValue 解決 →
 * DiceRollLogicService.handleSkillRoll を正しい引数で呼ぶ、を固定する。
 */
describe('CharacterSkillRollHandler', () => {
  let handler: CharacterSkillRollHandler
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
    handler = new CharacterSkillRollHandler(diceRollLogicService as any, characterService as any)
  })

  it('pattern は skill_ / type は button', () => {
    expect(handler.getCustomIdPattern()).toBe('skill_')
    expect(handler.getInteractionType()).toBe('button')
  })

  it('skill_{channelId}_{skillKey} を parse し、解決した skillName/skillValue で handleSkillRoll を呼び成功時は親チャンネルへ投稿', async () => {
    characterService.findByChannelId.mockResolvedValue({
      skill: { dodge: { name: '回避', values: { level: 50 } } }
    })
    const interaction = buildInteraction('skill_chan123_dodge')

    await handler.execute(interaction)

    expect(interaction.deferUpdate).toHaveBeenCalled()
    expect(characterService.findByChannelId).toHaveBeenCalledWith('chan123')
    expect(diceRollLogicService.handleSkillRoll).toHaveBeenCalledWith(interaction, 'chan123', '回避', 50)
    expect(parentSend).toHaveBeenCalledWith({ content: '50 ≤ 50 → 成功' })
  })

  it('skillKey に _ を含む場合も残り全体を skillKey として解決する（数値スキルは name=skillKey・level=数値）', async () => {
    characterService.findByChannelId.mockResolvedValue({ skill: { fast_talk: 60 } })
    const interaction = buildInteraction('skill_chan123_fast_talk')

    await handler.execute(interaction)

    expect(characterService.findByChannelId).toHaveBeenCalledWith('chan123')
    expect(diceRollLogicService.handleSkillRoll).toHaveBeenCalledWith(interaction, 'chan123', 'fast_talk', 60)
  })

  it('不正な customId（_ 区切りなし）は reply でエラー・defer も roll も行わない', async () => {
    const interaction = buildInteraction('skill_')

    await handler.execute(interaction)

    expect(interaction.reply).toHaveBeenCalled()
    expect(interaction.deferUpdate).not.toHaveBeenCalled()
    expect(diceRollLogicService.handleSkillRoll).not.toHaveBeenCalled()
  })

  it('character が見つからない場合は followUp でエラー・roll は行わない', async () => {
    characterService.findByChannelId.mockResolvedValue(null)
    const interaction = buildInteraction('skill_chan123_dodge')

    await handler.execute(interaction)

    expect(interaction.deferUpdate).toHaveBeenCalled()
    expect(interaction.followUp).toHaveBeenCalled()
    expect(diceRollLogicService.handleSkillRoll).not.toHaveBeenCalled()
  })
})
