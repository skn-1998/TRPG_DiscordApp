import { Card, Group, Text, ActionIcon } from '@mantine/core'
import { IconSettings } from '@tabler/icons-react'
import { getGameSystemNameById } from '~/lib'

// 軽量キャラクターデータ
interface CharacterSummary {
  characterId: string
  characterName: string
  gameSystemId: string
}

interface CharacterCardProps {
  character: CharacterSummary
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
          {character.characterName}
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
        System Name: {getGameSystemNameById(character.gameSystemId)}
      </Text>
    </Card>
  )
}

export type { CharacterSummary }
