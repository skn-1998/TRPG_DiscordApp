import { AppShell, useMantineTheme } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { Header } from './Header'
import { Footer } from './Footer'

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const [opened, { toggle }] = useDisclosure()
  const theme = useMantineTheme()

  return (
    <AppShell
      header={{ height: 60 }}
      footer={{ height: 'auto' }}
      padding="md"
      style={{
        backgroundColor: theme.colors.bg[0]
      }}
    >
      <AppShell.Header>
        <Header opened={opened} toggle={toggle} />
      </AppShell.Header>

      <AppShell.Main>{children}</AppShell.Main>

      <AppShell.Footer>
        <Footer />
      </AppShell.Footer>
    </AppShell>
  )
}
