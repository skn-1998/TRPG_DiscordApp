import { Alert, Box, Button, SimpleGrid } from '@mantine/core'
import { Link } from '@remix-run/react'
import { CharacterCard, CharacterSummary } from './characterCard'

interface CharacterListProps {
  characters?: CharacterSummary[]
  onCharacterClick?: (character: CharacterSummary) => void
}

export function CharacterList({ characters = [], onCharacterClick }: CharacterListProps) {
  return (
    <Box p="md">
      {characters.length === 0 ? (
        <Alert color="blue" title="キャラクターがありません">
          published テンプレートから作成してください。{' '}
          <Button component={Link} to="/templates" size="xs" variant="light">
            テンプレート一覧へ
          </Button>
        </Alert>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
          {characters.map((character) => (
            <CharacterCard
              key={character.characterId}
              character={character}
              onClick={() => onCharacterClick?.(character)}
            />
          ))}
        </SimpleGrid>
      )}
    </Box>
  )
}
