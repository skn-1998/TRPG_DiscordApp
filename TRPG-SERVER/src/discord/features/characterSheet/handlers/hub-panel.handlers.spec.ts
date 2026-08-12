import {
  createEphemeralPanel,
  createGroupBrowser,
  createGroupSelect,
  GROUP_SELECT_MORE_VALUE
} from '@trpg/sheet-projection'
import { MessageFlags, type AnySelectMenuInteraction, type ButtonInteraction } from 'discord.js'
import type { CharacterService } from '../../../../domains/character/character.service'
import type { CharacterPaletteEntry } from '../../../../domains/character/models/character.entity'
import { HubDiscordViewBuilder } from '../adapters/hub-discord-view.builder'
import { HubGroupSelectCustomId, HubPanelCustomId } from '../custom-id'
import { HubGroupBrowserNavigationHandler } from './hub-group-browser-navigation.handler'
import { HubGroupSelectHandler } from './hub-group-select.handler'
import { HubPanelNavigationHandler } from './hub-panel-navigation.handler'

const channelId = '123456789012345678'

function roll(key: string, group: string): CharacterPaletteEntry {
  return { key, kind: 'roll', label: key, group, fieldRef: { uid: key }, notation: '1d6' }
}

function resource(key: string, group: string): CharacterPaletteEntry {
  return { key, kind: 'resource', label: key, group, fieldRef: { uid: key }, deltas: [-1, 1] }
}

describe('hub select / panel handlers', () => {
  const builder = {
    buildPanel: jest.fn().mockReturnValue({ content: 'panel', components: [] }),
    buildGroupBrowser: jest.fn().mockReturnValue({ content: 'browser', components: [] })
  }

  beforeEach(() => jest.clearAllMocks())

  it('selectは共有hubを編集せずephemeral panelをreplyする', async () => {
    const palette = [roll('r1', '日本語 グループ')]
    const groupToken = createGroupSelect(palette, channelId)!.options[0].value
    const characterService = { findByChannelId: jest.fn().mockResolvedValue({ palette }) }
    const handler = new HubGroupSelectHandler(
      characterService as unknown as CharacterService,
      builder as unknown as HubDiscordViewBuilder
    )
    const interaction = {
      customId: HubGroupSelectCustomId.create(channelId),
      values: [groupToken],
      user: { id: 'viewer-1' },
      reply: jest.fn(),
      update: jest.fn(),
      deferUpdate: jest.fn()
    } as unknown as AnySelectMenuInteraction

    await handler.execute(interaction)

    expect(builder.buildPanel).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'group-panel', title: '日本語 グループ' })
    )
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'panel', flags: MessageFlags.Ephemeral })
    )
    expect(interaction.update).not.toHaveBeenCalled()
    expect(interaction.deferUpdate).not.toHaveBeenCalled()
  })

  it('selectは所有者にresource actionを投影する', async () => {
    const palette = [resource('hp', 'resource')]
    const groupToken = createGroupSelect(palette, channelId)!.options[0].value
    const characterService = {
      findByChannelId: jest.fn().mockResolvedValue({ palette, discordUserId: 'owner-1' })
    }
    const handler = new HubGroupSelectHandler(
      characterService as unknown as CharacterService,
      builder as unknown as HubDiscordViewBuilder
    )
    const interaction = {
      customId: HubGroupSelectCustomId.create(channelId),
      values: [groupToken],
      user: { id: 'owner-1' },
      reply: jest.fn()
    } as unknown as AnySelectMenuInteraction

    await handler.execute(interaction)

    expect(builder.buildPanel).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'actions',
        actions: expect.arrayContaining([expect.objectContaining({ action: 'resource' })])
      })
    )
  })

  it('selectは非所有者のresource-only groupを権限案内としてephemeral replyする', async () => {
    const palette = [resource('hp', 'resource')]
    const groupToken = createGroupSelect(palette, channelId)!.options[0].value
    const characterService = {
      findByChannelId: jest.fn().mockResolvedValue({ palette, discordUserId: 'owner-1' })
    }
    const handler = new HubGroupSelectHandler(
      characterService as unknown as CharacterService,
      new HubDiscordViewBuilder()
    )
    const interaction = {
      customId: HubGroupSelectCustomId.create(channelId),
      values: [groupToken],
      user: { id: 'viewer-2' },
      reply: jest.fn()
    } as unknown as AnySelectMenuInteraction

    await handler.execute(interaction)

    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'この操作はキャラクター所有者のみ実行できます',
      components: [],
      flags: MessageFlags.Ephemeral
    })
  })

  it('その他…はephemeral group browserをreplyする', async () => {
    const palette = Array.from({ length: 25 }, (_, index) => roll(`r${index}`, `group ${index}`))
    const characterService = { findByChannelId: jest.fn().mockResolvedValue({ palette }) }
    const handler = new HubGroupSelectHandler(
      characterService as unknown as CharacterService,
      builder as unknown as HubDiscordViewBuilder
    )
    const interaction = {
      customId: HubGroupSelectCustomId.create(channelId),
      values: [GROUP_SELECT_MORE_VALUE],
      reply: jest.fn()
    } as unknown as AnySelectMenuInteraction

    await handler.execute(interaction)

    expect(builder.buildGroupBrowser).toHaveBeenCalledWith(expect.objectContaining({ kind: 'group-browser' }))
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'browser', flags: MessageFlags.Ephemeral })
    )
  })

  it('panel内page buttonはephemeral messageだけをupdateする', async () => {
    const palette = Array.from({ length: 21 }, (_, index) => roll(`r${index}`, 'group'))
    const groupId = createGroupSelect(palette, channelId)!.options[0].value
    const nextId = createEphemeralPanel({ channelId, palette, groupId, canMutate: true, page: 1 }).page.next!.customId
    const characterService = { findByChannelId: jest.fn().mockResolvedValue({ palette }) }
    const handler = new HubPanelNavigationHandler(
      characterService as unknown as CharacterService,
      builder as unknown as HubDiscordViewBuilder
    )
    const interaction = {
      customId: nextId,
      user: { id: 'viewer-1' },
      update: jest.fn()
    } as unknown as ButtonInteraction

    await handler.execute(interaction)

    expect(builder.buildPanel).toHaveBeenCalledWith(
      expect.objectContaining({ page: expect.objectContaining({ currentPage: 2 }) })
    )
    expect(interaction.update).toHaveBeenCalledWith({ content: 'panel', components: [] })
  })

  it('panel遷移はinteractionごとに所有者を再判定し、空文字・undefined discordUserIdは所有者と一致しない', async () => {
    const palette = [resource('hp', 'resource')]
    const customId = HubPanelCustomId.create(channelId, 'resource', 1)
    const characterService = {
      findByChannelId: jest
        .fn()
        .mockResolvedValueOnce({ palette, discordUserId: 'owner-1' })
        .mockResolvedValueOnce({ palette, discordUserId: '' })
        .mockResolvedValueOnce({ palette, discordUserId: undefined })
    }
    const handler = new HubPanelNavigationHandler(
      characterService as unknown as CharacterService,
      builder as unknown as HubDiscordViewBuilder
    )
    const ownerInteraction = {
      customId,
      user: { id: 'owner-1' },
      update: jest.fn()
    } as unknown as ButtonInteraction
    const emptyOwnerInteraction = {
      customId,
      user: { id: 'owner-1' },
      update: jest.fn()
    } as unknown as ButtonInteraction
    const undefinedOwnerInteraction = {
      customId,
      user: { id: 'owner-1' },
      update: jest.fn()
    } as unknown as ButtonInteraction

    await handler.execute(ownerInteraction)
    await handler.execute(emptyOwnerInteraction)
    await handler.execute(undefinedOwnerInteraction)

    expect(characterService.findByChannelId).toHaveBeenCalledTimes(3)
    expect(builder.buildPanel).toHaveBeenNthCalledWith(1, expect.objectContaining({ status: 'actions' }))
    expect(builder.buildPanel).toHaveBeenNthCalledWith(2, expect.objectContaining({ status: 'no-authorized-actions' }))
    expect(builder.buildPanel).toHaveBeenNthCalledWith(3, expect.objectContaining({ status: 'no-authorized-actions' }))
  })

  it('group browser navigationは24件単位の次pageをupdateする', async () => {
    const palette = Array.from({ length: 25 }, (_, index) => roll(`r${index}`, `group ${index}`))
    const nextId = createGroupBrowser({ channelId, palette, page: 1 }).page.next!.customId
    const characterService = { findByChannelId: jest.fn().mockResolvedValue({ palette }) }
    const handler = new HubGroupBrowserNavigationHandler(
      characterService as unknown as CharacterService,
      builder as unknown as HubDiscordViewBuilder
    )
    const interaction = { customId: nextId, update: jest.fn() } as unknown as ButtonInteraction

    await handler.execute(interaction)

    expect(builder.buildGroupBrowser).toHaveBeenCalledWith(
      expect.objectContaining({ page: expect.objectContaining({ currentPage: 2 }) })
    )
    expect(interaction.update).toHaveBeenCalledWith({ content: 'browser', components: [] })
  })
})
