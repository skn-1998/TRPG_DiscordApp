import { apiClient } from '~/lib/api-client'
import { ApiResponseUtil } from '~/lib/api-response.util'
import { Character } from '~/types'
import { CustomError } from '~/utils/customError'

// キャラクターカード表示用の軽量データ
export type CharacterHubStatus = 'none' | 'publishing' | 'active' | 'error'

export interface CharacterSummary {
  characterId: string
  characterName: string
  gameSystemId: string
  templateVersion?: string
  hub?: { status: CharacterHubStatus }
}

export interface MaterializedCharacter {
  characterId: string
  characterName: string
  gameSystemId: string
  discordUserId: string
  description?: Record<string, unknown>
  sheet?: {
    templateId: string
    templateVersion: string
    revision: number
    values: Record<string, unknown>
  }
}

export interface CharacterSheetChange {
  path: { fieldUid: string; partsKey?: string }
  baseValue: unknown
  newValue: unknown
}

interface SuccessEnvelope<T> {
  success: true
  data: T
}

function unwrapCharacterResponse<T>(response: { data: SuccessEnvelope<T> }): T {
  if (!response.data.success) throw new Error('API response indicates failure')
  return response.data.data
}

export async function createCharacterFromTemplate(input: {
  templateId: string
  templateVersion: string
  characterName: string
  values?: Record<string, unknown>
}): Promise<{ characterId: string }> {
  const response = await apiClient.post<{ characterId: string }>('/character/from-template', input)
  return response.data
}

// キャラクター取得
export async function getCharacter(characterId: string): Promise<MaterializedCharacter> {
  try {
    const response = await apiClient.get<SuccessEnvelope<MaterializedCharacter>>(`/character/${characterId}`)
    return unwrapCharacterResponse(response)
  } catch (err: unknown) {
    const errorMessage = ApiResponseUtil.handleError(err)
    console.error('❌ キャラクター取得エラー:', errorMessage)
    throw new Error(CustomError(err))
  }
}

// ユーザーのキャラクター一覧取得
export async function getUserCharacters(): Promise<Character[]> {
  try {
    const response = await apiClient.get<SuccessEnvelope<Character[]>>('/character')
    return unwrapCharacterResponse(response)
  } catch (err: unknown) {
    const errorMessage = ApiResponseUtil.handleError(err)
    console.error('❌ キャラクター一覧取得エラー:', errorMessage)
    throw new Error(CustomError(err))
  }
}

// ユーザーのキャラクター軽量データ一覧取得（カード表示用）
export async function getUserCharacterSummaries(): Promise<CharacterSummary[]> {
  try {
    const response = await apiClient.get<SuccessEnvelope<CharacterSummary[]>>('/character/summaries')
    return unwrapCharacterResponse(response)
  } catch (err: unknown) {
    const errorMessage = ApiResponseUtil.handleError(err)
    console.error('❌ キャラクターサマリー取得エラー:', errorMessage)
    throw new Error(CustomError(err))
  }
}

// キャラクター更新
export async function updateCharacter(characterId: string, characterData: Partial<Character>): Promise<Character> {
  try {
    const response = await apiClient.put<SuccessEnvelope<Character>>(`/character/${characterId}`, characterData)
    return unwrapCharacterResponse(response)
  } catch (err: unknown) {
    const errorMessage = ApiResponseUtil.handleError(err)
    console.error('❌ キャラクター更新エラー:', errorMessage)
    throw new Error(CustomError(err))
  }
}

// キャラクター削除
export async function deleteCharacter(characterId: string): Promise<void> {
  try {
    await apiClient.delete(`/character/${characterId}`)
  } catch (err: unknown) {
    const errorMessage = ApiResponseUtil.handleError(err)
    console.error('❌ キャラクター削除エラー:', errorMessage)
    throw new Error(CustomError(err))
  }
}

export async function saveCharacterSheet(input: {
  characterId: string
  baseRevision: number
  changes: CharacterSheetChange[]
}): Promise<{ revision: number; noOp: boolean; appliedChanges: number }> {
  const response = await apiClient.put<{ revision: number; noOp: boolean; appliedChanges: number }>(
    `/character/${input.characterId}/sheet`,
    { baseRevision: input.baseRevision, changes: input.changes }
  )
  return response.data
}
