import * as path from 'path'
import { CommandInteraction, ChannelType } from 'discord.js'
import { loadJsonFile } from '../../../utils/file.util'

type GameSystemJSON = { ID: string; Name?: string }

const gameSystemList = loadJsonFile<GameSystemJSON[]>(path.join(__dirname, '../../../static/gameSystemList.json'))

export function getGameSystemIdFromTopic(topic: string | null | undefined): string | undefined {
  if (!topic) return
  const id = topic.split('\n')[1]?.replace(/^ID:/, '')
  return gameSystemList.find((e) => e.ID === id)?.ID
}

export function getParentChannelTopic(interaction: CommandInteraction): string | null | undefined {
  if (
    interaction.channel?.type === ChannelType.PrivateThread ||
    interaction.channel?.type === ChannelType.PublicThread
  ) {
    return interaction.channel.parent?.topic
  }
  return null
}
