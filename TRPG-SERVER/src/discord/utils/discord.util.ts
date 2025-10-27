import {
  Channel,
  ChannelType,
  Client,
  Guild,
  CategoryChannel,
  TextChannel,
  GuildChannelCreateOptions
} from 'discord.js'

/**
 * 指定されたカテゴリを取得する
 * @param client Discordクライアント
 * @param guildId サーバーID
 * @param categoryName カテゴリ名
 * @returns カテゴリチャンネル、または見つからない場合はnull
 */
export async function getCategory(
  client: Client,
  guildId: string,
  categoryName: string
): Promise<CategoryChannel | null> {
  const guild = client.guilds.cache.get(guildId)

  if (!guild) {
    throw new Error(`サーバーID ${guildId} が見つかりません`)
  }

  const categories = guild.channels.cache.filter(
    (channel) => channel.type === ChannelType.GuildCategory && channel.name === categoryName
  )

  return categories.first() as CategoryChannel | null
}

/**
 * カテゴリを作成する
 * @param guild サーバー
 * @param categoryName カテゴリ名
 * @returns 作成されたカテゴリチャンネル
 */
export async function createCategory(guild: Guild, categoryName: string): Promise<CategoryChannel> {
  return guild.channels.create({
    name: categoryName,
    type: ChannelType.GuildCategory
  })
}

/**
 * チャンネルIDからチャンネルを検索する
 * @param client Discordクライアント
 * @param channelId チャンネルID
 * @returns チャンネル、または見つからない場合はnull
 */
export async function findChannelById(client: Client, channelId: string): Promise<Channel | null> {
  return client.channels.cache.get(channelId) || null
}

/**
 * テキストチャンネルを作成する
 * @param guild サーバー
 * @param options チャンネル作成オプション
 * @returns 作成されたテキストチャンネル
 */
export async function createTextChannel(
  guild: Guild,
  options: GuildChannelCreateOptions & { name: string }
): Promise<TextChannel> {
  return guild.channels.create({
    ...options,
    type: ChannelType.GuildText
  })
}
