import { AxiosResponse } from 'axios'

/**
 * APIレスポンスの基本型
 */
export interface BaseApiResponse {
  success: boolean
}

/**
 * 成功レスポンス型（ドメインベース）
 */
export type SuccessApiResponse<T, Domain extends string> = BaseApiResponse & {
  success: true
} & Record<Domain, T>

/**
 * エラーレスポンス型
 */
export interface ErrorApiResponse extends BaseApiResponse {
  success: false
  message: string
  error?: string
}

/**
 * 統合APIレスポンス型
 * 成功時はドメインデータ、失敗時はエラー情報
 */
export type ApiResponse<T, Domain extends string> = SuccessApiResponse<T, Domain> | ErrorApiResponse

/**
 * Axiosレスポンス型（統合版）
 */
export type TypedAxiosResponse<T, Domain extends string> = AxiosResponse<ApiResponse<T, Domain>>

/**
 * APIクライアントの返り値型
 */
export interface ApiClientResponse<T, Domain extends string> {
  data: ApiResponse<T, Domain>
  status: number
  statusText: string
  headers: any
  config: any
}

/**
 * ドメイン定義（型安全性のため）
 */
export type KnownDomains = 'auth' | 'character' | 'user' | 'discord'

/**
 * ドメインデータ型マッピング
 */
export interface DomainDataMap {
  auth: {
    message: string
    discordUserId: string
    userName: string
    token: string
    user: {
      id: string
      username: string
      avatar?: string
    }
  }
  character: any // Character型をimportする場合は置き換え
  user: any // User型をimportする場合は置き換え
  discord: any
}

/**
 * 型安全なAPIレスポンス型生成ヘルパー
 */
export type DomainApiResponse<Domain extends KnownDomains> = ApiResponse<DomainDataMap[Domain], Domain>

/**
 * 型安全なAxiosレスポンス型生成ヘルパー
 */
export type DomainAxiosResponse<Domain extends KnownDomains> = TypedAxiosResponse<DomainDataMap[Domain], Domain>
