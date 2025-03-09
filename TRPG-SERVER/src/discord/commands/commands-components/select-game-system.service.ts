import { Injectable } from '@nestjs/common'
import { discordCommandType } from 'src/discord/discord.type'
import {
  CommandInteraction,
  SlashCommandBuilder,
  AutocompleteInteraction
} from 'discord.js'
import { loadJsonFile } from 'src/discord/utils/loadJsonFile'
import Fuse from 'fuse.js'
import moji from 'moji'
import { getCategory } from 'src/discord/utils/getCategory'
import { createCategory } from 'src/discord/utils/createCategory'
import { selectGameSystemConfig } from 'src/discord/commands/commands.list'

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

const gameSystemList = loadJsonFile(
  'src/discord/static/gameSystemList.json'
) as GameSystemJSON[]

const CATEGORY_NAME = 'ダイスロールチャンネル'

export function convertSearchText(str: string) {
  const hiragana = moji(str).convert('KK', 'HG').toString()
  const katakana = moji(str).convert('HG', 'KK').toString()
  return [str, hiragana, katakana]
}

@Injectable()
export class SelectGameSystemService implements discordCommandType {
  private fuse = new Fuse<GameSystemJSON>(gameSystemList, options)
  public data = new SlashCommandBuilder()
    .setName(selectGameSystemConfig.name)
    .setDescription(selectGameSystemConfig.description)
    .addStringOption(option =>
      option
        .setName('gamesystem')
        .setDescription('キーワードを入力してゲームシステムを検索')
        .setAutocomplete(true)
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('channel-name')
        .setDescription(
          '作成するチャンネルの名前 ※デフォルトはゲームシステム名'
        )
    )

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedValue = interaction.options.getFocused()
    if (focusedValue === '') {
      await interaction.respond([])
      return
    }
    // Fuse.search() に長い文字列渡すと重くなるため200にslice
    const gameSystemSearchText = convertSearchText(focusedValue.slice(0, 200))
    const gameSystemSearchObj = gameSystemSearchText.map(e => ({ NAME: e }))
    const gameSystemSearchResults = this.fuse
      .search({ $or: gameSystemSearchObj })
      .map(e => e.item)
    // Discordの選択肢は25個までしか渡せないため25にslice
    await interaction.respond(
      gameSystemSearchResults
        .slice(0, 25)
        .map(e => ({ name: e.NAME, value: e.ID }))
    )
  }

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return

    const inputGameSystem = interaction.options.getString('gamesystem', true)

    const gameSystem = gameSystemList.find(
      e => e.ID === inputGameSystem || e.NAME === inputGameSystem
    )

    if (!gameSystem) {
      await interaction.reply(
        `ゲームシステムが見つかりませんでした : ${inputGameSystem}`
      )
      return
    }

    const inputChannelName = interaction.options.getString('channel-name')
    const channelName = inputChannelName ? inputChannelName : gameSystem.NAME

    const gameSystemCategory =
      getCategory(interaction.guild, CATEGORY_NAME) ||
      (await createCategory(interaction.guild, CATEGORY_NAME))

    const topic = `ここでは「${gameSystem.NAME}」のダイスが振れます\nID:${gameSystem.ID}\n※チャンネルトピックは変更しないでください ゲームシステムを認識できなくなる可能性があります`

    const channel = await interaction.guild?.channels.create({
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
