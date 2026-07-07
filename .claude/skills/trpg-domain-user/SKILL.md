---
name: trpg-domain-user
description: >-
  TRPG-SERVER の user ドメイン（src/domains/user）の設計ガイド。ユーザー情報の CRUD・
  characterIds の関連付け・Discord トークン（暗号化保存）・Discord ギルド取得に関わるコードを追加・変更・
  レビュー・リファクタするときは必ず使う。「ユーザーにキャラクターを紐付ける」「ギルド一覧が取れない」
  「User スキーマにフィールドを足す」など user と明示されない依頼でも、src/domains/user 配下や
  User モデル・UserService に触るなら必ず参照する。責務・公開API・Auth⇄User 循環の再導入禁止・
  やらないこと・既知の落とし穴を定義する。
---

# user ドメイン 設計ガイド

**対象**: `TRPG-SERVER/src/domains/user/`
**役割**: Discord アカウントに紐づくアプリユーザーの正本。ユーザー情報の CRUD、所有キャラクター ID
（`characterIds[]`）の関連付け、暗号化された Discord OAuth トークンの保管と、それを使った Discord API
（ギルド一覧）呼び出し。**「ユーザーが誰か」を決めるのは auth ドメインの仕事**で、user はその結果を保管するだけ。

## 構成マップ

| ファイル | 役割 |
| --- | --- |
| `user.module.ts` | MongooseModule（User）＋ **AuthTokenModule**（AuthModule ではない）＋ SharedModule を import |
| `user.controller.ts` | `/users` CRUD・`/users/discord/guilds`・characterIds の PATCH/DELETE |
| `user.service.ts` | CRUD・characterIds 操作・Discord トークン復号・ギルド取得（HttpClientService） |
| `repositories/user.repository.ts` | Mongoose CRUD。characterIds は `$addToSet`（重複なし）/ `$pull` |
| `models/user.model.ts` | User スキーマ。collection は `trpg-usertable` |
| `dto/` | CreateUserDto / UpdateUserDto / UserOutputDto 等 |

**User スキーマの要点**: `discordUserId`（unique・必須・全メソッドのキー）、`name`、`avatarHash?`、
`characterIds: string[]`、`discordAccessToken?` / `discordRefreshToken?`（**CryptoService で暗号化済みの値のみ保存**）、
`discordTokenExpiresAt?`、`discordTokenScope?`。

## 最重要ルール: AuthModule を import しない（H6）

user ドメインは**認証方式を知らない**。JWT の検証が必要なら `AuthTokenModule` の
`JwtAuthGuard` / `JwtTokenService` を使う。次をやると H6（2026-06-01）で解消した Auth⇄User 循環が復活する：

```typescript
// ❌ UserModule に AuthModule を import する
// ❌ UserController / UserService に AuthService を注入する
// ✅ @UseGuards(JwtAuthGuard) と JwtTokenService.validateToken() だけを使う（現行 user.controller.ts と同じ）
```

逆方向（AuthService → UserService）は許容されている。auth 側から user を呼ぶのは正常。

## 公開API（他層が使ってよい入口）

- `UserService.findOne / findByDiscordId / create / update / remove`
- `UserService.addCharacterId / removeCharacterId` — キャラクター関連付けの唯一の入口（`$addToSet`/`$pull`。配列を丸ごと update で上書きしない）
- `UserService.updateDiscordTokens / getDiscordAccessToken` — トークン保管・取得（復号込み）
- `UserService.getUserDiscordGuilds` — 保存トークンでギルド一覧取得

Repository を domains 外から直接使わない（現行の消費者は auth と character。Service 経由を維持）。

## やること / やらないこと

| やること | やらないこと |
| --- | --- |
| ユーザー情報の CRUD（キーは discordUserId） | JWT の発行・検証ロジックの実装（→ auth / AuthTokenModule） |
| characterIds の追加・削除（原子的演算子で） | キャラクター本体のデータ操作（→ character ドメイン） |
| Discord トークンの暗号化保管（暗号化は CryptoService） | discord.js の import・Bot 操作（→ discord 層） |
| 保存トークンでの Discord REST 呼び出し（ギルド） | トークンのリフレッシュ実装（→ auth の `getValidDiscordAccessToken`） |
| | イベント発行・購読（user ドメインは TypedEventService を使わない。現状ゼロを維持） |

## 実装パターン

**エンドポイントを追加・変更する**:
- 既存には**無ガードの更新系エンドポイント**（PUT/PATCH/DELETE がパスパラメータの discordUserId を信用する）が
  残っているが、これは既知の負債。**新規・変更するエンドポイントには `@UseGuards(JwtAuthGuard)` を付け、
  `request.user.discordUserId` とパスパラメータの一致を検証する**。既存の形を真似しない。

**トークンを扱う**:
- DB に入れる値は必ず CryptoService で暗号化してから。平文トークンを保存・ログ出力しない。
- `getDiscordAccessToken` は復号失敗時に **null を黙って返す**（既知の挙動）。ギルド取得の不具合調査では
  「復号失敗 / 期限切れ / scope 不足」の3系統を順に疑う。

**スキーマにフィールドを足す**:
- optional フィールドに `default: ''` を使うと `$exists: true` クエリが空文字にもマッチする。
  不在は undefined/null で表現する方が安全（既存の `discordUserId: default ''` はこの罠の実例）。

## 検証

変更後は必ず: `pnpm run build` → `pnpm run check:circular`（No circular dependency found!）→
user 関連 spec（controller / service / repository）→ auth・character の消費側 spec。
作業終了後は該当 AI.*.md に状況を記録する。

## 正本ドキュメント

上位ルールは `src/ARCHITECTURE.md`（§10 Auth/User 方針）。認証フロー側は `trpg-domain-auth` スキル、
キャラクター側は `trpg-domain-character` スキルを参照。
