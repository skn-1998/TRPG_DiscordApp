import { apiClient } from '~/lib/api-client'
import { CustomError } from '~/utils/customError'
import { DiscordGuildInfo, DiscordGuildsResponse, DiscordServerSelectOption } from '../../../types/discord'

/**
 * ユーザーが参加しているDiscordサーバー一覧を取得する
 * @returns サーバー一覧とカウント情報
 */
export async function getDiscordServers(): Promise<DiscordGuildsResponse> {
  try {
    const response = await apiClient.get<DiscordGuildsResponse>('/users/discord/guilds')
    return response.data
  } catch (error) {
    console.error('Failed to fetch Discord servers:', error)
    throw error
  }
}

/**
 * Select用のデータ形式に変換
 * @param guilds サーバー一覧
 * @returns Select用データ形式
 */
export function formatGuildsForSelect(guilds: DiscordGuildInfo[]): DiscordServerSelectOption[] {
  return guilds.map((guild) => ({
    value: guild.id,
    label: guild.name
  }))
}

// Discord Bot操作関連の型定義
export interface SendMessageRequest {
  channelId: string
  content?: string
  embed?: {
    title?: string
    description?: string
    color?: string
    fields?: Array<{
      name: string
      value: string
      inline?: boolean
    }>
  }
  ephemeral?: boolean
}

export interface CreateChannelRequest {
  guildId: string
  name: string
  type?: 'text' | 'voice' | 'category' | 'thread'
  topic?: string
  parentId?: string
  position?: number
  nsfw?: boolean
  rateLimitPerUser?: number
}

export interface BotStatus {
  online: boolean
  guilds: number
  users: number
  ping: number
  uptime: number
}

export interface GuildInfo {
  id: string
  name: string
  memberCount: number
  channels: Array<{
    id: string
    name: string
    type: string
  }>
}

export interface ChannelInfo {
  id: string
  name: string
  type: string
  guild: {
    id: string
    name: string
  }
}

/**
 * Discord Bot経由でメッセージを送信する
 * @param messageData メッセージ送信データ
 */
export async function sendDiscordMessage(messageData: SendMessageRequest): Promise<{
  success: boolean
  messageId?: string
}> {
  try {
    const response = await apiClient.post<{
      success: boolean
      messageId?: string
    }>('/discord/send-message', messageData)
    return response.data
  } catch (err: unknown) {
    throw new Error(CustomError(err))
  }
}

/**
 * Discord Bot経由でチャンネルを作成する
 * @param channelData チャンネル作成データ
 */
export async function createDiscordChannel(channelData: CreateChannelRequest): Promise<{
  success: boolean
  channelId?: string
}> {
  try {
    const response = await apiClient.post<{
      success: boolean
      channelId?: string
    }>('/discord/create-channel', channelData)
    return response.data
  } catch (err: unknown) {
    throw new Error(CustomError(err))
  }
}

/**
 * Discord Bot の現在の状態を取得する
 */
export async function getDiscordBotStatus(): Promise<BotStatus> {
  try {
    const response = await apiClient.get<BotStatus>('/discord/status')
    return response.data
  } catch (err: unknown) {
    throw new Error(CustomError(err))
  }
}

/**
 * 指定されたギルドの情報を取得する
 * @param guildId ギルドID
 */
export async function getDiscordGuildInfo(guildId: string): Promise<GuildInfo> {
  try {
    const response = await apiClient.get<GuildInfo>(`/discord/guild/${guildId}`)
    return response.data
  } catch (err: unknown) {
    throw new Error(CustomError(err))
  }
}

/**
 * 指定されたチャンネルの情報を取得する
 * @param channelId チャンネルID
 */
export async function getDiscordChannelInfo(channelId: string): Promise<ChannelInfo> {
  try {
    const response = await apiClient.get<ChannelInfo>(`/discord/channel/${channelId}`)
    return response.data
  } catch (err: unknown) {
    throw new Error(CustomError(err))
  }
}

/**
 * Discord Bot経由でキャラクター情報をDiscordに送信する
 * @param characterId キャラクターID
 * @param channelId 送信先チャンネルID
 */
export async function sendCharacterToDiscord(
  characterId: string,
  channelId: string
): Promise<{
  success: boolean
  messageId?: string
}> {
  try {
    // キャラクター情報を取得（既存のcharacter.serviceから）
    const { getCharacter } = await import('~/features/character/api/character.service')
    const character = await getCharacter(characterId)

    // キャラクター情報をEmbed形式に変換
    const embed = {
      title: `キャラクター: ${character.characterName}`,
      description: character.description ? JSON.stringify(character.description) : 'キャラクターの詳細情報',
      color: '#0099ff',
      fields: [
        {
          name: 'ゲームシステム',
          value: character.gameSystemId,
          inline: true
        },
        {
          name: 'プレイヤー',
          value: character.discordUserId,
          inline: true
        }
      ]
    }

    // Discord Bot経由でメッセージ送信
    return await sendDiscordMessage({
      channelId,
      embed
    })
  } catch (err: unknown) {
    throw new Error(CustomError(err))
  }
}

/**
 * Discord Bot経由でダイスロール結果を送信する
 * @param channelId 送信先チャンネルID
 * @param diceCommand ダイスコマンド
 * @param result ダイスロール結果
 */
export async function sendDiceRollToDiscord(
  channelId: string,
  diceCommand: string,
  result: {
    total: number
    details: string
    success?: boolean
  }
): Promise<{
  success: boolean
  messageId?: string
}> {
  try {
    const embed = {
      title: `🎲 ダイスロール結果`,
      description: `コマンド: ${diceCommand}`,
      color: result.success ? '#00ff00' : '#ff0000',
      fields: [
        {
          name: '結果',
          value: result.total.toString(),
          inline: true
        },
        {
          name: '詳細',
          value: result.details,
          inline: false
        }
      ]
    }

    return await sendDiscordMessage({
      channelId,
      embed
    })
  } catch (err: unknown) {
    throw new Error(CustomError(err))
  }
}

/**
 * キャラクター情報をDiscordサーバーに投稿する
 * @param characterId キャラクターID
 * @param guildId DiscordサーバーID
 * @returns 投稿結果
 */
export async function postCharacterToDiscord(
  characterId: string,
  guildId: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const response = await apiClient.post<{ success: boolean; messageId?: string; error?: string }>(
      '/discord/post-character',
      {
        characterId,
        guildId
      }
    )
    return response.data
  } catch (error) {
    console.error('Failed to post character to Discord:', error)
    throw error
  }
}
