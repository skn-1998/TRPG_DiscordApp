/**
 * Discord関連の型定義
 */

/**
 * Discordサーバー情報（/users/@me/guilds APIレスポンス形式）
 */
export interface DiscordGuildInfo {
  id: string
  name: string
  icon: string | null
  owner: boolean
  permissions: string
  features: string[]
}

/**
 * Discordサーバー一覧レスポンス
 */
export interface DiscordGuildsResponse {
  guilds: DiscordGuildInfo[]
  count: number
  message?: string
}

/**
 * Select用のサーバーデータ
 */
export interface DiscordServerSelectOption {
  value: string
  label: string
}
