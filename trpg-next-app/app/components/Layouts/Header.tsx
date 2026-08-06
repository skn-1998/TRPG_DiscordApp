'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ActionIcon, Avatar, Button, darken, Group, Menu, Text, useMantineTheme } from '@mantine/core'
import { IconDice6, IconLogin, IconLogout, IconMenu2, IconUser } from '@tabler/icons-react'
import { logout } from '../../features/auth/actions'
import type { AuthState } from '../../lib/auth-state.server'
import { getDefaultDiscordAvatarUrl, getDiscordAvatarUrl } from '../../utils/discordAvatar'

interface HeaderProps {
  authState: AuthState
  toggle?: () => void
}

export function Header({ authState, toggle }: HeaderProps) {
  const theme = useMantineTheme()
  const router = useRouter()
  const { isLoggedIn, hasValidJwt, user } = authState

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('ログアウトエラー:', error)
      router.push('/login')
    }
  }

  return (
    <Group
      justify="space-between"
      h={60}
      px="md"
      style={{
        backgroundColor: darken(theme.colors.bg[0], 0.4),
        width: '100%'
      }}
    >
      <Group>
        {toggle && (
          <ActionIcon onClick={toggle} variant="transparent" size="md" color={theme.colors.accent[5]}>
            <IconMenu2 size={18} />
          </ActionIcon>
        )}

        <Group gap="xs">
          <IconDice6 size={28} color={theme.colors.accent[5]} />
          <Text
            size="xl"
            fw={700}
            c={theme.colors.accent[5]}
            component={Link}
            href="/"
            style={{ textDecoration: 'none' }}
          >
            TRPG Master
          </Text>
        </Group>
      </Group>

      <Group gap="md">
        {isLoggedIn && hasValidJwt && user ? (
          <Menu shadow="md" width={200}>
            <Menu.Target>
              <Avatar
                size={32}
                src={getDiscordAvatarUrl(user.discordUserId, user.avatarHash, 64)}
                alt={user.name}
                style={{ cursor: 'pointer' }}
                onError={(event) => {
                  const target = event.target as HTMLImageElement
                  target.src = getDefaultDiscordAvatarUrl(user.discordUserId, 64)
                }}
              />
            </Menu.Target>

            <Menu.Dropdown>
              <Menu.Item leftSection={<IconUser size={16} />} component={Link} href="/user">
                ユーザーページ
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item leftSection={<IconLogout size={16} />} onClick={handleLogout} color="red">
                ログアウト
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        ) : (
          <Button variant="subtle" color="accent" component={Link} href="/login" leftSection={<IconLogin size={16} />}>
            ログイン
          </Button>
        )}
      </Group>
    </Group>
  )
}
