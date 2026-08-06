import { CharacterPageClient } from '../../features/character/components/CharacterPageClient'
import { getCharacterListData } from './getCharacterListData.server'

export default async function UserCharacter() {
  // requireJwt は意図的に呼ばず、character 一覧の soft degrade を維持する。
  const characterListData = await getCharacterListData()
  return (
    <CharacterPageClient
      characters={characterListData.characters}
      isAuthenticated={characterListData.isAuthenticated}
    />
  )
}
