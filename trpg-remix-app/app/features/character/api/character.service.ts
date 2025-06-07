import { apiClient, createAuthenticatedRequest } from '~/lib/api-client'
import { Character } from '~/lib/types'
import { CustomError } from '~/utils/customError'

// キャラクター作成
export async function createCharacter(
  characterData: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>,
  jwt: string
): Promise<Character> {
  try {
    const response = await apiClient.post<Character>('/character', characterData, createAuthenticatedRequest(jwt))
    return response.data
  } catch (err: unknown) {
    throw new Error(CustomError(err))
  }
}

// キャラクター取得
export async function getCharacter(characterId: string, jwt: string): Promise<Character> {
  try {
    const response = await apiClient.get<Character>(`/characters/${characterId}`, createAuthenticatedRequest(jwt))
    return response.data
  } catch (err: unknown) {
    throw new Error(CustomError(err))
  }
}

// ユーザーのキャラクター一覧取得
export async function getUserCharacters(jwt: string): Promise<Character[]> {
  try {
    const response = await apiClient.get<Character[]>('/character', createAuthenticatedRequest(jwt))
    return response.data
  } catch (err: unknown) {
    throw new Error(CustomError(err))
  }
}

// キャラクター更新
export async function updateCharacter(
  characterId: string,
  characterData: Partial<Character>,
  jwt: string
): Promise<Character> {
  try {
    const response = await apiClient.put<Character>(
      `/characters/${characterId}`,
      characterData,
      createAuthenticatedRequest(jwt)
    )
    return response.data
  } catch (err: unknown) {
    throw new Error(CustomError(err))
  }
}

// キャラクター削除
export async function deleteCharacter(characterId: string, jwt: string): Promise<void> {
  try {
    await apiClient.delete(`/characters/${characterId}`, createAuthenticatedRequest(jwt))
  } catch (err: unknown) {
    throw new Error(CustomError(err))
  }
}
