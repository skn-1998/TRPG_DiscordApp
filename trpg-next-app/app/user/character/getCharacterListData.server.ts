import 'server-only'

import type { CharacterSummaryWire } from '@trpg/api-contract'
import { getUserCharacterSummaries } from '../../features/character/api/character.service.server'
import { getResponseStatus } from '../../lib/api-response.util'
import { readJwt } from '../../lib/auth-guard.server'

interface CharacterListData {
  characters: CharacterSummaryWire[]
  isAuthenticated: boolean
}

// JWT 不在・認証拒否時も一覧ページを表示できる soft degrade 契約を維持する。
const failedCharacterListData: CharacterListData = {
  characters: [],
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
      isAuthenticated: true
    }
  } catch (error) {
    const status = getResponseStatus(error)
    if (status === 401 || status === 403) return failedCharacterListData
    throw error
  }
}
