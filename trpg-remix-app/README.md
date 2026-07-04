# TRPG Frontend

Discord連携TRPG支援ツールのWebフロントエンドです。Next.js App Router、React、TypeScript、Mantineで構成します。

## 開発

```powershell
pnpm install --frozen-lockfile
pnpm run dev
```

開発サーバーは `http://127.0.0.1:5173` で起動します。

## 検証

```powershell
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
```

## 環境変数

- `SERVER_DOMAIN`: Next.jsサーバーから接続するTRPG-SERVERのURL
- `INTERNAL_SERVER_DOMAIN`: Docker内部などで`SERVER_DOMAIN`と接続先を分ける場合の優先URL
- `HOST_DOMAIN`: Discord OAuth callbackのフロントエンドURL
- `DISCORD_APPLICATIONID`: Discord Application ID

DiscordのsecretやOAuth tokenはクライアントへ公開しません。

## 実行構成

- `app/`: Next.js App Routerと共通コード
- `app/features/`: feature固有のUI・API・hooks・型
- `app/backend/[...path]/route.ts`: HttpOnly JWTをBearerへ変換するBFF
- `app/auth/`: Discord callbackとlogout
- `app/lib/server-api.ts`: server-onlyのTRPG-SERVERクライアント

本番DockerはNext.js standalone outputを使用し、3000番ポートで起動します。
