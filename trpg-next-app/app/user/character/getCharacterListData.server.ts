import 'server-only'

import type { CharacterSummaryWire } from '@trpg/api-contract'
import { redirect } from 'next/navigation'
import { getUserCharacterSummaries } from '../../features/character/api/character.service.server'
import { getResponseStatus } from '../../lib/api-response.util'

interface CharacterListData {
  characters: CharacterSummaryWire[]
}

export async function getCharacterListData(): Promise<CharacterListData> {
  try {
    const characters = await getUserCharacterSummaries()
    return { characters }
  } catch (error) {
    const status = getResponseStatus(error)
    if (status === 401 || status === 403) redirect('/login')
    throw error
  }
}
