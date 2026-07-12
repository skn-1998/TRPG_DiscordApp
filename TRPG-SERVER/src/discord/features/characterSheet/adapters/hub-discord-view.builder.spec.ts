import type { DiscordProjectionViewModel } from '@trpg/sheet-projection'
import { ButtonBuilder, EmbedBuilder, StringSelectMenuBuilder } from 'discord.js'
import { HubDiscordViewBuilder } from './hub-discord-view.builder'

describe('HubDiscordViewBuilder', () => {
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
})
