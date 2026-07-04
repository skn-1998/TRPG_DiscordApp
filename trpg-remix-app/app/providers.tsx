'use client'

import { MantineProvider } from '@mantine/core'
import { AuthProvider } from './hooks/AuthProvider'
import type { ServerAuthState } from './lib/auth.server'
import theme from './theme'

interface ProvidersProps {
  authState: ServerAuthState
  children: React.ReactNode
}

export function Providers({ authState, children }: ProvidersProps) {
  return (
    <MantineProvider theme={theme} forceColorScheme="dark" defaultColorScheme="dark">
      <AuthProvider initialState={authState}>{children}</AuthProvider>
    </MantineProvider>
  )
}
