import { Text, Title } from '@mantine/core'
import { CharacterEditMock } from '~/features/character/components/characterEdit'

export default async function CharacterEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return (
    <>
      <Title order={1}>キャラクター編集</Title>
      <Text>ID: {id}</Text>
      <CharacterEditMock />
    </>
  )
}
