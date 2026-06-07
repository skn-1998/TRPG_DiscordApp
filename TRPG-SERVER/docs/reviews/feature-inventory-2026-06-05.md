# TRPG-SERVER 機能棚卸し 2026-06-05

## 読み方

- **根拠**: 各項目の末尾に実ファイルパス（必要に応じて行番号）を付ける。原則として本棚卸しの作成者が実コードで確認した内容を「確認済み」として扱う。実コードで確証が取れなかった点・将来挙動の予測は `推測:` または `未確認` を明記する。
- **正本の優先順位**: 古い履歴ドキュメント（`AI.md` の 2025 年スナップショット、`src/discord/DESIGN.md` の As-Is 評価など）より、次を優先する。
  1. 実コード（`src/**`）
  2. リファクタ進捗の正本 `AI.refactor.md`（最新履歴）
  3. 全体方針 `src/ARCHITECTURE.md` / `AGENTS.md`
- **`推測:` 表記の意味**: 「コメントや命名から妥当と思われるが、実 routing / 実呼び出しまでは追えていない」もの。断定はしない。
- **対象**: TRPG-SERVER（NestJS バックエンド）のみ。frontend `trpg-remix-app` は対象外。
- **本棚卸し時点のコミット基準**: `ecc6d63`（S-5c・dead な legacy roll\*/character-dice handler クラスタ撤去）まで反映。作業ツリーには大量の未コミット dirty（主に `.md` / CRLF churn）があるが、本棚卸しは実コードを根拠にする。
- **【コミット後ステータス注記（2026-06-06 追記）】**: 上記の作業ツリー状態（大量 dirty、`features/diceRoll/custom-id/` 未追跡 等）は `ecc6d63` 直後のスナップショット。その後 **コミット `57bd2b5`「docs moved」で docs 一式が追跡化され、`diceRoll/custom-id/` も追跡済み**となった ＝ **git status / 未追跡に関する記述は解消済み**。一方、**本棚卸しの中核である実コード根拠の機能・残タスク finding（`postActionButtons` dead path 等）は git コミットと無関係に現役**であり、本注記で弱めない。

---

## 現在ある機能

### A. Web API（HTTP / ドメイン層・Discord REST）

ドメインは `Controller → Service → Repository → Model(Mongoose)` のレイヤード構成。domain 配下で HTTP を公開するのは auth / user / character の 3 ドメイン。dice-roll はリポジトリ層のみで HTTP controller を持たず、Discord 経路から利用される。

TRPG-SERVER 全体の HTTP controller としては、上記 3 ドメインに加えて root health 相当の `AppController`、Discord Bot 操作用の `DiscordController`、監視用の `PerformanceDashboardController` がある。`CommandsController` / `InteractionsController` は `@Controller` ではあるが `@Get` / `@Post` を持たず、Discord.js interaction dispatch 用の内部 controller として使われる。

#### auth ドメイン（認証・認可）

- エンドポイント（確認済み・`src/domains/auth/auth.controller.ts`）:
  - `GET /auth/discord`（auth.controller.ts:67）
  - `GET /auth/discord/callback`（:80）
  - `GET /auth/validate-token`（:114）
  - `POST /auth/login`（:135）
  - `POST /auth/logout`（:188）
  - `GET /auth/:userId/User`（:207）
- 主な実装: `AuthService`、`DiscordStrategy`（passport-discord）、JWT 検証は `JwtTokenService` / `AuthTokenModule`（H6 で User⇄Auth 循環解消のため切り出し済み）。
- module: `src/domains/auth/auth.module.ts`

#### user ドメイン（ユーザー情報管理）

- エンドポイント（確認済み・`src/domains/user/user.controller.ts`）:
  - `POST /users`（:49）
  - `GET /users`（:58・JwtAuthGuard）
  - `GET /users/discord/guilds`（:75）
  - `PUT /users/:discordUserId`（:95）
  - `PATCH /users/:discordUserId/characters/:characterId`（:110）
  - `DELETE /users/:discordUserId/characters/:characterId`（:125）
  - `DELETE /users/:discordUserId`（:140）
- 主な実装: `UserService` / `UserRepository`
- module: `src/domains/user/user.module.ts`

#### character ドメイン（キャラクター管理）

- エンドポイント（確認済み・`src/domains/character/character.controller.ts`）:
  - `POST /character`（:79）
  - `GET /character`（:107・JwtAuthGuard）
  - `GET /character/summaries`（:136）
  - `GET /character/:id`（:165）
  - `PUT /character/:id`（:187）
  - `DELETE /character/:id`（:216）
  - `PUT /character/:id/discord/embed`（:242）
  - `POST /character/:id/discord/thread`（:270）
  - `POST /character/:id/discord/display`（:310）
- 主な実装: `CharacterService` / `CharacterRepository` / `CharacterIdService`
- module: `src/domains/character/character.module.ts`（imports: AuthModule, UserModule）

#### dice-roll ドメイン（ダイスロール履歴）

- HTTP コントローラなし（確認済み・`src/domains` 配下の `*.controller.ts` は auth/user/character の 3 つのみ）。
- 主な実装: `DiceRollService` / `DiceRollChannelRepository` / `DiceRollTextRepository`（推測: Discord のダイス経路から履歴永続化に使われる）。
- module: `src/domains/dice-roll/dice-roll.module.ts`

#### Discord REST / monitoring API

- root:
  - `GET /`（確認済み・`src/app.controller.ts`）
- Discord Bot 操作用 API（確認済み・`src/discord/discord.controller.ts`、`JwtAuthGuard` 付き）:
  - `POST /discord/send-message`
  - `POST /discord/create-channel`
  - `GET /discord/status`
  - `GET /discord/guild/:guildId`
  - `GET /discord/channel/:channelId`
  - `POST /discord/post-character`
- performance dashboard API（確認済み・`src/discord/controllers/performance-dashboard.controller.ts`、`JwtAuthGuard` 付き）:
  - `GET /discord/performance/stats`
  - `GET /discord/performance/health`
  - `GET /discord/performance/discord`
  - `GET /discord/performance/metrics/timeseries`
  - `GET /discord/performance/alerts`
  - `POST /discord/performance/reset`
  - `GET /discord/performance/system-info`

### B. Discord Bot — Slash Command

- コマンド定義: `src/discord/commands/commands.list.ts` / `commands.controller.ts`（薄いアダプタ層）。
- コマンド（根拠: 上記ファイル。Explore 棚卸し結果。実 routing 細部は 未確認）:
  - `create-character-thread` → `CharacterThreadService`
  - `d`（ダイスロール）→ `RollDiceService`
  - `create-dice-channel` → `SelectGameSystemService`
  - `user-dice`（オリジナルダイス表）→ `UserDefinedDiceService`
  - `dice-from-context-menu` → `DiceFromContextMenuService`
  - `dice-result` → `DiceResultService`
- module: `src/discord/commands/commands.module.ts`

### C. Discord Bot — Interaction Registry 基盤

- `InteractionsModule` は **registry 基盤のみ**を提供し feature module を一切 import しない（確認済み・`src/discord/interactions/interactions.module.ts`：providers は `InteractionsService` のみ、imports は `InteractionRegistryModule` / `EventEmitterModule`、exports も registry 系と `InteractionsService` のみ）。§8（ARCHITECTURE）達成済み。
- `InteractionRegistryService`（`registry/interaction-registry.service.ts`）: customId → handler ルーティング、`registerHandlers()` で feature が明示登録、実行/エラー統計を保持。
- `PatternMatcherService`（`registry/pattern-matcher.service.ts`）: exact / startsWith / regex の優先度マッチ、競合検出。
- `InteractionsService`（`interactions.service.ts`）: Discord.js interaction を registry へ委譲する thin service（旧 characterEdit 特例分岐・ModuleRef.get・ChannelCreate 依存は撤去済み）。
- `InteractionsController`（`interactions.controller.ts`）: legacy entrypoint（service locator 経路撤去済み）。
- **登録 handler 総数 = 23**（確認済み・`handlers.integration.spec.ts:255-257` が `totalHandlers` を `23` で固定）。内訳は下記 feature の registerHandlers と一致（6+8+9=23）。

### D. Discord Bot — Feature モジュール

`src/discord/features/` 配下にビジネスロジックを集約。各 feature が `onModuleInit` で自身の handler を registry 登録する。

#### characterEdit（キャラクター編集）

- registry 登録 6 handler（確認済み・`character-edit.module.ts:150-157`）: Refresh / Create / Compact / Section / Field / Modal。
- 主なサービス: `EnhancedCharacterEditService`、`CharacterSectionEditorService`、`CharacterModalHandlerService`、`CharacterEmbedManagerService`、`ChannelNameSyncService`、`CharacterEditMessageUpdaterService`、`CharacterEditChannelCreateListenerService`（ChannelCreate listener は P1-A でここへ移管）。
- customId 契約: `characterEdit/custom-id/`（Factory / Parser / pattern 定数）。
- module: `src/discord/features/characterEdit/character-edit.module.ts`

#### characterThread（キャラクター専用スレッド／ダイス UI）

- registry 登録 9 handler（確認済み・`character-thread-feature.module.ts:125-135`）: ThreadSelect / ThreadCreate / CharacterTab / FlexibleDiceParam / **DiceGeneric** / FlexibleDiceSelect / **CharacterSkillRoll** / **AbilityRoll** / **PresetDiceQuickRoll**。
- 太字は「ダイスボタン customId 統合キャンペーン（案2）」で機能化／新設された live handler:
  - `dice_generic_{diceType}_{channelId}`（基本ダイス・親チャンネル投稿）
  - `skill_{channelId}_{skillKey}`（技能ロール・key ベース再解決）
  - `ability_{channelId}_{abilityKey}`（能力ロール・S-3 新設・`character.parameter` 再解決）
  - `dice_(coc7|dnd5e|sw25)_*`（プリセット・system 既定 notation で簡易機能化）
- スレッド生成は 2 経路が収束済み（S-4.3）: select 経路 `ThreadCreationService` と event 経路 `ThreadOrchestratorService` がいずれも `ThreadInteractionService` の post 系（basic/flexible/preset/skill/ability）へ委譲。
- module: `src/discord/features/characterThread/character-thread-feature.module.ts`

#### diceRoll（ダイス結果ページング／モーダル）

- registry 登録 8 handler（確認済み・`dice-roll.module.ts:108-117`）: DicePagePrev / Next / First / Last / Cancel / Select / DiceCharacterSelect / DiceRollModal。
- pagination は `features/diceRoll/services/pagination/` 所有（構造課題③で interactions core から移管済み）。
- adapters は `features/diceRoll/adapters/`。
- customId 契約: `features/diceRoll/custom-id/`（`dice-character-select.custom-id.ts` / `dice-page.custom-id.ts` / `index.ts`）。
- module: `src/discord/features/diceRoll/dice-roll.module.ts`

#### gameSystem / userDefinedDice

- registry 登録なし（orchestrator のみ）。
- `gameSystem/`: `SelectGameSystemOrchestrator`、module `game-system.module.ts`。
- `userDefinedDice/`: `UserDefinedDiceOrchestrator`、module `user-defined-dice.module.ts`。
- 根拠: Explore 棚卸し。推測: slash command（create-dice-channel / user-dice）からの呼び出しが主経路。

### E. Discord — 横断サービス（`src/discord/services/`）

- `channel/`: `ChannelCacheService` / `ChannelCreatorService` / `MessageManagerService`
- `dice/`: `DiceCalculationService` / `DiceOrchestratorService` / `DiceParserService` / `DicePresetService` / `DiceRollLogicService`（`DiceServicesModule` 所有・`DiceRollLogicService` は skill/ability/preset/generic handler の委譲先で live）
- `monitoring/`: `AlertManagerService` / `DiscordMonitorService` / `MetricsCollectorService` / `PerformanceOrchestratorService`（`DiscordModule` 所有。P1-A で InteractionsModule から重複所有を撤去）
- 単体: `CommandManagerService` / `DiscordClientService` / `DiscordGuildManagerService` / `DiscordInteractionHandlerService`

### F. events / config / core 基盤

- イベント基盤は `TypedEventService` 1 系統（`src/core/events/typed-event.service.ts`・`core-events.module.ts` は `@Global()`）。旧 3 系統バスは撤去済み。
- イベント契約: `src/events/contracts/`（`character-events` / `discord-events` / `system-events` / `unified-event-contracts` / `index.ts`）。`EVENT_NAMES` 定数は `src/events/contracts/index.ts`（推測: 文字列直書き禁止の受け皿）。
- config: `AppConfigService`（`src/config/config.service.ts`）に設定を集約。env バリデーションは `environment.validator.ts` / `schemas/environment.schema.ts`。本番コードの `process.env` 直接参照は P1-C で全解消（config / env validation / test のみ許容）。
- core 基盤: `core/http`（ResponseInterceptor / 例外フィルタ）、`core/dto`、`core/database`、`core/shared`、`core/events`、`core/types`。

---

## 実装待ち・保留・未配線

| #   | 項目                                                                               | 優先度 | 状態                          | 根拠ファイル                                                                                                                                            | 次の確認（focused test / grep）                                                                                                         |
| --- | ---------------------------------------------------------------------------------- | ------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `postActionButtons` の `character_edit_` / `dice_roll_` / `character_info_` ボタン | 中     | 未配線（dead path）           | `thread-interaction.service.ts:35-49`（生成は live コードに存在）／呼び出し元 `thread-orchestrator.service.ts:79` は**コメントアウト**／registry 未登録 | `pnpm test -- thread-interaction.service.spec.ts`（spec:64-86 が生成のみ固定）。撤去 or 機能化の判断が必要                              |
| 2   | プリセットダイスの「本格ルール」未実装                                             | 中     | 未実装（暫定機能のみ）        | `AI.refactor.md`「P1-D 後続 ③」節（`fa1ff5b`）。現状は system 既定 notation（coc7=1d100/dnd5e=1d20/sw25=2d6）＋reason ラベルの簡易実装                  | SAN 値比較・武器ダメージ式・命中-回避・魔法行使等。前提として `findByChannelId` projection は S-1 で拡張済（`character.repository.ts`） |
| 3   | `DiceOrchestratorService` の dead な preset メソッド                               | 低     | legacy cleanup                | `AI.refactor.md` S-5c 節「`createPresetButton`/`handlePresetDiceRoll` は残置・別 issue」                                                                | `rg -n "createPresetButton\|handlePresetDiceRoll" src/discord/services/dice`（live 呼び出し元の最終確認）                               |
| 4   | `DicePresetService` の dead メソッド                                               | 低     | legacy cleanup                | `AI.refactor.md` S-5c「dead メソッド createPresetButton/handlePresetDiceRoll は残置」                                                                   | 同上。撤去は preset 経路 live 化と独立                                                                                                  |
| 5   | `app.module.ts` の adapters コメントアウト残存整理                                 | 低     | docs/コード drift（決着済み） | `AI.md` 最新メモ「adaptersモジュール: 『復旧不要』で決着済み」。コメントアウト最終整理のみ別タスク                                                      | `rg -n "adapter" src/app.module.ts`                                                                                                     |
| 6   | gameSystem / userDefinedDice の registry 非登録                                    | 低     | 設計どおり（要確認）          | `features/gameSystem` / `features/userDefinedDice`（onModuleInit 登録なし）                                                                             | 推測: slash command 経由で完結し interaction registry 不要。実 routing 経路の確認が望ましい                                             |

> **重要**: 「ダイスボタン customId 統合キャンペーン（案2）」（S-1〜S-5c・7 コミット）は **完了**（`AI.refactor.md` 末尾「S-5 完了」）。主要バグ修正（projection / channelId 抽出 / modal field 名）＋約 7000 行の dead-code 撤去を達成済み。本棚卸し時点で **roll\* / character-dice\* を生成する live コードは皆無**。

---

## ドキュメントずれ

| #   | 古い記述                                                                                                                                                                                                                  | 正しい現状                                                                                                                                                                                                                                          | 根拠                                                                                              | 直すならどこか                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | `src/discord/DESIGN.md` §2-3 が「InteractionsModule = God Module（providers/exports 40 以上・monitoring 二重所有）」「3 層ルーティング並存」「DiceRollFeatureModule → InteractionsModule 循環」「forwardRef 残存」と記載  | いずれも解消済み。InteractionsModule は registry のみ（`interactions.module.ts` で providers は service 1 つ）。循環ゼロ・forwardRef ゼロ（`AI.refactor.md` 健全性ゲート）                                                                          | `interactions.module.ts` / `AI.refactor.md`（2026-06-04 健全性ゲート・P1-A/B/C）                  | DESIGN.md。ただし**本タスクでは大改稿しない**（設計方針変更を伴うため Codex 判断）。As-Is 節に「実装は P1-A/B/C・③で解消済み（本棚卸し参照）」の注記追加が候補 |
| D2  | `src/discord/interactions/README.md` が「interactions.service に characterEdit 特例分岐（移管予定）」「interactions.module は現状 God Module（slim 化予定）」「button/select/modal/channel = Legacy（Phase 0/1 で整理）」 | characterEdit 特例分岐は P1-A で撤去。God Module は slim 化済み。interactions 配下の legacy button 系サービス（CharacterDiceOrchestrator 等）は S-5c で撤去済み                                                                                     | `interactions.module.ts` / `AI.refactor.md` P1-A・S-5c                                            | README.md。陳腐化注記 or 「Phase 1 完了」への更新（Codex 判断・本タスクでは未改稿）                                                                            |
| D3  | `AI.features.md` が「diceRoll は Phase 1 未着手で一部は InteractionsModule が直接 provide」                                                                                                                               | diceRoll は feature module 化済み（`dice-roll.module.ts` が handler 8 を registry 登録）。InteractionsModule は diceRoll を provide しない                                                                                                          | `dice-roll.module.ts` / `interactions.module.ts`                                                  | `AI.features.md`（本タスクで棚卸しへのリンク追記。表の注記は最小限に留め、詳細は本棚卸しへ委譲）                                                               |
| D4  | `AI.features.md` の feature 表に characterEdit/characterThread/diceRoll の 3 つのみ（Claude 初稿時点）                                                                                                                    | 実際は gameSystem / userDefinedDice も存在（計 5 feature）。Codex レビューで `AI.features.md` に 5 feature を反映済み                                                                                                                               | `features/gameSystem` / `features/userDefinedDice` / `AI.features.md`                             | 対応済み。gameSystem / userDefinedDice の実 routing 経路は引き続き未確認欄で追跡                                                                               |
| D5  | 旧ハンドオフ／一部履歴が `postActionButtons` の live/dead を二転（「dead」→「live」→ 現「dead」）                                                                                                                         | 現状は **dead**（呼び出し元 `thread-orchestrator.service.ts:79` コメントアウト・S-4.3 で Path A の roll\* 生成解消後）。`AI.refactor.md` 自身が「postActionButtons を dead と記載するが live＝記述ズレ」と途中で注記したが、S-4.3/S-5 後は再び dead | `thread-orchestrator.service.ts:79` / `thread-interaction.service.ts:35` / `AI.refactor.md` S-4.3 | 本棚卸しが最新の確定状態（dead）を記録。`AI.refactor.md` の途中注記は履歴として残す                                                                            |
| D6  | `AI.md` 冒頭〜中盤の 2025 年スナップショット（型安全性「100%達成」、Phase 3.x イベント移行記録 等）                                                                                                                       | `AI.md` 自身が冒頭で「古いスナップショット・正本は AI.refactor.md / ARCHITECTURE.md / events DESIGN」と注記済み                                                                                                                                     | `AI.md:5-10`（正本ポインタ）                                                                      | 既に注記済みのため追加対応不要。履歴として維持                                                                                                                 |

---

## 次の実装候補

1 slice ずつ独立検証できる単位（build / check:circular / focused jest / start:dev）。`/discord`・`/events`・`/domains` を同時に大きく動かさない。

1. **`postActionButtons` dead path の決着（#1）** — `/discord` 内に閉じる単独 slice。
   - 選択肢A（撤去）: `thread-interaction.service.ts` の `postActionButtons` とコメントアウト呼び出し（thread-orchestrator:79）、対応 spec を削除。registry 影響なし。
   - 選択肢B（機能化）: `character_edit_` / `dice_roll_` / `character_info_` を custom-id 契約化し handler 新設＋registry 登録（UX 追加＝ユーザー判断要）。
   - 推奨: まず A（dead 撤去）。機能追加は別タスク。

2. **プリセットダイスの本格ルール（#2）** — `/discord/services/dice` + `/discord/features/characterThread` にまたがるため、ゲームシステムごとに sub-slice 分割。
   - 分割案: (a) coc7（SAN 値判定）→ (b) dnd5e（セーヴ／d20 攻撃）→ (c) sw25。各々 characterization を張ってから semantic 判定を実装。
   - 前提（充足済み）: `findByChannelId` の status/skill/parameter/gameSystemId projection（S-1）。

3. **dice services の dead メソッド整理（#3・#4）** — `DiceOrchestratorService` / `DicePresetService` の dead な preset メソッドを 1 サービスずつ撤去。live 呼び出し元ゼロを grep で再確認してから。`/discord/services/dice` に閉じる低リスク slice。

4. **Discord 設計ドキュメントの現状反映（D1/D2）** — 実装ずれの解消。`DESIGN.md` の As-Is／`interactions/README.md` の Phase 表記を現状（P1-A/B/C・③・S 完了）へ更新する docs-only slice。**設計方針変更を伴わない注記更新に限定**し、Codex レビュー前提。

---

## 未確認・要判断

- **gameSystem / userDefinedDice の実 routing 経路**（推測: slash command で完結）。registry 非登録が設計どおりか、interaction（autocomplete / select）経由の経路が別にあるかは未追跡。
- **dice-roll ドメインの実呼び出し元**（HTTP なし）。Discord ダイス経路からの履歴永続化が主と推測するが、live な呼び出しチェーンは未トレース。
- **`DiceOrchestratorService` / `DicePresetService` の preset メソッドの真の dead 性**（`AI.refactor.md` は dead と記すが、本棚卸しでは grep 再確認していない＝撤去前に要検証）。
- **commands.list.ts の 6 コマンドと各サービスの実 routing 細部**（Explore 棚卸し由来。controller の dispatch 実装は未確認）。
- **D1/D2 の設計ドキュメント改稿可否**（触らない範囲＝Codex 判断）。本棚卸しはずれの記録に留めた。

---

## 実行した調査コマンド

| コマンド / 操作                                                      | 重要な結果                                                                                                                                                                                                                   |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git status --short`                                                 | （`ecc6d63` 直後の状態）TRPG-SERVER に大量の dirty（主に `.md` / CRLF churn、`features/diceRoll/custom-id/` は未追跡）。自分の担当外は不接触。**※その後 `57bd2b5` で docs / custom-id は追跡化済み＝この未追跡記述は解消。** |
| domains の `@Get/@Post/...` grep（`src/domains/**/*.controller.ts`） | controller は auth / user / character の 3 つのみ。dice-roll に controller なし。全エンドポイントを行番号付きで確認（本書「現在ある機能 A」）。                                                                              |
| `interactions.module.ts` 通読                                        | providers=`InteractionsService` のみ、imports=`InteractionRegistryModule`/`EventEmitterModule`、feature module import ゼロ＝§8 達成を確認。                                                                                  |
| 3 feature module の `registerHandlers` 通読                          | characterEdit=6 / diceRoll=8 / characterThread=9＝計 23 を確認。                                                                                                                                                             |
| `handlers.integration.spec.ts` の登録数 assertion                    | `totalHandlers` を `23`（:257）で固定＝registry 登録数と一致を確認。                                                                                                                                                         |
| `postActionButtons` 関連 grep（characterThread）                     | 生成は `thread-interaction.service.ts:35-49` に live コードとして存在するが、呼び出し元 `thread-orchestrator.service.ts:79` はコメントアウト＝dead path を確認。                                                             |
| `src/{config,core/events,events/contracts}` glob                     | `AppConfigService`=`config/config.service.ts`、`TypedEventService`=`core/events/typed-event.service.ts`、`EVENT_NAMES`=`events/contracts/index.ts` を確認。                                                                  |
| Explore サブエージェント（src 全体棚卸し）                           | commands 6 / feature 5 / monitoring・channel・dice サービス群 / grep 系（TODO・forwardRef・process.env・ModuleRef・@Global）の概況を取得（細部は本書で「推測 / 未確認」に区分）。                                            |

> 参考（`AI.refactor.md` 健全性ゲート・2026-06-04 裏取り）: `pnpm run build` OK / `check:circular` **No circular(507)** / 実コードの `forwardRef`・`process.env` 直接参照・`ModuleRef.get` は**すべてゼロ**（残はコメントのみ）。本棚卸しは docs-only のため build/test は未再実行。
