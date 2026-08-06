import 'server-only'

import type { CharacterSummaryWire } from '@trpg/api-contract'
import { cookies } from 'next/headers'
import { getUserCharacterSummaries } from '../../features/character/api/character.service.server'

interface CharacterListData {
  characters: CharacterSummaryWire[]
  error: string | null
  isAuthenticated: boolean
}

const failedCharacterListData: CharacterListData = {
  characters: [],
  error: 'Failed to load characters',
  isAuthenticated: false
}

export async function getCharacterListData(): Promise<CharacterListData> {
  const jwt = (await cookies()).get('jwt')?.value
  if (!jwt) {
    return failedCharacterListData
  }

  try {
    const characters = await getUserCharacterSummaries()
    return {
      characters,
      error: null,
      isAuthenticated: true
    }
  } catch {
    return failedCharacterListData
  }
}
