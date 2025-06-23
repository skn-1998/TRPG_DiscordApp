import { apiClient } from '~/lib/api-client'
import { Character } from '~/lib/types'
import { CustomError } from '~/utils/customError'

// キャラクターカード表示用の軽量データ
export interface CharacterSummary {
  characterId: string
  characterName: string
  gameSystemId: string
}

// キャラクター作成
export async function createCharacter(
  characterData: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Character> {
  try {
    const response = await apiClient.post<Character>('/character', characterData)
    return response.data
  } catch (err: unknown) {
    throw new Error(CustomError(err))
  }
}

// キャラクター取得
export async function getCharacter(characterId: string): Promise<Character> {
  try {
    const response = await apiClient.get<Character>(`/characters/${characterId}`)
    return response.data
  } catch (err: unknown) {
    throw new Error(CustomError(err))
  }
}

// ユーザーのキャラクター一覧取得
export async function getUserCharacters(): Promise<Character[]> {
  try {
    const response = await apiClient.get<Character[]>('/character')
    return response.data
  } catch (err: unknown) {
    throw new Error(CustomError(err))
  }
}

// ユーザーのキャラクター軽量データ一覧取得（カード表示用）
export async function getUserCharacterSummaries(): Promise<CharacterSummary[]> {
  try {
    const response = await apiClient.get<CharacterSummary[]>('/character/summaries')
    console.log('response', response)
    return response.data
  } catch (err: unknown) {
    throw new Error(CustomError(err))
  }
}

// キャラクター更新
export async function updateCharacter(characterId: string, characterData: Partial<Character>): Promise<Character> {
  try {
    const response = await apiClient.put<Character>(`/characters/${characterId}`, characterData)
    return response.data
  } catch (err: unknown) {
    throw new Error(CustomError(err))
  }
}

// キャラクター削除
export async function deleteCharacter(characterId: string): Promise<void> {
  try {
    await apiClient.delete(`/characters/${characterId}`)
  } catch (err: unknown) {
    throw new Error(CustomError(err))
  }
}
