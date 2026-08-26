import type { DiscordProjectionViewModel, EphemeralPanelViewModel, GroupBrowserViewModel } from '@trpg/sheet-projection'
import { ButtonBuilder, EmbedBuilder, StringSelectMenuBuilder } from 'discord.js'
import { HubDiscordViewBuilder } from './hub-discord-view.builder'

describe('HubDiscordViewBuilder', () => {
  const hubViewWithButtonLabel = (label: string): DiscordProjectionViewModel => ({
    hub: {
      embed: { title: 'Alice', fields: [] },
      pinnedButtonRows: [
        [
          {
            type: 'button',
            action: 'roll',
            label,
            customId: 'roll_123_atk',
            style: 'primary',
            paletteKey: 'atk'
          }
        ]
      ]
    },
    warnings: []
  })

  beforeEach(() => jest.clearAllMocks())

  it('projection境界を越えた空ラベルもDiscord component生成前にfallbackする', () => {
    const view: DiscordProjectionViewModel = {
      hub: {
        embed: {
          title: 'Alice',
          fields: [{ name: '  ', value: '10', inline: true }]
        },
        pinnedButtonRows: [
          [
            {
              type: 'button',
              action: 'roll',
              label: '',
              customId: 'roll_123_atk',
              style: 'primary',
              paletteKey: 'atk'
            }
          ]
        ],
        groupSelect: {
          type: 'select',
          menuCustomId: 'hub_group_123',
          placeholder: 'グループを選択',
          options: [{ label: '\t', value: 'skills' }],
          hasMore: false
        }
      },
      warnings: []
    }

    new HubDiscordViewBuilder().buildHubMessage(view)
    const embed = (EmbedBuilder as unknown as jest.Mock).mock.results[0].value
    const button = (ButtonBuilder as unknown as jest.Mock).mock.results[0].value
    const select = (StringSelectMenuBuilder as unknown as jest.Mock).mock.results[0].value

    expect(embed.addFields).toHaveBeenCalledWith([expect.objectContaining({ name: 'Field 1' })])
    expect(button.setLabel).toHaveBeenCalledWith('atk')
    expect(select.addOptions).toHaveBeenCalledWith([expect.objectContaining({ label: 'skills' })])
  })

  it('81字のbutton labelだけをDiscord上限の80字へ切り詰める', () => {
    const longLabel = 'x'.repeat(81)

    new HubDiscordViewBuilder().buildHubMessage(hubViewWithButtonLabel(longLabel))
    const button = (ButtonBuilder as unknown as jest.Mock).mock.results[0].value

    expect(button.setLabel).toHaveBeenCalledWith('x'.repeat(80))
  })

  it('80字ちょうどのbutton labelはそのまま渡す', () => {
    const exactLabel = 'x'.repeat(80)

    new HubDiscordViewBuilder().buildHubMessage(hubViewWithButtonLabel(exactLabel))
    const button = (ButtonBuilder as unknown as jest.Mock).mock.results[0].value

    expect(button.setLabel).toHaveBeenCalledWith(exactLabel)
  })

  it('81字のselect option labelはhubとgroup browserの両経路で切り詰めない', () => {
    const longLabel = 'x'.repeat(81)
    const hubView: DiscordProjectionViewModel = {
      hub: {
        embed: { title: 'Alice', fields: [] },
        pinnedButtonRows: [],
        groupSelect: {
          type: 'select',
          menuCustomId: 'hub_group_123',
          placeholder: 'グループを選択',
          options: [{ label: longLabel, value: 'skills' }],
          hasMore: false
        }
      },
      warnings: []
    }
    const browserView: GroupBrowserViewModel = {
      kind: 'group-browser',
      title: 'Groups',
      menuCustomId: 'hub_groups_123',
      options: [{ label: longLabel, value: 'skills' }],
      page: { currentPage: 1, totalPages: 1 },
      warnings: []
    }

    const builder = new HubDiscordViewBuilder()
    builder.buildHubMessage(hubView)
    builder.buildGroupBrowser(browserView)
    const hubSelect = (StringSelectMenuBuilder as unknown as jest.Mock).mock.results[0].value
    const browserSelect = (StringSelectMenuBuilder as unknown as jest.Mock).mock.results[1].value

    expect(hubSelect.addOptions).toHaveBeenCalledWith([expect.objectContaining({ label: longLabel })])
    expect(browserSelect.addOptions).toHaveBeenCalledWith([expect.objectContaining({ label: longLabel })])
  })

  it('81字のembed field name・placeholder・contentは切り詰めない', () => {
    const longLabel = 'x'.repeat(81)
    const hubView: DiscordProjectionViewModel = {
      hub: {
        embed: { title: 'Alice', fields: [{ name: longLabel, value: '10', inline: true }] },
        pinnedButtonRows: []
      },
      warnings: []
    }
    const panelView: EphemeralPanelViewModel = {
      kind: 'group-panel',
      status: 'actions',
      groupId: 'skills',
      title: longLabel,
      actions: [],
      actionRows: [],
      page: { currentPage: 1, totalPages: 1 },
      warnings: []
    }
    const browserView: GroupBrowserViewModel = {
      kind: 'group-browser',
      title: longLabel,
      menuCustomId: 'hub_groups_123',
      options: [{ label: 'Skills', value: 'skills' }],
      page: { currentPage: 1, totalPages: 1 },
      warnings: []
    }

    const builder = new HubDiscordViewBuilder()
    builder.buildHubMessage(hubView)
    const panelMessage = builder.buildPanel(panelView)
    const browserMessage = builder.buildGroupBrowser(browserView)
    const embed = (EmbedBuilder as unknown as jest.Mock).mock.results[0].value
    const browserSelect = (StringSelectMenuBuilder as unknown as jest.Mock).mock.results[0].value

    expect(embed.addFields).toHaveBeenCalledWith([expect.objectContaining({ name: longLabel })])
    expect(browserSelect.setPlaceholder).toHaveBeenCalledWith(longLabel)
    expect(panelMessage.content).toBe(longLabel)
    expect(browserMessage.content).toBe(longLabel)
  })
})
