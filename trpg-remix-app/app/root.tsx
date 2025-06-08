import { Links, Meta, Outlet, Scripts, ScrollRestoration } from '@remix-run/react'
import { MantineProvider, ColorSchemeScript } from '@mantine/core'
import { json, LoaderFunctionArgs } from '@remix-run/node'
import '@mantine/core/styles.css'
import './styles/globals.css'
import theme from './theme'
import { AppLayout } from './components/Layouts'
import { getJwtFromRequest } from './features/auth/api/auth.service'
import { apiClient, createAuthenticatedRequest } from './lib/api-client'

export async function loader({ request }: LoaderFunctionArgs) {
  const jwt = getJwtFromRequest(request)

  if (!jwt) {
    return json({
      user: null,
      isLoggedIn: false,
      hasValidJwt: false
    })
  }

  try {
    // JWTが存在する場合、バックエンドでトークンを検証
    const response = await apiClient.get('/users', createAuthenticatedRequest(jwt))

    if (response.data) {
      return json({
        user: response.data,
        isLoggedIn: true,
        hasValidJwt: true
      })
    } else {
      return json({
        user: null,
        isLoggedIn: false,
        hasValidJwt: false
      })
    }
  } catch (error) {
    // JWT検証に失敗した場合
    console.error('JWT validation failed in root loader:', error)
    return json({
      user: null,
      isLoggedIn: false,
      hasValidJwt: false
    })
  }
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
