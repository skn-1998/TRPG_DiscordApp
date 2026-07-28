import type {
  CharacterDeleteResultWire,
  CharacterHubStatusWire,
  CharacterSummaryWire,
  CharacterWire,
  CreateCharacterFromTemplateResultWire,
  SaveCharacterSheetResultWire,
  SuccessEnvelope
} from '@trpg/api-contract'
import { apiClient } from '~/lib/api-client'
import { ApiResponseUtil } from '~/lib/api-response.util'
import { Character } from '~/types'
import { CustomError } from '~/utils/customError'

// キャラクターカード表示用の軽量データ
export type CharacterHubStatus = CharacterHubStatusWire
export type CharacterSummary = CharacterSummaryWire

export interface CharacterSheetChange {
  path: { fieldUid: string; partsKey?: string }
  baseValue: unknown
  newValue: unknown
}

function unwrapSheetResponse<T>(body: SuccessEnvelope<T> | T): T {
  // 対象の生 payload は success/data キーを持たないため、この2条件で封筒と誤判別しない。
  if (body !== null && typeof body === 'object' && 'success' in body && body.success === true && 'data' in body) {
    return (body as SuccessEnvelope<T>).data
  }

  return body as T
}

export async function createCharacterFromTemplate(input: {
  templateId: string
  templateVersion: string
  characterName: string
  values?: Record<string, unknown>
}): Promise<CreateCharacterFromTemplateResultWire> {
  const response = await apiClient.post<
    SuccessEnvelope<CreateCharacterFromTemplateResultWire> | CreateCharacterFromTemplateResultWire
  >('/character/from-template', input)
  return unwrapSheetResponse(response.data)
}

// キャラクター取得
export async function getCharacter(characterId: string): Promise<CharacterWire> {
  try {
    const response = await apiClient.get<SuccessEnvelope<CharacterWire>>(`/character/${characterId}`)
    return response.data.data
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
    return response.data.data
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
    return response.data.data
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
    return response.data.data
  } catch (err: unknown) {
    const errorMessage = ApiResponseUtil.handleError(err)
    console.error('❌ キャラクター更新エラー:', errorMessage)
    throw new Error(CustomError(err))
  }
}

// キャラクター削除
export async function deleteCharacter(characterId: string): Promise<CharacterDeleteResultWire> {
  try {
    const response = await apiClient.delete<SuccessEnvelope<CharacterDeleteResultWire>>(`/character/${characterId}`)
    return response.data.data
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
}): Promise<SaveCharacterSheetResultWire> {
  const response = await apiClient.put<SuccessEnvelope<SaveCharacterSheetResultWire> | SaveCharacterSheetResultWire>(
    `/character/${input.characterId}/sheet`,
    { baseRevision: input.baseRevision, changes: input.changes }
  )
  return unwrapSheetResponse(response.data)
}
