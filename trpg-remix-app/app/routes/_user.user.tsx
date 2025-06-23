import { Outlet } from '@remix-run/react'
import { LoaderFunctionArgs } from '@remix-run/node'
import { requireLogin } from '../utils/auth-guards'
import { useAuth } from '../hooks/useAuth'

export const loader = async (args: LoaderFunctionArgs) => {
  // ログインが必須なので認証ガードを実行
  await requireLogin(args)

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
  // サーバーサイドの requireLogin() により、このコンポーネントに到達した時点で
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
