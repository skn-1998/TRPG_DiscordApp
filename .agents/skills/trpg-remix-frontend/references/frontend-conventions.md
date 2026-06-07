# Frontend Conventions

## Architecture

- `trpg-remix-app` は Remix v2 + React + TypeScript のフロントエンド。
- UI は Mantine v7。Tailwind ではない。
- 状態管理は Zustand + Immer。
- API 通信は Axios ベースの `app/lib/api-client.ts` と `app/lib/api-response.util.ts` を中心にする。
- routes は Remix flat routes。画面/業務ロジックは feature 側へ寄せる。

## Directory Ownership

- `app/routes`: Remix route module。loader/action、route-level composition、認証/redirect など。
- `app/features/<feature>`: feature 固有の components/api/hooks/store/types/utils/docs。
- `app/components`: 汎用 UI。feature 固有の UI をここへ逃がさない。
- `app/lib`: API client、response utility、横断 hook など。
- `app/store`: 横断 state。feature state は feature 配下を優先する。
- `app/types`: 複数 feature をまたぐ型。feature 固有型は feature 配下を優先する。
- `app/config`: 型安全な設定。新規コードで環境変数を散らさない。

## Remix Rules

- loader/action はサーバー側データ取得・変更・redirect に集中させる。
- route component が大きくなる場合は feature component に切り出す。
- client-only API (`window`, `localStorage`) は hook/effect か browser guard の中で扱う。
- form mutation は Remix action と Mantine form のどちらが既存箇所に合うかを見て選ぶ。

## UI And Theme

- `trpg-remix-app/THEME.md` を正本として読む。
- ダークテーマ前提。背景/メイン/アクセント配分は概ね 70%/25%/5%。
- 主な色は `bg`, `main`, `accent`, `sub`, `comp`, `subComp` の Mantine theme palette。
- フォントは Noto Sans JP + Mantine default。
- 余白は 8px 系を基本に、Mantine の spacing token を優先する。
- インタラクティブ要素にはキーボード操作、ラベル、フォーカス表示を用意する。
- エラー表示は色だけに頼らず、テキストやアイコンも併用する。

## API And Types

- `postDomain/getDomain/putDomain/deleteDomain` と `createApiHandler('<domain>')` の既存パターンを優先する。
- 新しい API domain を追加する場合は `app/types/api.ts` の `KnownDomains` / `DomainDataMap` を確認・更新する。
- `response.data.data` や広い `as any` に戻さない。
- エラー処理は `ApiResponseUtil` の既存方針に合わせる。バラバラの try/catch 表示を増やさない。
- Discord OAuth token や secret をフロントに露出しない。フロントは JWT/cookie とサーバー API を介して扱う。

## State Management

- サーバー由来データは loader/action と API client の責務を先に検討する。
- 複数画面で共有する client state は Zustand + Immer。
- feature 固有 state は `app/features/<feature>/store` を優先する。
- localStorage 永続化は browser guard と migration 方針を持たせる。

## Security

- 新規 `eval` を追加しない。
- ユーザー入力を HTML として直接描画しない。
- `dangerouslySetInnerHTML` を避ける。どうしても必要ならサニタイズ方針を docs に残す。
- token、secret、認証コード、cookie の生値をログに出さない。
- 開発ログを追加する場合も本番で出ないよう制御する。

## Documentation

- フロント全体の設計や優先度を変えたら `trpg-remix-app/AI.md` または `document/frontend-trpg-remix-app.md` を更新する。
- UI theme を変えたら `trpg-remix-app/THEME.md` を更新する。
- feature 固有の仕様変更は `app/features/<feature>/AI.*.md` に残す。
- この skill は安定した規約の置き場。日々変わる進捗は repo docs 側へ置く。

## Verification Commands

```powershell
cd trpg-remix-app
pnpm run typecheck
pnpm run build
pnpm run test
```

UI 変更では必要に応じて:

```powershell
cd trpg-remix-app
pnpm run dev
```

その後 Browser/Playwright で desktop/mobile の表示、操作、エラー状態を確認する。
