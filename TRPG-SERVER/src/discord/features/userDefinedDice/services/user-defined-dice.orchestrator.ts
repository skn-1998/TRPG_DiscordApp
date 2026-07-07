import { Injectable } from '@nestjs/common'
import { AutocompleteInteraction, ChannelType, CommandInteraction, TextChannel } from 'discord.js'
import Fuse from 'fuse.js'
import { convertSearchText } from '../../gameSystem'
import { tableDice } from '../../../utils/tableDice'

const options = {
  threshold: 0.4,
  distance: 250,
  keys: ['name']
}

const CATEGORY_NAME = 'オリジナル表'

@Injectable()
export class UserDefinedDiceOrchestrator {
  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    if (!interaction.guild) return

    const allChannels = interaction.guild.channels.cache
      .filter((channel) => channel.type === ChannelType.GuildText || channel.type === ChannelType.PublicThread)
      .map((channel) => ({ name: channel.name, value: channel.id, parentId: channel.parentId }))

    const focusedValue = interaction.options.getFocused()

    if (focusedValue.trim() === '') {
      const categoryId = interaction.guild.channels.cache.find((channel) => channel.name === CATEGORY_NAME)?.id
      if (!categoryId) {
        await interaction.respond(allChannels.slice(0, 25))
        return
      }
      const channels = allChannels.filter((channel) => channel.parentId === categoryId)
      if (!channels.length) {
        await interaction.respond(allChannels.slice(0, 25))
        return
      }
      await interaction.respond(channels.slice(0, 25))
      return
    }

    const channelSearchText = convertSearchText(focusedValue.slice(0, 200))
    const channelSearchObj = channelSearchText.map((e) => ({ name: e }))
    const fuse = new Fuse(allChannels, options)
    const channelSearchResult = fuse.search({ $or: channelSearchObj }).map((e) => e.item)
    await interaction.respond(channelSearchResult.slice(0, 25))
  }

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return
    if (!interaction.guild) return

    const channelId = interaction.options.getString('channel', true)
    const channel = interaction.guild.channels.cache.find(
      (channel) => channel.id === channelId || channel.name === channelId
    )

    if (!channel) {
      await interaction.reply('チャンネルが見つかりませんでした。')
      return
    }

    if (channel instanceof TextChannel) {
      const messages = await channel.messages.fetch({ limit: 100 })
      const contents = [...messages.entries()].map((e) => e[1].content).filter((e) => e !== '')

      if (!contents.length) {
        await interaction.reply(`${channel.name}：メッセージが見つかりませんでした。`)
        return
      }

      const bcdiceTableRegExp = /.+\n(\d+D\d+|D66|D66[NASD])\n1:./i
      const isDirectToTableDice = contents.length === 1 && bcdiceTableRegExp.test(contents[0])

      const tableDiceResult = tableDice(channel.name, contents, isDirectToTableDice)
      if (!tableDiceResult) {
        await interaction.reply('エラーが発生しました')
        return
      }
      await interaction.reply(tableDiceResult)
    } else {
      await interaction.reply('チャンネルが見つかりませんでした。')
    }
  }
}
