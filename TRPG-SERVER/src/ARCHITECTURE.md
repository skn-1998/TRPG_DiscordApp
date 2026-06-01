# TRPG-SERVER 全体アーキテクチャ方針

**最終更新**: 2026-05-30  
**ステータス**: Step 0 設計ルール固定  
**関連**: [AI.architecture.md](./AI.architecture.md) / [discord/DESIGN.md](./discord/DESIGN.md) / events/DESIGN.md（作成予定）

---

## 1. 目的

`src/` 配下の再設計を安全に進めるため、module 境界・依存方向・責務の置き場所を固定する。

この文書は実装詳細ではなく、今後のリファクタで守る **全体ルール** を定義する。  
`discord/DESIGN.md` や events/DESIGN.md は、この文書の下位設計として扱う。

---

## 2. 現状評価

全体方針として feature / domain / event / registry へ向かっている点は良い。  
ただし、移行途中のため旧設計と新設計が並存している。

| 領域                | 現状の問題                                                   | 優先度 |
| ------------------- | ------------------------------------------------------------ | ------ |
| `shared` / `events` | EventEmitter 初期化と event bus が複数系統で並存             | 高     |
| `discord`           | InteractionsModule が feature 実装を所有している             | 高     |
| `domains`           | domain service が event bus / application concern に直接依存 | 高     |
| `auth` / `user`     | `forwardRef` による循環依存                                  | 中     |
| `types` / `utils`   | 横断置き場として肥大化しやすい                               | 中     |
| `config`            | 概ね良いが、直接 `process.env` / `ConfigService` 使用が残る  | 中     |

---

## 3. 目標構造

長期的な整理後の目標構造は以下。

```txt
src/
  core/
    config/
    database/
    events/
    http/
    logging/

  domains/
    character/
    dice-roll/
    user/

  features/
    auth/
    discord/
    character-edit/
    character-thread/
    dice-roll/

  shared/
    types/
    utils/
```

短期的には既存フォルダを大きく動かさず、責務と依存方向を先に揃える。

---

## 4. 依存方向ルール

依存は原則として上から下へ流す。

```txt
features
  -> domains
  -> core
  -> shared
```

許可する依存:

| From         | To                             | 条件                                                         |
| ------------ | ------------------------------ | ------------------------------------------------------------ |
| `features/*` | `domains/*`                    | use case / orchestration から domain service を呼ぶ          |
| `features/*` | `core/*`                       | config, events, http, database port などの基盤利用           |
| `domains/*`  | `core/*`                       | repository interface や ID 生成など、domain 非依存の基盤のみ |
| `core/*`     | `shared/*`                     | 純粋型・純粋関数のみ                                         |
| any          | `shared/types`, `shared/utils` | 副作用なしの型・関数のみ                                     |

禁止する依存:

| From                | To           | 理由                                                  |
| ------------------- | ------------ | ----------------------------------------------------- |
| `core/*`            | `features/*` | 基盤が feature を所有してしまう                       |
| `core/*`            | `domains/*`  | domain を基盤へ逆流させない                           |
| `domains/*`         | `features/*` | domain が UI / Discord / auth flow を知るべきではない |
| `events` core       | `features/*` | event 基盤が feature handler を所有してしまう         |
| `interactions` core | `features/*` | interaction 基盤が feature handler を所有してしまう   |

---

## 5. Module ルール

### 5.1 `forwardRef` は原則禁止

`forwardRef` は一時的な移行手段としてのみ許可する。新規追加は禁止。

残存箇所は issue / phase plan に載せ、以下のいずれかで解消する。

- 共通 port / interface を切り出す
- orchestration を feature 層へ移す
- event で非同期連携に変える
- module の所有権を片方向に決める

### 5.2 `@Global()` は原則禁止

許可する候補:

- `ConfigModule` 相当のアプリ設定
- 本当にアプリ全体で単一の infrastructure provider

禁止するもの:

- feature service
- repository
- event handler
- interaction handler
- UI / presenter / adapter

### 5.3 provider は所有 module に置く

provider は「使われる場所」ではなく「所有する feature / domain / core module」に登録する。

例:

- dice-roll pagination は `diceRoll` feature が所有する
- interaction registry は interactions core が所有する
- event handler はイベントを処理する feature / domain 側が所有する

---

## 6. レイヤー責務

| レイヤー        | やること                                  | やらないこと                                   |
| --------------- | ----------------------------------------- | ---------------------------------------------- |
| `core/config`   | 設定の読み取り・型安全 access             | feature 固有の分岐                             |
| `core/database` | DB 接続・transaction 基盤                 | domain logic                                   |
| `core/events`   | event bus / registry / contract 基盤      | feature handler の所有                         |
| `core/http`     | 外部 HTTP client port                     | Discord / OAuth 固有処理                       |
| `domains/*`     | entity, repository, domain service        | Discord UI, HTTP response, event orchestration |
| `features/*`    | use case, orchestration, handler, adapter | DB 接続初期化、横断基盤の所有                  |
| `shared/types`  | 本当に横断的な型                          | feature 固有型                                 |
| `shared/utils`  | 副作用なしの純粋関数                      | DI service, I/O, framework 依存                |

---

## 7. Events 方針

event bus は 1 系統に統一する。

目標:

```txt
core/events
  - TypedEventService
  - EventRegistryService
  - event contracts

features/*/events
  - feature-local contracts
  - feature-owned handlers
  - publishers
```

ルール:

- `EventsModule` は feature module を import しない
- feature module が event registry / bus を import し、自分の handler を登録する
- global integration event と feature-local event を分ける
- レガシーバス（旧 `EventRouterService` / 旧 global event bus）は撤去済み（B-2 T1/T2c, 2026-05-31）。バスは TypedEventService 1系統
- `TypedEventService.on()` の直接登録は段階的に registry 経由へ寄せる

---

## 8. Discord 方針

`discord/DESIGN.md` を下位設計として扱う。

ルール:

- `InteractionsModule` は feature module を import しない
- feature 側が `InteractionRegistryService` を import して handler を明示登録する
- customId は Factory / Parser / Handler pattern 定数に集約する
- handler は routing と 1 行委譲に限定する
- adapter / presenter / pagination / ports は feature が所有する

---

## 9. Domains 方針

domain は可能な限り純粋に保つ。

許可:

- repository
- entity / model
- domain service
- domain DTO / value object

避ける:

- `TypedEventService` への直接依存
- Discord / HTTP / controller の都合
- feature-specific event name の直書き
- application flow の orchestration

domain の変更結果を通知したい場合は、feature/application 層が event を publish する。

---

## 10. Auth / User 方針

`AuthModule <-> UserModule` の循環依存は解消対象。

目標:

```txt
AuthFeature
  -> UserDomain
  -> core/config, core/http
```

方針:

- `AuthService -> UserService` は許容
- `UserModule -> AuthModule` は原則禁止
- JWT guard / OAuth strategy / cookie は auth feature に閉じる
- user domain は認証方式を知らない

---

## 11. Config 方針

設定 access は `AppConfigService` に寄せる。

ルール:

- 新規コードで `process.env` を直接読まない
- 新規コードで Nest の `ConfigService` を直接 inject しない
- `AppConfigService` に typed accessor を追加してから使う
- test では `AppConfigService` を mock する

例外:

- config module の実装内部
- test bootstrap
- env validation

---

## 12. 横断コード / 型の置き場所（決定表）

横断（cross-cutting）コードと型の置き場所は、「純粋関数か」「DI/フレームワーク依存か」「横断か feature/domain 固有か」で機械的に決める。乱立（`core`/`shared`/`utils`/`types` 重複、型の多系統）を防ぐための規約。

### 決定表（コード）

| 種類                                                                          | 置き場所                          | 例                                                                                                                                                          | 禁止                                                     |
| ----------------------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 横断インフラ・DI サービス（framework 依存 OK）                                | `core/<領域>/`                    | `core/events`(TypedEventService) / `core/http`(interceptor・filter・decorator) / `core/database` / `core/shared/services`(HttpClientService・CryptoService) | —                                                        |
| 純粋関数（Nest/discord.js/express を import しない・I/O なし・config 非依存） | `shared/`（純粋関数の単一ホーム） | id 生成・文字列/計算ユーティリティ                                                                                                                          | DI / I/O / framework / config / DB・Discord・HTTP access |
| feature / domain 固有                                                         | 各 module 配下                    | `domains/character/*` / `discord/features/*`                                                                                                                | 横断扱いにしない                                         |

- **`shared/` と `core/shared` の区別**：`shared/`＝**純粋関数のみ**（依存方向の最下層・誰からも依存され得る・依存ゼロ）。`core/shared`＝**DI サービス**（HttpClient・Crypto 等）。「DI が要るなら core、要らない純関数なら shared」で判断。
- **`src/utils/` は段階的に解消する**（新規の横断コードを置かない）。現中身の振り分け先：純粋関数（`crypto.util` 等）→ `shared/`、DI サービス（`cookie.service`）→ `core/http` か `auth`、エラー処理（`error-handler`/`error-helpers`）→ `core/http`（H9 の例外フィルタへ統合）。

### 決定表（型）

- **横断型は `core/types` に一本化**する（旧 `src/types`・`shared/types` の分散を解消。`shared/types` は撤去済み。残る `src/types` は `core/types` へ集約していく）。
- feature / domain 固有型は各 module に置く：`domains/*/types`、`discord/features/*/types`、イベント契約は `core/events`/`events/contracts`。
- **例外（安易に動かさない）**：express の global 型拡張（`src/types/express/index.d.ts` の `Request.user: JwtTokenPayload`）は tsconfig の型解決（typeRoots/include）に関わる。移設するなら tsconfig を必ず整合させる、または express 拡張だけ別管理にする。

### 現状の違反と移行（各々 小さな PR・挙動保存で順次）

- `src/utils/*` … 上記の振り分け（純関数→`shared`、`cookie.service`→`core`、`error-*`→`core/http`）。
- `src/types/*` → `core/types` へ集約（express 拡張は上記例外に注意）。
- `src/shared/utils/id-generator.util.ts` … 純粋関数の単一ホーム方針に沿って配置を確定（`core/shared` と紛らわしくしない）。

> この決定表が「どこに何を置くか」の正本。新規コード・リファクタ時はまずこの表で置き場所を決める。型の詳細は `AI.types.md` も参照。

---

## 13. Testing 方針

テストしやすい設計を優先する。

| 対象                 | テスト方針                                                |
| -------------------- | --------------------------------------------------------- |
| domain service       | repository mock の unit test                              |
| feature orchestrator | port / domain service mock の unit test                   |
| event handler        | event payload と dependent port mock の unit test         |
| interaction handler  | mocked Discord interaction の unit / integration-ish test |
| registry             | pattern / route の unit test                              |
| config               | typed accessor の unit test                               |

禁止したいテスト構造:

- 小さな unit test のために巨大 module を import する
- global provider に依存して暗黙に動く
- `forwardRef` を解決するためだけの testing module を組む

---

## 14. 移行順序

```txt
Step 0: 本書で全体ルールを固定
Step 1: events/DESIGN.md 作成
Step 2: shared と events の責務整理
Step 3: discord customId Phase 0
Step 4: diceRoll Feature 分離
Step 5: domains の event 依存除去
Step 6: auth/user forwardRef 解消
```

各 step は小さな PR / commit に分ける。  
`discord`、`events`、`domains` を同時に大きく動かさない。

---

## 15. 現時点の禁止事項

- 新規 `forwardRef` 追加
- feature provider を core / shared / events module に登録
- `EventEmitterModule.forRoot()` の追加
- 新規 `@Global()` module 追加
- customId / event name の文字列直書き追加
- domain service から Discord / interaction / UI を参照
- 新規コードで `process.env` を直接参照
