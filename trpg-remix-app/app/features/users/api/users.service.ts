/* eslint-disable import/no-unresolved */
import { apiClient } from '~/lib/api-client'
import { User as TRPGUser } from '~/types'
import { CustomError } from '~/utils/customError'

// ユーザー情報取得
export async function getUserInfo(): Promise<TRPGUser> {
  try {
    const response = await apiClient.get<TRPGUser>('/users')
    return response.data
  } catch (err: unknown) {
    throw new Error(CustomError(err))
  }
}

// ユーザー情報更新
export async function updateUserInfo(userData: Partial<TRPGUser>): Promise<TRPGUser> {
  try {
    const response = await apiClient.put<TRPGUser>('/users', userData)
    return response.data
  } catch (err: unknown) {
    throw new Error(CustomError(err))
  }
}
