'use client'

import { Alert, Button, Container, Stack, Text } from '@mantine/core'

export const GENERIC_DATA_LOAD_ERROR_MESSAGE =
  'データの取得に失敗しました。接続を確認して、再試行してください。'

interface DataLoadErrorProps {
  error: Error & { digest?: string }
  reset: () => void
  retry: () => void
}

export default function DataLoadError({ retry }: DataLoadErrorProps) {
  return (
    <Container size="sm" py="xl">
      <Alert color="red">
        <Stack gap="sm">
          <Text>{GENERIC_DATA_LOAD_ERROR_MESSAGE}</Text>
          <Button onClick={retry}>再試行</Button>
        </Stack>
      </Alert>
    </Container>
  )
}
