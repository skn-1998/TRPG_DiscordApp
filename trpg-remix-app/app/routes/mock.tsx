import { Outlet } from '@remix-run/react'
import { MockButton, Header, ScrollTest } from '~/features/mock'
import {
  AppShell,
  useMantineTheme,
  darken,
  lighten,
  Burger,
  ScrollArea,
  Center,
  Flex,
  Container,
  Stack,
  Button,
  Group
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { Link } from '@remix-run/react'

export default function MockIndex() {
  const theme = useMantineTheme()
  const [opened, { toggle }] = useDisclosure()

  return (
    <>
      <AppShell
        withBorder={false}
        header={{ height: 44 }}
        navbar={{
          width: 230,
          breakpoint: 'sm',
          collapsed: { mobile: !opened }
        }}
        padding="md"
      >
        <AppShell.Header bg={darken(theme.colors.bg[0], 0.4)}>
          <Flex align="center" h="100%">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" p="md" />
            {/* <Header /> */}
          </Flex>
        </AppShell.Header>
        <AppShell.Navbar p="md" bg={lighten(theme.colors.bg[0], 0.05)} h="100%">
          <AppShell.Section>Navbar</AppShell.Section>
          <AppShell.Section grow component={ScrollArea}>
            <ScrollTest />
          </AppShell.Section>
        </AppShell.Navbar>
        <AppShell.Main>
          <Stack gap="md">
            <Group>
              <MockButton />
              <Button component={Link} to="/mock/template-editor" variant="outline">
                テンプレートエディタ
              </Button>
              <Button component={Link} to="/mock/template-gallery" variant="outline">
                テンプレートギャラリー
              </Button>
            </Group>
            <Outlet />
          </Stack>
        </AppShell.Main>
      </AppShell>
    </>
  )
}
