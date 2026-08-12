'use client'

import { Alert, Button, Container, Stack, Text } from '@mantine/core'
import { GENERIC_CHARACTER_DATA_LOAD_ERROR_MESSAGE } from '../../features/character/sheet-edit'

interface CharacterErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function CharacterError({ reset }: CharacterErrorProps) {
  return (
    <Container size="sm" py="xl">
      <Alert color="red">
        <Stack gap="sm">
          <Text>{GENERIC_CHARACTER_DATA_LOAD_ERROR_MESSAGE}</Text>
          <Button onClick={reset}>再試行</Button>
        </Stack>
      </Alert>
    </Container>
  )
}
