/* eslint-disable import/no-unresolved */
import { apiClient, createAuthenticatedRequest } from '~/lib/api-client'
import { TRPGUser } from '~/lib/types'
import { CustomError } from '~/utils/customError'

// ユーザー情報取得
export async function getUserInfo(jwt: string): Promise<TRPGUser> {
  try {
    const response = await apiClient.get<TRPGUser>('/users', createAuthenticatedRequest(jwt))
    return response.data
  } catch (err: unknown) {
    throw new Error(CustomError(err))
  }
}

// ユーザー情報更新
export async function updateUserInfo(userData: Partial<TRPGUser>, jwt: string): Promise<TRPGUser> {
  try {
    const response = await apiClient.put<TRPGUser>('/users', userData, createAuthenticatedRequest(jwt))
    return response.data
  } catch (err: unknown) {
    throw new Error(CustomError(err))
  }
}
