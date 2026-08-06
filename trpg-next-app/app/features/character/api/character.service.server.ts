import 'server-only'

import type {
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
  return response.data.data
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
