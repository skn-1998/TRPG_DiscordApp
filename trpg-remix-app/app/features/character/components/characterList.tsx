import { Box, SimpleGrid, Modal } from '@mantine/core'
import { useState } from 'react'
import { CharacterCard, CharacterSummary } from './characterCard'
import { CreateCharacterCard } from './createCharacterCard'
import { CharacterCreate } from './characterCreate'

interface CharacterListProps {
  characters?: CharacterSummary[]
  onCreateNew?: () => void
  onEditCharacter?: (character: CharacterSummary) => void
  onCharacterClick?: (character: CharacterSummary) => void
  onCharacterDelete?: (characterId: string) => void
  onCharacterCreated?: (character?: any) => void
}

export function CharacterList({
  characters = [],
  onCreateNew,
  onEditCharacter,
  onCharacterClick,
  onCharacterCreated
}: CharacterListProps) {
  const [createModalOpened, setCreateModalOpened] = useState(false)

  const handleCreateNew = () => {
    setCreateModalOpened(true)
    onCreateNew?.()
  }

  const handleCharacterCreated = (character?: any) => {
    setCreateModalOpened(false)
    onCharacterCreated?.(character)
  }

  return (
    <Box p="md">
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
        {/* 新規作成カード */}
        <CreateCharacterCard onClick={handleCreateNew} />

        {/* キャラクターカード */}
        {characters.map((character) => (
          <CharacterCard
            key={character.characterId}
            character={character}
            onEdit={() => onEditCharacter?.(character)}
            onClick={() => onCharacterClick?.(character)}
          />
        ))}
      </SimpleGrid>

      {/* キャラクター作成モーダル */}
      <Modal
        opened={createModalOpened}
        onClose={() => setCreateModalOpened(false)}
        title="新しいキャラクターを作成"
        size="md"
        centered
      >
        <CharacterCreate onCharacterCreated={handleCharacterCreated} />
      </Modal>
    </Box>
  )
}
