import { CharacterPageClient } from '../../features/character/components/CharacterPageClient'
import { getCharacterListData } from './getCharacterListData.server'

export default async function UserCharacter() {
  const characterListData = await getCharacterListData()
  return (
    <CharacterPageClient
      characters={characterListData.characters}
      isAuthenticated={characterListData.isAuthenticated}
    />
  )
}
