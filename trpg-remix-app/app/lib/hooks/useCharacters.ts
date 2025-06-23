import { useState, useEffect } from 'react'
import { getUserCharacters, createCharacter, updateCharacter, deleteCharacter } from '~/features/character'
import { Character } from '~/types'

export function useCharacters(jwt?: string) {
  const [characters, setCharacters] = useState<Character[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchCharacters = async () => {
    if (!jwt) return

    try {
      setIsLoading(true)
      setError(null)
      const data = await getUserCharacters()
      setCharacters(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch characters')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateCharacter = async (characterData: Omit<Character, '_id' | 'createdAt' | 'updatedAt'>) => {
    if (!jwt) throw new Error('JWT token is required')

    try {
      setError(null)
      const newCharacter = await createCharacter(characterData)
      setCharacters((prev) => [...prev, newCharacter])
      return newCharacter
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create character'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }

  const handleUpdateCharacter = async (characterId: string, characterData: Partial<Character>) => {
    if (!jwt) throw new Error('JWT token is required')

    try {
      setError(null)
      const updatedCharacter = await updateCharacter(characterId, characterData)
      setCharacters((prev) => prev.map((char) => (char.characterId === characterId ? updatedCharacter : char)))
      return updatedCharacter
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update character'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }

  const handleDeleteCharacter = async (characterId: string) => {
    if (!jwt) throw new Error('JWT token is required')

    try {
      setError(null)
      await deleteCharacter(characterId)
      setCharacters((prev) => prev.filter((char) => char.characterId !== characterId))
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete character'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }

  useEffect(() => {
    fetchCharacters()
  }, [jwt])

  return {
    characters,
    isLoading,
    error,
    refetch: fetchCharacters,
    createCharacter: handleCreateCharacter,
    updateCharacter: handleUpdateCharacter,
    deleteCharacter: handleDeleteCharacter
  }
}
