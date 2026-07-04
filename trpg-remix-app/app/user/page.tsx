import { Stack, Text, Title } from '@mantine/core'
import { requireUser } from '~/lib/auth.server'

export default async function UserPage() {
  const user = await requireUser()

  return (
    <Stack>
      <Title order={1}>{user.name}さんのダッシュボード</Title>
      <Text c="dimmed">左のメニューから管理する機能を選択してください。</Text>
    </Stack>
  )
}
