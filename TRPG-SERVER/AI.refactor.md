# TRPG-SERVER リファクタリング設計メモ

このドキュメントは TRPG-SERVER のリファクタリングに関する調査・方針・進捗を記録する正本。
全体方針の上位は `src/ARCHITECTURE.md`、依存・ドメインは `AI.architecture.md` / `AI.domain.md` を参照。

---

## 2026-06-01 H6 AuthModule⇄UserModule 循環の解消（forwardRef 撤去・挙動保存）

ブランチ `refactor/auth-user-cycle-h6`。最後まで残っていた `domains/auth/auth.module.ts ⇄ domains/user/user.module.ts`（forwardRef）を解消。ARCHITECTURE §10（AuthService→UserService 許容 / UserModule→AuthModule 原則禁止 / 共通 port 切り出し）に準拠。**認証・トークン検証の挙動は不変**。

循環の真因：`JwtAuthGuard` が `AuthService` を注入していたため、guard を使う UserModule が AuthService→UserService を引き込んで循環していた。さらに UserController が `AuthService.validateToken` を直接利用。

破断方式（JWT 検証 primitive を下位モジュールへ抽出）：

- **新設 `JwtTokenService`**（`src/domains/auth/token/jwt-token.service.ts`）：`AuthService.validateToken`/`parseJwt` のロジックをそのまま移設。依存は `JwtService` のみ（UserService に依存しない）。検証ロジック・例外・戻り値は不変。
- **新設 `AuthTokenModule`**（`src/domains/auth/token/auth-token.module.ts`）：`JwtModule.registerAsync`（旧 AuthModule の設定を移設）と `ConfigModule` を import し、`JwtTokenService` / `JwtAuthGuard` / `JwtModule` を providers/exports。`@Global` 不使用の下位共通モジュール。
- **`JwtAuthGuard`**：`AuthService` 注入 → `JwtTokenService` 注入へ繋ぎ替え（`request.user = payload` 等の挙動は不変）。
- **`AuthService.validateToken`/`parseJwt`**：`JwtTokenService` へ委譲する薄いラッパに変更（AuthController の validate-token 等の既存呼び出しは挙動不変）。
- **`UserController`**：`AuthService` 注入を撤去し `JwtTokenService` を注入（findOne の validateToken）。`JwtAuthGuard` は AuthTokenModule 由来。`JwtTokenPayload` は型 import のまま。

モジュール配線 before/after：

- `AuthModule`：`forwardRef(() => UserModule)` → 通常 import に戻す。`JwtModule` 登録を撤去し `AuthTokenModule` を import＋**re-export**（下流の Character/Discord が従来どおり AuthModule 経由で JwtAuthGuard を解決できるよう互換維持）。providers から `JwtAuthGuard` 除去。
- `UserModule`：`forwardRef(() => AuthModule)` を削除し `AuthTokenModule` を import。これで user→auth(module) が消滅。

検証結果：

- `pnpm run build`：成功。
- `pnpm run check:circular`：**No circular dependency found!（0 件）**。これまで許容していた auth⇄user が消滅し、循環ゼロを達成。
- `pnpm test src/domains/auth src/domains/user`：5 suites / 66 tests 緑。既存 spec のモック構造を追従（auth.service.spec は実体 JwtTokenService を登録、user.controller.spec は AuthService モック→JwtTokenService モックへ）。新規 `jwt-token.service.spec.ts`（有効/無効トークン検証）を追加。
- `pnpm run start:dev`：AuthTokenModule/UserModule/AuthModule/CharacterModule/DiscordModule の DI 解決成功、"Nest application successfully started"。

---

## 2026-06-01 H9-character エラーハンドリング統合（character.controller・挙動完全保存）

ブランチ `refactor/error-handling-h9-character`。対象は `domains/character/character.controller.ts`（9 メソッド全てが `@Res()`＋手動 try/catch＋`ApiResponseUtil` 直呼び）。auth/user と同様に `core/http` の `ResponseInterceptor`＋例外フィルタへ controller スコープで置換し、**envelope/status/message/error/errorCode を完全保存**。`ApiResponseUtil` 本体・他 controller・core/http 共通実装は不変。グローバル登録なし。

### auth/user との差分と最小追加

character は汎用 `ApiResponseUtil.error` ではなく**専用ヘルパ**（`authenticationError`/`notFoundError`/`internalServerError`）を使っており、これらは `errorCode` と固定 `message`（'認証エラー'/'未発見エラー'/'サーバーエラー'）を持つ `ErrorResponse` サブクラスを生成していた。共通 `HttpExceptionFilter` は `errorCode` を再現できないため、character スコープ専用に最小追加した（`src/domains/character/character-http.exception.ts`）。

- **`CharacterHttpExceptionFilter`（`@Catch()`）**：`CharacterAuthenticationException`→`AuthenticationErrorResponse`(401)、`CharacterNotFoundException`→`NotFoundErrorResponse`(404)、それ以外→`InternalServerErrorResponse`(500)。いずれも core/http の DTO を再利用するため envelope は `ApiResponseUtil.authenticationError/notFoundError/internalServerError` と完全一致。
- 成功封筒化は共通 `ResponseInterceptor`＋`@ResponseMessage`/`@HttpCode` を流用。**meta を持つ一覧系**（findAll/summaries）は interceptor が meta を落とすため、`SuccessResponse(data, message, meta, uuidv4())` を直接 return（interceptor は `instanceof SuccessResponse` を素通し）して meta を保存。

### エンドポイント別 保存マッピング

| method                     | success (status / message)                                                                | error                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| create                     | 201 / 'キャラクターを作成しました'                                                        | 認証欠落 401(authenticationError,'認証トークンがありません') / DB 500(internalServerError) |
| findAll                    | 200 / 'キャラクター一覧を取得しました'（meta 付き）                                       | 同上 401 / 500                                                                             |
| findUserCharacterSummaries | 200 / 'キャラクターサマリーを取得しました'（meta 付き）                                   | 同上 401 / 500                                                                             |
| findOne                    | 200 / 'キャラクターを取得しました'                                                        | not found 404(notFoundError,'キャラクター') / 500                                          |
| update                     | 200 / 'キャラクターを更新しました'（character.updated emit）                              | 404 / 500                                                                                  |
| remove                     | 200 / 'キャラクターを削除しました'（`{message,characterId}`・character.deleted emit）     | 404 / 500                                                                                  |
| updateDiscordEmbed         | 200 / 'キャラクター情報の取得が完了しました'                                              | 認証 401 / not found 404 / 500                                                             |
| createDiscordThread        | 201 / 'Discordスレッド作成を開始しました'（discord.thread.create.requested emit）         | 401 / 404 / 500                                                                            |
| displayCharacterOnDiscord  | 200 / 'Discordキャラクター表示を開始しました'（discord.character.display.requested emit） | 401 / 404 / 500                                                                            |

Discord 連携 3 メソッドは cookie/redirect の副作用が無く、`@Res()` を完全に return 化（`@SkipResponseWrapper` 不要）。`extractAuthenticatedUser` は `UnauthorizedException`→`CharacterAuthenticationException` に変更（catch 経由の authenticationError と同一 envelope）。

### 検証結果

- `git grep '@Res()' character.controller.ts`：0 件。
- `pnpm run build` 成功。
- `pnpm test character.controller.spec.ts`：**26/26 緑**。spec は新方式（戻り値/throw 検証）＋実機同様の interceptor/filter を介した最終 envelope を `ApiResponseUtil.success/authenticationError/notFoundError/internalServerError` と requestId/timestamp 除き完全一致比較。
- `pnpm run check:circular`：**No circular dependency found**（新規循環なし。character-http.exception は core/dto のみ参照）。
- 既存の `character.integration.spec.ts`（実 DB 依存・トランザクション/イベント）は**変更前から 7 failed の pre-existing**（stash で確認、本変更と無関係）。`character.crud.spec.ts` は単独実行で 9/9 緑（フル並列実行時のみ DB 競合で flaky）。

### 残課題

- 実 HTTP 経由の E2E は未実施。最終的に auth/user/character を共通フィルタ＋グローバル登録へ寄せる際、character の専用 errorCode 保存をどう一般化するか（共通 `HttpExceptionFilter` の `ApiError` 拡張 or 専用例外の昇格）を検討。

## 2026-06-01 H9 エラーハンドリング統合（auth/user controller のみ・挙動完全保存）

ブランチ `refactor/error-handling-h9`。対象は `domains/auth/auth.controller.ts` と `domains/user/user.controller.ts` の 2 つのみ。`character.controller` 他・`ApiResponseUtil` 本体は不変。**レスポンス形（envelope/status/message）を一切変えない**ことを成功条件に、`@Res()`＋try/catch＋`ApiResponseUtil` 直呼びの NestJS アンチパターンを宣言的方式へ置換した。

### 追加した仕組み（`src/core/http/`、controller スコープ適用・グローバル登録なし）

- **`ResponseInterceptor`**：ハンドラ戻り値を `ApiResponseUtil.success` と同一の `SuccessResponse(data, message, undefined, uuidv4())` でラップ。message は `@ResponseMessage` メタ（無ければ '成功'）。`SuccessResponse` 既存インスタンスは二重ラップしない。
- **`HttpExceptionFilter`（`@Catch()`）**：throw を `ApiResponseUtil.error` と同一の `ErrorResponse(errorMessage, label, undefined, undefined, stack, uuidv4())` に整形。
  - `ApiError`（独自 `HttpException`）が throw された場合は最優先で status/label/errorPayload を採用（個別 404/401 分岐の再現）。
  - 素の例外は `@ApiErrorResponse(status, label)` メタを fallback として適用（= 変換前の「catch が全エラーを固定 status＋固定 label に潰す」挙動の再現）。メタも無ければ既定 500/'エラーが発生しました'。
- **デコレータ**：`@ResponseMessage(msg)` / `@ApiErrorResponse(status,label)` / `@SkipResponseWrapper()`（redirect・空返却の非封筒化マーカー）。
- envelope は `ApiResponseUtil` と**同一クラス（`SuccessResponse`/`ErrorResponse`）・requestId=uuid・timestamp**を再利用し形を完全一致。

### エンドポイント別 保存マッピング

auth: validate-token=success 200/'成功'・error 401/'トークン検証に失敗しました' ／ login=200/'成功'・401/'ログインに失敗しました'（code 無し BadRequestException も catch 同様 401 に潰れる挙動を保存）／ logout=200/'成功'・500/'ログアウトに失敗しました'（失敗時ログ出力も保持）／ getUser=200/'成功'・not found は `ApiError(404,'エラーが発生しました','ユーザーID … が見つかりません')`／DB エラー 500/'ユーザー情報の取得に失敗しました'。discordLoginCallback は動的 redirect のため `@Res({passthrough})`＋`@SkipResponseWrapper()`＋`@ApiErrorResponse(401,'Discord認証コールバックに失敗しました')`。
user: 全 success 200/'成功'。create=err 500/'ユーザー作成に失敗しました'、findOne=500/'ユーザー取得に失敗しました'（not found は `ApiError(404,…,'ユーザーが見つかりません')`）、getDiscordGuilds=500/'Discord Guild一覧取得に失敗しました'（user 不在 `ApiError(401,…,'認証トークンがありません')`）、update/addCharacter/removeCharacter/remove も同様に各 500 ラベル＋not found 404。全エンドポイント `@HttpCode(200)` で 200 を保存。

### 検証結果

- `pnpm run build` 成功。
- `pnpm test src/domains/auth src/domains/user src/core/http`：6 suites / 67 tests 緑。controller spec は「戻り値/throw を検証」＋「実機同様の interceptor/filter を介した最終 envelope が変換前の `ApiResponseUtil.success/error` と一致（requestId/timestamp 除き完全一致）」を保証。interceptor/filter 単体テストも追加。
- `pnpm run check:circular`：許容済み UserDomain⇄AuthDomain 1 件のみ（新規循環なし。core/http は依存を一方向に保つ）。
- `@Res()`（引数なし）：対象 2 controller で 0 件。残る `@Res({passthrough:true})` は cookie 設定/redirect の副作用境界のみで、レスポンス本体は interceptor/filter が封筒化。

### 残課題・注意

- `discordLoginCallback` は動的 redirect のため `@Res({passthrough:true})` を維持。`@HttpCode` でなく redirect なので envelope 対象外。passthrough で redirect 後にハンドラが undefined を返す経路は controller spec では緑だが、実 HTTP（redirect 後の二重送信有無）は **E2E 未検証**。本番投入前に手動/E2E で redirect 動作の確認推奨。
- `ApiResponseUtil` は character 等が継続使用のため温存。将来 character spec の AttributeValue ドリフト解消後、同方式を character.controller へ展開し最終的にグローバル登録へ寄せる案。

## 2026-05-30 全フォルダ監査を実施（NestJS ベストプラクティス照合）

`src` 直下10フォルダ（domains, discord, events, core, config, auth, middleware, shared, types, utils）に
専任サブエージェントを割り当て、4視点（設計・依存／コード品質／テスト・保守性／未完成・負債）＋
`nestjs-best-practices` スキル（40ルール）で「劣っている点」を洗い出した。

- 詳細レポート: `document/refactoring-audit-2026-05-30.md`
- フォルダ別の生所見: `outputs/refactor-audit/findings/<folder>.md`（セッション作業領域）

### 監査で判明した構造的問題（3点）

1. **横断コードの置き場所の乱立** — `core`/`shared`/`utils`/`types` が重複し、`core/shared`⇔`src/shared`、
   型置き場が `src/types`/`core/types`/`shared/types` の3系統に分散。規約が未確立。
2. **複数の移行が同時に途中停止** — イベントバス一本化、Discord Interactions の Registry 移行、
   `process.env`→`AppConfigService` 集約、`forwardRef` 撤廃、エラーハンドリング統合がいずれも新旧並存。
3. **ドキュメントと実装の乖離** — 「型安全100%」「循環依存0」の主張に対し、`any` が約360件（非テスト約230件）・
   `forwardRef` 循環・`process.env` 直読み（約25ファイル）が残存。

### High 優先課題（横断）

- H1 横断レイヤー責務未確立 / H2 **イベントバス3系統**（EventBusService/GlobalEventBusService/TypedEventService）
  ＋registry/router/manager 三重 / H3 Discord 巨大サービス / H4 Interactions 新旧並存（InteractionsModule が feature を import）/
  H5 ドメイン純粋性の崩れ（Controller の @Res 手動レスポンス＋デッドコード3点）/ H6 auth 二重構造(forwardRef 循環) /
  H7 設定アクセス非集約 / H8 型安全性の実態乖離(`req.user: any`, any 約230件) / H9 エラーハンドリング三重化 /
  H10 純粋層への混入＋機密ログ(`crypto.util.ts` の config 参照, `auth.controller.ts` のトークン console.log)

### 特に緊急（セキュリティ）

- `auth.controller.ts:103-133` 等が **JWT トークン / Authorization ヘッダを console.log 出力**している。
  機密漏洩リスクのため最優先で除去すること。

### 確認されたデッドコード（domains）

- `character-id.service.ts`（利用箇所ゼロ、ID生成は別3系統に分散）
- `character/schemas/character.schema.ts`（zod 248行、参照ゼロの未配線並行実装）
- `CharacterEventHandlerService`（自称レガシー、リスナー登録は空・private 群は呼び出し元なし）

> ⚠️ **2026-05-31 訂正（実コード再確認）**: 上記デッドコード3点の判定は**実態と乖離しており当てにできない**。
>
> - `character-id.service.ts`（`CharacterIdService`）は **4ファイルで参照・使用中**（`CharacterCreationRequestedHandler`
>   経由でキャラ作成のユニーク ID 採番に使われる現役経路）。「利用箇所ゼロ」は**誤り**。削除すればキャラ作成が壊れる。
> - `character/schemas/character.schema.ts` は参照1件、`CharacterEventHandlerService` は参照3件あり、完全な死蔵とは限らない。
> - **結論: これらは安易に削除しない。削除前に必ず実コードで再精査すること。** 監査レポートの同記述も同様に要訂正。

### 推奨着手順（ARCHITECTURE.md の移行順序に整合）

1. 規約の明文化（横断コード／型の置き場所の決定表、`req.user` の any 排除）
2. 機密ログの即時除去（auth.controller のトークン出力）→ console.\* の Logger 統一に着手
3. events/DESIGN.md 作成 → バス3系統を TypedEventService へ統一・registry 一本化・contracts 逆流依存撤去・
   EventsModule/InteractionsModule の feature import 排除
4. 設定集約（AppConfigService に typed accessor、process.env/生 ConfigService 置換、crypto 鍵もここへ）
5. エラーハンドリング統合（単一 ErrorHandler ＋例外フィルタ、Controller の @Res＋try/catch を戻り値方式へ）
6. デッドコード一掃 ＋ Discord 巨大サービス分割（diceRoll Feature 分離から）、domain の event 直接依存除去
7. auth/user の forwardRef 解消（port 切り出しで UserModule→AuthModule を断つ。src/auth と domains/auth 統合。最後に実施）

各ステップは小さな PR に分割し、`pnpm run build` → `pnpm run start:dev` → `pnpm run check:circular`
で循環参照を確認する（UserDomain⇄AuthDomain のみ許容）。

### 次にやること

- [x] 横断コード／型の置き場所の決定表を作成し本書と `AI.types.md` に追記 → **H1 完了（2026-06-01）**：`src/ARCHITECTURE.md` §12 を決定表化（core=DIサービス/インフラ、shared=純粋関数、utils 解消方針、型は core/types 一本化、express 拡張は例外）。`AI.types.md` に正本ポインタ追記。適用（utils/types のファイル移動）は挙動保存の小 PR で順次。
- [x] `auth.controller.ts` 等の機密 console.log を削除（セキュリティ最優先）→ **Phase S で完了（下記）**
- [ ] `src/events/DESIGN.md` を作成（バス一本化の具体設計）
- [ ] High 課題を Issue / Phase plan 化して着手順に並べる

---

## 2026-05-31 Phase S（セキュリティ最優先）完了

ブランチ `refactor/security-phase-s`。計画書 `document/refactor-phase-S-plan.md` の S1〜S4 を実施。
各ステップは nestjs-best-practices スキルのサブエージェントに委譲し、`pnpm run build` /
`pnpm run check:circular` で検証（循環は許容の UserDomain⇄AuthDomain 1件のみ、新規循環なし）。

### S1: 機密ログ除去（完了）

- `auth.controller.ts`: `console.log('Authorization'/'headers')`（JWT・全ヘッダ漏洩）、
  `User object to save` の `JSON.stringify(user)`（discord access/refresh token 漏洩）等、計7行削除。
- `auth.service.ts`: `console.log(redirectUri)`、params 全ループ debug（**client_secret 漏洩**）、
  Discord プロフィール全体 JSON 出力 等、計8行削除。
- **判断: login レスポンス body の `token: jwt` は削除しない。** フロント（Remix loader
  `trpg-remix-app/app/features/auth/api/authLoader.tsx`）が `auth.token` に依存しており、消すと
  ログインが壊れる。「Cookie 専用移行」は別 Issue（下記 残課題）。

### S2: 機密 env 必須化 ＋ crypto 鍵の config 集約（完了）

- `config/environment.validator.ts`: `JWT_SECRET` / `DISCORD_TOKEN_ENCRYPTION_KEY` に最小長32文字検証、
  `REDIRECT_URL` は値がある場合のみ URL 形式検証を追加（エラーに機密値は出さず長さのみ表示）。
- crypto を**純粋関数 ＋ DI サービス**に分離（ARCHITECTURE 方針＝utils は純粋関数のみ）：
  - `utils/crypto.util.ts` … 鍵を引数で受け取る純粋関数化（process.env 直読み廃止）。
    アルゴリズム `aes-256-gcm`・鍵導出 `scryptSync(key,'salt',32)`・フォーマットは維持＝**後方互換あり**。
  - `core/shared/services/crypto.service.ts`（新規）… `@Injectable`、`AppConfigService` から
    `security.discordTokenEncryptionKey` を取得し CryptoUtil へ委譲。`SharedModule` に登録・export。
  - 呼び出し元（`auth.service.ts` 6箇所、`user.service.ts` 1箇所）を CryptoService 注入へ置換。
  - spec: `crypto.util.spec.ts` を鍵引数対応に更新、`crypto.service.spec.ts` 新規（往復・鍵未設定エラー）。

### S3: CORS 二系統解消（完了）

- no-op の `middleware/cors.middleware.ts` を削除。`app.module.ts` から `NestModule`/`configure()`/
  `CorsMiddleware` 配線を撤去（`import { Module }` のみに）。CORS は `main.ts` の `enableCors` に一本化。
- `main.ts`: 未使用の `import cors from 'cors'` を削除。`frontendUrl` 空時に fail-fast するガードを追加し
  `origin` を確定値化（`credentials: true` 維持）。`cors` npm パッケージは未使用＝削除可（未削除・報告のみ）。

### S4: req.headers['user'] 無検証認証導線を Guard 一本化（完了）

- `character.controller.ts` の `extractAuthenticatedUser` と `user.controller.ts` の `getDiscordGuilds`
  から `req.headers['user']` の `JSON.parse` フォールバックを除去し、`JwtAuthGuard` が設定する
  `req.user`（`express/index.d.ts` で `JwtTokenPayload` 宣言済み）のみを使用。`as unknown as` キャスト除去。
- 対象ルートは全て `@UseGuards(JwtAuthGuard)` 付与済み（抜けなし）。

### ⚠️ Phase S 完了後の重要な運用上の注意・残課題

- **【対応済み】** S2 の最小長32文字検証は **`NODE_ENV=production` のときのみ強制**（dev/test は緩和）に調整。
  必須チェック（値の存在）と `REDIRECT_URL` 形式検証は全環境で維持。これによりローカル/開発は既存の短い秘密
  （12文字）でも起動でき、本番のみ強い秘密を要求する。`environment.validator.ts` の `validate()` 内で
  `if (result.NODE_ENV === 'production')` ガードにより実装。dev=success / prod=fail を dist 直叩きで確認済み。
  - ⚠️ **本番デプロイ時の注意**: 本番 env の `JWT_SECRET` / `DISCORD_TOKEN_ENCRYPTION_KEY` は32文字以上が必須。
    `JWT_SECRET` 変更 → 既存 JWT 無効化（再ログイン、影響小）。`DISCORD_TOKEN_ENCRYPTION_KEY` 変更 →
    scrypt 出力が変わり**既存 DB の暗号化 Discord トークンが復号不能**（ユーザーは Discord 再連携が必要）。
    本番で鍵を伸ばす場合は移行計画（再認証フローの案内等）が必要。
- **【別 Issue】** login レスポンス body の `token: jwt` を廃し Cookie(httpOnly) 専用へ移行する。
  フロント（Remix loader が body token で自前 Cookie を設定）の改修が前提。
- **【別 Issue／既存負債】** `auth.controller.spec.ts`・`auth.service.spec.ts`・`user.controller.spec.ts`・
  `user.service.spec.ts`・`character.controller.spec.ts` 等が **Phase S 着手前から** 型/メソッド/モジュール
  不整合でコンパイル不能。Phase S の変更は新規破損を加えていない（stash ベースライン比較で確認済み）が、
  これら spec の修復は別タスク。
- **【未着手】** `cors` パッケージの package.json からの削除、`discord.controller.ts` の独自
  `AuthenticatedRequest` 型一本化（Phase T 型整理へ）。

---

## 2026-05-31 次フェーズ計画（整理）

Phase S 完了後の状況を実コードで再確認し、着手順を整理した。`process.env` 直読みは監査の「約25」ではなく
**実際は9ファイル**（非 spec）。デッドコード3点の判定は誤り（上の訂正注記参照）。

### A. 現ブランチ（refactor/security-phase-s）の締め

- [x] auth/user の壊れた spec を修復（4 suites / 62 tests green）。Guild 系メソッドは Auth→User へ移管済みと判明（`AI.test.md` 記載）。
- [x] pre-commit フックの健全化（`git add .` 撤去・ステージ限定）とテンプレート同期、`prettier.config.js` の CommonJS 化。
- [x] 監査の「デッドコード3点」記述を訂正（本書・監査レポート）。
- [ ] **develop へマージ**（前に `pnpm run build`→`start:dev`→`check:circular` の最終確認。push 要否はユーザー判断）。
- [ ] Phase S スピンオフのバックログ化（下記「別 Issue」群：token の Cookie 専用移行 / 未使用 `cors` パッケージ削除 / 本番 env 32文字必須の周知）。

### B. High 課題（ARCHITECTURE.md の移行順・推奨シーケンス）

1. **H7 設定集約** … `process.env` 直読みを `AppConfigService` へ。**DI 可能な3クラスは移行完了**（2026-05-31, ブランチ `refactor/config-aggregation`）：`channel-cache.service`・`discord-command-registration.service`・`performance-dashboard.controller`。`DISCORD_CACHE_TTL`/`MESSAGE_CACHE_LIMIT`/`CHANNEL_CACHE_LIMIT`/`TEST_MOCK_DISCORD` を schema/validator/configuration/ConfigPaths へ追加し `discord.*` で公開、NODE_ENV は既存 `app.environment` を使用。
   - **残**（DI 困難・別途）：`core/dto/api-response.dto.ts`・`utils/error-handler.ts` の NODE*ENV 直読み（DTO/静的 util で DI 不可）。設定層の読み取り（`config.service`・`configuration` の PROTOTYPE*\*・`environment.validator`）は env→config 境界として維持。
2. **H2/H4 イベントバス一本化＋Interactions registry** … **完了（2026-05-31）**。`events/DESIGN.md` の T1〜T5 を全実施し、安全網テスト（挙動固定）＋build/check:circular/start:dev で挙動不変を都度証明しつつ develop へ段階マージ。
   - **T1**: デッドな `EventRouterService` 撤去。
   - **T2(a/b/c)**: レガシー `GlobalEventBusService` を完全撤去し**バスを `TypedEventService` 1系統に統一**（3系統並存を解消）。生フローは型付き契約に追加のうえ移設、dead 利用は削除。
   - **T3**: events→features 逆流を解消。完了系4ハンドラを `src/discord/events/handlers/`（`DiscordEventHandlersModule`）へ移設し `TypedEventService.on` 自己購読化。EventsModule の feature `forwardRef` import を撤去 → events 層は domains/core/shared 依存のみ。
   - **T4**: `TypedEventService` を `shared/application`→`core/events` へ移設、@Global `CoreEventsModule` 新設、旧 `src/shared/shared.module` 削除（import 48ファイル更新）。
   - **T5**: `src/events/AI.event.md` 冒頭に現状の正アーキテクチャ節を追加し以降を履歴と明示。
   - 正本は `src/events/AI.event.md` 冒頭節＋`src/events/DESIGN.md`。登録は events 層=EventRegistry（File-based）／discord 層=自己購読 の2経路。監査の「contracts 逆流」は実在せず、逆流は handlers→features / EventsModule→feature の import だった（T3 で是正済み）。
3. **H9 エラーハンドリング統合** … **auth/user controller 完了（2026-06-01, ブランチ `refactor/error-handling-h9`）**。`core/http` の controller スコープ例外フィルタ＋レスポンスインターセプタへ置換、envelope/status/message を完全保存（詳細は冒頭 2026-06-01 節）。残: character 他は spec ドリフト解消後に展開し、最終的にグローバル登録へ寄せる。
4. **H3/H5 Discord 巨大サービス分割** … pagination 等の分割＋（再精査後の）デッド整理（中〜大）。
5. **H6 auth/user forwardRef 解消** … port 切り出し＋`src/auth`/`domains/auth` 統合。影響最大＝最後（大）。
6. 随時: **H1/H8** 横断コード・型の置き場所決定表＋`any` 削減。

### C. テスト負債（別トラック）

- `character`/`discord` 系 spec が **AttributeValue モデルドリフト**でコンパイル不能（Phase S 着手前から）。`test-expansion`/`create-test` で別タスク修復。auth/user spec は A で修復済み。

### 進め方

各 High 課題は `trpg-refactor` スキル（理解→nestjs-best-practices へ実装委譲→build/check:circular 検証→AI.\*.md 記録）で小さな PR に分割して進める。循環参照は UserDomain⇄AuthDomain のみ許容。
