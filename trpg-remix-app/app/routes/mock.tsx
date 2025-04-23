import { Outlet } from '@remix-run/react'
import { MockButton } from '~/features/mock'
import { AppShell, useMantineTheme, darken, lighten } from '@mantine/core'

export default function MockIndex() {
  const theme = useMantineTheme()
  
  return (
    <>
    <AppShell
          header={{ height: 60 }}
          navbar={{
            width: 250,
            breakpoint: 'sm',
          }}
          padding="md"
    >
      <AppShell.Header bg={darken(theme.colors.bg[0], 0.4)}></AppShell.Header>
      <AppShell.Navbar p="md" bg={lighten(theme.colors.bg[0], 0.05)}>Navbar</AppShell.Navbar>
      <AppShell.Main>
        <MockButton />
        <Outlet />
      </AppShell.Main>
    </AppShell>
    </>
  )
}
