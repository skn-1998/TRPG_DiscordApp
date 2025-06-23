import { json, LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData, useNavigation } from '@remix-run/react'
import { CharacterCreate, CharacterList } from '~/features/character'
import { getUserCharacterSummaries, CharacterSummary } from '~/features/character/api/character.service'
import { useCharacterSummaries } from '~/lib/hooks/useCharacterSummaries'
import { setServerRequestContext, clearServerRequestContext } from '~/lib/api-client'
import { getJwtFromRequest } from '~/features/auth/api/auth.service'

// SSRでキャラクター軽量データを取得
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // サーバーリクエストコンテキストを設定
    const jwt = getJwtFromRequest(request)
    setServerRequestContext(request, jwt || undefined)

    // 軽量データを取得（拡張api-clientが自動でJWTを処理）
    const characters = await getUserCharacterSummaries()

    // コンテキストをクリア
    clearServerRequestContext()

    return json({
      characters,
      error: null,
      isAuthenticated: !!jwt
    })
  } catch (error) {
    console.error('Failed to load characters:', error)
    clearServerRequestContext()

    return json({
      characters: [] as CharacterSummary[],
      error: 'Failed to load characters',
      isAuthenticated: false
    })
  }
}

export default function UserCharacter() {
  // SSRからの初期データ
  const { characters: initialCharacters, error: loaderError, isAuthenticated } = useLoaderData<typeof loader>()
  // ナビゲーション状態（Remixの遷移状態）
  const navigation = useNavigation()
  const isNavigating = navigation.state !== 'idle'

  // CSR用のカスタムフック（SSRデータを初期値として使用）
  const {
    characters,
    isLoading,
    error,
    fetchCharacters,
    refreshCharacters,
    revalidateLoader,
    addCharacterOptimistic,
    removeCharacterOptimistic,
    setError
  } = useCharacterSummaries(initialCharacters)

  // キャラクター作成成功時の処理
  const handleCharacterCreated = async (newCharacter?: CharacterSummary) => {
    try {
      if (newCharacter) {
        // 楽観的更新: 即座にUIに反映
        addCharacterOptimistic(newCharacter)
      }

      // バックグラウンドでデータを同期
      await refreshCharacters()
    } catch (err) {
      console.error('Failed to refresh after character creation:', err)
      // 楽観的更新が失敗した場合はSSRデータに戻す
      revalidateLoader()
    }
  }

  // キャラクター削除時の処理
  const handleCharacterDelete = async (characterId: string) => {
    try {
      // 楽観的更新: 即座にUIから削除
      removeCharacterOptimistic(characterId)

      // バックグラウンドでデータを同期
      await refreshCharacters()
    } catch (err) {
      console.error('Failed to refresh after character deletion:', err)
      // 楽観的更新が失敗した場合はSSRデータに戻す
      revalidateLoader()
    }
  }

  // 手動更新ボタン
  const handleManualRefresh = () => {
    // エラーをクリアしてからデータ取得
    setError(null)
    fetchCharacters()
  }

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
      {(isLoading || isNavigating) && (
        <div style={{ padding: '10px', backgroundColor: '#f0f0f0', marginBottom: '10px' }}>
          {isNavigating ? 'Navigating...' : 'Loading characters...'}
        </div>
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

      <CharacterCreate />

      <CharacterList
        characters={characters}
        onCreateNew={() => handleManualRefresh()}
        onEditCharacter={(character) => {
          console.log('編集:', character)
          // 編集後の更新処理
          refreshCharacters()
        }}
        onCharacterClick={(character) => console.log('詳細:', character)}
      />
    </div>
  )
}
