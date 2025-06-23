import { useState, useCallback } from 'react'
import { useRevalidator } from '@remix-run/react'
import { getUserCharacterSummaries, CharacterSummary } from '~/features/character/api/character.service'

export function useCharacterSummaries(initialCharacters: CharacterSummary[] = []) {
  const [characters, setCharacters] = useState<CharacterSummary[]>(initialCharacters)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const revalidator = useRevalidator()

  // CSRでキャラクターデータを取得
  const fetchCharacters = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await getUserCharacterSummaries()
      setCharacters(data)
      return data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load characters'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // loader関数の再実行（SSRデータの更新）
  const revalidateLoader = useCallback(() => {
    revalidator.revalidate()
  }, [revalidator])

  // CSRでの即座更新（ローディング表示なし）
  const refreshCharacters = useCallback(async () => {
    try {
      setError(null)
      const data = await getUserCharacterSummaries()
      setCharacters(data)
      return data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh characters'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [])

  // ローカル状態の更新（楽観的更新用）
  const updateLocalCharacters = useCallback((updater: (chars: CharacterSummary[]) => CharacterSummary[]) => {
    setCharacters(updater)
  }, [])

  // キャラクター追加（楽観的更新）
  const addCharacterOptimistic = useCallback((character: CharacterSummary) => {
    setCharacters((prev) => [...prev, character])
  }, [])

  // キャラクター削除（楽観的更新）
  const removeCharacterOptimistic = useCallback((characterId: string) => {
    setCharacters((prev) => prev.filter((char) => char.characterId !== characterId))
  }, [])

  return {
    characters,
    isLoading,
    error,
    // データ取得・更新
    fetchCharacters, // CSRでの完全取得（ローディング表示あり）
    refreshCharacters, // CSRでの即座更新（ローディング表示なし）
    revalidateLoader, // SSRデータの再取得
    // ローカル状態管理
    updateLocalCharacters, // 任意の更新関数
    addCharacterOptimistic, // 楽観的追加
    removeCharacterOptimistic, // 楽観的削除
    setError // エラー状態のリセット
  }
}
