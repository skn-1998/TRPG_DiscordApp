'use client'

import type { ReactNode } from 'react'
import { useMantineTheme } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import type { AuthState } from '../../lib/auth-state.server'
import { Footer } from './Footer'
import { Header } from './Header'

interface AppLayoutProps {
  authState: AuthState
  children: ReactNode
}

export function AppLayout({ authState, children }: AppLayoutProps) {
  const [, { toggle }] = useDisclosure()
  const theme = useMantineTheme()

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: theme.colors.bg[0],
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Header authState={authState} toggle={toggle} />

      <main
        style={{
          flex: 1,
          padding: '16px'
        }}
      >
        {children}
      </main>

      <Footer />
    </div>
  )
}
