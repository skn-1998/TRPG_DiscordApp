# TRPG Frontend アーキテクチャ

## 現在の構成

`trpg-remix-app` はTRPG-SERVERと連携するWebフロントエンド。ディレクトリ名は互換性のため維持しているが、フレームワークはNext.jsへ移行済み。

- Next.js 16 App Router
- React 19 + TypeScript
- Mantine 7
- Zustand + Immer
- Axios
- Jest

## 配置

```text
app/
├─ layout.tsx                 Root layout、Mantine/Auth provider
├─ page.tsx                   ホーム
├─ auth/                      Discord callback、logout
├─ backend/[...path]/         TRPG-SERVER向けBFF
├─ character/                 キャラクタールート
├─ login/                     Discordログイン
├─ mock/                      UI検証ルート
├─ user/                      認証必須ルート
├─ features/                  feature固有UI/API/hooks/types
├─ components/                共有UI
├─ hooks/                     横断hook/provider
├─ lib/                       API、server-only認証、共通処理
├─ store/                     Zustand store
└─ types/                     横断型
```

ルートは `page.tsx`、共有レイアウトは `layout.tsx` に限定し、画面ロジックは `features/` へ置く。

## Server / Client境界

- page/layoutは原則Server Component。
- state、event handler、browser API、Zustand、Mantine hookを使う境界だけ`'use client'`にする。
- server-only処理は`app/lib/*.server.ts`またはRoute Handlerへ置く。
- server-only moduleをClient Componentからimportしない。

## 認証

1. `/login`でDiscord OAuth URLを生成する。
2. Discordは既存契約どおり`/login?code=...`へ戻す。
3. `LoginCallback`が`POST /auth/callback`を呼ぶ。
4. Route HandlerがTRPG-SERVER `/auth/login`へcodeを渡す。
5. 取得したJWTをHttpOnly、SameSite=Lax Cookieへ保存する。
6. `getAuthState()`と`requireUser()`がサーバー側でJWTを検証する。

JWT、OAuth code、Discord tokenの生値をログへ出さない。

## API通信

ブラウザは直接TRPG-SERVERへBearer tokenを送らない。

```text
Client Component
  → /backend/[...path]
  → HttpOnly CookieをAuthorization Bearerへ変換
  → TRPG-SERVER
```

Server ComponentとRoute Handlerは`app/lib/server-api.ts`からTRPG-SERVERを直接呼ぶ。ブラウザ用クライアントは`app/lib/api-client.ts`を使い、既存の`getDomain/postDomain/putDomain/deleteDomain`型安全パターンを維持する。

## UI

- `THEME.md`を正本とする。
- ダークテーマ、Mantine token、8px系spacingを維持する。
- Tailwindは導入しない。
- エラーは色だけに依存せず文言を表示する。

## 環境変数

- `SERVER_DOMAIN`: server-onlyのバックエンドURL
- `INTERNAL_SERVER_DOMAIN`: Docker内部接続用。設定時は`SERVER_DOMAIN`より優先
- `HOST_DOMAIN`: OAuth callback URLのorigin
- `DISCORD_APPLICATIONID`: OAuth URL生成用Application ID

公開不要な値へ`NEXT_PUBLIC_`を付けない。`DISCORD_SECRET`はフロントエンドで使用しない。

## Docker

- development: Next dev、5173番
- development起動時は永続`node_modules`をfrozen lockfileへ同期する。
- production: `output: 'standalone'`、3000番
- dependency build scriptは`pnpm-workspace.yaml`の`allowBuilds`で明示許可する。
- 現在の許可対象は`sharp`と`unrs-resolver`。

## 検証

```powershell
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
```

UI変更時は主要ルートと認証redirectをブラウザまたはHTTP疎通で確認する。

## Next.js移行記録（2026-07-04）

- Remix flat routes 23件をApp Routerへ移植。
- loaderをServer Component/server-only helperへ移植。
- action/fetcherのデモをServer Actionへ移植。
- Discord OAuth callback URL `/login`を維持。
- Remix/Vite依存、entry、root、routes、設定を撤去。
- API clientの共有SSR contextを廃止し、server APIとBFFへ分割。
- Next.js standalone Dockerfileへ移行。
- OAuth URLテスト、typecheck、lint、test、production buildを実施。
