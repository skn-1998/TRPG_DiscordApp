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

  // ColorSchemeScript が hydrate 前に html[data-mantine-color-scheme] を書き換える。
  // 不一致は FOUC 防止の想定動作なので、公式 mantineHtmlProps で html 要素だけ警告を抑止する。
  return (
    <html lang="ja" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript forceColorScheme="dark" defaultColorScheme="dark" />
      </head>
      <body>
        <MantineProvider theme={theme} forceColorScheme="dark" defaultColorScheme="dark">
          <AppLayout authState={authState}>{children}</AppLayout>
        </MantineProvider>
      </body>
    </html>
  )
}
