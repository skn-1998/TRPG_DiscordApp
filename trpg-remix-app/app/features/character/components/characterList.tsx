import { Box, SimpleGrid } from '@mantine/core'
import { CharacterCard, CharacterSummary } from './characterCard'
import { CreateCharacterCard } from './createCharacterCard'

interface CharacterListProps {
  characters?: CharacterSummary[]
  onCreateNew?: () => void
  onEditCharacter?: (character: CharacterSummary) => void
  onCharacterClick?: (character: CharacterSummary) => void
  onCharacterDelete?: (characterId: string) => void
}

export function CharacterList({ characters = [], onCreateNew, onEditCharacter, onCharacterClick }: CharacterListProps) {
  return (
    <Box p="md">
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
        {/* 新規作成カード */}
        <CreateCharacterCard onClick={onCreateNew} />

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
    </Box>
  )
}
