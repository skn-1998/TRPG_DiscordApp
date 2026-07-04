import { Box, Flex } from '@mantine/core'
import { UserPageNav } from '~/features/users'
import { requireUser } from '~/lib/auth.server'

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  await requireUser()

  return (
    <Flex mih="calc(100vh - 60px)" style={{ overflow: 'hidden' }}>
      <UserPageNav />
      <Box flex={1} p="md" style={{ overflowY: 'auto' }}>
        {children}
      </Box>
    </Flex>
  )
}
