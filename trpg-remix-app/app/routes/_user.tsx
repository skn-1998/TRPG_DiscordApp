import { Outlet } from '@remix-run/react'
import { Flex, Box } from '@mantine/core'
import { UserPageNav } from '../features/users'

export default function User() {
  return (
    <Flex h="100vh" style={{ overflow: 'hidden' }}>
      {/* ナビゲーション */}
      <UserPageNav />

      {/* メインコンテンツ */}
      <Box
        flex={1}
        p="md"
        style={{
          overflowY: 'auto',
          height: '100vh'
        }}
      >
        <Outlet />
      </Box>
    </Flex>
  )
}
