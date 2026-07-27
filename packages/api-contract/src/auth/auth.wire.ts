/**
 * AuthController の直列化応答形。正典は server 実装。
 * S5a2 で server 側戻り型の契約参照化により、avatar の null を含めて機械固定済み。
 */
export interface LoginDataWire {
  message: string
  discordUserId: string
  userName: string
  token: string
  user: {
    id: string
    username: string
    avatar?: string | null
  }
}
