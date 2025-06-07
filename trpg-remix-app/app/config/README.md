# Remix TRPG App 設定システム

TRPG-SERVERの環境変数管理システムをRemix用に移植した型安全な設定システムです。

## 特徴

- 🔒 **型安全**: TypeScriptによる完全な型安全性
- ✅ **バリデーション**: 起動時の環境変数検証
- 🎯 **IntelliSense**: ドット記法での設定パス補完
- 🚀 **パフォーマンス**: 設定値のキャッシュ機能
- 📝 **詳細エラー**: わかりやすいエラーメッセージ

## 環境変数設定

### 必須環境変数

```bash
# Discord OAuth設定
DISCORD_SECRET=your_discord_client_secret
DISCORD_APPLICATIONID=your_discord_application_id
```

### オプション環境変数

```bash
# アプリケーション設定
NODE_ENV=development
PORT=5173

# サーバー設定
SERVER_DOMAIN=http://localhost:5173
HOST_DOMAIN=http://localhost:5173

# API設定
API_BASE_URL=http://localhost:3000

# データベース設定
DATABASE_URL=your_database_url
DB_LOGGING=false
```

## 使用方法

### 基本的な使用方法

```typescript
import { configService } from '~/config'

// Discord設定の取得
const discordApplicationId = configService.get('discord.applicationId')
const discordSecret = configService.get('discord.secret')

// サーバー設定
const serverDomain = configService.get('server.domain')
const hostDomain = configService.get('server.hostDomain')

// 環境チェック
if (configService.isProduction()) {
  // 本番環境での処理
}
```

### Remixローダーでの使用

```typescript
// app/routes/_auth.login.tsx
import { LoaderFunctionArgs } from '@remix-run/node'
import { configService } from '~/config'

export async function loader({ request }: LoaderFunctionArgs) {
  const applicationId = configService.get('discord.applicationId')
  const serverDomain = configService.get('server.domain')
  const redirectUri = `${serverDomain}/login`

  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${applicationId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify`

  return { discordAuthUrl }
}
```

### 設定値の直接取得

```typescript
import { getConfigValue } from '~/config'

// 関数として使用
const apiUrl = getConfigValue('api.baseUrl')
```

## 利用可能な設定パス

- `app.environment` - アプリケーション環境
- `app.port` - ポート番号
- `discord.secret` - Discord Client Secret
- `discord.applicationId` - Discord Application ID
- `server.domain` - サーバードメイン
- `server.hostDomain` - ホストドメイン
- `api.baseUrl` - APIベースURL
- `database.url` - データベースURL
- `database.logging` - データベースログ出力

## エラーハンドリング

環境変数の検証に失敗した場合、詳細なエラーメッセージが表示されます：

```
🚨 環境変数の検証に失敗しました:
❌ DISCORD_SECRET: 必須環境変数 DISCORD_SECRET が設定されていません
❌ DISCORD_APPLICATIONID: 必須環境変数 DISCORD_APPLICATIONID が設定されていません
```

## テスト

```typescript
import { revalidateEnvironment } from '~/config'

// テスト用に環境変数を再検証
beforeEach(() => {
  revalidateEnvironment()
})
```

## Discord OAuth設定手順

1. [Discord Developer Portal](https://discord.com/developers/applications)にアクセス
2. 新しいアプリケーションを作成
3. OAuth2 > General から Client ID と Client Secret を取得
4. OAuth2 > Redirects に `http://localhost:3000/login` を追加
5. 取得した値を環境変数に設定:
   - Client ID → `DISCORD_APPLICATIONID`
   - Client Secret → `DISCORD_SECRET`

## セキュリティ注意事項

- 環境変数ファイル（.env）はGitにコミットしない
- Discord Client Secret（DISCORD_SECRET）は絶対に公開しない
- 本番環境では適切なSERVER_DOMAINを設定する
