import { Links, Meta, Outlet, Scripts, ScrollRestoration } from '@remix-run/react'
import { MantineProvider, ColorSchemeScript } from '@mantine/core'
import '@mantine/core/styles.css'
import './styles/globals.css'
import theme from './theme'
import { AppLayout } from './components/Layouts'

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <ColorSchemeScript forceColorScheme="dark" defaultColorScheme="dark" />
        <Meta />
        <Links />
      </head>
      <body>
        <MantineProvider theme={theme} forceColorScheme="dark" defaultColorScheme="dark">
          <AppLayout>{children}</AppLayout>
        </MantineProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  return <Outlet />
}
