import 'server-only'

import type { CharacterSummaryWire, SuccessEnvelope } from '@trpg/api-contract'
import { apiClient } from '../../../lib/api-client.server'

export async function getUserCharacterSummaries(): Promise<CharacterSummaryWire[]> {
  const response = await apiClient.get<SuccessEnvelope<CharacterSummaryWire[]>>('/character/summaries')
  return response.data.data
}
