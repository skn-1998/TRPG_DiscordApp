import { Group, Text, Button, ActionIcon, useMantineTheme, darken, Loader } from '@mantine/core'
import { IconMenu2, IconDice6, IconUser, IconSettings, IconLogin } from '@tabler/icons-react'
import { Link } from '@remix-run/react'
import { useAuth } from '../../hooks/useAuth'

interface HeaderProps {
  opened?: boolean
  toggle?: () => void
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function Header({ toggle }: HeaderProps) {
  const theme = useMantineTheme()
  const { isLoggedIn, isLoading } = useAuth()

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
        ) : isLoggedIn ? (
          <Group gap="sm">
            <Button variant="subtle" color="accent" component={Link} to="/user" leftSection={<IconUser size={16} />}>
              ユーザーページ
            </Button>
            <ActionIcon variant="subtle" color="accent" component={Link} to="/settings">
              <IconSettings size={18} />
            </ActionIcon>
          </Group>
        ) : (
          <Button variant="subtle" color="accent" component={Link} to="/login" leftSection={<IconLogin size={16} />}>
            ログイン
          </Button>
        )}
      </Group>
    </Group>
  )
}
