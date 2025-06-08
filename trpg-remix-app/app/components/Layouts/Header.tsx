import { Group, Text, Button, ActionIcon, useMantineTheme, darken, Loader, Menu, Avatar } from '@mantine/core'
import { IconMenu2, IconDice6, IconLogin, IconLogout, IconUser } from '@tabler/icons-react'
import { Link } from '@remix-run/react'
import { useAuth } from '../../hooks/useAuth'
import { getDiscordAvatarUrl, getDefaultDiscordAvatarUrl } from '../../utils/discordAvatar'

interface HeaderProps {
  opened?: boolean
  toggle?: () => void
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function Header({ toggle }: HeaderProps) {
  const theme = useMantineTheme()
  const { isLoggedIn, isLoading, hasValidJwt, user } = useAuth()

  const handleLogout = () => {
    // クッキーからJWTを削除
    document.cookie = 'jwt=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    // ログインページにリダイレクト
    window.location.href = '/login'
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
      {/* Left side - Menu and Logo */}
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
            to="/"
            style={{ textDecoration: 'none' }}
          >
            TRPG Master
          </Text>
        </Group>
      </Group>

      {/* Right side - Navigation */}
      <Group gap="md">
        {isLoading ? (
          <Loader size="sm" color={theme.colors.accent[5]} />
        ) : isLoggedIn && hasValidJwt && user ? (
          <Menu shadow="md" width={200}>
            <Menu.Target>
              <Avatar
                size={32}
                src={getDiscordAvatarUrl(user.discordUserId, user.avatarHash, 64)}
                alt={user.name}
                style={{ cursor: 'pointer' }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.src = getDefaultDiscordAvatarUrl(user.discordUserId, 64)
                }}
              />
            </Menu.Target>

            <Menu.Dropdown>
              <Menu.Item leftSection={<IconUser size={16} />} component={Link} to="/user">
                ユーザーページ
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item leftSection={<IconLogout size={16} />} onClick={handleLogout} color="red">
                ログアウト
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        ) : (
          <Button variant="subtle" color="accent" component={Link} to="/login" leftSection={<IconLogin size={16} />}>
            ログイン
          </Button>
        )}
      </Group>
    </Group>
  )
}
