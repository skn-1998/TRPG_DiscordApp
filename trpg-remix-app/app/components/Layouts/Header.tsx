import { Box, Group, Text, Button, ActionIcon, useMantineTheme } from '@mantine/core'
import { IconMenu2, IconDice6, IconUser, IconSettings } from '@tabler/icons-react'
import { Link } from '@remix-run/react'

interface HeaderProps {
  opened?: boolean
  toggle?: () => void
}

export function Header({ opened, toggle }: HeaderProps) {
  const theme = useMantineTheme()

  return (
    <Box
      h={60}
      px="md"
      style={{
        backgroundColor: theme.colors.bg[0],
        borderBottom: `1px solid ${theme.colors.main[8]}`,
        display: 'flex',
        alignItems: 'center'
      }}
    >
      <Group justify="space-between" style={{ width: '100%' }}>
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
          <Button variant="subtle" color="accent" component={Link} to="/sessions" leftSection={<IconDice6 size={16} />}>
            セッション
          </Button>

          <Button
            variant="subtle"
            color="accent"
            component={Link}
            to="/characters"
            leftSection={<IconUser size={16} />}
          >
            キャラクター
          </Button>

          <ActionIcon variant="subtle" color="accent" component={Link} to="/settings">
            <IconSettings size={18} />
          </ActionIcon>
        </Group>
      </Group>
    </Box>
  )
}
