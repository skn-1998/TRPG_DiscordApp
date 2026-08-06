import 'server-only'

import type { CharacterSummaryWire } from '@trpg/api-contract'
import { getUserCharacterSummaries } from '../../features/character/api/character.service.server'
import { readJwt } from '../../lib/auth-guard.server'

interface CharacterListData {
  characters: CharacterSummaryWire[]
  error: string | null
  isAuthenticated: boolean
}

// error フィールドを含む返却形は旧 app の character loader 契約を pin する。
const failedCharacterListData: CharacterListData = {
  characters: [],
  error: 'Failed to load characters',
  isAuthenticated: false
}

export async function getCharacterListData(): Promise<CharacterListData> {
  // requireJwt で redirect せず、JWT 不在時も空一覧へ soft degrade する。
  const jwt = await readJwt()
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
