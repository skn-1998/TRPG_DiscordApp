import 'server-only'

import type {
  CharacterSheetVisibility,
  CharacterSummaryWire,
  CharacterWire,
  CreateCharacterFromTemplateResultWire,
  RerollCreationRollResultWire,
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

/**
 * 受信側だけの緩い写し。公開 wire は rollOnCreateResults を required に保つが、
 * 実際に届く JSON は旧 server 応答だと field ごと欠落しうる。
 * union で受けるのは、`in` チェックで「在る側」を公開 wire そのものへ絞り込み、
 * 欠落側だけを下の補完経路へ落とすため。
 */
type CreateCharacterFromTemplateResponseWire =
  | CreateCharacterFromTemplateResultWire
  | Omit<CreateCharacterFromTemplateResultWire, 'rollOnCreateResults'>

export async function createCharacterFromTemplate(input: {
  templateId: string
  templateVersion: string
  characterName: string
  values?: Record<string, unknown>
}): Promise<CreateCharacterFromTemplateResultWire> {
  const response = await apiClient.post<SuccessEnvelope<CreateCharacterFromTemplateResponseWire>>(
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

/**
 * 作成時ロールを宣言している field を振り直す。値は送らない（出目は server の実行結果だけを採用する）。
 *
 * 保存経路と違い baseRevision は情報値ではなく、server 側で sheet.revision との不一致がそのまま 409 になる。
 * 応答の revision を呼び出し側が次の基準へ書き戻す前提で、wire がそのキーを保証している。
 */
export async function rerollCreationRoll(input: {
  characterId: string
  fieldUid: string
  baseRevision: number
}): Promise<RerollCreationRollResultWire> {
  const response = await apiClient.post<SuccessEnvelope<RerollCreationRollResultWire>>(
    `/character/${input.characterId}/sheet/reroll`,
    { fieldUid: input.fieldUid, baseRevision: input.baseRevision }
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
