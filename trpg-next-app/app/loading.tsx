import { Container, Skeleton, Stack } from '@mantine/core'

export default function RootLoading() {
  return (
    <Container size="lg" py="xl">
      <Stack gap="lg" role="status" aria-label="ページを読み込み中">
        <Skeleton height={36} width="45%" />
        <Skeleton height={96} radius="md" />
        <Skeleton height={240} radius="md" />
      </Stack>
    </Container>
  )
}
