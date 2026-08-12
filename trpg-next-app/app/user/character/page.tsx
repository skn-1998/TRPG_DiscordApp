import { CharacterPageClient } from '../../features/character/components/CharacterPageClient'
import { requireJwt } from '../../lib/auth-guard.server'
import { getCharacterListData } from './getCharacterListData.server'

export default async function UserCharacter() {
  await requireJwt()
  const characterListData = await getCharacterListData()
  return <CharacterPageClient characters={characterListData.characters} />
}
