import { Links, Meta, Outlet, Scripts, ScrollRestoration } from '@remix-run/react'
import { MantineProvider, ColorSchemeScript } from '@mantine/core'
import { json, LoaderFunctionArgs } from '@remix-run/node'
import '@mantine/core/styles.css'
import './styles/globals.css'
import theme from './theme'
import { AppLayout } from './components/Layouts'
import { getJwtFromRequest } from './features/auth/api/auth.service'

export async function loader({ request }: LoaderFunctionArgs) {
  const jwt = getJwtFromRequest(request)
  const isLoggedIn = !!jwt

  return json({
    user: isLoggedIn ? { authenticated: true } : null,
    isLoggedIn
  })
}

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
