import { ChannelType, MessageFlags } from 'discord.js'
import type { ButtonInteraction } from 'discord.js'
import type { CharacterService } from '../../../../domains/character/character.service'
import type { DiceRollLogicService } from '../../../services/dice/dice-roll-logic.service'
import { RollPaletteCustomId } from '../custom-id'
import { RollPaletteHandler } from './roll-palette.handler'

describe('RollPaletteHandler', () => {
  const channelId = '123456789012345678'
  let characterService: { findByChannelId: jest.Mock }
  let diceRollLogicService: { executeCustomDiceRoll: jest.Mock; saveCustomDiceRollHistory: jest.Mock }
  let parentSend: jest.Mock
  let interaction: ButtonInteraction
  let handler: RollPaletteHandler

  beforeEach(() => {
    characterService = { findByChannelId: jest.fn() }
    diceRollLogicService = {
      executeCustomDiceRoll: jest.fn(),
      saveCustomDiceRollHistory: jest.fn().mockResolvedValue(undefined)
    }
    parentSend = jest.fn().mockResolvedValue(undefined)
    interaction = {
      customId: RollPaletteCustomId.create(channelId, 'atk1'),
      user: { id: 'participant-not-owner' },
      deferUpdate: jest.fn().mockResolvedValue(undefined),
      reply: jest.fn().mockResolvedValue(undefined),
      followUp: jest.fn().mockResolvedValue(undefined),
      channel: { type: ChannelType.PublicThread, parentId: 'parent-1' },
      client: {
        channels: {
          fetch: jest.fn().mockResolvedValue({ isTextBased: () => true, send: parentSend })
        }
      }
    } as unknown as ButtonInteraction
    handler = new RollPaletteHandler(
      characterService as unknown as CharacterService,
      diceRollLogicService as unknown as DiceRollLogicService
    )
  })

  it('非所有者でも palette notation を既存任意ロール経路へ委譲し親チャンネルへ投稿する', async () => {
    characterService.findByChannelId.mockResolvedValue({
      discordUserId: 'owner',
      characterName: '探索者',
      gameSystemId: 'coc7',
      palette: [
        { key: 'atk1', kind: 'roll', notation: '2d6+1', label: '攻撃', group: 'combat', fieldRef: { uid: 'atk' } }
      ]
    })
    const rollResult = {
      success: true,
      total: 8,
      details: '2d6+1 = 8',
      diceType: '2d6+1',
      reason: '攻撃',
      characterName: '探索者',
      isCustomRoll: true
    }
    diceRollLogicService.executeCustomDiceRoll.mockResolvedValue(rollResult)

    await handler.execute(interaction)

    expect(interaction.deferUpdate).toHaveBeenCalledTimes(1)
    expect(characterService.findByChannelId).toHaveBeenCalledWith(channelId)
    expect(diceRollLogicService.executeCustomDiceRoll).toHaveBeenCalledWith('2d6+1', '攻撃', '探索者')
    expect(diceRollLogicService.saveCustomDiceRollHistory).toHaveBeenCalledWith(
      interaction,
      channelId,
      rollResult,
      'coc7'
    )
    expect(parentSend).toHaveBeenCalledWith({ content: '2d6+1 = 8' })
  })

  it('履歴保存が失敗しても成功したロール結果を親チャンネルへ投稿する', async () => {
    characterService.findByChannelId.mockResolvedValue({
      palette: [{ key: 'atk1', kind: 'roll', notation: '2d6+1', label: '攻撃' }]
    })
    diceRollLogicService.executeCustomDiceRoll.mockResolvedValue({
      success: true,
      total: 8,
      details: '2d6+1 = 8',
      diceType: '2d6+1',
      reason: '攻撃',
      characterName: '探索者',
      isCustomRoll: true
    })
    diceRollLogicService.saveCustomDiceRollHistory.mockRejectedValue(new Error('history unavailable'))

    await handler.execute(interaction)

    expect(diceRollLogicService.saveCustomDiceRollHistory).toHaveBeenCalledTimes(1)
    expect(parentSend).toHaveBeenCalledWith({ content: '2d6+1 = 8' })
    expect(interaction.followUp).not.toHaveBeenCalled()
  })

  it('ロール失敗時は result.error を ephemeral メッセージへ表示する', async () => {
    characterService.findByChannelId.mockResolvedValue({
      palette: [{ key: 'atk1', kind: 'roll', notation: '1d100<70', label: 'DEX(70)' }]
    })
    diceRollLogicService.executeCustomDiceRoll.mockResolvedValue({
      success: false,
      error: '未対応のダイス記法です: 1d100<70',
      diceType: '1d100<70',
      reason: 'DEX(70)',
      isCustomRoll: true
    })

    await handler.execute(interaction)

    expect(interaction.followUp).toHaveBeenCalledWith({
      content: '❌ ダイスロールに失敗しました: 未対応のダイス記法です: 1d100<70',
      flags: MessageFlags.Ephemeral
    })
    expect(diceRollLogicService.saveCustomDiceRollHistory).not.toHaveBeenCalled()
    expect(parentSend).not.toHaveBeenCalled()
  })

  it('key 不明はロールせず ephemeral で該当エントリなしを返す', async () => {
    characterService.findByChannelId.mockResolvedValue({ discordUserId: 'owner', palette: [] })

    await handler.execute(interaction)

    expect(diceRollLogicService.executeCustomDiceRoll).not.toHaveBeenCalled()
    expect(interaction.followUp).toHaveBeenCalledWith({
      content: '❌ 該当エントリなし',
      flags: MessageFlags.Ephemeral
    })
  })

  it('厳密 parser が拒否した customId は handler 本体へ到達しない', async () => {
    Object.assign(interaction, { customId: `${RollPaletteCustomId.create(channelId, 'atk1')}_suffix` })

    await handler.execute(interaction)

    expect(interaction.deferUpdate).not.toHaveBeenCalled()
    expect(characterService.findByChannelId).not.toHaveBeenCalled()
    expect(interaction.reply).toHaveBeenCalledWith({
      content: '❌ ボタンの形式が不正です。',
      flags: MessageFlags.Ephemeral
    })
  })
})
