// 共通のAPI応答型
export interface ApiResponse<T = unknown> {
  data: T
  message?: string
  success: boolean
}

// ユーザー関連の型
export interface TRPGUser {
  message?: string
  DiscordUserId: string
  userName: string
  token?: string
  characterId?: string[]
}

// キャラクター関連の型
export interface GameSystemJSON {
  ID: string
  NAME: string
  SORT_KEY: string
  HELP_MESSAGE: string
  PRIORITY?: number
}

export interface Character {
  id?: string
  name: string
  gameSystemId: string
  userId: string
  createdAt?: string
  updatedAt?: string
}

// 認証関連の型
export interface AuthResult {
  user: TRPGUser
  token: string
}

export interface LoginRequest {
  code: string
}

// Cookie関連の型
export interface CookieHeader {
  'Set-Cookie': string
  'Content-Type': 'application/json'
}
