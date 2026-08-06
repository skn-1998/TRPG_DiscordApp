import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { ColorSchemeScript, MantineProvider } from '@mantine/core'
import '@mantine/core/styles.css'
import './globals.css'
import theme from './theme'

export const metadata: Metadata = {
  title: 'New Remix App',
  description: 'Welcome to Remix!'
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ja">
      <head>
        <ColorSchemeScript forceColorScheme="dark" defaultColorScheme="dark" />
      </head>
      <body>
        <MantineProvider theme={theme} forceColorScheme="dark" defaultColorScheme="dark">
          {children}
        </MantineProvider>
      </body>
    </html>
  )
}
