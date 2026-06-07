# Phase S（セキュリティ最優先）実装計画書

## ⚠️ 履歴注記（2026-06-03 / 循環依存の追記 2026-06-06）

本計画書の S1〜S4 は 2026-05-31 に実施完了。実施詳細は AI.refactor.md『2026-05-31 Phase S 完了』節を参照。本書は実施済み計画のスナップショット。

> 🔁 **循環依存ポリシーの現行注記（2026-06-06）**: 本書内に複数回ある
> 「`check:circular` は `UserDomain⇄AuthDomain` のみ許容」という記述は、**作成時点（2026-05-30）の
> スナップショットとしては正しかった**が、**現行ポリシーではない**。`UserDomain⇄AuthDomain` の循環は
> H6（2026-06-01）で解消済みで、現在は循環依存ゼロが必須（`check:circular` は「No circular dependency found!」が正常）。
> 以降に出る「のみ許容」表現は履歴として読むこと（本文は当時のまま残置）。

**作成日:** 2026-05-30
**ブランチ:** `refactor/security-phase-s`（develop から分岐済み）
**前提:** サンドボックスでは `node_modules` の pnpm シンボリックリンクが I/O エラーで全滅しており、
`build` / `test` / `check:circular` を実行できない。よって本書は「計画」であり、各ステップのコードは
ユーザーのローカル環境で検証しながら適用する（または検証可能環境で改めて実施）。

## 検証方針（各ステップ共通・ローカルで実行）

```
pnpm run build          # nest build（コンパイル）
pnpm run test           # Jest ユニット
pnpm run check:circular # madge --circular（UserDomain⇄AuthDomain のみ許容）
```

各ステップは独立コミットにし、問題時はステップ単位で revert する。

---

## S1: 機密ログ除去と JWT 二重露出の見直し（最重要）

### 対象と現状（実コード確認済み）

- `src/domains/auth/auth.controller.ts`
  - `:103` `console.log('validateToken')`
  - `:105` `console.log('Authorization', Authorization)` ← **JWT トークンを平文出力（重大）**
  - `:106` `console.log('headers', headers)` ← 全ヘッダ出力（Cookie 等も露出）
  - `:133` `console.log('login')`
  - `:155-169` `login` のレスポンスボディに `token: jwt` を含む。一方 `:153` で Cookie にも JWT を発行しており**二重露出**。
- `src/domains/auth/services/auth.service.ts`
  - `:338` `console.log(redirectUri)`

### 変更内容

1. `auth.controller.ts:103,105,106,133` の `console.log` を削除。デバッグが必要な箇所のみ
   `this.logger.debug(...)` に置換し、**トークン・Authorization ヘッダ・headers 全体は出力しない**。
2. `auth.service.ts:338` の `console.log(redirectUri)` を削除（必要なら `this.logger.debug` で URL のみ、機密は出さない）。
3. `login` レスポンスの JWT 二重露出を解消：認証は Cookie（httpOnly）で行う方針のため、
   レスポンスボディの `token: jwt`（`:161`）を削除。フロントが body の token に依存していないか要確認
   （`trpg-remix-app` 側 `app/lib`／`features/auth` の login 呼び出しを grep）。依存が残る場合は
   「Cookie 専用へ移行」を別 Issue 化し、本ステップでは最低限ログ除去のみ先行も可。
4. 併せて `auth.service.ts:316-317,347-352` の過剰 debug（プロファイル全体/スコープ/全 params 出力）を
   機密を含まない粒度へ削減。

### 検証

- build 成功、auth.controller.spec / auth.service.spec が緑。
- grep で `console.` が auth 配下から消えたこと、`token:` がレスポンスから消えた（または Issue 化）こと。

---

## S2: 機密 env の必須化＋crypto 鍵の config 集約

### 対象と現状（監査 config.md / utils.md より）

- `src/config/environment.validator.ts` … REQUIRED チェックと型変換はあるが、機密の**最小長/形式検証が無い**。
  `JWT_SECRET` / `TOKEN`(Discord) / `DISCORD_SECRET` / `DISCORD_TOKEN_ENCRYPTION_KEY` / `MONGODB_URI` の
  必須・最小長が未保証で、空シークレットでも起動し得る。
- `src/config/schemas/environment.schema.ts` … `REQUIRED_VARIABLES` の中身を要確認（機密が含まれているか）。
- `src/utils/crypto.util.ts:15` … `process.env.DISCORD_TOKEN_ENCRYPTION_KEY`（実コードでは `TOKEN_ENCRYPTION_KEY`
  の可能性あり、要現認）を直読み。`AppConfigService` に `security.discordTokenEncryptionKey` があるのに迂回。

### 変更内容

1. `environment.schema.ts` の `REQUIRED_VARIABLES` に機密5種が含まれるか確認し、不足を追加。
2. `environment.validator.ts` に追加検証：
   - `JWT_SECRET` 最小長（例 32 文字以上）
   - `DISCORD_TOKEN_ENCRYPTION_KEY` は AES-256 用に 32 バイト相当（hex/base64 の長さ）を検証
   - `MONGODB_URI` スキーム検証は既存を流用、`REDIRECT_URL` の URL 形式検証を追加
   - 不正時は起動前に fail-fast（既存の検証失敗パスに乗せる。`console.error`→Nest Logger 化は任意）
3. `crypto.util.ts` を「鍵を引数で受け取る純粋関数」に変更し、`process.env` 直読みを除去。
   鍵解決は呼び出し側（`AuthService` など AppConfigService を持つ層）が
   `appConfigService.get('security.discordTokenEncryptionKey')` で行い渡す。
   - 影響: `CryptoUtil.encrypt/decrypt` の呼び出し箇所（auth.service の token 暗号化/復号）を
     新シグネチャに合わせて修正。`crypto.util.spec.ts` も更新。
   - 代替案（影響小）: `CryptoService`（@Injectable, AppConfigService 注入）を新設し、utils の純粋関数を内部利用。
     auth は CryptoService を DI。utils は純粋関数のみに戻る（ARCHITECTURE 方針に合致）。**こちらを推奨**。

### 検証

- 空/短い機密で起動させ、起動が**失敗する**ことを確認（手動 or 専用 spec）。
- crypto.util.spec / auth.service.spec が緑。トークン暗号化往復が正しいこと。

---

## S3: CORS 二系統解消と過剰許可リスク封じ

### 対象と現状（監査 middleware.md より）

- `src/middleware/cors.middleware.ts` … 全ロジックがコメントアウトされた no-op。`import 'dotenv/config'` 等の
  不要 import あり。
- `src/app.module.ts:48-51` … `consumer.apply(CorsMiddleware).forRoutes('*')` で no-op を全ルート適用。
- `src/main.ts:30-33` … 実際の CORS は `app.enableCors({ origin: frontendUrl, credentials: true })`。
  `frontendUrl` 未設定時は `origin: undefined` ＝**全オリジン許可 + credentials:true** の危険。

### 変更内容

1. `cors.middleware.ts` を削除。`app.module.ts` から `NestModule`/`MiddlewareConsumer`/`configure()` と
   `CorsMiddleware` 配線を削除（CORS は `main.ts` に一本化）。
2. `main.ts` の `enableCors` で `frontendUrl` 必須化：未設定なら起動失敗 or 明示的許可リストのみ許可。
   S2 で `FRONTEND_URL` を必須化すれば `origin` が undefined になり得ない状態にできる（S2 と連動）。
3. `credentials: true` は維持しつつ `origin` を確定値に。

### 検証

- build 成功、起動時に CORS が main.ts 経由でのみ設定されること。
- `frontendUrl` 未設定で起動失敗することを確認。

---

## S4: req.headers['user'] 無検証認証導線を Guard 一本化

### 対象と現状（監査 domains.md / types.md より）

- `src/domains/character/character.controller.ts:58-68` `extractAuthenticatedUser` が
  `req.headers['user']` を `JSON.parse`（信頼できないヘッダを認証情報として採用しうる）。
- `src/domains/user/user.controller.ts:62-64` も同様。
- 正規の認証は `JwtAuthGuard`（`domains/auth/guards/jwt-auth.guard.ts:37` で `request.user = tokenPayload`）。
- `req.user` の型が3系統に分裂（express 型拡張 / discord.controller の独自 AuthenticatedRequest / as unknown as）。

### 変更内容

1. `character.controller.ts` / `user.controller.ts` の `req.headers['user']` JSON.parse を廃止し、
   `@UseGuards(JwtAuthGuard)` 経由の `req.user`（JwtTokenPayload）を使う形へ統一。
2. `src/types/express/index.d.ts` の `Request.user?: JwtTokenPayload` を正本とし、各 controller の
   `as unknown as` 二重キャストを除去。`discord.controller.ts` の独自 `AuthenticatedRequest` も
   この型に寄せる（型の一本化は S4 の範囲で可能な分のみ。残りは Phase T の型整理で）。
3. Guard が必要なルートに `@UseGuards(JwtAuthGuard)` が付いているか確認し、抜けがあれば付与。

### 検証

- build 成功、character/user の spec が緑。
- ヘッダ `user` を送っても認証として採用されないこと（手動 or spec）。

---

## フェーズ完了時

- 各ステップを独立コミット（例: `fix(auth): remove secret console.log and token in response body`）。
- `AI.refactor.md` の「次にやること」を更新し、`AI.development.md`（セキュリティ節）に対応内容を追記。
- `pnpm run build && pnpm run test && pnpm run check:circular` を**ローカルで**通してから develop へ。

## サブエージェント実行方針（環境復旧後）

各ステップ（S1〜S4）に1サブエージェントを割り当て、(1)対象ファイルを読む→(2)変更→
(3)`pnpm run build` と該当 spec を実行→(4)結果を報告、の手順で実行する。
S2・S3 は `FRONTEND_URL`/機密必須化で連動するため、S2→S3 の順に。S1 は独立で先行可能。
