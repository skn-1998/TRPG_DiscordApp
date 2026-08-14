import 'server-only'

import type {
  CharacterSheetVisibility,
  CharacterSummaryWire,
  CharacterWire,
  CreateCharacterFromTemplateResultWire,
  SaveCharacterSheetResultWire,
  SuccessEnvelope
} from '@trpg/api-contract'
import { apiClient } from '../../../lib/api-client.server'

export interface CharacterSheetChange {
  path: { fieldUid: string; partsKey?: string }
  baseValue: unknown
  newValue: unknown
}

interface UpdateCharacterSheetVisibilityResult {
  visibility: CharacterSheetVisibility
}

export async function createCharacterFromTemplate(input: {
  templateId: string
  templateVersion: string
  characterName: string
  values?: Record<string, unknown>
}): Promise<CreateCharacterFromTemplateResultWire> {
  const response = await apiClient.post<SuccessEnvelope<CreateCharacterFromTemplateResultWire>>(
    '/character/from-template',
    input
  )
  const data = response.data.data
  if ('rollOnCreateResults' in data) return data

  // 公開 wire は required を維持しつつ、cross-package の runtime 値は型では守れないため、
  // HTTP 境界で旧応答の rollOnCreateResults 欠落だけを空配列へ吸収する。
  return { ...data, rollOnCreateResults: [] }
}

export async function getCharacter(characterId: string): Promise<CharacterWire> {
  const response = await apiClient.get<SuccessEnvelope<CharacterWire>>(`/character/${characterId}`)
  return response.data.data
}

export async function getUserCharacterSummaries(): Promise<CharacterSummaryWire[]> {
  const response = await apiClient.get<SuccessEnvelope<CharacterSummaryWire[]>>('/character/summaries')
  return response.data.data
}

export async function saveCharacterSheet(input: {
  characterId: string
  baseRevision: number
  changes: CharacterSheetChange[]
}): Promise<SaveCharacterSheetResultWire> {
  const response = await apiClient.put<SuccessEnvelope<SaveCharacterSheetResultWire>>(
    `/character/${input.characterId}/sheet`,
    { baseRevision: input.baseRevision, changes: input.changes }
  )
  return response.data.data
}

export async function updateCharacterSheetVisibility(
  characterId: string,
  visibility: CharacterSheetVisibility
): Promise<UpdateCharacterSheetVisibilityResult> {
  const response = await apiClient.put<SuccessEnvelope<UpdateCharacterSheetVisibilityResult>>(
    `/character/${characterId}/sheet/visibility`,
    { visibility }
  )
  return response.data.data
}
