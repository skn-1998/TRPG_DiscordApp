# NEXT_MIGRATION_PLAN — Remix → Next.js 移行キャンペーン計画（正本）

> **✅ 完了（2026-08-06〜07）**: N0〜N6 全フェーズ完了。`trpg-remix-app` は N6b（`e179640`）で
> 撤去され、現行フロントは `trpg-next-app`（正本 doc = `trpg-next-app/AI.md`）。
> 以下は計画時点の記述であり、旧 app への参照は歴史記録。

作成: 2026-08-06（N0）／作成者: Fable（司令塔）／実装: Codex・Opus へ委譲
経緯の正本: 旧 `trpg-remix-app/AI.md` 末尾「フレームワーク移行検討記録」（2026-07-26 保留 →
2026-08-06 ユーザー指示「Next移行で進めて」で着手・旧 doc は git 履歴参照）。
進行状況は `document/SESSION_HANDOFF.md`。

## 1. 目的（確定済み・AI.md:1502-1505）

Discord 連携強化ロードマップ:
① Discord Activity（iframe 内 SPA・token 認証）
② TRPG シナリオの執筆・公開機能（公開ページ = OGP/ISR で Next が有利）
③ シナリオ画像のワンボタン Discord 共有

## 2. 目標スタックと方式

| 項目 | 値 | 根拠 |
|---|---|---|
| Next.js | 16.3.0（npm 実測 2026-08-06） | App Router。②の OGP/ISR 要件 |
| React | 19.2.8 | Next 16 標準・Mantine 9 の必須要件（React 19.2+） |
| Mantine | 9.5.1 | @mantine/form が zod v4 Standard Schema 組込 → 契約の zod 4.1.11 と整合。7→9 は 2 メジャー跳びのため 7→8・8→9 両ガイド適用 |
| zod | 4.1.11（既存） | `@trpg/api-contract` 現行 |

**方式 = 並行パッケージ**: `trpg-next-app` を新設し、ルート毎に移植 → N6 で compose/CI を
切替して `trpg-remix-app` を撤去する。in-place 置換にしない理由:

1. フェーズ毎に旧 app が壊れず「受入コマンドが独立に緑」（fable-rules）を保てる
2. pnpm workspace で React 18/19・Mantine 7/9 がパッケージ単位で共存でき、Remix 上での
   事前アップグレード（別リスク源）が不要
3. 共有パッケージ（`@trpg/api-contract`・`@trpg/sheet-engine`）は react 非依存を実測済みで
   そのまま両 app から使える

制約: 移行中は trpg-remix-app 側の feature 開発を凍結する（複製 drift 防止）。

## 3. 移行面の実測（2026-08-06 read-only インベントリ・全数値は実カウント）

**旧記録の訂正**: 「実質 12 ルート」（AI.md:1494）は陳腐化。現在は **17 ルートファイル**。
内訳と移行方針:

| 分類 | 件数 | 移行方針 |
|---|---|---|
| 実体ルート（loader/action＋UI） | 8 | page.tsx / layout.tsx へ移植（N2〜N5） |
| redirect スタブ（character+/ 5 本・全て `redirect('/user/character')` 3 行） | 5 | `next.config` の `redirects()` 5 行へ圧縮（ページファイル不要・N6） |
| 静的プレースホルダ（`<div>text</div>` のみ） | 3 | 移行コストほぼゼロ（N3） |
| resource route（templates_.dice-preview・UI なし POST） | 1 | Route Handler `route.ts` 化（N5） |

### 3-1. URL 写像（実体ルートのみ・実ビルドのルートマニフェスト確認済み）

| Remix | URL | Next App Router 案 |
|---|---|---|
| `_index.tsx` | `/` | `app/page.tsx` |
| `_auth.login.tsx` | `/login` | `app/(auth)/login/page.tsx` |
| `_user.tsx`＋`_user.user.tsx` | `/user`（pathless layout＋hard gate） | `app/(user)/user/layout.tsx`＋`page.tsx` |
| `_user.user.character.tsx` | `/user/character` | `app/(user)/user/character/page.tsx` |
| `_user.user.character_.$id.sheet.tsx` | `/user/character/:id/sheet`（un-nest） | Route Group 分離で layout 非継承を再現 |
| `_user.user.{discordBotCombination,gameManager,story}.tsx` | `/user/…` | 各 page.tsx（プレースホルダ） |
| `templates.tsx` | `/templates` | `app/templates/page.tsx` |
| `templates_.$id.edit.tsx` | `/templates/:id/edit`（un-nest） | Route Group 分離 |
| `templates_.dice-preview.tsx` | `/templates/dice-preview`（POST） | `app/templates/dice-preview/route.ts` |

### 3-2. 設計ガードの実態（保留時ガード「Remix API は route 層のみ」は守られていない）

routes 外 **12 ソースファイル**が `@remix-run/*` を直接 import。うち Next に直接の等価物が
ない 5 ファイルは再設計が必要:

| ファイル | API | Next での再設計 |
|---|---|---|
| `hooks/useAuth.ts` | `useRouteLoaderData('root')` | root loader 概念が消滅 → Server Component から props/Context 供給へ |
| `features/character/hooks/useCharacterSummaries.ts` | `useRevalidator` | `router.refresh()` / `revalidatePath` |
| `features/character/hooks/useCharacterManagement.ts` | `useNavigation`（loading 判定） | `useTransition` / `useFormStatus` |
| `features/characterTemplate/components/TemplateListV3.tsx` | `Form`×1＋`fetcher.Form`×3（親 action 暗黙依存） | Server Actions へ |
| `TemplateEditorV3.tsx`・`TemplatePreviewV3.tsx` | `useFetcher`（`fetcher.data/state` 多用・URL ハードコード） | Server Action / `fetch`＋手動 state |

軽微（`Link`/`useNavigate`/`useLocation` の置換のみ）: Header・userPageNavigation・
characterCard・characterList。逆方向 import 2 件（`features/auth/components/login.tsx` →
routes・dicePreviewRoute.spec → routes）は移植時に解消する。

### 3-3. 必ず踏む地雷（実ファイル確認済み・委譲指示書に毎回転記する）

1. **`app/lib/index.ts` バレル**が `gameSystem`（fuse/moji/JSON トップレベル評価）と
   `api-client`（`node:http`/`node:https` 静的 import）を束ね、Client Component
   （characterCard）から到達 → Next では**ビルド不能**。client-safe / server-only へ分割必須
2. **`serverRequestContext`（api-client.ts の module 可変グローバル）**: Next の並行
   リクエストでは危険。サーバ側は `next/headers` の `cookies()` 直読みへ置換し、
   グローバル文脈と「2 本目以降は jwt 明示」不変条件そのものを廃止する（N2 で再裁定）
3. **`configService`/`apiClient` のモジュールトップレベル初期化**（検証失敗で import 時
   throw）→ Next のビルド時評価と衝突しうる。遅延初期化へ
4. **環境変数の自作二重機構**（SSR=`process.env` / CSR=Vite `define` の
   `__APP_PUBLIC_ENV__`）→ `NEXT_PUBLIC_*` 規約へ置換。**`DISCORD_SECRET` は
   サーバ専用を維持**（現行も browser 非注入を意図実装済み）
5. **root**: `Layout` が `<html>` 自前生成・entry.client が `document` 全体 hydrate・
   ErrorBoundary が `<html>`＋Provider 再掲 → Next root layout / error.tsx へ再設計
   （機械移植不可）
6. `_user.user.tsx` の `<Outlet context={{user}}>` → 等価物なし（props/Context 再設計）
7. postcss-preset-mantine / postcss-simple-vars / postcss は**宣言のみで未配線**
   （postcss config 不在を実測）。新 app へ「必要だと誤認して持ち込まない」。Mantine CSS は
   precompiled `@mantine/core/styles.css` 1 本＋globals.css（5 行）のみ

### 3-4. 移植しない dead code（routes からの到達 0 を grep 実測済み）

- `features/character/edit/` ツリー全体（COC editor）— **@mantine/form・
  @mantine/notifications の唯一の使用者**
- `features/character/components/gridTest.tsx`＋`.module.css` — **唯一の CSS Modules**
- `lib/gameSystem.ts` の `createGameSystemOptionsFilter`（fuse.js・moji の実質唯一の経路。
  生きているのは `getGameSystemNameById` のみ → 移植時に分離）
- zustand / immer（参照 0・#79 起票済み）・@mantine/modals・@mantine/nprogress（import 0）

→ 新 app の初期依存から @mantine/form・notifications・modals・nprogress・fuse.js・moji・
postcss 系・zustand・immer を**すべて除外**できる（必要になった時点で追加）。

## 4. フェーズ構成（タスク #112〜#120）

| フェーズ | 内容 | 受入（各フェーズ共通ゲートは §5） |
|---|---|---|
| N0 | 本計画書＋SESSION_HANDOFF 記録 | 済 |
| N1 | `trpg-next-app` scaffold: workspace 登録・Next 16/React 19/Mantine 9・root layout（dark 固定・theme/generateColors 移植）・`/` ページ・eslint/jest/typecheck 配線 | 新 app build/typecheck/lint/test 緑＋dev で `/` render・旧 app 無変更 |
| N2 | 認証基盤: env 機構（NEXT_PUBLIC_*）・api-client 再設計（cookies() 直読み・バレル分割・遅延初期化）・`/login`（Discord OAuth）・ガード規約の Next 版正本化 | login→/user 遷移が dev で動作・util spec 緑 |
| N3 | user 系: `(user)` layout・useAuth 再設計・Header/Footer/nav 移植・`/user`・`/user/character`（soft degrade 維持）・プレースホルダ 3 | 各ページ表示・spec 移植緑 |
| — | **大粒度認知負荷レビュー #1**（N1〜N3 俯瞰・二重）— Med+ 消化まで N4 に進まない | |
| N4 | `/user/character/:id/sheet`（最重量）: sheet-engine 連携・保存 Server Action・409 conflict 挙動維持・NumberInput の Mantine 9 意味論確認 | 表示・編集・保存・409 が dev で動作 |
| N5 | templates 系 3 ルート＋fetcher 依存 3 コンポーネント再設計＋dice-preview Route Handler（401 JSON 契約維持）・spec #5 移植 | 一覧・編集・publish・preview ロール動作 |
| N6 | 配線切替: Dockerfile・compose(.prod)・verify.yml・`redirects()` 5 本・**trpg-remix-app 削除**・#79 自然解消・doc 全面更新・rename 裁定 | compose build＋healthcheck 緑・CI 緑（※実態訂正 — 最終レビュー M8: N6 時点の受入は local 実測のみで CI に docker ゲートは無かった。最終レビュー消化で verify.yml に両 image の production build ジョブを追加。runtime healthcheck は env secrets が要るため CI 外＝local 実測が正のまま） |
| — | **最終大粒度レビュー＋campaign close**（記録・compact 合図） | |

## 5. 横断ルール（全フェーズ共通）

- **受入ゲート（Fable 独立再実行）**: `pnpm --filter trpg-next-app run build / typecheck /
  lint / test` 全緑＋`pnpm --filter trpg-remix-app run build` 緑（旧 app 非破壊の証明・
  N6 まで）＋diff 実読（範囲一致・過剰実装なし）
- 委譲指示書には**統制定型 8 項目**（ファイル範囲錠・AI.*.md は Fable・git 変更系禁止・
  lint --fix 禁止・秘匿値不読・障害時停止・node_modules 再リンク禁止・M 差分停止）と
  §3-3 地雷の該当項を毎回丸ごと転記する
- 挙動の正は**旧 app の現挙動**（soft degrade・401 JSON・409 conflict 形・dark 固定等)。
  「Next らしい改善」は移行中スコープ外（起票して後続）
- Mantine 9 の API 差分はローカル `node_modules/@mantine/core` の型定義を正とする
  （Web ガイド: 7→8 https://mantine.dev/guides/7x-to-8x/ ・8→9 https://mantine.dev/guides/8x-to-9x/ ）
- 新規依存は pnpm-workspace.yaml のサプライチェーン統制（minimumReleaseAge 24h・
  strictDepBuilds・allowBuilds）を通す。install が統制に阻まれたら**回避せず停止報告**

## 6. 既存規約の再裁定（N2 で確定させる設計判断）

1. **#72 認証ガード規約の Next 版**: App Router でも layout は soft navigation で再実行
   されないため「親 layout のガードは子を守れない」構図は**同じ**（インベントリ報告の
   「layout は毎回サーバで実行される」は誤り — Fable 訂正済み）。よって
   **per-page/route-handler インライン検査の正本を維持**。middleware は多層防御として
   任意（正本にはしない）。resource route の 401 JSON 例外も維持
2. **JWT 伝搬**: `serverRequestContext`＋「2 本目以降 jwt 明示」不変条件を廃止し、
   サーバ専用 api-client が `cookies()` を遅延で読む形へ。9 遵守サイトの明示引数は
   撤去できる見込み（N2 で実測裁定）
3. **旧 doc の不変条件**（`document/frontend-trpg-remix-app.md` の Remix 前提記述）は
   N6 で歴史注記化する

## 7. リスク台帳

| リスク | 対策 |
|---|---|
| UI 挙動固定テストが 0（RTL 未導入・spec 7 本は純関数中心） | 移植は「旧 app 現物との目視突合」を受入に含める。純関数 spec 5 本（Remix 非依存）は先行移植して安全網化 |
| Mantine 7→9 の 2 メジャー跳び（NumberInput 空文字 sentinel・ColorSchemeScript/forceColorScheme・Menu polymorphic 等 15 使用面を実測済み） | 型定義正・フェーズ毎に対象コンポーネントの表示確認 |
| fetcher 3 コンポーネントの再設計（最重） | N5 に隔離し、N4 までの安定基盤の上で実施 |
| 新規依存とサプライチェーン統制の衝突 | 阻まれたら停止報告（統制⑥）。バージョンは 24h 経過済み安定版を選ぶ |
| 旧 app との複製 drift | 移行中は旧 app 凍結・大粒度レビューで複製スイープ |
