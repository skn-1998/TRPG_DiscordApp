import { Container, Skeleton, Stack } from '@mantine/core'

export default function CharacterLoading() {
  return (
    <Container size="lg" py="xl">
      <Stack gap="lg" role="status" aria-label="キャラクター一覧を読み込み中">
        <Skeleton height={36} width="40%" />
        <Skeleton height={104} radius="md" />
        <Skeleton height={104} radius="md" />
      </Stack>
    </Container>
  )
}
