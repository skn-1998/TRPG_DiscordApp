import { Container, Skeleton, Stack } from '@mantine/core'

export default function CharacterSheetLoading() {
  return (
    <Container size="sm" py="xl">
      <Stack gap="lg" role="status" aria-label="キャラクターシートを読み込み中">
        <Skeleton height={36} width="55%" />
        <Skeleton height={48} radius="md" />
        <Skeleton height={320} radius="md" />
      </Stack>
    </Container>
  )
}
