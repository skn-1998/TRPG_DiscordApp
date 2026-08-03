import { Outlet } from '@remix-run/react'
import { LoaderFunctionArgs, redirect } from '@remix-run/node'
import { getJwtFromRequest } from '~/features/auth/api/auth.service'
import { apiClient, setServerRequestContext, clearServerRequestContext } from '~/lib/api-client'
import { useAuth } from '../hooks/useAuth'

// ログインが必須なので、この loader 自身で認証を検査する。
// 親 layout のガードは client-side transition で単独実行される子 loader を守れないため、
// ログイン必須のルートはそれぞれの loader でインライン検査するのが本プロジェクトの方式。
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const jwt = getJwtFromRequest(request)

  if (!jwt) {
    console.log('JWT not found, redirecting to login')
    throw redirect('/login')
  }

  // JWTが存在する場合、有効性を再確認
  try {
    // サーバーリクエストコンテキストを設定
    setServerRequestContext(request, jwt)

    const response = await apiClient.get('/users')
    if (!response.data) {
      console.log('Invalid JWT, redirecting to login')
      throw redirect('/login')
    }
    console.log('JWT validation successful')
  } catch (error) {
    console.error('認証確認エラー:', error)
    throw redirect('/login')
  } finally {
    // コンテキストをクリア
    clearServerRequestContext()
  }

  // 認証情報はRoot Loaderから取得できるので、追加のAPI呼び出しは不要
  return { success: true }
}

// ErrorBoundaryを追加してリダイレクトエラーを処理
export function ErrorBoundary() {
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h2>認証が必要です</h2>
      <p>このページにアクセスするにはログインしてください。</p>
      <a
        href="/login"
        style={{
          display: 'inline-block',
          padding: '10px 20px',
          backgroundColor: '#007bff',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '4px',
          marginTop: '10px'
        }}
      >
        ログインページへ
      </a>
    </div>
  )
}

export default function User() {
  // サーバーサイドの loader での認証検査により、このコンポーネントに到達した時点で
  // ユーザーは必ず認証済みです
  const { user } = useAuth()

  // ユーザー情報が存在しない場合のフォールバック
  // 通常はサーバーサイドで処理されるため、この状態は稀です
  if (!user) {
    return (
      <div>
        <p>ユーザー情報を読み込み中...</p>
      </div>
    )
  }

  return (
    <div>
      <Outlet context={{ user }} />
    </div>
  )
}
