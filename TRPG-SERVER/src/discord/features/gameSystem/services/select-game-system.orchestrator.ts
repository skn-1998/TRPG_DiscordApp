import { Injectable, Logger } from '@nestjs/common'
import { AutocompleteInteraction, CommandInteraction } from 'discord.js'
import Fuse from 'fuse.js'
import { loadJsonFile } from '../../../utils/loadJsonFile'
import { getCategory } from '../../../utils/getCategory'
import { createCategory } from '../../../utils/createCategory'
import { convertSearchText } from '../utils/search.util'

export type GameSystemJSON = {
  ID: string
  NAME: string
  SORT_KEY: string
  HELP_MESSAGE: string
}

const options = {
  threshold: 0.4,
  keys: ['NAME']
}

const gameSystemList = loadJsonFile('src/discord/static/gameSystemList.json') as GameSystemJSON[]
const CATEGORY_NAME = 'ダイスロールチャンネル'

@Injectable()
export class SelectGameSystemOrchestrator {
  private readonly logger = new Logger(SelectGameSystemOrchestrator.name)
  private fuse = new Fuse<GameSystemJSON>(gameSystemList, options)

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedValue = interaction.options.getFocused()
    if (focusedValue === '') {
      await interaction.respond([])
      return
    }
    const gameSystemSearchText = convertSearchText(focusedValue.slice(0, 200))
    const gameSystemSearchObj = gameSystemSearchText.map((e) => ({ NAME: e }))
    const gameSystemSearchResults = this.fuse.search({ $or: gameSystemSearchObj }).map((e) => e.item)
    await interaction.respond(gameSystemSearchResults.slice(0, 25).map((e) => ({ name: e.NAME, value: e.ID })))
  }

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return
    const inputGameSystem = interaction.options.getString('gamesystem', true)
    const gameSystem = gameSystemList.find((e) => e.ID === inputGameSystem || e.NAME === inputGameSystem)
    if (!gameSystem) {
      await interaction.reply(`ゲームシステムが見つかりませんでした : ${inputGameSystem}`)
      return
    }

    const inputChannelName = interaction.options.getString('channel-name')
    const channelName = inputChannelName ? inputChannelName : gameSystem.NAME

    const gameSystemCategory =
      getCategory(interaction.guild!, CATEGORY_NAME) || (await createCategory(interaction.guild!, CATEGORY_NAME))

    const topic = `ここでは「${gameSystem.NAME}」のダイスが振れます\nID:${gameSystem.ID}\n※チャンネルトピックは変更しないでください ゲームシステムを認識できなくなる可能性があります`

    const channel = await interaction.guild!.channels.create({
      name: channelName,
      parent: gameSystemCategory?.id,
      topic
    })
    const message = await channel?.send(gameSystem.HELP_MESSAGE)
    await message?.pin()

    await interaction.reply(
      `${CATEGORY_NAME}を作成しました\nチャンネル名: ${channelName.toLowerCase().replace(/\s+/g, '-')}\nゲームシステム: ${gameSystem.NAME}`
    )
  }
}
