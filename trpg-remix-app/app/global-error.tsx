'use client'

import '@mantine/core/styles.css'
import { Button, ColorSchemeScript, MantineProvider, Stack, Text, Title, mantineHtmlProps } from '@mantine/core'
import theme from './theme'

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ja" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript forceColorScheme="dark" defaultColorScheme="dark" />
      </head>
      <body>
        <MantineProvider theme={theme} forceColorScheme="dark">
          <Stack align="center" p="xl">
            <Title order={1}>アプリケーションエラー</Title>
            <Text>画面を表示できませんでした。</Text>
            <Button onClick={reset}>再読み込み</Button>
          </Stack>
        </MantineProvider>
      </body>
    </html>
  )
}
