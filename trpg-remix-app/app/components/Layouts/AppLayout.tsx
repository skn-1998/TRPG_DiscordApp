import { Box, useMantineTheme } from '@mantine/core'
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
    <Box
      style={{
        minHeight: '100vh',
        backgroundColor: theme.colors.bg[1],
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Header opened={opened} toggle={toggle} />

      <Box
        component="main"
        p="md"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <Box style={{ flex: 1 }}>{children}</Box>
        <Footer />
      </Box>
    </Box>
  )
}
