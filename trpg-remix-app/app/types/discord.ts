import type { DiscordGuildWire } from '@trpg/api-contract'

/**
 * Discord関連の型定義
 */

/**
 * Discordサーバー情報（/users/@me/guilds APIレスポンス形式）
 */
export type DiscordGuildInfo = DiscordGuildWire

/**
 * Select用のサーバーデータ
 */
export interface DiscordServerSelectOption {
  value: string
  label: string
}
