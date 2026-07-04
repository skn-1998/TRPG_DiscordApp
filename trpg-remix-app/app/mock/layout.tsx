'use client'

import Link from 'next/link'
import {
  AppShell,
  Burger,
  Button,
  Flex,
  Group,
  ScrollArea,
  Stack,
  darken,
  lighten,
  useMantineTheme
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { MockButton, ScrollTest } from '~/features/mock'

export default function MockLayout({ children }: { children: React.ReactNode }) {
  const theme = useMantineTheme()
  const [opened, { toggle }] = useDisclosure()

  return (
    <AppShell
      withBorder={false}
      header={{ height: 44 }}
      navbar={{ width: 230, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header bg={darken(theme.colors.bg[0], 0.4)}>
        <Flex align="center" h="100%">
          <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" p="md" />
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
            <Button component={Link} href="/mock/template-editor" variant="outline">
              テンプレートエディタ
            </Button>
            <Button component={Link} href="/mock/template-gallery" variant="outline">
              テンプレートギャラリー
            </Button>
          </Group>
          {children}
        </Stack>
      </AppShell.Main>
    </AppShell>
  )
}
