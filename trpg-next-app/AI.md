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
- **feature 間の直接依存は宣言済みの有向辺のみ**（eslint import/no-restricted-paths で機械固定 —
  #121。ただし zone は現 6 feature の**列挙**であり fail-open: **新しい feature ディレクトリを
  作るときは zone を 1 本足す**こと。足さないとその feature への辺は自由なまま lint が緑になる）。
  許可辺は 5 本: ① character → characterTemplate（`types/v3` の型共有 — シートは
  テンプレート実体を編集モデルに使う）② characterTemplate → character
  （`createCharacterFromTemplate` — テンプレート画面からのキャラ作成はどこに置いても跨ぐ
  本質的フロー）③ character → discord（キャラカードの Discord 投稿ボタン）④
  characterTemplate → characterSheet（`TemplatePreviewV3` がシート入力と同じ field widget を
  `TemplateFormRenderer` へ委譲し、scalar widget の実装を一元化するため）⑤
  character → characterSheet（D-R2 裁定、2026-08-12 ユーザー — シート編集面の入力描画正本を
  `TemplateFormRenderer` に一本化し、第三の描画実装を作らないため）。
  新しい辺が必要になったら「lib へ移す」を先に検討し、辺の追加はここへ理由つきで記録してから
  eslint の except に足す（無断で except を増やさない）

## JWT / 認証

- jwt cookie の読み取り正本は `app/lib/auth-guard.server.ts` の `readJwt()`。cookie 名 `'jwt'` を
  実装コードにリテラルで書かない（**spec 内の fixture は許容** — 最終レビュー L5 の明文化）。
  set/delete は `/auth/callback` と `logout` のみ（属性は `buildJwtCookieOptions` — spec で pin 済み）
- **保護 page は処理の先頭で `requireJwt()` を明示的に呼ぶ**。理由: Next の layout は
  soft navigation で再実行されず、親 layout の gate は子を守れない（旧 #72 規約の Next 版。
  旧 `_user.user.tsx:7-9` と同根）
- /user 配下は**二段ゲート**: `user/layout.tsx` が `requireJwt()`＋`getAuthState()` の user null
  判定（= /users probe。react cache 済みなので root layout と同一リクエスト内で dedupe され
  probe は 1 回 — #125）で hard gate を持ち（layout はツリー進入時には必ず実行される）、
  データを扱う page が個別に `requireJwt()` を重ねる。認証状態の返却形は `{ user,
  degradedByInfraFailure?: true }`。JWT なし・401/403 はフラグなしの `user:null`、network 断・5xx
  等はフラグありの `user:null` とし、公開面はフラグを無視して soft degrade、`/user` layout
  だけが throw して root error 境界へ渡す（3 信号 isLoggedIn/hasValidJwt は #125 で削除 —
  常に連動し 8 状態中 2 状態しか生成されなかった）。stub 3 枚（gameManager / story / discordBotCombination）は現状 layout gate のみ
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
  3 controller**（最終レビュー M1 で 1→3 へ実測訂正。bare 側も #127 で
  `.not.toContain(ResponseInterceptor)` の負のアサーションが同 spec に入り、両面が機械固定済み）。
  失敗は全経路 4xx/5xx＋ErrorEnvelope（GlobalExceptionFilter）で axios reject に入る
- ErrorEnvelope の復号・status 抽出の正本は `app/lib/api-response.util.ts`
  （`isErrorEnvelope` / `errorEnvelopeMessages` / `getUpstreamResponse` /
  `extractApiErrorMessages` / `getResponseStatus`）。feature 内に復号を再実装しない
  （旧 app で #82 の分裂→統合の実害あり。旧 4 変種は #121 で一本化済み）。
  narrowing の正準 reader は `getUpstreamResponse`（status 数値＋data 存在を要求）。
  `getResponseStatus` だけは data の有無を問わない寛容な status 専用 reader（既存 spec 契約）。
  catch でのユーザー向け文字列化は `extractApiErrorMessages(error).join(' / ')` に統一
- 新規 Server Action は `{ error: string | null }` を返す。追加データは同じオブジェクトに足す
  （共有 generic 型は作らない — 大粒度レビュー#1 裁定）。現行 10 action の返却形の全量
  （最終レビュー M2/M3/M-2 の実測で確定）:
  標準 `{error}`＋追加データ（`saveSheet` の `conflict?`・`loadDiscordServers` の `servers`）／
  `saveTemplateDraft` のみ `EditorActionData = { template?, conflict?, messages? }` —
  編集継続のため redirect しない（n5 裁定 22。死蔵だった `ok`/`intent` は #126 で削除済み。
  **失敗は throw ではなくこの返却形**なので、呼び側は `template` 不在を失敗として
  known state へ遷移させる — saving 固着の実害あり・レビュー#2 CL-1）／
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
- OAuth の CSRF 対策 `state`: `/auth/start`（Route Handler）が発行し httpOnly cookie
  （`oauth_state`・lax・600s）へ保存 → Discord URL に付与 → `/login` の hop が転送 →
  callback が**照合前に無条件削除（single-use）**し、一致時のみ code 交換する（#123 で導入。
  /login が RSC で cookie を set できないため、発行は callback と対称の Route Handler に置く）
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

- jest は `testEnvironment: 'node'` のまま、client component の spec は**ファイル冒頭の
  docblock `/** @jest-environment jsdom */`** で個別に jsdom へ切り替える（#122。
  multi-project 方式は採らなかった）。**docblock を忘れると `document is not defined` で落ちる**。
  TSX は ts-jest の `jsx: 'react-jsx'` override が処理し、Mantine が要る browser API
  （matchMedia / ResizeObserver）の polyfill は `jest.setup.ts` に集約する — spec 内に書かない
- UI の自動受入は最小限: `'use client'` 13 コンポーネント中 spec ありは TemplateEditorV3 の
  1 件（autosave 4 ケース）。残 12 件は spec 0。render を伴う受入ゲートとしては薄い前提で扱う
- 純関数・server ロジックは spec で契約 pin（OAuth URL・cookie 属性・認証失敗時の redirect・
  callback status・editor 署名など）
