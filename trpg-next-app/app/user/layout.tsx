import type { ReactNode } from 'react'
import { Box, Flex } from '@mantine/core'
import { redirect } from 'next/navigation'
import { UserPageNav } from '../features/users/components/UserPageNav'
import { requireJwt } from '../lib/auth-guard.server'
import { getAuthState } from '../lib/auth-state.server'

export default async function UserLayout({ children }: Readonly<{ children: ReactNode }>) {
  await requireJwt()

  const { user, degradedByInfraFailure } = await getAuthState()
  if (!user) {
    if (degradedByInfraFailure) {
      throw new Error('認証状態を取得できませんでした')
    }

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
