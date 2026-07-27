import { ConflictException, NotFoundException } from '@nestjs/common'
import { EPSILON } from '@trpg/sheet-engine'
import { MessageFlags } from 'discord.js'
import type { ButtonInteraction } from 'discord.js'
import type { CharacterService } from '../../../../domains/character/character.service'
import type { CharacterSheetOperationService } from '../../../../features/character-sheet/services/character-sheet-operation.service'
import { ResourceDeltaCustomId } from '../custom-id'
import { ResourceDeltaHandler } from './resource-delta.handler'
import type { HubRefreshWorker } from '../services/hub-refresh.worker'

describe('ResourceDeltaHandler', () => {
  const channelId = '123456789012345678'
  let characterService: { findByChannelId: jest.Mock }
  let operationService: { applyResourceDelta: jest.Mock }
  let interaction: ButtonInteraction
  let handler: ResourceDeltaHandler
  const refreshWorker = { wake: jest.fn() }

  beforeEach(() => {
    characterService = { findByChannelId: jest.fn() }
    operationService = { applyResourceDelta: jest.fn() }
    interaction = {
      customId: ResourceDeltaCustomId.create(channelId, 'hp', 1),
      id: 'interaction-1',
      user: { id: 'owner-1' },
      deferUpdate: jest.fn().mockResolvedValue(undefined),
      reply: jest.fn().mockResolvedValue(undefined),
      followUp: jest.fn().mockResolvedValue(undefined)
    } as unknown as ButtonInteraction
    handler = new ResourceDeltaHandler(
      characterService as unknown as CharacterService,
      operationService as unknown as CharacterSheetOperationService,
      refreshWorker as unknown as HubRefreshWorker
    )
  })

  it('DB参照・所有者検証・更新より先に ack し、所有者の更新を use case へ委譲する', async () => {
    characterService.findByChannelId.mockResolvedValue({ discordUserId: 'owner-1' })
    operationService.applyResourceDelta.mockResolvedValue({
      noOp: false,
      clamped: false,
      effectiveDelta: 1,
      beforeEffectiveValue: 8,
      afterEffectiveValue: 9,
      atBound: null,
      character: { characterId: 'char-1' }
    })

    await handler.execute(interaction)

    const deferOrder = (interaction.deferUpdate as jest.Mock).mock.invocationCallOrder[0]
    const findOrder = characterService.findByChannelId.mock.invocationCallOrder[0]
    const applyOrder = operationService.applyResourceDelta.mock.invocationCallOrder[0]
    expect(deferOrder).toBeLessThan(findOrder)
    expect(findOrder).toBeLessThan(applyOrder)
    expect(operationService.applyResourceDelta).toHaveBeenCalledWith({
      channelId,
      paletteKey: 'hp',
      delta: 1,
      interaction: { id: 'interaction-1' }
    })
    expect(interaction.followUp).toHaveBeenCalledWith({
      content: '✅ リソースを +1 更新しました。',
      flags: MessageFlags.Ephemeral
    })
  })

  it('非所有者は ack 後に ephemeral 拒否し use case を呼ばない', async () => {
    characterService.findByChannelId.mockResolvedValue({ discordUserId: 'another-owner' })

    await handler.execute(interaction)

    expect(interaction.deferUpdate).toHaveBeenCalledTimes(1)
    expect(operationService.applyResourceDelta).not.toHaveBeenCalled()
    expect(interaction.followUp).toHaveBeenCalledWith({
      content: '❌ この操作はキャラクターの所有者のみ実行できます。',
      flags: MessageFlags.Ephemeral
    })
  })

  it.each([
    [1, 10, 'max', 'ℹ️ 上限です。'],
    [-1, 0, 'min', 'ℹ️ 下限です。']
  ] as const)(
    'delta=%s で実効値が動かなければ接している境界の文言を返す',
    async (delta, effectiveValue, atBound, content) => {
      Object.assign(interaction, { customId: ResourceDeltaCustomId.create(channelId, 'hp', delta) })
      characterService.findByChannelId.mockResolvedValue({ discordUserId: 'owner-1' })
      operationService.applyResourceDelta.mockResolvedValue({
        noOp: false,
        clamped: true,
        effectiveDelta: 0,
        beforeEffectiveValue: effectiveValue,
        afterEffectiveValue: effectiveValue,
        atBound,
        character: { characterId: 'char-1' }
      })

      await handler.execute(interaction)

      expect(interaction.followUp).toHaveBeenCalledWith({
        content,
        flags: MessageFlags.Ephemeral
      })
    }
  )

  it('minとmaxが同じ縮退trackは境界方向を決めず変化なし文言を返す', async () => {
    characterService.findByChannelId.mockResolvedValue({ discordUserId: 'owner-1' })
    operationService.applyResourceDelta.mockResolvedValue({
      noOp: false,
      clamped: true,
      effectiveDelta: 0,
      beforeEffectiveValue: 5,
      afterEffectiveValue: 5,
      atBound: null,
      character: { characterId: 'char-1' }
    })

    await handler.execute(interaction)

    expect(interaction.followUp).toHaveBeenCalledWith({
      content: 'ℹ️ これ以上変化しません。',
      flags: MessageFlags.Ephemeral
    })
  })

  it('max超過legacyへの負deltaは実効値がmaxのままなら上限文言を返す', async () => {
    Object.assign(interaction, { customId: ResourceDeltaCustomId.create(channelId, 'hp', -3) })
    characterService.findByChannelId.mockResolvedValue({ discordUserId: 'owner-1' })
    operationService.applyResourceDelta.mockResolvedValue({
      noOp: false,
      clamped: false,
      effectiveDelta: -3,
      beforeEffectiveValue: 10,
      afterEffectiveValue: 10,
      atBound: 'max',
      character: { characterId: 'char-1' }
    })

    await handler.execute(interaction)

    expect(interaction.followUp).toHaveBeenCalledWith({
      content: 'ℹ️ 上限です。',
      flags: MessageFlags.Ephemeral
    })
  })

  it('min未満legacyへの正deltaは実効値がminのままなら下限文言を返す', async () => {
    Object.assign(interaction, { customId: ResourceDeltaCustomId.create(channelId, 'hp', 3) })
    characterService.findByChannelId.mockResolvedValue({ discordUserId: 'owner-1' })
    operationService.applyResourceDelta.mockResolvedValue({
      noOp: false,
      clamped: false,
      effectiveDelta: 3,
      beforeEffectiveValue: 0,
      afterEffectiveValue: 0,
      atBound: 'min',
      character: { characterId: 'char-1' }
    })

    await handler.execute(interaction)

    expect(interaction.followUp).toHaveBeenCalledWith({
      content: 'ℹ️ 下限です。',
      flags: MessageFlags.Ephemeral
    })
  })

  it('requested deltaがclampされても実効値が動いた分だけ更新成功を報告する', async () => {
    Object.assign(interaction, { customId: ResourceDeltaCustomId.create(channelId, 'hp', 5) })
    characterService.findByChannelId.mockResolvedValue({ discordUserId: 'owner-1' })
    operationService.applyResourceDelta.mockResolvedValue({
      noOp: false,
      clamped: true,
      effectiveDelta: 2,
      beforeEffectiveValue: 8,
      afterEffectiveValue: 10,
      atBound: 'max',
      character: { characterId: 'char-1' }
    })

    await handler.execute(interaction)

    expect(interaction.followUp).toHaveBeenCalledWith({
      content: '✅ リソースを +2 更新しました。',
      flags: MessageFlags.Ephemeral
    })
  })

  it('EPSILON以下の実効値差は境界到達として扱う', async () => {
    Object.assign(interaction, { customId: ResourceDeltaCustomId.create(channelId, 'hp', 0.1) })
    characterService.findByChannelId.mockResolvedValue({ discordUserId: 'owner-1' })
    operationService.applyResourceDelta.mockResolvedValue({
      noOp: false,
      clamped: true,
      effectiveDelta: 0.1,
      beforeEffectiveValue: 0.3,
      afterEffectiveValue: 0.3 + EPSILON / 10,
      atBound: 'max',
      character: { characterId: 'char-1' }
    })

    await handler.execute(interaction)

    expect(interaction.followUp).toHaveBeenCalledWith({
      content: 'ℹ️ 上限です。',
      flags: MessageFlags.Ephemeral
    })
  })

  it('更新成功の実効値差は浮動小数誤差を丸めて表示する', async () => {
    Object.assign(interaction, { customId: ResourceDeltaCustomId.create(channelId, 'hp', 0.2) })
    characterService.findByChannelId.mockResolvedValue({ discordUserId: 'owner-1' })
    operationService.applyResourceDelta.mockResolvedValue({
      noOp: false,
      clamped: false,
      effectiveDelta: 0.2,
      beforeEffectiveValue: 0.1,
      afterEffectiveValue: 0.3,
      atBound: null,
      character: { characterId: 'char-1' }
    })

    await handler.execute(interaction)

    expect(interaction.followUp).toHaveBeenCalledWith({
      content: '✅ リソースを +0.2 更新しました。',
      flags: MessageFlags.Ephemeral
    })
  })

  it('palette key 不明は該当エントリなしを返す', async () => {
    characterService.findByChannelId.mockResolvedValue({ discordUserId: 'owner-1' })
    operationService.applyResourceDelta.mockRejectedValue(new NotFoundException('resource palette entry not found'))

    await handler.execute(interaction)

    expect(interaction.followUp).toHaveBeenCalledWith({
      content: '❌ 該当エントリなし',
      flags: MessageFlags.Ephemeral
    })
  })

  it('retry budget 超過を混雑案内へ分類する', async () => {
    characterService.findByChannelId.mockResolvedValue({ discordUserId: 'owner-1' })
    operationService.applyResourceDelta.mockRejectedValue(
      new ConflictException({ message: 'retry exhausted', refetchRequired: true })
    )

    await handler.execute(interaction)

    expect(interaction.followUp).toHaveBeenCalledWith({
      content: '⚠️ 混み合っています。少し待ってから再試行してください。',
      flags: MessageFlags.Ephemeral
    })
  })

  it('不正 customId は ack/DB 呼び出し前に拒否する', async () => {
    Object.assign(interaction, { customId: `res_${channelId}_hp_1_suffix` })

    await handler.execute(interaction)

    expect(interaction.deferUpdate).not.toHaveBeenCalled()
    expect(characterService.findByChannelId).not.toHaveBeenCalled()
    expect(operationService.applyResourceDelta).not.toHaveBeenCalled()
  })
})
