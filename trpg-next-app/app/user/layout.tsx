import type { ReactNode } from 'react'
import { Box, Flex } from '@mantine/core'
import { redirect } from 'next/navigation'
import { UserPageNav } from '../features/users/components/UserPageNav'
import { apiClient } from '../lib/api-client.server'
import { requireJwt } from '../lib/auth-guard.server'

export default async function UserLayout({ children }: Readonly<{ children: ReactNode }>) {
  await requireJwt()

  try {
    // root の getAuthState とは別に /users を再取得し、/user 配下の hard gate を成立させる。
    await apiClient.get('/users')
  } catch {
    redirect('/login')
  }

  return (
    <Flex h="100vh" style={{ overflow: 'hidden' }}>
      <UserPageNav />

      <Box
        flex={1}
        p="md"
        style={{
          overflowY: 'auto',
          height: '100vh'
        }}
      >
        {children}
      </Box>
    </Flex>
  )
}
