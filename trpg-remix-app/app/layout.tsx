import type { Metadata } from 'next'
import { ColorSchemeScript, mantineHtmlProps } from '@mantine/core'
import '@mantine/core/styles.css'
import './styles/globals.css'
import { AppLayout } from './components/Layouts'
import { getAuthState } from './lib/auth.server'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: {
    default: 'TRPG Master',
    template: '%s | TRPG Master'
  },
  description: 'オンラインTRPGセッションの管理・支援アプリケーション'
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const authState = await getAuthState()

  return (
    <html lang="ja" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript forceColorScheme="dark" defaultColorScheme="dark" />
      </head>
      <body>
        <Providers authState={authState}>
          <AppLayout>{children}</AppLayout>
        </Providers>
      </body>
    </html>
  )
}
