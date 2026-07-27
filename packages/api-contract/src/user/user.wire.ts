/**
 * UserController の直列化応答形。正典は server 実装。
 * S5a2 で server 側戻り型の契約参照化により機械固定済み。
 */
export interface UserProfileWire {
  discordUserId: string
  name: string
  avatarHash?: string | null
  characterIds: string[]
}

/**
 * UserController の直列化応答形。正典は server 実装。
 * S5a2 で server 側戻り型の契約参照化により機械固定済み。
 */
export interface DiscordGuildWire {
  id: string
  name: string
  icon: string | null
  owner: boolean
  permissions: string
  features: string[]
}

/**
 * UserController の直列化応答形。正典は server 実装。
 * S5a2 で server 側戻り型の契約参照化により機械固定済み。
 */
export interface DiscordGuildsPayloadWire {
  guilds: DiscordGuildWire[]
  count: number
  message: string
}
