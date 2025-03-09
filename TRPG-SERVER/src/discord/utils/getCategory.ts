import { Guild, ChannelType, GuildBasedChannel } from 'discord.js'

export function getCategory(
  guild: Guild | null,
  cateName: string
): GuildBasedChannel | undefined {
  return guild?.channels.cache.find(
    channel =>
      channel.name === cateName && channel.type === ChannelType.GuildCategory
  )
}
