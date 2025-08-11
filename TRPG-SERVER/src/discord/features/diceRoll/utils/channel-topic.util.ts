import { CommandInteraction, ChannelType } from 'discord.js'
import { loadJsonFile } from '../../../utils/loadJsonFile'

type GameSystemJSON = { ID: string; Name?: string }

const gameSystemList = loadJsonFile('src/discord/static/gameSystemList.json') as GameSystemJSON[]

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
