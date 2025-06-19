import { Card, Text, Box, Center } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'

interface CreateCharacterCardProps {
  onClick?: () => void
}

export function CreateCharacterCard({ onClick }: CreateCharacterCardProps) {
  return (
    <Card
      shadow="sm"
      padding="lg"
      radius="md"
      withBorder
      style={{
        cursor: 'pointer',
        minHeight: '200px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderStyle: 'dashed',
        borderWidth: '2px',
        borderColor: '#ced4da',
        backgroundColor: '#f8f9fa',
        transition: 'all 0.2s ease'
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#e9ecef'
        e.currentTarget.style.borderColor = '#adb5bd'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = '#f8f9fa'
        e.currentTarget.style.borderColor = '#ced4da'
      }}
    >
      <Center>
        <Box ta="center">
          <IconPlus size={48} color="#868e96" />
          <Text size="lg" mt="sm" c="dimmed">
            新しいキャラクター
          </Text>
        </Box>
      </Center>
    </Card>
  )
}
