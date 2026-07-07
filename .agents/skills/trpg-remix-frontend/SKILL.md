---
name: trpg-remix-frontend
description: TRPG_DiscordApp のフロントエンド `trpg-remix-app` に関する設計・規約・実装判断を支援する。Remix routes/loaders/actions、React components、Mantine UI/theme、Zustand store、Axios API client、型定義、characterTemplate 機能、フロントのテスト/ビルド/ドキュメント更新を扱うときに使う。
---

# TRPG Remix Frontend

`TRPG_DiscordApp/trpg-remix-app` のフロントエンド開発用ガイド。作業前に一次情報を確認し、既存の feature-based 構成、Remix + Mantine の設計、型安全 API 方針に沿って変更する。

回答・作業メモは日本語。コマンドは `pnpm` を使う。

## Start Here

1. リポジトリ直下で作業している前提で、まず `trpg-remix-app/AI.md` を読む。
2. UI/見た目を触る場合は `trpg-remix-app/THEME.md` を読む。
3. 現状や優先度を確認する場合は `document/frontend-trpg-remix-app.md` と `document/open-issues-next.md` を読む。
4. feature 固有の作業では `trpg-remix-app/app/features/<feature>/AI.*.md` を探して読む。
5. API 契約やサーバー連携を変える場合は、該当する `TRPG-SERVER` 側の docs と実装も確認する。
6. バックエンドの `TRPG-SERVER/` は絶対に変更しない。読み取り専用とする。
7. ルートディレクトリにあるファイルと`trpg-remix-app/`以外のディレクトリは勝手に変更せず、必ず承認を得てから作業する。（読み取りのみの場合は承認不要）

詳しい規約は必要に応じて読む:

- `references/frontend-conventions.md`: フロント全体の配置、UI、API、状態管理、テスト規約。
- `references/character-template.md`: `characterTemplate` 機能の DSL/UI/API/セキュリティ方針。

## Working Rules

- 変更前に対象 route / feature / lib / store の既存パターンを読む。
- route module は loader/action/routing を中心に薄く保ち、画面・ロジックは `app/features/<feature>` に寄せる。
- 共有 UI は `app/components`、横断 API は `app/lib`、本当に横断的な型は `app/types` に置く。
- UI は Mantine v7 と `app/theme.ts`/`THEME.md` のトークンを優先する。Tailwind 前提の実装を追加しない。
- API 呼び出しは `app/lib/api-client.ts` と `app/lib/api-response.util.ts` の型安全な流れを優先する。
- ユーザー入力の式評価や HTML 展開で `eval`、`dangerouslySetInnerHTML`、トークン値ログを追加しない。
- 設計・規約・移行方針を変えたら、該当する `AI.*.md` または `document/` も更新する。

## Verification

変更範囲に応じて focused に実行する。

```powershell
cd trpg-remix-app
pnpm run typecheck
pnpm run build
pnpm run test
```

UI の見た目や操作を変えた場合は、開発サーバーを起動して Browser/Playwright で確認する。

```powershell
cd trpg-remix-app
pnpm run dev
```
