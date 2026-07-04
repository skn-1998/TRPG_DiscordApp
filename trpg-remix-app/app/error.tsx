'use client'

import { Button, Container, Stack, Text, Title } from '@mantine/core'

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Container size="sm" py="xl">
      <Stack align="center">
        <Title order={1}>申し訳ございません</Title>
        <Text>予期しないエラーが発生しました。</Text>
        <Button onClick={reset}>もう一度試す</Button>
      </Stack>
    </Container>
  )
}
