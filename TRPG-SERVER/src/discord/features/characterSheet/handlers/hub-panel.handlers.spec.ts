import {
  createEphemeralPanel,
  createGroupBrowser,
  createGroupSelect,
  GROUP_SELECT_MORE_VALUE
} from '@trpg/sheet-projection'
import { MessageFlags, type AnySelectMenuInteraction, type ButtonInteraction } from 'discord.js'
import type { CharacterService } from '../../../../domains/character/character.service'
import type { CharacterPaletteEntry } from '../../../../domains/character/models/character.entity'
import type { HubDiscordViewBuilder } from '../adapters/hub-discord-view.builder'
import { HubGroupSelectCustomId } from '../custom-id'
import { HubGroupBrowserNavigationHandler } from './hub-group-browser-navigation.handler'
import { HubGroupSelectHandler } from './hub-group-select.handler'
import { HubPanelNavigationHandler } from './hub-panel-navigation.handler'

const channelId = '123456789012345678'

function roll(key: string, group: string): CharacterPaletteEntry {
  return { key, kind: 'roll', label: key, group, fieldRef: { uid: key }, notation: '1d6' }
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
    const nextId = createEphemeralPanel({ channelId, palette, groupId, page: 1 }).page.next!.customId
    const characterService = { findByChannelId: jest.fn().mockResolvedValue({ palette }) }
    const handler = new HubPanelNavigationHandler(
      characterService as unknown as CharacterService,
      builder as unknown as HubDiscordViewBuilder
    )
    const interaction = { customId: nextId, update: jest.fn() } as unknown as ButtonInteraction

    await handler.execute(interaction)

    expect(builder.buildPanel).toHaveBeenCalledWith(
      expect.objectContaining({ page: expect.objectContaining({ currentPage: 2 }) })
    )
    expect(interaction.update).toHaveBeenCalledWith({ content: 'panel', components: [] })
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
