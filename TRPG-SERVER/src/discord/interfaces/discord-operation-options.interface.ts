import type { ChannelType, MessageCreateOptions, OverwriteResolvable } from 'discord.js'

export type DiscordSendMessageOptions = Pick<MessageCreateOptions, 'embeds' | 'components' | 'files'>

export type DiscordGuildChannelTypeName = 'text' | 'voice' | 'category' | 'news' | 'stage' | 'forum'

export type DiscordGuildChannelType =
  | ChannelType.GuildText
  | ChannelType.GuildVoice
  | ChannelType.GuildCategory
  | ChannelType.GuildAnnouncement
  | ChannelType.GuildStageVoice
  | ChannelType.GuildForum

export interface DiscordChannelCreationOptions {
  type?: DiscordGuildChannelType | DiscordGuildChannelTypeName
  parent?: string
  topic?: string
  permissions?: OverwriteResolvable[]
}
