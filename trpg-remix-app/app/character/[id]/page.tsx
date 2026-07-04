import { Text, Title } from '@mantine/core'

export default async function CharacterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return (
    <>
      <Title order={1}>キャラクター詳細</Title>
      <Text>ID: {id}</Text>
    </>
  )
}
