import { Guild } from 'discord.js'

export const getChannelIdByName = (
  guild: Guild,
  channelName: string
): string => {
  const channel = guild.channels.cache.find(ch => ch.name === channelName)

  return channel ? channel.id : ''
}
