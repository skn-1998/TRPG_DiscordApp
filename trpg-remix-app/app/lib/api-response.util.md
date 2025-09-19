# APIレスポンス処理共通関数（統合型定義版）

## 概要

`api-client.ts`と`api-response.util.ts`を統合した型安全なAPIレスポンス処理システムです。

## 特徴

- **完全な型安全性**: TypeScriptによる厳密な型チェック
- **統合型定義**: APIクライアントとレスポンスユーティリティの型が完全に連携
- **ドメインベース**: ドメイン名による明確なデータ分離
- **エラーハンドリング**: 統一されたエラー処理
- **後方互換性**: 既存のAPIクライアント使用方法も維持

## 型定義システム

### 1. 中央集権的な型定義（`app/types/api.ts`）

```typescript
// ドメイン定義
export type KnownDomains = 'auth' | 'character' | 'user' | 'discord'

// ドメインデータマッピング
export interface DomainDataMap {
  auth: {
    message: string
    discordUserId: string
    userName: string
    token: string
    user: DiscordUserProfile
  }
  character: Character
  user: User
  discord: DiscordData
}

// 統合APIレスポンス型
export type ApiResponse<T, Domain extends string> =
  | SuccessApiResponse<T, Domain> // { success: true, [domain]: T }
  | ErrorApiResponse // { success: false, message: string }
```

## 使用方法

### 1. 型安全なAPIクライアント使用

```typescript
import { apiClient } from '~/lib/api-client'
import { createApiHandler } from '~/lib/api-response.util'

// ドメイン指定でAPIハンドラーを作成
const authHandler = createApiHandler('auth')

// 型安全なAPI呼び出し
const response = await apiClient.postDomain('/auth/login', 'auth', { code })
const authData = authHandler.handleSuccess(response)

console.log(authData.userName) // 型安全にアクセス可能
```

### 2. サービス層での実装例

```typescript
// 認証サービス
export async function loginOrRegisterUser(code: string): Promise<LoginResponse> {
  try {
    const response = await apiClient.postDomain('/auth/login', 'auth', { code })
    const authData = authHandler.handleSuccess(response)

    console.log('ログイン成功:', authData.userName) // 型安全
    return response.data
  } catch (err) {
    const errorMessage = ApiResponseUtil.handleError(err)
    throw new Error(errorMessage)
  }
}

// キャラクターサービス
export async function getCharacter(id: string): Promise<Character> {
  const response = await apiClient.getDomain(`/character/${id}`, 'character')
  return characterHandler.handleSuccess(response) // 型安全にCharacterを返す
}
```

### 3. 型ガードによる安全なアクセス

```typescript
const userInfo = await loginOrRegisterUser(code)

// TypeScriptの型ガードが自動的に働く
if (userInfo.success) {
  // この時点でuserInfo.authが型安全にアクセス可能
  console.log(userInfo.auth.userName)
  const token = userInfo.auth.token
} else {
  // この時点でuserInfo.messageが型安全にアクセス可能
  console.error(userInfo.message)
}
```

## APIクライアントメソッド

### 新しい型安全メソッド

```typescript
// ドメイン指定版（推奨）
apiClient.getDomain<Domain>(url, domain, config?)
apiClient.postDomain<Domain>(url, domain, data?, config?)
apiClient.putDomain<Domain>(url, domain, data?, config?)
apiClient.deleteDomain<Domain>(url, domain, config?)
```

### 従来メソッド（後方互換性）

```typescript
// 汎用版（既存コードとの互換性のため）
apiClient.get<T>(url, config?)
apiClient.post<T>(url, data?, config?)
apiClient.put<T>(url, data?, config?)
apiClient.delete<T>(url, config?)
```

## レスポンス形式

### 成功レスポンス

```json
{
  "success": true,
  "auth": {
    "message": "認証成功",
    "token": "jwt-token",
    "userName": "username",
    "discordUserId": "123456789",
    "user": { ... }
  }
}
```

### エラーレスポンス

```json
{
  "success": false,
  "message": "エラーメッセージ",
  "error": "詳細エラー情報"
}
```

## 型安全性の恩恵

1. **コンパイル時エラー検出**

   ```typescript
   // ❌ コンパイルエラー：存在しないプロパティ
   const invalid = authData.invalidProperty

   // ✅ 型安全：正しいプロパティのみアクセス可能
   const valid = authData.userName
   ```

2. **IntelliSenseサポート**
   - IDEでの自動補完
   - プロパティの型情報表示
   - リファクタリング支援

3. **ドメイン名のtypo防止**

   ```typescript
   // ❌ コンパイルエラー：未定義のドメイン
   createApiHandler('auht') // typo

   // ✅ 正しいドメイン名のみ許可
   createApiHandler('auth')
   ```

## マイグレーション指針

### 既存コードから新システムへ

1. **段階的移行**

   ```typescript
   // Before
   const response = await apiClient.post('/auth/login', { code })
   const authData = response.data.auth

   // After
   const response = await apiClient.postDomain('/auth/login', 'auth', { code })
   const authData = authHandler.handleSuccess(response)
   ```

2. **型定義の更新**

   ```typescript
   // Before
   interface CustomResponse { ... }

   // After
   type CustomResponse = DomainApiResponse<'custom'>
   ```

## 注意事項

- 新しいドメインを追加する場合は`app/types/api.ts`の`KnownDomains`と`DomainDataMap`を更新
- 既存の`as any`キャストは不要になりました
- エラーハンドリングは必ず`ApiResponseUtil.handleError`を使用
- レスポンスは必ず`success`フラグでの分岐処理を推奨
