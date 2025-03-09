import { Guild, ChannelType, GuildBasedChannel } from 'discord.js'

export async function createCategory(
  guild: Guild | null,
  cateName: string
): Promise<GuildBasedChannel | undefined> {
  return await guild?.channels.create({
    name: cateName,
    type: ChannelType.GuildCategory
  })
}
