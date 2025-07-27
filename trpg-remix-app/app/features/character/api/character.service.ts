import { apiClient } from '~/lib/api-client'
import { createApiHandler, ApiResponseUtil } from '~/lib/api-response.util'
import { Character } from '~/types'
import { CustomError } from '~/utils/customError'

// キャラクターカード表示用の軽量データ
export interface CharacterSummary {
  characterId: string
  characterName: string
  gameSystemId: string
}

// キャラクター用のAPIハンドラーを作成
const characterHandler = createApiHandler('character')

// キャラクター作成
export async function createCharacter(
  characterData: Omit<Character, '_id' | 'createdAt' | 'updatedAt'>
): Promise<Character> {
  try {
    const response = await apiClient.postDomain('/character', 'character', characterData)
    return characterHandler.handleSuccess(response)
  } catch (err: unknown) {
    const errorMessage = ApiResponseUtil.handleError(err)
    console.error('❌ キャラクター作成エラー:', errorMessage)
    throw new Error(CustomError(err))
  }
}

// キャラクター取得
export async function getCharacter(characterId: string): Promise<Character> {
  try {
    const response = await apiClient.getDomain(`/characters/${characterId}`, 'character')
    return characterHandler.handleSuccess(response)
  } catch (err: unknown) {
    const errorMessage = ApiResponseUtil.handleError(err)
    console.error('❌ キャラクター取得エラー:', errorMessage)
    throw new Error(CustomError(err))
  }
}

// ユーザーのキャラクター一覧取得
export async function getUserCharacters(): Promise<Character[]> {
  try {
    const response = await apiClient.getDomain('/character', 'character')
    return characterHandler.handleSuccess(response)
  } catch (err: unknown) {
    const errorMessage = ApiResponseUtil.handleError(err)
    console.error('❌ キャラクター一覧取得エラー:', errorMessage)
    throw new Error(CustomError(err))
  }
}

// ユーザーのキャラクター軽量データ一覧取得（カード表示用）
export async function getUserCharacterSummaries(): Promise<CharacterSummary[]> {
  try {
    const response = await apiClient.getDomain('/character/summaries', 'character')
    return characterHandler.handleSuccess(response)
  } catch (err: unknown) {
    const errorMessage = ApiResponseUtil.handleError(err)
    console.error('❌ キャラクターサマリー取得エラー:', errorMessage)
    throw new Error(CustomError(err))
  }
}

// キャラクター更新
export async function updateCharacter(characterId: string, characterData: Partial<Character>): Promise<Character> {
  try {
    const response = await apiClient.putDomain(`/characters/${characterId}`, 'character', characterData)
    return characterHandler.handleSuccess(response)
  } catch (err: unknown) {
    const errorMessage = ApiResponseUtil.handleError(err)
    console.error('❌ キャラクター更新エラー:', errorMessage)
    throw new Error(CustomError(err))
  }
}

// キャラクター削除
export async function deleteCharacter(characterId: string): Promise<void> {
  try {
    await apiClient.deleteDomain(`/characters/${characterId}`, 'character')
  } catch (err: unknown) {
    const errorMessage = ApiResponseUtil.handleError(err)
    console.error('❌ キャラクター削除エラー:', errorMessage)
    throw new Error(CustomError(err))
  }
}
