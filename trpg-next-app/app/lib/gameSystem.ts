import gameSystemList from '../static/gameSystemList.json'

type GameSystemSelectOption = { value: string; label: string }

export function getGameSystemNameById(id: string): string {
  return gameSystemList.find((gameSystem) => gameSystem.ID === id)?.NAME ?? ''
}

const gameSystemSearchValuesById = new Map(
  gameSystemList.map(({ ID, NAME, SEARCH_KEY_KANJI, SEARCH_KEY_HIRAGANA }) => [
    ID,
    [ID, NAME, SEARCH_KEY_KANJI, SEARCH_KEY_HIRAGANA].map((value) => value.toLocaleLowerCase('ja'))
  ])
)

// 表示ラベルの先頭にある NAME と同じ基準で探せるよう、日本語名の昇順に固定する。
export const gameSystemSelectOptions: GameSystemSelectOption[] = [...gameSystemList]
  .sort((left, right) => left.NAME.localeCompare(right.NAME, 'ja'))
  .map(({ ID, NAME }) => ({ value: ID, label: `${NAME}（${ID}）` }))

export function filterGameSystemOptions<T extends object>({
  options,
  search,
  limit
}: {
  options: T[]
  search: string
  limit?: number
}): T[] {
  const normalizedSearch = search.trim().toLocaleLowerCase('ja')
  const filteredOptions = normalizedSearch
    ? options.filter((option) => {
        if (!('value' in option) || typeof option.value !== 'string') return false
        const searchValues = gameSystemSearchValuesById.get(option.value) ?? [option.value.toLocaleLowerCase('ja')]
        return searchValues.some((value) => value.includes(normalizedSearch))
      })
    : options

  // Mantine は custom filter の結果へ limit を自動適用しないため、検索後にここで制限する。
  return limit === undefined ? filteredOptions : filteredOptions.slice(0, limit)
}

export function resolveGameSystemOptions(currentId?: string): GameSystemSelectOption[] {
  if (!currentId || gameSystemSelectOptions.some((option) => option.value === currentId)) {
    return gameSystemSelectOptions
  }

  return [{ value: currentId, label: `${currentId}（一覧に無い ID）` }, ...gameSystemSelectOptions]
}
