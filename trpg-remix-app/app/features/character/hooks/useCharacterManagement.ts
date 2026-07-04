'use client'

import { CharacterSummary } from '~/features/character/api/character.service'
import { useCharacterSummaries } from '~/lib/hooks/useCharacterSummaries'

export function useCharacterManagement(initialCharacters: CharacterSummary[]) {
  // CSR用のカスタムフック（SSRデータを初期値として使用）
  const {
    characters,
    isLoading,
    error,
    fetchCharacters,
    refreshCharacters,
    revalidateLoader,
    addCharacterOptimistic,
    removeCharacterOptimistic,
    setError
  } = useCharacterSummaries(initialCharacters)

  // キャラクター作成成功時の処理
  const handleCharacterCreated = async (newCharacter?: CharacterSummary) => {
    try {
      if (newCharacter) {
        // 楽観的更新: 即座にUIに反映
        addCharacterOptimistic(newCharacter)
      }

      // バックグラウンドでデータを同期
      await refreshCharacters()
    } catch (err) {
      console.error('Failed to refresh after character creation:', err)
      // 楽観的更新が失敗した場合はSSRデータに戻す
      revalidateLoader()
    }
  }

  // キャラクター削除時の処理
  const handleCharacterDelete = async (characterId: string) => {
    try {
      // 楽観的更新: 即座にUIから削除
      removeCharacterOptimistic(characterId)

      // バックグラウンドでデータを同期
      await refreshCharacters()
    } catch (err) {
      console.error('Failed to refresh after character deletion:', err)
      // 楽観的更新が失敗した場合はSSRデータに戻す
      revalidateLoader()
    }
  }

  // 手動更新ボタン
  const handleManualRefresh = () => {
    // エラーをクリアしてからデータ取得
    setError(null)
    fetchCharacters()
  }

  return {
    characters,
    isLoading,
    error,
    handleCharacterCreated,
    handleCharacterDelete,
    handleManualRefresh,
    setError
  }
}
