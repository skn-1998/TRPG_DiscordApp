---
name: trpg-domain-auth
description: >-
  TRPG-SERVER の auth ドメイン（src/domains/auth）の設計ガイド。認証・認可・JWT・Discord OAuth2・
  JwtAuthGuard・JwtTokenService・AuthTokenModule・Cookie 認証に関わるコードを追加・変更・レビュー・
  リファクタするときは必ず使う。「ログインを直す」「トークン検証を変える」「ガードを付ける」「認証エラーを調査する」
  など auth と明示されない依頼でも、src/domains/auth 配下や JWT/OAuth/guard に触るなら必ず参照する。
  責務・公開API・依存ルール（Auth⇄User 循環の再導入禁止）・やらないこと・既知の落とし穴を定義する。
---

# auth ドメイン 設計ガイド

**対象**: `TRPG-SERVER/src/domains/auth/`
**役割**: Discord OAuth2 によるログインと、JWT（Cookie/Authorization ヘッダ）による認証・認可。
「ユーザーが誰か」を確定させることだけが仕事。ユーザー情報の保管は user ドメイン、認可後の業務処理は各ドメインの責務。

## 構成マップ

| ファイル | 役割 |
| --- | --- |
| `auth.module.ts` | AuthService / DiscordStrategy / CookieService を提供。AuthTokenModule を import し re-export |
| `auth.controller.ts` | `/auth/discord`（OAuth 開始）・`/auth/discord/callback`・`/auth/validate-token`・`/auth/login`・`/auth/logout` |
| `services/auth.service.ts` | OAuth code 交換・JWT 発行・Discord トークンの暗号化保存と自動リフレッシュ |
| `token/auth-token.module.ts` | **JWT プリミティブの単一ホーム**。JwtModule 設定＋ JwtTokenService / JwtAuthGuard を提供・export |
| `token/jwt-token.service.ts` | JWT 検証プリミティブ（`validateToken` / `parseJwt`）。**UserService に依存しない**設計 |
| `guards/jwt-auth.guard.ts` | Authorization ヘッダ → `req.cookies.jwt` の順で JWT を検証し `request.user` に payload を載せる |
| `discord.strategy.ts` | passport-discord。scope は `identify, email, guilds` |
| `models/` `dto/` | `JwtTokenPayload`（username / discordUserId のみ）・`DiscordUserProfile`・login 系 DTO |

## 最重要ルール: Auth⇄User 循環の再導入禁止（H6）

かつて `UserModule → AuthModule → UserModule` の循環があり、H6（2026-06-01）で
**JWT 検証を `AuthTokenModule`（JwtTokenService / JwtAuthGuard）に切り出して解消**した。現在は循環ゼロが必須
（`pnpm run check:circular` = "No circular dependency found!" が正常）。

この構造が壊れるのは次のときなので、絶対にやらない：

```typescript
// ❌ JwtTokenService に UserService や UserRepository を注入する
//    （AuthTokenModule が user ドメインを知った瞬間に循環が復活する）
// ❌ user ドメイン側で AuthService を注入する（ガード目的なら JwtTokenService / JwtAuthGuard を使う）
// ❌ UserModule に AuthModule を import で追加する

// ✅ 他ドメインが「認証」を必要とするときは AuthTokenModule を import し、
//    JwtAuthGuard（@UseGuards）または JwtTokenService.validateToken() を使う
// ✅ AuthService → UserService の方向は許容（一方向）
```

## 公開API（他層が使ってよい入口）

- `JwtAuthGuard` — コントローラの `@UseGuards(JwtAuthGuard)`。検証済み payload は `request.user`（`JwtTokenPayload`）
- `JwtTokenService.validateToken(authorizationHeader)` / `parseJwt(token)` — ガードを使えない場面の手動検証
- `AuthService.generateJwt(user)` / `getValidDiscordAccessToken(discordUserId)` — JWT 発行・Discord トークン取得（期限切れなら自動リフレッシュ）

これ以外（private の `refreshDiscordToken`、DiscordStrategy 内部など）を外から呼ぶ設計にしない。

## やること / やらないこと

| やること | やらないこと |
| --- | --- |
| OAuth code ↔ トークン交換、JWT 発行・検証 | ユーザー情報の CRUD（→ user ドメイン） |
| Discord トークンの暗号化保存・自動リフレッシュ（CryptoService 経由） | Discord Bot の操作・discord.js の import（→ discord 層） |
| Cookie（httpOnly）への JWT 設定・削除（CookieService） | キャラクター等の業務データ参照 |
| ガード提供（AuthTokenModule） | イベント発行・購読（auth ドメインは TypedEventService を使わない。現状ゼロを維持） |

## 実装パターン

**認証必須のエンドポイントを新設する（他ドメイン含む）**:
1. その module が `AuthTokenModule` を import していることを確認（AuthModule 丸ごとは不要）
2. `@UseGuards(JwtAuthGuard)` を付け、`request.user.discordUserId` で本人を特定する
3. **リソース操作系はパスパラメータの ID を信用せず、JWT の discordUserId と突き合わせる**
   （既存の user ドメインには無ガードの更新系エンドポイントが残っているが、これは既知の負債であり真似しない）

**ログイン経路に手を入れる**:
- `signInAndRegisterUserInfo` は **@deprecated**（Discord トークンを保存しないためリフレッシュが効かない）。
  新規・変更コードでは `signInAndRegisterUserInfoWithTokens` を使う。
- JWT payload（`JwtTokenPayload`）は username / discordUserId のみ。フィールド追加は
  「発行時スナップショットで良いか」を検討してから（ロール等の実行時状態を入れない）。

## 既知の落とし穴

- **ガードのフォールバック順序**: Authorization ヘッダが存在すれば（不正形式でも）Cookie は見ない。認証不具合の調査はまずここ。
- **トークン復号の silent failure**: `UserService.getDiscordAccessToken` は復号失敗で null を黙って返す。guilds 取得失敗の調査時は復号・期限切れ・scope 不足の3系統を疑う。
- **scope 検証なし**: Discord が `guilds` scope を返したかは検証していない。
- **秘密情報をログに出さない**: JWT・Authorization ヘッダ・headers 全体・トークンの console.log / logger 出力は禁止（Phase S で除去済み。再導入しない）。

## 検証

変更後は必ず: `pnpm run build` → `pnpm run check:circular`（No circular dependency found!）→
関連 spec（auth.controller / auth.service / jwt-token.service / user 側の guard 利用 spec）→ 影響が広ければ全 suite。
作業終了後は `AI.refactor.md` 等の該当 AI.*.md に状況を記録する。

## 正本ドキュメント

依存方向・禁止事項の上位ルールは `src/ARCHITECTURE.md`（§10 Auth/User 方針・§15 禁止事項）。
進捗・経緯は `AI.refactor.md`。user ドメイン側の詳細は `trpg-domain-user` スキルを参照。
