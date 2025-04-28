import { Outlet } from '@remix-run/react'
import { MockButton, Header, ScrollTest } from '~/features/mock'
import { AppShell, useMantineTheme, darken, lighten, Burger, ScrollArea, Center, Flex, Container } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'

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
          <MockButton />
          <Outlet />
        </AppShell.Main>
      </AppShell>
    </>
  )
}
