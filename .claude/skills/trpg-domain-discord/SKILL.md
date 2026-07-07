---
name: trpg-domain-discord
description: >-
  TRPG-SERVER の discord 層（src/discord）の設計ガイド。Discord Bot のボタン・セレクト・モーダル・
  スラッシュコマンド・customId・InteractionRegistry・features（characterEdit / characterThread /
  diceRoll / gameSystem / userDefinedDice）・ダイス計算サービスに関わるコードを追加・変更・レビュー・
  リファクタするときは必ず使う。「ボタンを追加したい」「モーダルが反応しない」「ダイスの挙動を変える」
  「スレッドでロールすると〜」など discord と明示されない依頼でも、Bot の UI/interaction/ロール処理に
  触るなら必ず参照する。新規ハンドラ追加の正しい手順・customId 契約・スレッド保存キーの意味論・
  イベント RPC 禁止・God Module 再発防止を定義する。
---

# discord 層 設計ガイド

**対象**: `TRPG-SERVER/src/discord/`
**役割**: Discord Bot のアプリケーション層。原則は
**「Commands / Events（アダプタ）＝薄い受け口、Features ＝ ビジネスロジック、Interactions ＝ ルーティング基盤のみ」**。
ドメインデータの正本は `domains/*`（DI でサービスを呼ぶ）。ダイスの計算エンジンは `services/dice`。

## 構成マップ

| 場所 | 役割 |
| --- | --- |
| `interactions/` | Registry 基盤のみ（InteractionRegistryService・PatternMatcherService・base handler）。**feature を所有しない** |
| `features/characterEdit/` | キャラ編集 UI（handler 6・Embed/Modal セッション管理） |
| `features/characterThread/` | キャラスレッド・スレッド内ダイス UI（handler 9・skill_/ability_/dice_generic_/preset） |
| `features/diceRoll/` | 履歴ページネーション・カスタムダイスモーダル（handler 8・dice-page-*） |
| `features/gameSystem/` `userDefinedDice/` | コマンド用オーケストレータのみ（handler なし） |
| `services/dice/` | 計算エンジン（DiceRollLogicService / DiceOrchestratorService / DiceCalculationService / DiceParserService） |
| `commands/` | スラッシュコマンド（/d, /dice-result, /create-character-thread 等）→ 各オーケストレータへ委譲 |
| `application/` | DiscordIntegrationModule（DiscordClientService）。features が依存する葉モジュール |
| `discord-facade.service.ts` | 起動オーケストレーション＋REST controller の裏付け（存続決定済み・DESIGN.md §4.5） |

## 新しいボタン/セレクト/モーダルを追加する手順（これ以外の方法でやらない）

1. **customId 契約を作る**: 対象 feature の `custom-id/` に Factory/Parser（`create()` / `parse()` / pattern 定数）を追加。
   **customId 文字列の直書きは禁止**（ARCHITECTURE §15）。既存例: `SkillRollCustomId`＝`skill_{channelId}_{skillKey}`、
   `DicePageCustomId`＝`dice-page-prev*{messageId}*{channelId}`。Discord の customId は **100 文字上限**。
2. **handler を作る**: `interactions/handlers/base/interaction-handler.base.ts` の基底を継承し
   `getCustomIdPattern()`（prefix 文字列 or RegExp）・`getInteractionType()`（button/select/modal）・
   `execute()` を実装。**execute はパースして service へ 1 行委譲するだけ**。Embed 生成・DB アクセスを handler に書かない。
3. **feature module に登録**: providers に追加し、その module の `onModuleInit()` の
   `interactionRegistry.registerHandlers([...])` に足す。**InteractionsModule には絶対に追加しない**
   （feature import が復活すると God Module と循環依存が再発する）。
4. **integration spec を更新**: `interactions/handlers/handlers.integration.spec.ts` の登録総数
   （現在 23。**正はこの spec**）と match assertion を更新。
5. **検証**: `pnpm run build` → `pnpm run check:circular` → 関連 spec → `pnpm run start:dev` で
   登録数と pattern conflict warning なしを確認。

**パターンマッチの罠**: prefix 文字列は `-` か `_` か `*` で終わらせて `startsWith` を意図通りにする
（`character-refresh-` は OK、`character-refresh` は exact のみ）。スコアは exact(100) > prefix(50+長さ) >
regex(30)。同点は登録順で先勝ちなので onModuleInit の登録順にも意味がある。

## domains の使い方（イベント RPC 禁止）

- キャラクター・履歴・ユーザーが必要なら **CharacterService / DiceRollService / UserService を DI で直接呼ぶ**。
- `character.findBy*.requested` を emit して `waitForEvent('*.completed')` で待つ**イベント RPC は書かない**
  （correlationId 無しの混線・必ずタイムアウトする順序バグ・リスナー残存が確認済み。既存の残存箇所は
  `docs/refactor/refactor-event-design-plan-2026-07-06.md` E-2 で撤去予定——**増やさない・真似しない**）。
- イベントは**通知専用**（例: `character.creation.completed` → Discord UI 更新。`src/discord/events/handlers/`
  が onModuleInit で自己購読）。素の `EventEmitter2` を注入しない（TypedEventService 一本）。
- **Mongoose Model への直接アクセス（InjectModel）は discord 層では禁止**。必ず domain service 経由（現状違反ゼロを維持）。

## スレッドとチャンネル ID の意味論（最重要・バグ多発地帯）

ID が3種類あり、混同すると「/dice-result に出ない」「キャラが見つからない」系のバグになる：

| ID | 用途 |
| --- | --- |
| `character.discordChannelId`（customId に埋め込まれる） | **キャラクター解決キー**。`findByChannelId` に渡す。スレッド作成後も不変 |
| `interaction.channel.parentId`（スレッドの実親） | **履歴の保存キー**。`DiceRollLogicService.resolveSaveChannelId()` が解決する |
| `interaction.channelId`（スレッド ID そのもの） | どちらのキーにも**使わない** |

新しいロール系 handler では、キャラ解決は customId 由来キー、履歴保存は `resolveSaveChannelId` 経由、を必ず守る。

## やること / やらないこと

| やること | やらないこと |
| --- | --- |
| interaction の受付・customId 契約・UI 構築 | ドメインデータの直接永続化（→ domain service 経由） |
| feature 内での orchestration（ports/adapters） | InteractionsModule への feature provider 追加 |
| domain service の DI 呼び出し | `DiscordService`（@deprecated ラッパー）の新規注入（→ DiscordFacadeService / DiscordClientService） |
| 通知イベントの購読（自己購読 onModuleInit） | イベント RPC（waitForEvent）・素の EventEmitter2 |
| ダイス計算（services/dice） | status セクションのロールボタン再導入（S-4 で撤去済み・status は表示専用） |
| | `roll*` / `preset-dice*` / `character-dice*` 系 legacy customId の再導入（S-5c で撤去済み） |

## 既知の落とし穴

- **ルーティングは現在3層**（DiscordInteractionHandlerService の Map キャッシュ〔登録ゼロの dead 構造〕→
  InteractionsService → Registry）。新規コードが依存してよいのは **Registry だけ**。Map への register* を使わない。
- **モーダルの field 名**は受け手（`CustomDiceModalService`）と生成側で一致必須。canonical は
  `dice-command` + `dice-comment`（custom 系）/ `dice-formula` + `multiplier` + `modifier` + `dice-comment`（param 系）。
  `getTextInputValue` は不在 field で throw する（S-2 の教訓）。
- **履歴保存の失敗はユーザーへの結果返信を妨げない**（Logger.error に留める）が確立済みの UX 方針。
- 未登録 customId は Registry が `unregisteredCounts` に記録する。「ボタンが反応しない」調査は
  `registry.debugInfo()` / start:dev ログの未登録統計から始める。
- モジュール init 順: diceRoll / characterThread は DiceServicesModule に依存。**feature 同士の import は禁止**
  （共有したいものは services/ か custom-id 契約へ）。

## 検証

`pnpm run build` → `pnpm run check:circular`（No circular dependency found!）→ 関連 spec →
`handlers.integration.spec.ts`（登録数）→ `pnpm run start:dev`（batch 登録・conflict なし・DI 解決）。
挙動変更を伴うなら全 suite（suite 単位のコンパイルエラーで「未実行の緑」を誤認しない——AI.test.md 2026-06-07 の教訓）。
作業終了後は `AI.discord.md` / `AI.refactor.md` に記録。

## 正本ドキュメント

`src/discord/DESIGN.md`（目標アーキテクチャ・customId 契約・Phase 計画）・`AI.discord.md`（経緯）・
`src/ARCHITECTURE.md`（§8 Discord 方針）・`interactions/README.md`。
ドメイン側の契約は `trpg-domain-character` / `trpg-domain-dice-roll` スキルを参照。
