'use client'

import { CharacterList } from './characterList'
import type { CharacterSummary } from '../api/character.service'
import { useCharacterManagement } from '../hooks/useCharacterManagement'

interface UserCharacterPageProps {
  initialCharacters: CharacterSummary[]
  loaderError?: string
}

export function UserCharacterPage({ initialCharacters, loaderError }: UserCharacterPageProps) {
  const { characters, isLoading, error, handleCharacterCreated, handleCharacterDelete, handleManualRefresh, setError } =
    useCharacterManagement(initialCharacters)

  if (loaderError && characters.length === 0) {
    return (
      <div>
        <h2>キャラクターを読み込めませんでした</h2>
        <p>{loaderError}</p>
        <button onClick={handleManualRefresh} disabled={isLoading}>
          {isLoading ? '読み込み中...' : '再試行'}
        </button>
      </div>
    )
  }

  return (
    <div>
      {error && (
        <div role="alert">
          {error}
          <button onClick={() => setError(null)}>閉じる</button>
        </div>
      )}
      <button onClick={handleManualRefresh} disabled={isLoading}>
        {isLoading ? '更新中...' : 'キャラクターを更新'}
      </button>
      <CharacterList
        characters={characters}
        onEditCharacter={handleManualRefresh}
        onCharacterDelete={handleCharacterDelete}
        onCharacterCreated={handleCharacterCreated}
      />
    </div>
  )
}
