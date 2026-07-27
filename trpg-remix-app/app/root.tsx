import { Links, Meta, Outlet, Scripts, ScrollRestoration, isRouteErrorResponse, useRouteError } from '@remix-run/react'
import { MantineProvider, ColorSchemeScript } from '@mantine/core'
import { LoaderFunctionArgs } from '@remix-run/node'
import type { SuccessEnvelope } from '@trpg/api-contract'
import '@mantine/core/styles.css'
import './styles/globals.css'
import theme from './theme'
import { AppLayout } from './components/Layouts'
import { getJwtFromRequest } from './features/auth/api/auth.service'
import { apiClient, withJwt } from './lib/api-client'
import type { UserProfileData } from './types/user'

export async function loader({ request }: LoaderFunctionArgs) {
  const jwt = getJwtFromRequest(request)

  // JWTが存在しない場合は、認証状態をfalseで返す（リダイレクトしない）
  if (!jwt) {
    return {
      user: null,
      isLoggedIn: false,
      hasValidJwt: false
    }
  }

  try {
    // JWTが存在する場合のみ検証を実行
    const response = await apiClient.get<SuccessEnvelope<UserProfileData>>('/users', withJwt(jwt))
    const user = response.data.data
    console.log('🔍 Server Debug Info:', {
      hasUser: true,
      userInfo: user
    })
    return {
      user,
      isLoggedIn: true,
      hasValidJwt: true
    }
  } catch (error) {
    // JWT検証に失敗した場合も認証状態をfalseで返す（リダイレクトしない）
    console.error('JWT validation failed in root loader:', error)
    return {
      user: null,
      isLoggedIn: false,
      hasValidJwt: false
    }
  }
}

export function ErrorBoundary() {
  const error = useRouteError()

  // リダイレクトエラーの場合
  if (isRouteErrorResponse(error) && error.status === 302) {
    // 自動的にリダイレクト先へ移動
    window.location.href = '/login'
    return (
      <html lang="ja">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>リダイレクト中...</title>
        </head>
        <body>
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <p>リダイレクト中...</p>
          </div>
        </body>
      </html>
    )
  }

  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>エラーが発生しました</title>
        <ColorSchemeScript forceColorScheme="dark" defaultColorScheme="dark" />
      </head>
      <body>
        <MantineProvider theme={theme} forceColorScheme="dark" defaultColorScheme="dark">
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <h1>申し訳ございません</h1>
            <p>予期しないエラーが発生しました。</p>
            <details style={{ marginTop: '20px', textAlign: 'left' }}>
              <summary>エラー詳細</summary>
              <pre
                style={{
                  background: '#f5f5f5',
                  padding: '10px',
                  borderRadius: '4px',
                  overflow: 'auto',
                  fontSize: '12px'
                }}
              >
                {error instanceof Error ? error.stack : JSON.stringify(error, null, 2)}
              </pre>
            </details>
            <div style={{ marginTop: '20px' }}>
              <a
                href="/"
                style={{
                  display: 'inline-block',
                  padding: '10px 20px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '4px',
                  margin: '0 10px'
                }}
              >
                ホームに戻る
              </a>
              <a
                href="/login"
                style={{
                  display: 'inline-block',
                  padding: '10px 20px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '4px',
                  margin: '0 10px'
                }}
              >
                ログインページ
              </a>
            </div>
          </div>
        </MantineProvider>
      </body>
    </html>
  )
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
