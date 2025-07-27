import { LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { CharacterCreate, CharacterList } from '~/features/character'
import { getUserCharacterSummaries, CharacterSummary } from '~/features/character/api/character.service'
import { setServerRequestContext, clearServerRequestContext } from '~/lib/api-client'
import { getJwtFromRequest } from '~/features/auth/api/auth.service'
import { useCharacterManagement } from '~/features/character/hooks/useCharacterManagement'

// SSRでキャラクター軽量データを取得
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // サーバーリクエストコンテキストを設定
    const jwt = getJwtFromRequest(request)
    setServerRequestContext(request, jwt || undefined)

    // 軽量データを取得（拡張api-clientが自動でJWTを処理）
    const characters = await getUserCharacterSummaries()

    console.log(characters)

    // コンテキストをクリア
    clearServerRequestContext()

    return {
      characters,
      error: null,
      isAuthenticated: !!jwt
    }
  } catch (error) {
    console.error('Failed to load characters:', error)
    clearServerRequestContext()

    return {
      characters: [] as CharacterSummary[],
      error: 'Failed to load characters',
      isAuthenticated: false
    }
  }
}

export default function UserCharacter() {
  // SSRからの初期データ
  const { characters: initialCharacters, error: loaderError, isAuthenticated } = useLoaderData<typeof loader>()

  // ビジネスロジックをカスタムフックに委譲
  const { characters, isLoading, error, handleCharacterCreated, handleCharacterDelete, handleManualRefresh, setError } =
    useCharacterManagement(initialCharacters)

  // 認証されていない場合の表示
  if (!isAuthenticated) {
    return (
      <div>
        <h2>Please login to view characters</h2>
        <p>You need to be authenticated to access this page.</p>
      </div>
    )
  }

  // エラー時の表示（回復可能）
  if (loaderError && characters.length === 0) {
    return (
      <div>
        <h2>Error loading characters</h2>
        <p>{loaderError}</p>
        <button onClick={handleManualRefresh} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Retry'}
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* ローディング状態の表示 */}
      {isLoading && (
        <div style={{ padding: '10px', backgroundColor: '#f0f0f0', marginBottom: '10px' }}>Loading characters...</div>
      )}

      {/* エラー表示（非破壊的） */}
      {error && (
        <div style={{ padding: '10px', backgroundColor: '#ffebee', color: '#c62828', marginBottom: '10px' }}>
          Error: {error}
          <button onClick={() => setError(null)} style={{ marginLeft: '10px' }}>
            Dismiss
          </button>
        </div>
      )}

      {/* 手動更新ボタン */}
      <div style={{ marginBottom: '10px' }}>
        <button onClick={handleManualRefresh} disabled={isLoading}>
          {isLoading ? 'Refreshing...' : 'Refresh Characters'}
        </button>
        <span style={{ marginLeft: '10px', fontSize: '14px', color: '#666' }}>
          {characters.length} character(s) loaded
        </span>
      </div>
      <CharacterList
        characters={characters}
        onCreateNew={() => {}}
        onEditCharacter={handleManualRefresh}
        onCharacterClick={(character) => console.log('詳細:', character)}
        onCharacterDelete={handleCharacterDelete}
        onCharacterCreated={handleCharacterCreated}
      />
    </div>
  )
}
