import { apiClient } from '../../../lib/api-client'
import { DiscordGuildInfo, DiscordGuildsResponse, DiscordServerSelectOption } from '../../../types/discord'

/**
 * ユーザーが参加しているDiscordサーバー一覧を取得する
 * @returns サーバー一覧とカウント情報
 */
export async function getDiscordServers(): Promise<DiscordGuildsResponse> {
  try {
    const response = await apiClient.get<DiscordGuildsResponse>('/auth/discord/guilds')
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
