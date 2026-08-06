# trpg-next-app — 実装規約の正本（AI.md）

Next 16 App Router 版フロントエンド。trpg-remix-app からの移行先（計画 =
`document/NEXT_MIGRATION_PLAN.md`・設計裁定 = `review-results/next-migration/n*-design-notes.md`）。
移行完了（N6）までは**旧 app の現挙動が正**で、「Next らしい改善」はスコープ外。
このファイルは N4/N5 実装者が毎回参照する規約だけを 1 ページに集約する（大粒度レビュー#1 CL-8）。

## サーバ境界（機械強制）

- **ブラウザから TRPG-SERVER を直接叩かない**。通信は RSC / Server Action / Route Handler のみ
  （正本 = `app/lib/api-client.server.ts`）
- **`.server.ts` は例外なく先頭に `import 'server-only'`** を置く（推移 import による偶然の保護に
  依存しない）。`actions.ts` は `'use server'` が同等の保証をするため対象外
- barrel（`lib/index.ts` 等）は作らない。client component から import するモジュール
  （例 `lib/gameSystem.ts`）は client-safe を保つ

## JWT / 認証

- jwt cookie の読み取り正本は `app/lib/auth-guard.server.ts` の `readJwt()`。cookie 名 `'jwt'` を
  リテラルで書かない。set/delete は `/auth/callback` と `logout` のみ（属性は
  `buildJwtCookieOptions` — spec で pin 済み）
- **保護 page は処理の先頭で `requireJwt()` を明示的に呼ぶ**。理由: Next の layout は
  soft navigation で再実行されず、親 layout の gate は子を守れない（旧 #72 規約の Next 版。
  旧 `_user.user.tsx:7-9` と同根）。例外: `/user/character` は意図的に呼ばない
  （soft degrade 維持 — n3-design-notes 裁定 10）
- api-client への **明示 jwt 引数は廃止済み**（n2 裁定 2）。`cookies()` は RSC / Server Action /
  Route Handler のどこでも読めるため、jwt を引数で運ぶ実装を書かない
- Server Action は先頭で `requireJwt()` を呼ぶ。**セッション失効時は inline error ではなく
  /login へ遷移する（意図的変更・大粒度レビュー#1 F5 裁定）** — 旧 app の「取得失敗」表示は
  失効を誤誘導していたため

## HTTP 封筒・エラー

- 封筒化は **controller 単位**（server の ResponseInterceptor は auth / user / character /
  character-sheet に適用・`response-interceptor-application.spec.ts` が pin）。これらの 2xx は
  常に SuccessEnvelope で `response.data.data` 取り出しはこの不変条件に依存する。
  **/sheet-templates は封筒なし**（bare entity — template service は `response.data` を直接返す）。
  失敗は全経路 4xx/5xx＋ErrorEnvelope（GlobalExceptionFilter）で axios reject に入る
- ErrorEnvelope の復号・status 抽出の正本は `app/lib/api-response.util.ts`
  （`isErrorEnvelope` / `errorEnvelopeMessages` / `getResponseStatus` — 旧 app と同名）。
  feature 内に復号を再実装しない（旧 app で #82 の分裂→統合の実害あり）
- 新規 Server Action は `{ error: string | null }` を返す。追加データは同じオブジェクトに足す
  （共有 generic 型は作らない — 大粒度レビュー#1 裁定）

## OAuth / redirect

- Discord の redirect_uri は `${HOST_DOMAIN}/login` で**固定**（Discord dashboard の whitelist
  制約）。`/login`（RSC）は cookie を set できないため、code 検出時に内部 Route Handler
  `/auth/callback` へ hop して交換・cookie set を行う（n2 裁定 1）
- **redirect status は 307 で統一（意図的変更・大粒度レビュー#1 F4 裁定）**。旧 app は
  成功 301／失敗 302 だったが、301 の恒久キャッシュ回避と Next 標準に合わせた。
  callback の status/Location/cookie set は spec で pin する
- **dev で OAuth を通すには**: 既定 fallback（HOST_DOMAIN=127.0.0.1:5173）は旧 app parity の
  ための値で、新 app の dev port は 3100。実際に callback を受けるには HOST_DOMAIN を明示するか
  旧 app を止めて 5173 で起動する（本切替は N6。大粒度レビュー#1 F1）

## 環境変数

- server 専用の遅延検証アクセサ `app/config/env.server.ts` のみ（import 時に throw しない）。
  `NEXT_PUBLIC_*` は「ブラウザから TRPG-SERVER を叩かない」方針により**存在しない**
  （必要になった時点で裁定）。DISCORD_SECRET は front では扱わない

## テスト

- jest は `testEnvironment: 'node'`（client component の spec は書けない — UI は旧 app との
  目視突合が受入）。純関数・server ロジックは spec で契約 pin（OAuth URL・cookie 属性・
  soft degrade 形・callback status など）
