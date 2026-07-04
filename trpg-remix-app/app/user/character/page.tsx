import type { DomainApiResponse } from '~/types/api'
import type { CharacterSummary } from '~/features/character/api/character.service'
import { UserCharacterPage } from '~/features/character/components/UserCharacterPage'
import { serverApiRequest } from '~/lib/server-api'

export default async function CharacterPage() {
  try {
    const response = await serverApiRequest<DomainApiResponse<'character'>>('/character/summaries')
    const characters = response.success ? (response.character as CharacterSummary[]) : []

    return <UserCharacterPage initialCharacters={characters} />
  } catch {
    return <UserCharacterPage initialCharacters={[]} loaderError="キャラクター一覧の取得に失敗しました。" />
  }
}
