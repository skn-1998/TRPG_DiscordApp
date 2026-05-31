# TRPG-SERVER リファクタリング監査レポート

**実施日:** 2026-05-30
**対象:** `TRPG-SERVER/src` 直下の10フォルダ
**方法:** フォルダごとに専任サブエージェントを割り当て、4視点（設計・依存／コード品質／テスト・保守性／未完成・負債）＋ NestJS ベストプラクティススキル（`nestjs-best-practices`, 40ルール）で監査。
**判定基準の正本:** `src/ARCHITECTURE.md`（依存方向・責務境界）、各 `AI.*.md`。
**各フォルダの詳細所見:** `outputs/refactor-audit/findings/<folder>.md`（本レポートは要約）。

---

## エグゼクティブサマリ

監査全体を貫く構造的な問題は次の3つに集約される。

1. **横断コードの置き場所が乱立している。** `src` 直下に `core` / `shared` / `utils` / `types` が並び、さらに `core/shared`⇔`src/shared`、型置き場が `src/types`／`core/types`／`shared/types` の3系統に重複。「どこに何を置くか」の規約が未確立で、散らかり続ける土台になっている。

2. **複数の移行が同時に途中停止している。** イベントバスの一本化、Discord Interactions の Registry 移行、`process.env`→`AppConfigService` 集約、`forwardRef` 撤廃、エラーハンドリング統合 ── いずれも「方針は ARCHITECTURE.md に明文化済み・実装は新旧並存」。新旧の併存自体が最大の負債。

3. **ドキュメントの主張と実装が乖離している。** `AI.md` / `AI.types.md` は「TypeScript 型安全性 100% 達成」「循環依存 0」と記すが、実コードには `any` が **src 全体で約360件（非テストでも約230件）**、`forwardRef` 循環、`process.env` 直読み（約25ファイル）が残存する。ドキュメントを信頼できる状態に戻す必要がある。

---

## 最優先（High）課題 ── フォルダ横断で重複する根本問題

| #   | テーマ                      | 内容                                                                                                                                                                             | 関連フォルダ               |
| --- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| H1  | 横断レイヤーの責務未確立    | `shared`/`core`/`utils`/`types` の責務重複。`core/shared`⇔`src/shared`、型置き場が3系統に分散                                                                                    | shared, core, types, utils |
| H2  | イベントバスが**3系統**並存 | `EventBusService` / `GlobalEventBusService`(@Global) / `TypedEventService`(shared/application, @Global) が併存。さらに registry/router/manager が三重管理。legacy 廃止計画は停滞 | events, shared             |
| H3  | Discord 巨大サービス        | `dice-roll-pagination.service.ts`≈531行ほか、characterEdit の Embed 生成サービスが400行超複数。単一責任を超過                                                                    | discord                    |
| H4  | Interactions 移行の新旧並存 | Registry(新)と commands の if 分岐・events アダプタ(旧)が同時生存。`InteractionsModule` が feature を import（方針と逆）。customId 文字列の直書きが散在                          | discord                    |
| H5  | ドメイン純粋性の崩れ        | Controller が `@Res()`＋try/catch で手動レスポンス。domain に Discord 連携/イベント発行が混在。大量のデッドコード                                                                | domains                    |
| H6  | auth の二重構造             | `src/auth` と `src/domains/auth` に認証コード分散。AuthModule⇄UserModule の forwardRef 循環（解消対象）                                                                          | auth, domains              |
| H7  | 設定アクセスの非集約        | `process.env` 直読みが約25ファイル、Nest `ConfigService` 直 inject も残存。`AppConfigService` 集約が未完                                                                         | config, 全体               |
| H8  | 型安全性の実態乖離          | `req.user: any`(express 型拡張) を起点に `any` が約230件（非テスト）。「型安全100%」の主張と矛盾                                                                                 | types, 全体                |
| H9  | エラーハンドリング三重化    | `utils/error-handler.ts`・`utils/error-helpers.ts`・`discord/utils` の handleError が併存                                                                                        | utils, discord             |
| H10 | 純粋層への混入・機密ログ    | `crypto.util.ts` が config(暗号鍵)を参照（utils は純粋関数のみの方針違反）。`console.*` 残存（特に `auth.controller.ts` がトークン/Authorization ヘッダを出力＝機密漏洩リスク）  | utils, domains, discord    |

---

## フォルダ別サマリ（実所見ベース）

### domains（auth/character/user/dice-roll）

- **High:** ① `auth.controller.ts:103-133` 等が **トークン/Authorization ヘッダを console.log**（機密漏洩リスク）。② **デッドコード3点** ── `character-id.service.ts`（利用箇所ゼロ）、`schemas/character.schema.ts`（zod 248行、参照ゼロ）、`CharacterEventHandlerService`（自称レガシー・空回り）。③ 全 Controller が `@Res()`＋try/catch で手動レスポンス（例外フィルタ/インターセプタが効かない）。
- **Med:** dice-roll の新旧フィールド二重持ち（`gameSystem(Id)`・`diceRoll/diceExpression`・`embedId(s)`）とフォールバック分岐。`create-user.dto.ts` の `name2`／「残りは省略」破損。Create系とInput系 DTO の重複。
- ドキュメント「循環0・型安全100%」と実装が乖離。`req.headers['user']` を無検証 `JSON.parse` する独自認証導線が Guard と二重。

### discord

- **High:** Interactions の Registry 移行が Phase 0 で停滞（新旧並存）。`InteractionsModule` が feature を import（方針と逆）。customId 直書きを Factory/Parser へ未集約。
- **Med:** 巨大サービス（pagination≈531行、Embed 生成群400行超）の分割。`console.*` が discord 配下に80箇所以上。flexible-dice 二系統の統合。`test root` 等のデバッグ残骸。
- `@Global` 多用、Discord.js モックの spec 重複、DESIGN.md/README/MIGRATION_GUIDE の空欄。

### events

- **High:** ① **バス3系統**（EventBusService / GlobalEventBusService / TypedEventService）を1系統へ統一。② registry/router/manager の三重管理を一本化。③ `contracts/*` が `domains/character/models`・`discord/utils` の具象型を `import type` で直接参照する**逆流依存**を撤去。
- legacy（GlobalEventBus/EventRouter）廃止が停滞。`@Global` 多用。console.\* 15箇所以上。

### core

- **High:** 現状構成（database/dto/interfaces/shared/testing/types）が目標（config/database/events/http/logging）と乖離。`core/shared`⇔`src/shared`、`core/types`⇔`src/types`⇔`shared/types` の重複を一意化。
- **Med:** `core/testing/repository.mock.factory.ts` が本番ツリーに同居 → test 領域へ。barrel export 導入で深い相対 import を軽減。

### config

- **High:** `process.env` 直読み約25ファイル（auth.service, database.module, main.ts, discord系, utils/crypto 等）を AppConfigService へ置換。Nest `ConfigService` 直 inject を AppConfigService に一本化。
- **Med:** `environment.schema` を全必須変数（Discord/Mongo/JWT/Log）へ拡張し起動時バリデーション。`configuration.ts` と `config.service.ts` の責務明文化。

### auth（src直下）

- **High:** `src/auth` と `domains/auth` を一方へ統合し正典を一意化。AuthModule⇄UserModule の forwardRef を interface token / port で解消。
- **Med:** `req.user` を `AuthenticatedUser` interface 化し guard 通過後の型保証。strategy の独自 `any` を passport 型へ。

### middleware

- **High:** CORS が `cors.middleware.ts` と `main.ts` で二重管理。`cors.middleware.ts` は `NestMiddleware` 未実装の素 Express 関数で DI(AppConfigService) を受けられず process.env 直読み。一系統へ統一。
- **Med:** グローバル ExceptionFilter / ResponseInterceptor 導入で各 Controller の手動 try/catch を排除。レート制限が見当たらない（要追加）。

### shared

- **High:** `TypedEventService`(@Injectable, EventEmitter2 依存) が `shared/application` に配置（純粋層に DI service ＝方針違反）。目標の `core/events` へ移動。shared/types・core/types・src/types の三重置きを一意化。
- **Med:** shared/utils の framework/config 依存を除去し純粋関数化。

### types

- **High:** `src/types/express/index.d.ts` の `Request.user?: any` を `AuthenticatedUser` interface へ置換（全 Controller/Guard で認証ユーザーが無検査）。横断型の三重置きを一意化。
- **Med:** `any` 約230件（非テスト、discord/events/contracts に集中）を段階的に型付け。barrel export 追加。

### utils

- **High:** エラーハンドリング3系統（`error-handler.ts`・`error-helpers.ts`・`discord/utils` handleError）を単一 ErrorHandler＋例外フィルタへ統合。`crypto.util.ts` の鍵取得を AppConfigService 経由の DI service（core/http か auth）へ移し utils を純粋化。
- **Med:** `console.*` を Winston/Nest Logger へ統一。crypto は `createCipheriv` へ修正済（deprecated 対応は完了）だが鍵管理が config 直依存。

---

## 推奨ロードマップ（ARCHITECTURE.md の移行順序に整合）

ARCHITECTURE.md は Step 0（ルール固定・完了）→ events/DESIGN.md → shared/events 整理 → discord customId → diceRoll Feature 分離 → domains の event 依存除去 → auth/user forwardRef 解消、という順序を定めている。本監査はこれを裏付ける。提案する着手順：

1. **規約の明文化（H1, H8）** ── 「横断コードの置き場所」「型の置き場所」の決定表を作り、`AI.types.md`/`ARCHITECTURE.md` に記載。`req.user` の `any` 排除を型安全回復の起点に。小さく効果が大きい。
2. **機密ログの即時除去（H10）** ── `auth.controller.ts` 等のトークン/ヘッダ console.log を最優先で削除（セキュリティ）。ついでに console.\* の Logger 統一に着手。
3. **events/DESIGN.md 作成 → バス一本化（H2, H4）** ── 3系統バスを TypedEventService に集約、registry/router/manager を一本化、`contracts` の逆流依存を撤去。`EventsModule`/`InteractionsModule` の feature import を断つ。
4. **設定集約（H7）** ── `AppConfigService` の typed accessor を整備し `process.env`/生 `ConfigService` を機械的に置換。crypto の鍵参照もここへ（H10）。
5. **エラーハンドリング統合（H9）** ── 単一 ErrorHandler＋例外フィルタへ集約、Controller の `@Res()`＋try/catch を戻り値方式へ。
6. **デッドコード一掃と Discord 巨大サービス分割（H3, H5）** ── domains の3デッドコード削除、diceRoll Feature 分離から巨大サービスを単一責任化、domain の event 直接依存を除去。
7. **auth/user の forwardRef 解消（H6）** ── port 切り出しで UserModule→AuthModule を断つ。`src/auth`/`domains/auth` を統合。影響が広いため最後に実施。

各ステップは小さな PR に分割し、`pnpm run build` → `pnpm run start:dev` → `pnpm run check:circular` で循環参照を確認（UserDomain⇄AuthDomain のみ許容）。
