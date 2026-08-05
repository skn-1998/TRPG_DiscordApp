# Discord機能アーキテクチャドキュメント

## 📋 概要

TRPGサーバーのDiscord統合機能に関するアーキテクチャと実装状況を管理するドキュメント

### 📖 主要ドキュメント（2026-05-30 整備）

| ドキュメント                                                             | 内容                                                                  |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| **[DESIGN.md](./DESIGN.md)**                                             | 統合設計書（現状評価・目標アーキテクチャ・customId 契約・Phase 0〜4） |
| **[interactions/README.md](./interactions/README.md)**                   | Interactions レイヤーの役割・構成・Handler 作法                       |
| **[interactions/MIGRATION_GUIDE.md](./interactions/MIGRATION_GUIDE.md)** | Registry 移行・Feature 分離の手順書                                   |

> ⚠️ **現状ステータス（2026-06-03 時点）**
> 本書は日付付きメモの集積（履歴を含む）。Discord 層の設計正本は [DESIGN.md](./DESIGN.md)、進捗の正本は `AI.refactor.md`。以下の点に注意:
>
> - **循環依存はゼロ**（`check:circular` = "No circular dependency found!"）。H6（2026-06-01）で旧 Auth⇄User 循環も解消済み。本書内の日付付き検証ログにある「Auth⇄User の 1 件のみ許容」は当時の記録。
> - 下部の「残存課題: TypeScriptエラー22個（2025-08-17）」「今後の改善項目」等は当時のスナップショットで陳腐化している箇所がある。最新は `AI.refactor.md` を参照。

---

## 📝 最新メモ（2026-08-05）

### characterEdit エラー経路の実測表（俯瞰#20 CL-1(a)・#102/J1 `62a84f3` 反映済み）

最深部 service が throw した場合の端から端（interactions.service の catch まで）。
read-only 実測エージェント測定＋Fable が registry:140 / refresh 内層 / modal 内層 / compact を現物で裏取り。

| 経路（入口）             | ユーザー通知                                                                                | ERROR ログ                                   | error.occurred の message                       | 最外周 interactions.service:93                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| ①select（section/field） | **2 通**（内層 section-editor:104→respondEphemeralError＋最外周）                           | **4 本**                                     | **原文**（I1）                                  | followUp 送達（replied=true）                                                                            |
| ②modal submit            | **2 通**（内層 sendErrorResponse=editReply＋最外周）                                        | **4 本**（J1 で内層 ErrorHandler 撤去・5→4） | **原文**（J1。従前は HttpException 変換後文言） | followUp 送達                                                                                            |
| ③refresh                 | **2 通**（内層 respondEphemeralError `deferredStrategy:'followUp'`＝J1 で util 化＋最外周） | **4 本**                                     | **原文**                                        | followUp 送達                                                                                            |
| ④-a create               | **1 通**（内層 catch なし・最外周のみ）                                                     | **4 本**                                     | **原文**                                        | **reply()**（showModal/update は成功時のみ replied=true のため未応答扱い。5 変種中唯一 followUp 不成立） |
| ④-b compact              | **1 通**（内層 catch なし・最外周のみ）                                                     | **4 本**                                     | **原文**                                        | followUp 送達（deferReply の placeholder は残置 = interactions.service:90-92 の許容劣化）                |

- **共通 ERROR 4 本の内訳**: ①character-edit-feature.handler:118 🚨（error.occurred 経由・
  I3 で characterId 付き）②error-handler.ts:128/130（外層 enhanced:106 経由の logError）
  ③interaction-registry.service.ts:140「Handler execution failed」＋rethrow
  ④interactions.service.ts:87。interactions.service:86-99 は rethrow しないため :43 の
  catch には到達しない。emitAsync は await されるため 🚨 は ErrorHandler ログより先に出る
- **訂正**: 俯瞰#20 CL-1 当初集計の「ERROR 3 本」は registry:140 を欠いた過小計上。本表が正
- **CL-1(b) 前提の訂正**: 内層に `ErrorHandler.handleServiceError` が残るのは **modal のみ**
  （modal-handler:80-87。このため②だけイベント文言が変換後になる）。refresh 内層
  （enhanced:169-181）は select と同じ「通知＋原文 rethrow」同型だが、共有 util を使わず
  `interaction.followUp` 直呼び。→ Task #102 の対象 = modal 内層の ErrorHandler 撤去
  ＋refresh の followUp 直呼び util 化（達成後: 文言全経路原文・ERROR 5→4 統一）
  **→ #102/J1（`62a84f3`・2026-08-06）で両方達成済み。表は達成後の状態**
- create の防衛枝（enhanced:80-86 respondEphemeralError・H1-e）は customId 契約 drift
  ガードであり throw 経路上には無い。compact（enhanced:187-204）は開発中 placeholder で
  try/catch 皆無

---

## 📝 最新メモ（2026-07-27）

### post-character の自動キャラ作成 suppression 契約（86e1f15）

REST `post-character` が開設したチャンネルに対し、`channelCreate` リスナー由来の自動キャラクター作成を抑止する仕組み。

- **マーク主体**: `DiscordController.postCharacter` — `createChannel` の resolve **直後**にマークする。
  **不変条件: resolve からマークまでに `await` を挟まないこと**（discord.js の `channelCreate` は
  `channels.create()` の promise 解決前に同期 emit されるため、マイクロタスク順序がこの契約の根拠）
- **照合**: `ChannelCreateOrchestratorService` が `CHARACTER_CREATION_REQUESTED` を emit する**直前**に照合
- **TTL**: 60 秒（unref 済みタイマー）。状態はプロセス内 Map（`ChannelDetectionService`）のため、
  **マルチレプリカ構成では成立しない**（負債として台帳記載）

### discord 層のエラー通知規則（4c582e9）

正本は `src/discord/utils/interaction-error-response.util.ts` の `respondEphemeralError`:
**replied→followUp(ephemeral) / deferred→editReply**（deferUpdate 由来で公開メッセージを守る場合のみ
`deferredStrategy: 'followUp'`）**/ 未応答→reply(ephemeral)**。util は no-catch・no-log（失敗の扱いは呼び出し元）。

- 既存の手書き実装（`deferUpdate → 無条件 followUp` 群等）は挙動が等価な限り置換必須ではないが、**新規コードは util を使う**
- `CharacterEditMessageUpdaterService` の `channel.send` は「interaction 応答でなく共有 embed の復旧」という意図的例外
- エラー通知は「通知先行 → `ErrorHandler.handleServiceError`（throw）後置」の順序を守る（CE-3）

### 認可バーの経路間非対称（俯瞰#3 明記）

上記 2026-07-12 メモの「REST `create-channel` / `post-character` とスラッシュコマンド `create-dice-channel`」の束ねは
不正確: **カテゴリ実効権限の追加検査・caller-holds・facade 結果型契約は REST 2 経路のみ**。
`create-dice-channel`（`select-game-system.orchestrator`）は基底 `ManageChannels` のみで
`guild.channels.create` を直呼びしている。統一（facade 経由化）は負債台帳の後続項目。

---

## 📝 最新メモ（2026-07-12）

### Discord REST操作の契約を統一

`send-message` / `create-channel` は、Discord SDKオブジェクトをHTTPへ露出せず、`success` で判別できる結果型を返す。成功時は `messageId` / `channelId`、失敗時は `error` を必須とする。入力optionsと結果型の正本は `interfaces/discord-operation-options.interface.ts` / `discord-operation-result.interface.ts`、詳細な事前条件・事後条件・不変条件は [DESIGN.md §4.5](./DESIGN.md#45-discordfacadeservice-の位置づけ2026-06-03-決着存続) を参照。

単数Embedと複数Embedはcontrollerで統合し、`#RRGGBB` はDTOで数値へ変換する。文字列チャンネル種別はmanagerでDiscord `ChannelType` へ変換する。`create-channel` の `thread` は通常チャンネルへ暗黙変換せず400とし、親チャンネルを持つ専用処理へ分離する。

チャンネル作成を伴う REST `create-channel` / `post-character` とスラッシュコマンド `create-dice-channel` は、対象ギルドでのユーザーの基底権限 `ManageChannels` を必須とする。呼び出しチャンネル限定の overwrite による付与は認可根拠にせず、REST の権限不足は403、Discord API・通信例外は500として分離する。`create-channel` で permission overwrite を指定する場合（非空 `permissions`）は、さらに呼び出し元の `ManageRoles` と overwrite で指定した各権限（allow/deny 全キー）の保持を要求する（Discord ネイティブの overwrite 編集意味論に準拠。判定粒度は非対称: `ManageChannels`/`ManageRoles` は guild 基底 AND（parent 時）カテゴリ実効の両方＝意図的過剰制限、指定した各権限は parent 時カテゴリ実効のみ。`permissions: []` は overwrite 無指定扱い）。controller の権限検査の成功述語は `result?.hasPermission === true` のみの fail-closed。

---

## 📝 最新メモ（2026-06-11）

### 修正: スレッド内ダイスロールの履歴保存キーを「実親チャンネル」へ変更（/dice-result に出ない問題）

**実機ログで確認した症状**: キャラ登録チャンネル（`character.discordChannelId`）の**外**で `/character-thread` からスレッドを
作成し、スレッド内でダイスを振ると、結果メッセージはスレッドの実親チャンネルへ投稿されるのに `/dice-result`（実行チャンネルで
検索）には何も出ない。

**真因**: 保存キーと表示先の乖離。スレッド内ボタンの customId にはキャラ登録チャンネル ID が埋め込まれ、履歴はそのキーで保存
される一方、結果メッセージは `interaction.channel.parentId`（実親）へ投稿される。スレッドがキャラ登録チャンネル内に作られる
限り両者は一致するが、別チャンネル配下にスレッドを作ると乖離する（2026-06-10 調査の「概念上はキャラ登録チャンネルで保存」が
顕在化したケース）。

**修正（ユーザー判断: 実親チャンネルで保存）**:

- `DiceRollLogicService` に `resolveSaveChannelId(interaction, lookupChannelId)` を追加し、`handleDiceRoll` /
  `handleSkillRoll` / `handleCustomDiceRoll` の **DB 保存のみ**「スレッド内なら `channel.parentId`、スレッド外・
  parentId 欠落時は従来の lookup キー」で行う。**キャラ解決（`findByChannelId(customId 由来キー)`）は不変**＝
  保存キーとキャラ解決キーの分離。5ハンドラ（dice_generic / flexible select / skill / ability / preset）は
  この一箇所で全て修正される（handler 側のコード変更なし）。
- `CustomDiceModalService.saveRollHistory` も同方針: 保存キーは「実親チャンネル → character.discordChannelId →
  customId 由来 → 現在チャンネル」の優先に変更。
- `diceroll.execute.completed/failed` イベントの channelId は**ロール文脈（lookup キー）のまま**（購読者ゼロを確認済み・
  挙動影響なし）。過去の履歴データは旧キー（キャラ登録チャンネル）のまま残る（migration なし）。
- **検証**: 対象 spec ＋新規回帰テスト5本（thread→parent-1 保存×3メソッド・parentId 欠落フォールバック・modal の
  実親優先）緑 / build 0 / check:circular = No circular dependency found! / 全 **187 suites 2613 tests 緑**
  （直前ベースライン 187/2608 ＋5件と整合＝新規破損ゼロ）。

---

## 📝 最新メモ（2026-06-10）

### 修正: カスタムダイスモーダルの履歴保存欠落と ID 不一致（下記調査の別件 1・2 を解消）

下記調査で見つかった `CustomDiceModalService`（`custom-dice-modal*` / `param-dice-modal*`）の確認済み不具合2件を修正。

- **保存欠落の解消**: ロール成功時（custom / param 両系統）に `DiceRollService.createText` で dice-roll 履歴へ保存するようにした
  （他のダイスボタン＝`DiceRollLogicService` 系と同じ保存系へ統一）。保存 channelId は
  `character.discordChannelId`（親チャンネル）→ customId 由来の値 → interaction のチャンネル（スレッドなら親）の順で解決。
  ロール失敗時は保存しない。**履歴保存の失敗はユーザーへの結果返信を妨げない**（Logger.error のみ）。
- **ID 不一致の解消**: customId 第2要素を「まず `findByChannelId`（live 送出元 `FlexibleDiceSelectHandler` は
  channelId を埋め込む）→ 不一致なら `findOne`（旧 param 系＝characterId 埋め込み。`flexible-dice-param*` メニューの
  生成元は現存しないが投稿済みメッセージからの interaction は届き得る）」の二段解決にした。
  これによりキャラ名が常に「プレイヤー」へフォールバックする latent bug も解消。
- **配線**: `DiceRollFeatureModule` に domains `DiceRollModule` を再 import（S-5c で除去していたが、
  `CustomDiceModalService` が `DiceRollService` を注入するため復活。leaf 方向の依存で循環なし）。
- **検証**: `pnpm build` 成功 / spec 14 緑（履歴保存・二段解決・失敗時非保存・保存失敗時 UX の回帰テスト 5 本追加）/
  全 suite 187 passed・2608 tests（新規破損ゼロ）/ `check:circular` = No circular dependency found!
- 残課題: 調査メモの別件 3（preset の characterId フォールバック・`postBasicDiceButtons` の undefined エッジ）は未着手。

### 調査: スレッド内ダイスボタンの保存 channelId は「スレッド ID ではない」（変更不要で決着）

「スレッドでダイスボタンを押すと結果がスレッド ID で保存されているのでは」という疑いを実コードで全数調査。**結論: スレッド ID では保存されていない**。

- スレッド内の全ダイスボタン（`dice_generic_` / `flexible_dice_`（即時ロール）/ `skill_` / `ability_` / `dice_{system}_` preset）は、
  **ボタン生成時（`ThreadInteractionService`）に customId へ `character.discordChannelId`（キャラクターの親チャンネル ID）を埋め込み**、
  各 handler はそれをパースして `DiceRollLogicService` へ渡す。保存（`DiceRollService.createText`）はこの customId 由来の channelId で行われ、
  `interaction.channelId`（＝スレッド ID）は保存に使っていない。
- スレッド作成時も `discordChannelId` は変更されない（`thread-creation.service.ts` は `discordThreadId` のみ設定。L103 のコメント
  「discordChannelIdをスレッドIDに更新」は実装と不一致の stale コメント）。
- 調査で見つかった別件:
  1. ~~**カスタムダイスモーダル（`custom-dice-modal*` / `param-dice-modal*` → `CustomDiceModalService`）はそもそも DB 保存していない**
     （`DiceOrchestratorService` は計算・送信のみ）。他のダイスボタンは履歴に残るのに modal 経由だけ残らない非一貫。~~ → **修正済み（上記 2026-06-10 メモ）**
  2. ~~同 modal は customId 第2要素を characterId として `findOne` するが、送出側 `FlexibleDiceSelectHandler` は
     **channelId** を埋めており不一致 → キャラ解決が常に失敗し表示名が「プレイヤー」になる latent bug。~~ → **修正済み（同上）**
  3. preset ボタン生成の `character.discordChannelId || character.characterId` フォールバック、
     `postBasicDiceButtons` の discordChannelId undefined 時（`..._undefined` な customId）はエッジケースとして残存（未着手）。

---

## 📝 最新メモ（2026-06-01）

### H3 巨大サービス分割: `dice-roll-pagination.service.ts`（挙動保存）

監査 H3「Discord 巨大サービスが単一責任を超過」対応。`components/pagination/dice-roll-pagination.service.ts`（590 行）を責務ごとに分割。

- **抽出した責務（同 feature 配下に co-locate）**
  - `dice-roll-pagination.util.ts`（101 行）… 純粋関数（discord.js 非依存・I/O なし）: `resolveHistoryTitle` / `filterRollsByCharacter` / `sortRollsByCreatedAtDesc` / `limitRolls` / `formatDiceRoll` / `computeNewPage` / `clampPage` / `isSpecificCharacter`。モック不要でユニットテスト可能。
  - `dice-roll-pagination.builder.ts`（196 行）… discord.js の Embed / コンポーネント生成（状態を持たない関数群）: `buildHistoryPages` / `setPageFooters` / `createEmptyEmbed` / `buildPageButtonRow` / `buildPageSelectRow` / `buildCharacterSelectRow`。
  - `dice-roll-pagination.store.ts`（116 行）… インメモリ状態 + ページ/キャラクターキャッシュ（TTL）。`PaginatedDiceRoll` 型の正本もここへ移し service から再エクスポート。
  - `dice-roll-pagination.service.ts`（234 行）… 上記を束ねる薄いオーケストレーター。
- **公開 API は不変**（コンストラクタ 2 引数も維持＝`character-select.spec.ts` が直接 `new` するため）。`@Global`/`forwardRef` 増やさず、provider 登録（interactions.module）も変更なし。
- 純粋関数の置き場所は ARCHITECTURE §12 に従い「pagination 固有 → 同 feature 配下の util」。`shared/` は横断純関数専用のため使わず。
- **検証**: `pnpm build` 成功 / `pnpm test src/discord/components/pagination` = 既存 33 + 新規 25（util.spec）= **58 緑** / `check:circular` は許容済み Auth⇄User の 1 件のみ（新規循環なし）。`src/discord` 全体の 13 失敗は本変更前から同数・同一（event-debug の timing 系）で本件と無関係。

---

## 📝 最新メモ（2026-05-30）

### Discord 層 統合設計書を作成

- 設計評価（78/100）・As-Is / To-Be・customId 契約・Phase 0〜4 を [DESIGN.md](./DESIGN.md) に集約
- 空だった `interactions/README.md` / `MIGRATION_GUIDE.md` を補完
- **次の着手**: Phase 0 残件（Factory / Parser 統一、legacy customId 廃止）→ Phase 1（diceRoll を InteractionsModule から分離）

### 設計上の最重要原則

- **InteractionsModule は feature 実装を所有しない**（registry 基盤のみ）
- **InteractionsModule は feature module を import しない**。feature 側が Registry を import して handler を明示登録する
- customId は Factory / Parser / Handler pattern に集約（文字列直書き禁止）
- `DiceRollCharacterProviderService` の ports 切り出しは正しい方向

### 既知の不具合リスク

- Legacy `dice-prev*` 系 customId が Registry handler（`dice-page-prev`）と不一致 → pagination 無反応
- ルーティング 3 層並存（Map → InteractionsService 特例 → Registry）

---

## ✅ 最新完了済み変更（2025-08-21）

### 📚 **ドキュメント体系整備完了**

**概要**: Discord機能全体のドキュメント体系を整備し、各フォルダにREADME.mdを作成

**整備内容**:

```
discord/services/
├── dice/README.md           - ダイス処理サービス群ドキュメント
├── monitoring/README.md     - パフォーマンス監視サービス群ドキュメント
├── channel/README.md        - チャンネル管理サービス群ドキュメント
├── README.md                - コアサービス群ドキュメント
└── features/README.md       - 機能モジュール群概要ドキュメント
```

**各ドキュメントの内容**:

- **サービス役割と責務**: 各ファイルの具体的な役割
- **アーキテクチャ設計**: 依存関係とパターン説明
- **使用方法**: 基本から高度な使用例
- **パフォーマンス特性**: レスポンス時間と制限事項
- **設定・カスタマイズ**: 環境変数と設定オプション
- **トラブルシューティング**: 問題診断と解決方法

**改善効果**:

- ✅ 完全なドキュメント体系: 全主要フォルダにドキュメント整備
- ✅ 開発者オンボーディング: 新規開発者の理解促進
- ✅ 保守性向上: アーキテクチャ理解とトラブル解決の迅速化
- ✅ 品質向上: 設計原則と最適化指針の明文化

---

## 📝 進行中メモ（2026-03-08）→ [DESIGN.md](./DESIGN.md) に統合済み

- Registry 移行方針・customId 洗い出し・Phase 計画は DESIGN.md §6〜7 を参照
- `InteractionRegistryService` 未登録 customId 集計・`debugInfo()` は実装済み

---

## ✅ 最新完了済み変更（2025-08-21 前半）

### 🎲 **ダイスサービス統合完了**

**概要**: `dice-notation-handler.service.ts`を`/dice`フォルダに統合し、ダイス処理を一元化

**統合結果**:

```
services/dice/
├── dice-orchestrator.service.ts     - 統合オーケストレーター
└── dice-calculation.service.ts      - 計算エンジン
```

> 注（2026-06-10）: `dice-preset.service.ts`（旧 `preset-dice*` 系プリセット管理）は dead 化のため撤去済み。
> 現役プリセットは `features/characterThread` の `PresetDiceQuickRollHandler`（`dice_(coc7|dnd5e|sw25)_`）。
> 注（2026-07-07 C-2）: `dice-parser.service.ts`（DiceParserService）は孤児化のため丸ごと撤去済み。
> orchestrator の dead 委譲メソッド（`parseAndCalculate`/`parseFormula`/`evaluateFormula`/`convertToDiceNotation`/
> `getServiceStats`/レガシー互換 3 種）と calculation の `parseAndCalculate`/`FlexibleDiceResult` も同時撤去。

**各サービスの役割**:

- **DiceOrchestratorService**: 全ダイス処理の統一インターフェース
  - `executeBasicNotation()` - 基本ダイス記法（1d100, 2d6+3等）
  - `calculateAndRoll()` - キャラクターパラメータ統合
- **DiceCalculationService**: ダイス計算コアロジック

**改善効果**:

- ✅ 一元化: 全ダイス処理が`/dice`フォルダに統合
- ✅ 統一API: DiceOrchestratorServiceによる統一インターフェース
- ✅ 後方互換: レガシーメソッドで既存コードとの互換性維持

**使用方法**:

```typescript
// 推奨
constructor(private diceOrchestrator: DiceOrchestratorService) {}
const result = await this.diceOrchestrator.executeBasicNotation('1d100')
```

---

## ⚠️ 残存課題管理（2025-08-17）

### 🔴 TypeScriptエラー `[要対応: 22個]`

**高優先度**:

1. **Enhanced Character Edit Service** - Character.Entity型不一致
2. **Discord Schema** - ZodDefault関数overload不一致

**中優先度**: 3. **Character Event Handler** - Character型とEntity型の不一致4. **Channel Create Orchestrator** - 型定義の軽微な不整合

**対応ロードマップ**:

- **Phase 1 (緊急)**: 型キャストによる一時回避
- **Phase 2 (構造改善)**: 型変換ヘルパー関数の実装
- **Phase 3 (品質向上)**: Character型とEntity型の統一設計

---

## 🏗️ アーキテクチャ概要

### サービス構成

**Core Services** (`/services`):

- `DiscordFacadeService` - Discord統合のメインエントリーポイント
- `discord-client.service.ts` - Discord.jsクライアント管理
- `discord-guild-manager.service.ts` - ギルド管理
- `discord-channel-manager.service.ts` - チャンネル管理

**Specialized Services**:

- `/dice` - ダイス処理統合サービス群
- `/monitoring` - パフォーマンス監視サービス群
- `/channel` - チャンネル専門サービス群

**Feature Modules** (`/features`):

- `characterEdit/` - キャラクター編集機能
- `characterThread/` - キャラクタースレッド機能
- `diceRoll/` - ダイスロール機能

**Interactions Layer** (`/interactions`):

- Discord.jsインタラクション処理の統合管理
- ボタン、モーダル、セレクトメニュー処理

### アーキテクチャ原則

1. **単一責任**: 各サービスは明確な責務を持つ
2. **依存性注入**: NestJSのDIコンテナを活用
3. **イベント駆動**: TypedEventServiceによる疎結合
4. **レイヤー分離**: UI層、ビジネス層、データ層の明確な分離

---

## 🚀 今後の改善項目

### 🔥 高優先度（[DESIGN.md](./DESIGN.md) Phase 0〜1）

- customId 統一（`dice-prev*` → `dice-page-*`）
- diceRoll を InteractionsModule から FeatureModule へ分離
- InteractionsModule slim 化・ルーティング 1 本化

### 🔧 中優先度

- TypeScriptエラー22個の解消（Character vs Entity型統一）
- ModuleRef / forwardRef の段階的排除
- パフォーマンス監視の Module 二重登録解消

### 📋 低優先度

- core/ フォルダ新設・commands の feature 移動
- Legacy（DiscordService, interactions/button/）削除
- テストカバレッジの feature 単位拡充

---

## 📊 参考情報

### ファイル構造

```
src/discord/
├── DESIGN.md          # 統合設計書（目標アーキテクチャ・リファクタ計画）
├── services/          # コアサービス（dice 計算エンジン、monitoring 等）
├── features/          # 機能別モジュール（目標: handler/pagination/ports もここに集約）
├── interactions/      # インタラクションルーティング基盤（Registry）
├── commands/          # スラッシュコマンド
├── components/        # 共有 UI（pagination 等 → diceRoll へ移動予定）
└── dto/               # データ転送オブジェクト
```

### 主要な設定

- `discord.module.ts` - メインモジュール設定
- `discord.service.ts` - レガシーサービス（非推奨）
- `discord-facade.service.ts` - 新統合サービス

---

_最終更新: 2026-05-30_
