import { Card, Group, Text, ActionIcon, Box } from '@mantine/core'
import { IconSettings } from '@tabler/icons-react'

interface Character {
  id: string
  name: string
  gameSystem: string
  level?: number
  imageUrl?: string
}

interface CharacterCardProps {
  character: Character
  onEdit?: () => void
  onClick?: () => void
}

export function CharacterCard({ character, onEdit, onClick }: CharacterCardProps) {
  return (
    <Card
      shadow="sm"
      padding="lg"
      radius="md"
      withBorder
      style={{
        minHeight: '200px',
        cursor: onClick ? 'pointer' : 'default'
      }}
      onClick={onClick}
    >
      <Group justify="space-between" mt="md" mb="xs">
        <Text fw={500} size="lg" lineClamp={1}>
          {character.name}
        </Text>
        {onEdit && (
          <ActionIcon
            variant="light"
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
          >
            <IconSettings size={16} />
          </ActionIcon>
        )}
      </Group>

      <Text size="sm" c="dimmed" mb="xs">
        {character.gameSystem}
      </Text>
    </Card>
  )
}

export type { Character }
