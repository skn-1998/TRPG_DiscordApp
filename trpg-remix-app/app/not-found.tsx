import Link from 'next/link'
import { Button, Container, Stack, Text, Title } from '@mantine/core'

export default function NotFound() {
  return (
    <Container size="sm" py="xl">
      <Stack align="center">
        <Title order={1}>ページが見つかりません</Title>
        <Text>URLをご確認ください。</Text>
        <Button component={Link} href="/">
          ホームへ戻る
        </Button>
      </Stack>
    </Container>
  )
}
