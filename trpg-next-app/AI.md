# trpg-next-app — 実装規約の正本（AI.md）

Next 16 App Router 版フロントエンド。trpg-remix-app からの移行は 2026-08 の N6 で完了し、
旧 app は撤去済み（計画 = `document/NEXT_MIGRATION_PLAN.md`・設計裁定 =
`review-results/next-migration/n*-design-notes.md`・最終判定 =
`review-results/next-migration/final-review-verdict.md`）。移行期 policy
「旧 app の現挙動が正」は終了し、以後の変更は通常の設計裁定で行う。
このファイルは実装者が毎回参照する規約だけを 1 ページに集約する（大粒度レビュー#1 CL-8）。

## サーバ境界（機械強制）

- **ブラウザから TRPG-SERVER を直接叩かない**。通信は RSC / Server Action / Route Handler のみ
  （正本 = `app/lib/api-client.server.ts`）
- **`.server.ts` は例外なく先頭に `import 'server-only'`** を置く（推移 import による偶然の保護に
  依存しない）。`actions.ts` は `'use server'` が同等の保証をするため対象外
- barrel（`lib/index.ts` 等）は作らない。client component から import するモジュール
  （例 `lib/gameSystem.ts`）は client-safe を保つ

## JWT / 認証

- jwt cookie の読み取り正本は `app/lib/auth-guard.server.ts` の `readJwt()`。cookie 名 `'jwt'` を
  実装コードにリテラルで書かない（**spec 内の fixture は許容** — 最終レビュー L5 の明文化）。
  set/delete は `/auth/callback` と `logout` のみ（属性は `buildJwtCookieOptions` — spec で pin 済み）
- **保護 page は処理の先頭で `requireJwt()` を明示的に呼ぶ**。理由: Next の layout は
  soft navigation で再実行されず、親 layout の gate は子を守れない（旧 #72 規約の Next 版。
  旧 `_user.user.tsx:7-9` と同根）。例外: `/user/character` は意図的に呼ばない
  （soft degrade 維持 — n3-design-notes 裁定 10）
- /user 配下は**二段ゲート**: `user/layout.tsx` が `requireJwt()`＋`/users` probe の hard gate を
  持ち（layout はツリー進入時には必ず実行される）、データを扱う page が個別に `requireJwt()` を
  重ねる。stub 3 枚（gameManager / story / discordBotCombination）は現状 layout gate のみ
  （静的文字列でデータ露出ゼロ — 最終レビューは両実施者とも layout gate を見落として
  「無ガード」と過大判定・Fable 実測で訂正）。**stub に実装を入れる際は page 先頭の
  `requireJwt()` が必須**。page 単位の機械 enforcement（lint/spec）は起票済み（M4）
- api-client への **明示 jwt 引数は廃止済み**（n2 裁定 2）。`cookies()` は RSC / Server Action /
  Route Handler のどこでも読めるため、jwt を引数で運ぶ実装を書かない
- Server Action は先頭で `requireJwt()` を呼ぶ。**セッション失効時は inline error ではなく
  /login へ遷移する（意図的変更・大粒度レビュー#1 F5 裁定）** — 旧 app の「取得失敗」表示は
  失効を誤誘導していたため

## HTTP 封筒・エラー

- 封筒化は **controller 単位**（server の ResponseInterceptor は auth / user / character /
  character-sheet に適用・`response-interceptor-application.spec.ts` が pin）。これらの 2xx は
  常に SuccessEnvelope で `response.data.data` 取り出しはこの不変条件に依存する。
  **封筒なし（bare entity・`response.data` 直読）は /sheet-templates・/discord・/dice-roll の
  3 controller**（最終レビュー M1 で 1→3 へ実測訂正。bare 側の負のアサーションは server spec に
  まだ無い — 起票済み）。
  失敗は全経路 4xx/5xx＋ErrorEnvelope（GlobalExceptionFilter）で axios reject に入る
- ErrorEnvelope の復号・status 抽出の正本は `app/lib/api-response.util.ts`
  （`isErrorEnvelope` / `errorEnvelopeMessages` / `getResponseStatus` — 旧 app と同名）。
  feature 内に復号を再実装しない（旧 app で #82 の分裂→統合の実害あり）。
  **既知の drift（起票済み・最終レビュー H3/M-3）**: 実態は復号 4 変種が併存し、共有復号器
  `extractApiErrorMessages` が characterTemplate feature 内に居て feature 跨ぎ import が 2 件ある。
  lib への移設＋feature↔feature を禁じる eslint zone の追加で一本化する
- 新規 Server Action は `{ error: string | null }` を返す。追加データは同じオブジェクトに足す
  （共有 generic 型は作らない — 大粒度レビュー#1 裁定）。現行 10 action の返却形の全量
  （最終レビュー M2/M3/M-2 の実測で確定）:
  標準 `{error}`＋追加データ（`saveSheet` の `conflict?`・`loadDiscordServers` の `servers`）／
  `saveTemplateDraft` のみ `EditorActionData` — 編集継続のため redirect しない（n5 裁定 22。
  うち `ok`/`intent` は読み手ゼロの死蔵フィールドで削除予定 — M2 起票済み）／
  `postCharacterToDiscord` は `{success, messageId?, error?}` の**規約外形**（error が optional で
  呼び側に success 分岐を強いる — 正規化候補として起票済み M3）／
  `logout` は redirect のみ・`requireJwt()` なし（未ログインでも冪等に cookie を消すため）。
  `requireJwt()` は 10 action 中 9 本が先頭で呼ぶ（例外は logout のみ）

## OAuth / redirect

- Discord の redirect_uri は `${HOST_DOMAIN}/login` で**固定**（Discord dashboard の whitelist
  制約）。`/login`（RSC）は cookie を set できないため、code 検出時に内部 Route Handler
  `/auth/callback` へ hop して交換・cookie set を行う（n2 裁定 1）
- **redirect status は 3 系統**（「307 統一」は過大主張だった — 最終レビュー H4/M-2 で訂正。
  実測を超えて一般化した claim-scoping の 8 例目）:
  ① next.config の redirects（permanent:false）・RSC の `redirect()`・Route Handler の
  `NextResponse.redirect` は **307**（dev/prod 実測＋callback spec で pin 済み）
  ② **Server Action 経由の `redirect()` は 303**（Next の Server Action semantics。
  `requireJwt()` 経由を含む 8 サイトが該当）
  ③ nginx の 80→443 は **301**（既存挙動）。
  旧 app（成功 301／失敗 302）からの変更意図＝恒久キャッシュ回避は ①② とも満たしている
- OAuth の CSRF 対策 `state` パラメータは**未実装**（旧 app parity の持ち越し。
  cookie 保存→URL 付与→callback 照合の導入を起票済み — 最終レビュー M-8）
- **dev で OAuth を通すには**: HOST_DOMAIN の既定 fallback は dev port と同じ
  `http://127.0.0.1:3100`（最終レビュー M-5 で旧 app の 5173 から修正）。Discord dashboard の
  whitelist に一致する HOST_DOMAIN を明示すれば別 origin でも可

## 環境変数

- server 専用の遅延検証アクセサ `app/config/env.server.ts` のみ（import 時に throw しない。
  ただし検証は一括なので、どの getter でも最初に触れた時点で必須 env の欠落は throw する）。
  `NEXT_PUBLIC_*` は「ブラウザから TRPG-SERVER を叩かない」方針により**存在しない**
  （必要になった時点で裁定）。DISCORD_SECRET は front では扱わない
- 供給経路: ローカル dev・dev compose は `trpg-next-app/.env`（dev compose は bind mount 経由で
  届く）。prod compose は `.env*` が .dockerignore で image に入らないため **environment での
  明示が必須**（DISCORD_APPLICATIONID は `${...:?required}` で fail-fast — 最終レビュー C-H1/M7）

## テスト

- jest は `testEnvironment: 'node'` のため client component の spec は現状書けない。
  **UI の自動受入ゲートは存在しない**（移行中の受入「旧 app との目視突合」は旧 app 撤去で
  消滅 — 最終レビュー H2 で訂正）。`'use client'` 13 コンポーネントは spec 0 件。
  jsdom project＋高リスク state の focused test 導入は起票済み。
  純関数・server ロジックは spec で契約 pin（OAuth URL・cookie 属性・soft degrade 形・
  callback status・editor 署名など）
