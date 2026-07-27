import type { DiscordGuildsPayloadWire, SuccessEnvelope } from '@trpg/api-contract'
import { apiClient } from '~/lib/api-client'
import { DiscordGuildInfo, DiscordServerSelectOption } from '../../../types/discord'

/**
 * ユーザーが参加しているDiscordサーバー一覧を取得する
 * @returns サーバー一覧とカウント情報
 */
export async function getDiscordServers(): Promise<DiscordGuildsPayloadWire> {
  try {
    const response = await apiClient.get<SuccessEnvelope<DiscordGuildsPayloadWire>>('/users/discord/guilds')
    return response.data.data
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
