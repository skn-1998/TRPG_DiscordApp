import { AxiosResponse } from 'axios'
import {
  ApiResponse,
  ErrorApiResponse,
  TypedAxiosResponse,
  KnownDomains,
  DomainDataMap,
  DomainAxiosResponse
} from '../types/api'

/**
 * レスポンス処理ユーティリティ
 */
export class ApiResponseUtil {
  /**
   * 成功レスポンスを処理する
   * @param response axiosレスポンス
   * @param domain ドメイン名
   * @returns ドメインデータ
   */
  static handleSuccess<T, Domain extends string>(response: TypedAxiosResponse<T, Domain>, domain: Domain): T {
    const { data } = response

    if (!data.success) {
      throw new Error('API response indicates failure')
    }

    const domainData = (data as any)[domain]
    if (!domainData) {
      throw new Error(`Domain '${domain}' not found in response`)
    }

    return domainData as T
  }

  /**
   * エラーレスポンスを処理する
   * @param error axiosエラー
   * @returns エラーメッセージ
   */
  static handleError(error: any): string {
    if (error.response?.data) {
      const errorData = error.response.data as ErrorApiResponse
      return errorData.message || errorData.error || 'Unknown error occurred'
    }

    if (error.message) {
      return error.message
    }

    return 'Network error occurred'
  }

  /**
   * レスポンスの成功/失敗をチェックする
   * @param response axiosレスポンス
   * @returns 成功フラグ
   */
  static isSuccess<T, Domain extends string>(
    response: TypedAxiosResponse<T, Domain>
  ): response is AxiosResponse<ApiResponse<T, Domain> & { success: true }> {
    return response.data.success === true
  }

  /**
   * ドメインデータの存在をチェックする
   * @param response axiosレスポンス
   * @param domain ドメイン名
   * @returns 存在フラグ
   */
  static hasDomain<T, Domain extends string>(response: TypedAxiosResponse<T, Domain>, domain: Domain): boolean {
    return response.data.success && (response.data as any)[domain] !== undefined
  }

  /**
   * 安全にドメインデータを取得する
   * @param response axiosレスポンス
   * @param domain ドメイン名
   * @returns ドメインデータ（存在しない場合はnull）
   */
  static getDomainSafely<T, Domain extends string>(response: TypedAxiosResponse<T, Domain>, domain: Domain): T | null {
    if (!this.isSuccess(response) || !this.hasDomain(response, domain)) {
      return null
    }

    return (response.data as any)[domain] as T
  }
}

/**
 * 型安全なAPIレスポンス処理のためのヘルパー関数
 */
export const createApiHandler = <Domain extends KnownDomains>(domain: Domain) => {
  type DataType = DomainDataMap[Domain]
  type ResponseType = DomainAxiosResponse<Domain>

  return {
    /**
     * 成功レスポンスを処理
     */
    handleSuccess: (response: ResponseType): DataType => {
      return ApiResponseUtil.handleSuccess<DataType, Domain>(response, domain)
    },

    /**
     * 安全にドメインデータを取得
     */
    getSafely: (response: ResponseType): DataType | null => {
      return ApiResponseUtil.getDomainSafely<DataType, Domain>(response, domain)
    },

    /**
     * ドメインの存在をチェック
     */
    hasData: (response: ResponseType): boolean => {
      return ApiResponseUtil.hasDomain<DataType, Domain>(response, domain)
    }
  }
}
