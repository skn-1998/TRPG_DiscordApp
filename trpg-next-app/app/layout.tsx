import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { ColorSchemeScript, MantineProvider, mantineHtmlProps } from '@mantine/core'
import '@mantine/core/styles.css'
import './globals.css'
import { AppLayout } from './components/Layouts/AppLayout'
import { getAuthState } from './lib/auth-state.server'
import theme from './theme'

export const metadata: Metadata = {
  title: 'TRPG アプリ',
  description: 'TRPG のキャラクターシート作成・管理アプリ'
}

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const authState = await getAuthState()

  return (
    <html lang="ja" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript forceColorScheme="dark" />
      </head>
      <body>
        <MantineProvider theme={theme} forceColorScheme="dark">
          <AppLayout authState={authState}>{children}</AppLayout>
        </MantineProvider>
      </body>
    </html>
  )
}
