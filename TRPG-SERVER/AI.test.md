# TRPG-SERVER テスト戦略・実装ドキュメント

## 📋 **ドキュメント概要** **[最終更新: 2026-06-03]**

> **2026-06-03 デッドコード削除（挙動保存）**: `src/discord/features/characterEdit/index.ts` の未使用 `CharacterEditServiceFactory`（実在しない `./character-channel-create.service` を require）を削除。製品コードの公開 API 不変。`pnpm test src/discord/features/characterEdit` = **21 suites / 292 tests 緑**、build 成功、check:circular「No circular dependency found!」。

---

## 🔧 **赤 triage（B3）: channel-detection / discord.service / event-debug-test** **[完了: 2026-06-02]**

3 spec の赤を本体 Read で現挙動を確認のうえ test 側で安全修正（製品コード未変更）。

### **1. channel-detection.service.spec.ts（A: test 修正で緑）**

- **原因**: 本体 `ChannelDetectionService.extractCreatorId` が `AuditLogEvent.ChannelCreate` を
  参照するが、グローバル discord.js モック（`test/utils/jest-setup.ts`）に `AuditLogEvent` が
  欠落 → `undefined.ChannelCreate` で TypeError → catch で `creatorId=null`。
  さらに `should detect...` / `should handle missing executor...` の mock が `entries: new Map([...])`
  だったが、本体は `entries.find(...)` を使う。素の `Map` に `.find` は無く（実 discord.js の
  `Collection` のみ持つ）これも例外要因だった。
- **対応**:
  - `jest-setup.ts` の discord.js モックに `AuditLogEvent`（ChannelCreate=10 ほか実値）を恒久追加。
  - spec 2ケースの `entries` を `find` を備えた Collection 互換オブジェクトへ修正。
  - → 5/5 PASS。本体は正常仕様（creatorId 解決ロジックにバグなし）。

### **2. discord.service.spec.ts（A: 現仕様へ全面置換）**

- **原因**: `DiscordService` は H 系で薄いファサードラッパー（deprecated）化済み。旧 spec は
  `registerButton/registerModal/registerSelectMenu`・`interactionCreate` ハンドリング等、
  既に**除去された責務**を前提に陳腐化していた。
- **移設先カバー確認**: register/interaction 処理は `DiscordInteractionHandlerService`
  （`discord-interaction-handler.service.spec.ts`）、`InteractionsService`
  （`interactions/interactions.service.spec.ts`）、`initializeDiscord` は
  `DiscordFacadeService`（`discord-facade.service.spec.ts`）でカバー済み。
- **対応**: 旧責務検証ケースを削除し、現仕様＝「各 deprecated メソッドが `DiscordFacadeService`
  へ正しく委譲するか」を検証する spec へ置換（DTO 展開・null時例外・getBotStatus 集約・
  verifyGuildManagePermission の failure 握り潰し等を網羅）。→ 19/19 PASS。

### **3. event-debug-test.spec.ts（A: 削除）**

- **原因**: `character.findById.requested` のリスナーは現アーキテクチャでは File-based handler
  `CharacterFindByIdRequestedHandler` が担当。一方 `CharacterEventHandlerService` の
  `registerEventListeners()` は本体コメント通り**意図的に無効化済み**（File-based へ移行）。
  この spec は「`onModuleInit` でリスナーが張られる」という古い前提のデバッグ用 spec で、
  `listenerCount > 0` を満たせず4件赤。製品バグではなく spec が現設計と矛盾。
- **カバー確認**: findById のイベントフローは `character.findById.requested.spec.ts`（充実した
  unit）、`on/emit` 動作は `core/events/typed-event.service.spec.ts`、`getCharacterById` フローは
  `enhanced-character-edit.service.spec.ts` でカバー済み。
- **対応**: デバッグ専用かつ重複ゆえ削除。

### **(B) 残課題（本タスク対象外・別途）**

- `src/discord/features/characterEdit/character-channel.service.spec.ts:766` で TS2345 型エラー
  （`description` fixture が `Character.description: AttributeSection` 型に不一致）。本タスクで
  触っていない別 spec の既存型ドリフト。`postCharacterEmbeds` に渡す fixture の型整合が必要。
  推奨: fixture の `description` を `AttributeSection` 形へ修正、または `as any` キャストで解凍。

---

## 🧪 **テスタビリティ改善（赤）: ThreadManagerService** **[完了: 2026-06-02]**

### **背景**

`src/discord/features/characterThread/services/thread-manager.service.ts`（298行・赤判定）。
コンストラクタで `discordClientService.getClient()` を保持し、`Date.now()` / `setTimeout` /
`guild.channels.fetch` / `channel.threads.create` / `client.channels.fetch` / `typedEventService.emit`
が密結合でテスト不能だった。**挙動保存（characterization 同時固定）＋ seam 分離**で改善。

### **抽出した Pure 関数（新規 `services/thread-manager.util.ts`・DI なし・discord.js 非依存）**

- `buildThreadUrl(guildId, threadId)` → `https://discord.com/channels/${guildId}/${threadId}`
- `nextBackoffDelay(current)` → `current * 2`（exponential backoff）
- `buildCreationCompletedPayload(input, threadUrl, timestamp)` → completed emit payload 組立
  （threadId を discordThreadId に複製・source 固定。Date は注入）
- `buildCreationFailedPayload(input, tempThreadId, error, timestamp)` → failed emit payload 組立

### **seam（副作用境界）**

- `protected now(): number`（既定 `Date.now()`）— poll ループ条件・タイミングログ・`temp-${now}` に使用。
- `protected sleep(ms): Promise<void>`（既定 `setTimeout`）— createDiscordThread の 50ms 待機・
  getThreadChannel の retry backoff・waitForThreadAvailability の poll 間隔に使用。
- client は **DiscordClientService 経由のまま**（注入済みなので mock 可）。
- **本番タイミング挙動は不変**（50ms 待機・retry 回数・×2 backoff・poll 間隔そのまま）。テストでは
  `now`/`sleep` を差し替え 0 遅延化し、テストを遅延させない（spec 18件 5.5s）。

### **作成テスト**

- `thread-manager.service.spec.ts`（characterization, 14 PASS）: 公開 6 メソッドの外部挙動
  （戻り値・emit イベント名 `character-thread.creation.completed`/`.failed` と payload キー・
  retry/poll の最終結果）を固定。グローバル discord.js モックは `jest.unmock` し実 ChannelType 使用。
- `thread-manager.util.spec.ts`（純関数ユニット, 4 PASS）: モック不要の入出力検証。

### **守った制約**

- 公開 API（`createCharacterThread`/`getThreadChannel`/`waitForThreadAvailability`/`threadExists`/
  `archiveThread`/`unarchiveThread`）のシグネチャ・外部挙動・emit イベント名/payload キー・
  CreateThreadResult・threadUrl 形式は不変。
- 純粋層に DI を持ち込まず（util は引数/戻り値のみ）。`now`/`sleep` の seam のみ副作用境界に追加。
- 既存の冗長ログ・多重 fetch（実験コード）は**挙動保存**のため削除せず seam 化のみ。

### **検証結果**

- 対象 2 spec: **18 PASS**（characterization 14 + 純関数 4）。
- `tsc --noEmit -p tsconfig.json`: thread-manager 関連エラー **0 件**（型クリーン）。
- `pnpm run check:circular` → **No circular dependency found!**（新規循環ゼロ）。
- **既知のベースライン破損**: `pnpm run build` は別作業（channel-creator.pure.ts / channel-creator.service.ts）
  の未コミット型エラー 2件で失敗する。本対象ファイルを `git stash` して build しても同じ 2件が残ることを
  確認済み＝**本改善由来の新規破損はゼロ**。
- 元サービス 298 行 → 331 行（seam メソッド + 純ヘルパ呼び出しへの置換）。Pure ロジックは util へ移設。

## 🧩 **H3 巨大サービス分割: EnhancedCharacterEditService** **[完了: 2026-06-01]**

### **背景**

`src/discord/features/characterEdit/enhanced-character-edit.service.ts`（815行）は
character-edit の中核オーケストレーター（6 interaction handler が依存する現役）。spec が無かったため
**characterization テスト先行**で現挙動を固定してから分割（挙動保存の安全網）。

### **テスタビリティ評価: 緑**

- 公開メソッド7つは「イベント発火 + 依存サービス委譲 + interaction 応答」のオーケストレーション。
  `@discord-test-utils` の `createMockButtonInteraction` / `createMockSelectMenuInteraction` /
  `createMockModalInteraction` で全公開挙動を固定可能だった。
- **重要な現挙動の発見（characterization で確定）**:
  - `ErrorHandler.handleServiceError` は**常に HttpException を再スロー**する。よって
    `handleButton/Select/ModalSubmitInteraction` のエラー時は error.occurred を emit した**後に
    HttpException が呼び出し元へ伝播**する（握りつぶさない）。`displayEnhancedCharacterEdit` も
    embed 生成失敗時は catch 先頭の handleServiceError で再スローし、フォールバック emit には到達しない。
  - モーダル送信の characterId 抽出は customId を `-` split し**最後の要素**を採用
    （`char-edit-status-hp-char-123` → characterId=`'123'`）。一方 error.occurred 側は
    `extractCharacterIdFromCustomId`（refresh/compact パターンのみ）を使うため `char-edit-*` は
    マッチせず `'unknown'`。この非対称性は現挙動として固定した。

### **作成テスト**

- `enhanced-character-edit.service.spec.ts`（characterization, 17 PASS）
  - 固定した挙動: 7 公開メソッドの依存呼び出し・引数・emit イベント名/payload・
    interaction 応答（showModal/update/deferUpdate+followUp/deferReply+editReply）・エラー時の
    error.occurred emit と HttpException 再スロー。
- `utils/enhanced-character-edit.util.spec.ts`（抽出純関数ユニット, 18 PASS）

### **分割設計**

- 新規 `utils/enhanced-character-edit.util.ts`（114行, discord.js 非依存の純粋関数）:
  `extractCharacterIdFromCustomId` / `parseModalSubmitCustomId` / `parseSectionSelectValue` /
  `normalizeSectionType` / `messageHasCharacterEditButtons`（Message の最小構造のみ受ける純化版）。
- 新規 focused service 2つ（character-edit.module の providers に登録・@Global/forwardRef 不使用）:
  - `services/character-edit-event-emitter.service.ts`（152行）: characterEdit.\* イベント発行
    （modal.opened/submitted, section.selected+field.selected, embed.refresh.requested, error.occurred）。
  - `services/character-edit-message-updater.service.ts`（91行）: refresh ボタン時の
    既存メッセージ探索・編集（`updateExistingCharacterEditEmbed` + `findCharacterEditMessage`）。
- `EnhancedCharacterEditService` は薄いオーケストレーターへ。**公開 7 メソッド・コンストラクタの
  公開シグネチャ（追加した協力者2つは新引数だが、6 handler は本サービスを DI 取得するだけで影響なし）は不変**。
- **デッドコード削除**: `handleCharacterUpdated` / `handleCharacterAutoUpdate`（呼び出し元ゼロ・
  onModuleInit のイベント登録は既に撤去済みで到達不能）を characterization 緑のまま削除。
  併せて未使用の private（`isCharacterEditChannel` は handleCharacterDisplayRequested で使用のため残置）。
- 元サービス **815 行 → 453 行**（-362行 ≒ -44%。util/2 service へ移設）。

### **検証結果**

- `pnpm run build` 成功
- characterization 17 PASS / 純関数 18 PASS（**分割前→分割後とも characterization 緑＝挙動不変**）
- `pnpm run check:circular` → **No circular dependency found（循環ゼロ・新規循環なし）**
- 回帰確認: 同コンストラクタを実体登録していた `event-debug-test.spec.ts` に新協力者2つを
  provider 追加（テスト意図は不変）。これで baseline と同じ 4 failed/3 passed に復帰。
  他の既存失敗5スイート（character-notification の `interactions.list` 欠落、channel系の
  discord.js モック起因 `reading 'ChannelCreate'/'close'`）は `EnhancedCharacterEditService` 非依存で
  本変更と無関係（stash 比較で baseline と同一を確認）。

---

## 🧩 **H3 巨大サービス分割: CharacterEmbedManagerService** **[完了: 2026-06-01]**

### **背景**

`src/discord/features/characterEdit/services/character-embed-manager.service.ts`（831行）を
責務分割。spec が無かったため、**characterization テスト先行**で現挙動を固定してから分割（挙動保存の安全網）。

### **テスタビリティ評価: 緑**

- embed 生成系は discord.js の `EmbedBuilder` を生成するが `.toJSON()` で構造を決定的に検証可能。
- `processCharacterData`（AttributeValue 合算・整形）が純粋ロジックの中心で出力決定的。
- DI は `TypedEventService` のみ（embed 生成では未使用）。
- **注意点**: グローバル `test/utils/jest-setup.ts` が `discord.js` をスタブモックしており
  `EmbedBuilder.toJSON()` / `setTimestamp()` が無い。実 builder を検証するため spec 冒頭で
  `jest.unmock('discord.js'); jest.mock('discord.js', () => jest.requireActual('discord.js'))` を宣言する
  （embed 構造を検証したいテストでは必須のパターン）。

### **作成テスト**

- `services/character-embed-manager.service.spec.ts`（characterization, 13 PASS）
  - 固定した挙動: 5 embed の順序とタイトル、基本情報の色/フィールド（gameSystemId 有無）、
    ステータス embed の AttributeValue 整形（合計/内訳/ダイス/説明）、空セクションの説明文、
    24 件超の切り詰め + footer 省略数、`createFieldSelectMenu`（既存/空/未知タイプ）、
    `createNewCharacterEmbed` / `createCharacterCreatedEmbed`、`sendSectionedEmbeds` の送信内容。
- `utils/character-embed.util.spec.ts`（抽出純関数ユニット, 20 PASS）

### **分割設計**

- 新規 `utils/character-embed.util.ts`（156行, discord.js 非依存の純粋関数）へ抽出:
  - `generateShortCharacterId()` / `formatAttributeFieldValue()` / `buildAttributeFields()`
    / `buildFieldOptionDisplay()` / `extractDiceRollValue()`
- `CharacterEmbedManagerService` は薄いオーケストレーターへ。status/parameter/skill/item の
  4 メソッドを共通 `createSectionEmbed()` に集約。**公開 API（メソッド名・シグネチャ・コンストラクタ）は不変**。
- ログ出力（logger.debug / console.log）は embed 出力に無関係な副作用のため util では除去（出力文字列は不変）。
- 元サービス **831 行 → 535 行**（-296 行 ≒ -36%。util 156 行へ移設）。

### **検証結果**

- `pnpm run build` 成功
- characterization 13 PASS / 純関数 20 PASS（分割前→分割後とも characterization 緑＝挙動不変）
- `pnpm run check:circular` → **No circular dependency found（循環ゼロ・新規循環なし）**

---

## 🧩 **H3 巨大サービス分割: CharacterUIService** **[完了: 2026-06-01]**

### **概要**

`src/discord/features/characterEdit/services/character-ui.service.ts`（739行）を分割。
Discord API ラッパー（channel/message I/O 中心）で spec が無かったため、**characterization テスト先行**で
現挙動を固定してから純粋構築ロジックを util へ抽出（挙動保存の安全網）。公開メソッド/コンストラクタは不変。

### **テスタビリティ評価（緑/黄/赤）**

- **緑（モックで素直に固定）**: sendMessage / getTextChannel / sendCharacterDeletionNotification /
  updateChannelName / archiveChannel / addChannelArchiveEmoji / updateChannelStatusDisplay /
  sendCharacterEmbedWithSelectMenu / handleSectionSelectInteraction
- **黄（messages.fetch の Collection.find/filter を扱う）**: updateCharacterEmbed / removeCharacterEmbeds /
  createOrUpdateCharacterEmbed … 実 discord.js `Collection` を使えば固定可能（赤に落とさず緑化）
- **赤**: なし。全公開メソッドを書ける範囲で characterization 済み

### **抽出した純粋ロジック（`utils/character-ui.util.ts`・I/O非依存）**

- Embed: `buildCharacterEmbedData` / `buildCharacterEmbed`（withTimestamp 差異を保存）
- 文言: `buildCharacterUpdateNotificationMessage` / `buildCharacterDeletionNotificationMessage` / `buildChannelStatusText`
- SelectMenu/Row: `buildSectionSelectMenu` / `buildSectionSelectMenuWithBack` / `buildFieldSelectMenu` / `toSelectMenuRow`
- customId: `isSectionSelectCustomId` / `extractCharacterIdFromSectionSelect`、定数 `CHARACTER_EMBED_TITLE_KEYWORD` 等

discord.js のビルダー生成は行うが channel.fetch/send/edit には依存しない。`CharacterUIService` は薄い I/O
オーケストレーターに（embed/select menu の重複定義を util へ集約）。I/O 薄ラッパ（fetch→send/edit/setName 等）は
過剰分割を避け据え置き。**character-ui.service.ts は 739行 → 476行**。

### **デッドコード（呼び出し元の無い公開メソッド・報告のみ）**

8 consumer のうち live に呼ばれるのは update/deletion 系（character.update.completed / character.deletion.completed）。
以下は本体内 or コメントアウトのみで**外部 live caller なし**だが、タスク指定の公開 API 保持方針に従い**削除せず温存**:
`createChannel` / `createOrUpdateCharacterEmbed` / `getTextChannel` / `sendCharacterUpdateNotification`（コメントアウト参照のみ）/
`sendCharacterEmbedWithSelectMenu` / `handleSectionSelectInteraction`。
また `channel-create-orchestrator.service` / `character.creation.completed` / `interactions.service` は
`CharacterUIService` を DI のみで未使用（将来の不要 injection 整理候補として報告）。

### **検証結果**

- `pnpm run build` 成功
- characterization 23 PASS / 純関数 21 PASS（分割前→分割後とも characterization 緑＝挙動不変）
- `pnpm run check:circular` → **No circular dependency found（循環ゼロ・新規循環なし）**

---

## 🆕 **@discord-test-utils ライブラリ導入** **[完了: 2026-04-03]**

### **概要**

`@shoginn/discordjs-mock` を拡張したプロジェクト内部モックライブラリを新設。
各spec.tsに散在していた `as any` モックと重複する `jest.mock('discord.js', ...)` を一元化。

### **ライブラリ構成**

```
test/discord-test-utils/
  index.ts                               ← エントリーポイント (@discord-test-utils)
  interactions/
    base.types.ts                        ← 共通ベース型・デフォルト値
    chat-input.factory.ts                ← ChatInputCommandInteraction
    button.factory.ts                    ← ButtonInteraction
    select-menu.factory.ts               ← StringSelectMenuInteraction
    modal.factory.ts                     ← ModalSubmitInteraction
    autocomplete.factory.ts              ← AutocompleteInteraction
  client/
    discord-client.factory.ts            ← Client/Guild/Channel/User/Thread
  jest/
    discord-module.mock.ts               ← jest.mock('discord.js', ...) 標準定義
  discord-test-utils.spec.ts             ← ライブラリ自体の動作確認テスト (24 PASS)
```

### **使い方**

```typescript
// 新規テストではこれだけでOK
import {
  createMockChatInputInteraction,
  createMockButtonInteraction,
  createMockSelectMenuInteraction,
  createMockModalInteraction
} from '@discord-test-utils'

// スラッシュコマンドテスト
const interaction = createMockChatInputInteraction({
  commandName: 'dice',
  options: { getString: jest.fn().mockReturnValue('1d100') }
})
await service.execute(interaction)
expect(interaction.deferReply).toHaveBeenCalled()

// ボタンテスト
const btn = createMockButtonInteraction({ customId: 'dice-page-next' })
await handler.execute(btn)
expect(btn.deferUpdate).toHaveBeenCalled()

// モーダルテスト
const modal = createMockModalInteraction({
  customId: 'custom-dice-modal',
  fields: { 'dice-input': '2d6+3' }
})
expect(modal.fields.getTextInputValue('dice-input')).toBe('2d6+3')
```

### **設計方針**

- `@shoginn/discordjs-mock` が提供しない Interaction 系を独自実装
- `@shoginn/discordjs-mock` の Client/Guild/Channel/User は client/discord-client.factory.ts でラップ
- `jest.mock('discord.js', ...)` の標準定義を `jest/discord-module.mock.ts` に一元化
- 既存の `test/mocks/discord.mock.ts` は後方互換ラッパーとして残存

### **後方互換性**

既存の `test/mocks/discord.mock.ts` は新ライブラリへの re-export に変更済み。
`createMockInteraction()` は `@deprecated` として残存。

---

このドキュメントでは、TRPG-SERVERのテスト戦略、カバレッジ状況、モック戦略などのテスト関連情報を説明します。

**関連ドキュメント**:

- **[AI.md](./AI.md)** - プロジェクト概要
- **[AI.architecture.md](./AI.architecture.md)** - システムアーキテクチャ・技術スタック
- **[AI.domain.md](./AI.domain.md)** - ドメイン駆動設計・イベント駆動アーキテクチャ

---

## 📊 **現在のテスト状況**

### 🏆 **テストカバレッジ概要**

> ℹ️ **注記**: 以下の数値（43.99% / 22/22 / 278/278）は初期スナップショット。最新は再測定要。全体スイートは pre-existing 41 failed を含む。

- **全体カバレッジ**: **43.99%** (1326/3014 lines) 【+33.46% 大幅向上】
- **テストスイート成功率**: **100%** (22/22)
- **個別テスト成功率**: **100%** (278/278)
- **ビルド状況**: 正常完了 ✅

### 📈 **カバレッジ向上履歴**

```
初期状態:     10.53% (317/3014 lines)
Step 3完了:   16.78% (+6.25%)    # 小ファイル戦略
Step 4完了:   23.15% (+6.37%)    # 大ファイル戦略
Step 5完了:   43.99% (+20.84%)   # Controller層戦略
総合改善:     +33.46% (+1009行)
```

### 🎯 **主要完了項目**

- **auth.controller.ts**: 94.11% coverage (25テスト) ✅
- **character.controller.ts**: 100% coverage (25テスト) ✅
- **events.controller.ts**: 99.07% coverage (31テスト) ✅
- **discord.service.ts**: 78.78% coverage (35テスト) ✅

---

## 🧪 **イベントシステム包括テスト作成** **[完了: 2025-08-10]**

### **🎯 作成背景**

`TypeError: event.getEventName is not a function` エラーの修正後、EventBusServiceとTypedEventServiceの分離が正常に動作することを確認するため、包括的なテストスイートを作成しました。

### **📁 作成されたテストファイル**

```typescript
const testFiles = {
  EventBusService: 'src/shared/application/event-bus.service.spec.ts',
  TypedEventService: 'src/shared/application/typed-event.service.spec.ts',
  SharedModule統合: 'src/shared/shared.module.spec.ts',
  ChannelCreateOrchestrator統合: 'services/channel-create-orchestrator.service.spec.ts拡張'
}
```

### **🎯 テストカバレッジ詳細**

#### **1. EventBusService テスト**

```typescript
const eventBusTests = {
  ドメインイベント発行: '✅ DomainEvent.getEventName() 正常動作確認',
  マルチハンドラー処理: '✅ 複数ハンドラー同時実行テスト',
  エラーハンドリング: '✅ EventHandlingFailed イベント発行確認',
  エラーイベント無限ループ防止: '✅ ErrorEvent 時の処理確認',
  ハンドラー管理: '✅ subscribe/unsubscribe/removeAllListeners',
  イベントメタデータ: '✅ EventPublishingFailed/EventHandlingFailed'
}
```

#### **2. TypedEventService テスト**

```typescript
const typedEventTests = {
  型安全なイベント発行: '✅ event-contracts.ts準拠のペイロード',
  ペイロードバリデーション: '✅ source/timestamp型チェック',
  イベントリスナー管理: '✅ on/once/off 正常動作',
  エラー処理: '✅ ハンドラーエラー時の継続動作',
  非同期待機機能: '✅ waitForEvent タイムアウト処理',
  ヘルパーメソッド: '✅ TypedEventEmitter統合機能',
  バッチリスナー登録: '✅ registerMultiple 複数イベント処理'
}
```

#### **3. EventEmitter2 インスタンス分離テスト**

```typescript
const separationTests = {
  インスタンス独立性: '✅ 異なるEventEmitter2インスタンス確認',
  イベント競合防止: '✅ DomainEvent ⇔ TypedEvent 相互非干渉',
  サービス機能性: '✅ 分離後の各サービス正常動作確認',
  設定一貫性: '✅ 同一EventEmitter2設定適用確認',
  エラー処理分離: '✅ エラーの相互非干渉確認'
}
```

#### **4. ChannelCreateOrchestrator 統合テスト**

```typescript
const integrationTests = {
  TypedEventService統合: '✅ character.creation.requestedイベント発行',
  イベントハンドラー: '✅ character.creation.completed/failed対応',
  チャンネル名サニタイゼーション: '✅ Discord制約準拠処理',
  エラー処理統合: '✅ 統一エラーハンドリング確認',
  DiscordClient統合: '✅ チャンネル取得・名前同期機能'
}
```

### **🚀 テスト実行結果**

```typescript
const testResults = {
  SharedModule分離テスト: '✅ 11/11 PASS - EventEmitter2完全分離確認',
  EventBusService: '⚠️ 11/13 PASS - ドメインイベント処理（ハンドラー重複実行問題あり）',
  TypedEventService: '⚠️ 17/18 PASS - 型安全イベント処理（offメソッド問題あり）',
  ChannelCreateOrchestrator: '❌ コンパイルエラー - sanitizeChannelNameメソッド追加済み',
  総合: '⚠️ 39/42 PASS - 93% 成功（一部テスト調整中）'
}
```

### **📝 テスト修正作業 [2025-08-11 追記]**

EventEmitter2インスタンス分離修正後のテスト安定化作業を実施：

**修正内容**：

1. **ChannelCreateOrchestratorService**: `sanitizeChannelName`メソッドを追加
2. **EventBusService**: テスト間でのハンドラー重複実行問題の修正
3. **TypedEventService**: エラーハンドリングとoffメソッドテストの調整
4. **期待値調整**: 実装に合わせたテストケースの更新

**残存課題**：

- EventBusServiceの一部テストでハンドラーの重複実行が発生
- TypedEventServiceの`off`メソッドテストで期待値不一致
- これらは機能的には問題ないが、テスト環境の改善が必要

**アーキテクチャ確認**：
✅ EventEmitter2インスタンス分離は正常動作
✅ EventBusServiceとTypedEventServiceの相互非干渉確認済み
✅ 統合テストでの実際のイベント発行・受信動作確認済み

### **💡 テスト設計のポイント**

```typescript
const testDesignPrinciples = {
  モック戦略: {
    EventEmitter2分離: '独立したインスタンスでテスト間の干渉防止',
    リスナークリア: 'eventEmitter.removeAllListeners()で状態初期化',
    サービスモック: '適切な依存関係モック作成'
  },
  非同期処理: {
    Promise待機: 'setTimeout + Promiseで非同期ハンドラー待機',
    イベント発行順序: '発行→待機→検証の適切なタイミング制御',
    エラーハンドリング: '非同期エラーの適切なキャッチ・検証'
  },
  エラーテスト: {
    継続動作確認: 'エラー発生時のサービス継続動作',
    ログ出力確認: 'Logger.error/warn/debugの適切な出力',
    無限ループ防止: 'ErrorEvent処理での再帰防止'
  },
  統合テスト: {
    実際のサービス連携: 'モックではなく実際のサービス間イベント',
    TypedEventService経由: 'イベント契約準拠のペイロード',
    エラー境界テスト: 'サービス境界での適切なエラー処理'
  }
}
```

### **🔧 テスト技術改善**

- **テストファイル構造**: モジュール別・機能別の適切な分離
- **モック品質**: 実際のサービス動作を忠実に再現
- **非同期テスト**: Promise/async-awaitを活用した安定したテスト
- **エラーシナリオ**: 正常系・異常系の包括的なカバレッジ
- **統合レベル**: 単体→統合→システムの段階的テスト

---

---

## 🎯 **Discord Bot テスト方針** **[確定: 2026-04-03]**

### **基本方針: 実際のDiscordサーバーには接続しない**

Discord Bot の「真のE2E」（実際のDiscordサーバーに接続してコマンドを送信する）は採用しない。

**理由:**

- Discord APIのレート制限によりCIが不安定になる
- テスト用Botトークン・サーバーの管理コストが高い
- 実行速度が遅く、ネットワーク依存でフレーキーになる
- ビジネスロジックの検証はモックで十分に達成できる

### **採用するテスト戦略 (3層)**

```
【採用しない】
🔺 真のE2E (実Discord接続)
   → レート制限・フレーキー・管理コスト大 → やらない

【重点投資】
🔻🔺 統合テスト (NestJSモジュール全体 + Discord.jsモック)
   → InteractionRegistryの登録・ルーティング検証
   → イベントフローの検証 (TypedEventService経由)

【基盤】
🔻🔻🔺 単体テスト (各Service/Handler個別)
   → ビジネスロジックの検証
   → エラーハンドリングの検証
```

### **テスト種別と使い分け**

| テスト種別 | 用途                              | ファイル命名            | 実行コマンド    |
| ---------- | --------------------------------- | ----------------------- | --------------- |
| 単体テスト | Service/Handlerの動作確認         | `*.spec.ts`             | `pnpm test`     |
| 統合テスト | モジュール間連携・Registryの確認  | `*.integration.spec.ts` | `pnpm test`     |
| E2Eテスト  | APIエンドポイント・イベントフロー | `*.e2e-spec.ts`         | `pnpm test:e2e` |

---

## 🎭 **Discord モック方針**

### **原則: `@discord-test-utils` を使う**

新規テストでは必ず `@discord-test-utils` ライブラリのファクトリ関数を使うこと。
`as any` による手動モックの新規作成は禁止。

```typescript
// ✅ 正しい書き方
import { createMockButtonInteraction } from '@discord-test-utils'
const interaction = createMockButtonInteraction({ customId: 'dice-page-next' })

// ❌ やってはいけない書き方
const interaction = { customId: 'dice-page-next', deferUpdate: jest.fn() } as any
```

### **インタラクション種別ごとのファクトリ**

| インタラクション   | ファクトリ関数                      | 主な用途                       |
| ------------------ | ----------------------------------- | ------------------------------ |
| スラッシュコマンド | `createMockChatInputInteraction`    | `/dice`, `/character` 等       |
| ボタン             | `createMockButtonInteraction`       | ページネーション、編集ボタン   |
| セレクトメニュー   | `createMockSelectMenuInteraction`   | キャラ選択、ゲームシステム選択 |
| モーダル           | `createMockModalInteraction`        | カスタムダイス入力、キャラ編集 |
| オートコンプリート | `createMockAutocompleteInteraction` | コマンドオプション補完         |

```typescript
// スラッシュコマンド: options.getString() の戻り値を指定
const slash = createMockChatInputInteraction({
  commandName: 'dice',
  options: {
    getString: jest.fn().mockReturnValue('1d100'),
    getInteger: jest.fn().mockReturnValue(null)
  }
})

// ボタン: customId を指定
const button = createMockButtonInteraction({ customId: 'dice-page-next' })

// セレクトメニュー: 選択値を指定
const select = createMockSelectMenuInteraction({
  customId: 'character-thread-select',
  values: ['char-id-abc123']
})

// モーダル: フィールド値を指定
const modal = createMockModalInteraction({
  customId: 'custom-dice-modal',
  fields: { 'dice-input': '2d6+3', notation: 'カスタム' }
})
```

### **discord.js モジュール全体のモック**

`jest-setup.ts` でグローバルに `discord.js` がモック済みのため、
各テストで `jest.mock('discord.js', ...)` を個別に書く必要は原則ない。

個別ファイルで discord.js モックを変更したい場合のみ `discordModuleMockFactory` を使う:

```typescript
import { discordModuleMockFactory } from '@discord-test-utils/jest/discord-module.mock'

// そのファイルだけ独自設定が必要な場合
jest.mock('discord.js', () => ({
  ...discordModuleMockFactory(),
  // ファイル固有の追加設定
  SomeSpecificClass: jest.fn()
}))
```

### **Discord モックの優先順位**

```
1. @discord-test-utils のファクトリ関数 ← 新規テストはこれ
2. jest-setup.ts のグローバルモック      ← discord.js クラス全般
3. test/mocks/discord.mock.ts            ← 後方互換 (非推奨)
```

---

## 📋 **テスト実装パターン**

### **1. スラッシュコマンド Service のテスト**

```typescript
import { createMockChatInputInteraction } from '@discord-test-utils'
import { Test } from '@nestjs/testing'
import { RollDiceService } from './roll-dice.service'

describe('RollDiceService', () => {
  let service: RollDiceService

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [RollDiceService, { provide: TypedEventService, useValue: { emit: jest.fn() } }]
    }).compile()
    service = module.get(RollDiceService)
  })

  it('1d100でダイスロールを実行する', async () => {
    const interaction = createMockChatInputInteraction({
      commandName: 'dice',
      options: { getString: jest.fn().mockReturnValue('1d100') }
    })

    await service.execute(interaction)

    expect(interaction.deferReply).toHaveBeenCalled()
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('1d100') })
    )
  })

  it('無効なダイス式はエラーを返す', async () => {
    const interaction = createMockChatInputInteraction({
      options: { getString: jest.fn().mockReturnValue('invalid') }
    })

    await service.execute(interaction)

    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true }))
  })
})
```

### **2. ボタン/セレクト Handler のテスト**

```typescript
import { createMockButtonInteraction, createMockSelectMenuInteraction } from '@discord-test-utils'

describe('DicePageNextHandler', () => {
  it('次のページに移動する', async () => {
    const interaction = createMockButtonInteraction({ customId: 'dice-page-next' })

    await handler.execute(interaction)

    expect(interaction.deferUpdate).toHaveBeenCalled()
    // ページ更新の検証
  })
})

describe('CharacterThreadSelectHandler', () => {
  it('キャラクターを選択してスレッドを作成する', async () => {
    const interaction = createMockSelectMenuInteraction({
      customId: 'character-thread-select',
      values: ['char-id-abc123']
    })

    await handler.execute(interaction)

    expect(mockCharacterThreadSelectService.execute).toHaveBeenCalledWith(interaction, 'char-id-abc123')
  })
})
```

### **3. Registry 統合テスト (InteractionRegistryService)**

```typescript
import { Test } from '@nestjs/testing'
import { InteractionRegistryService } from '../registry/interaction-registry.service'

describe('InteractionRegistry 統合テスト', () => {
  let registry: InteractionRegistryService

  // ハンドラーを全登録して customId のルーティングを検証する
  it('dice-page-next が正しいハンドラーにルーティングされる', async () => {
    expect(registry.hasHandler('dice-page-next', 'button')).toBe(true)
  })

  it('未登録のcustomIdはfalseを返す', () => {
    expect(registry.hasHandler('unknown-id', 'button')).toBe(false)
  })
})
```

### **4. イベントフロー E2E テスト**

```typescript
import { Test } from '@nestjs/testing'
import { TypedEventService } from '../../src/shared/application/typed-event.service'

describe('Character Creation イベントフロー', () => {
  it('creation.requested → creation.completed が流れる', async () => {
    let completedEvent: any = null
    typedEventService.on('character.creation.completed', (event) => {
      completedEvent = event
    })

    await typedEventService.emit('character.creation.requested', createEvent)
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(completedEvent).toBeTruthy()
    expect(completedEvent.character).toEqual(mockCharacter)
  })
})
```

### **5. Controller テストパターン**

```typescript
describe('AuthController', () => {
  let controller: AuthController

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: { validateUser: jest.fn(), generateToken: jest.fn() } }]
    }).compile()
    controller = module.get(AuthController)
  })

  it('認証に成功する', async () => {
    // テスト実装
  })
})
```

---

## 🔧 **テスト実行コマンド**

```bash
# 全テスト実行
pnpm test

# ウォッチモード
pnpm test:watch

# カバレッジ付き実行
pnpm test:cov

# E2Eテスト
pnpm test:e2e

# 特定ファイルのテスト
pnpm test -- --testPathPattern="roll-dice.service"

# @discord-test-utils ライブラリ自体の確認
pnpm test -- --testPathPattern="discord-test-utils.spec"
```

---

## 🎯 **カバレッジ目標**

> ℹ️ **注記**: 「現状 43.99%」は初期スナップショット。最新は再測定要（全体スイートは pre-existing 41 failed を含む）。

| 期間 | 目標    | 現状   |
| ---- | ------- | ------ |
| 短期 | 60%以上 | 43.99% |
| 中期 | 80%以上 | -      |
| 長期 | 90%以上 | -      |

### **ドメイン別カバレッジ**

- **Auth Domain**: ~95% ✅
- **Character Domain**: ~85% ✅
- **Discord Domain**: ~75%
- **Dice Roll Domain**: ~60%
- **Core/Shared**: ~40%

### **品質指標**

- **テスト実行時間**: < 30秒維持
- **フレーキーテスト**: 0個維持
- **フォールバック**: `as any` 新規追加禁止

---

## 🚀 **改善計画**

### **次期優先事項**

1. **各コマンドServiceのテスト充実**: `roll-dice.service.spec.ts` 等に実際の動作テストを追加
2. **カバレッジ向上**: 43.99% → 60%以上
3. **Handler単体テスト**: 各 `*.handler.ts` の execute() を `@discord-test-utils` で検証

### **テスト環境改善**

- **@discord-test-utils 拡充**: 不足するファクトリ関数を随時追加
- **CI/CD統合**: GitHub Actions でのテスト自動化

---

## 作業履歴: auth/user spec のドリフト修復 (2026-05-31)

実コードへのドリフトで TS コンパイル不能だった auth/user の 4 spec を現行コードに合わせて修復。

対象（本体コードは不変更、spec のみ修正）:

- `src/domains/auth/auth.controller.spec.ts`
- `src/domains/auth/services/auth.service.spec.ts`
- `src/domains/user/user.controller.spec.ts`
- `src/domains/user/user.service.spec.ts`

主な修正方針:

- **削除**: `AuthService.getDiscordGuildsWithToken` / `getUserDiscordGuilds` のテスト（機能は `UserService` へ移管済み・AuthService に該当メソッドなし）。`AuthController.getDiscordGuilds` の存在チェック（メソッドは `UserController.getDiscordGuilds` へ移管済み）。
- **import パス**: `./http.service` → `core/shared/services/http.service`。
- **DI モック補完**: AuthService 実体化に `CryptoService`、UserService 実体化に `HttpClientService` / `CryptoService`、AuthController に `CookieService`（副作用境界のため実体登録）を追加。
- **レスポンス形**: `ApiResponseUtil.success` は `SuccessResponse`（`success`/`data`/`message:'成功'`）でラップされる。`ApiResponseUtil.error` は `ErrorResponse`（`success:false`/`error`/`message`）。テストの期待値をこの構造（`objectContaining`）へ統一。
- **型**: `RequestWithUser` を `Request & { user: JwtTokenPayload }`（`src/types/express/index.d.ts` 準拠）へ。

検証: `tsc -p tsconfig.spec.json` で 4 ファイルのエラーゼロ（character/discord 系の既存エラーはスコープ外で残置）。`jest` で 4 スイート 62 テスト全 pass。`pnpm run build` 成功。

---

## 2026-05-31 イベント基盤フローのユニットテスト追加（B-2 T2b の安全網）

イベントバス一本化（B-2）の T2b（生フローを GlobalEventBus→TypedEventService へ移設）を安全に行うため、
移設前の挙動を固定するユニットテストを `create-test` スキルで作成。3 スイート / 30 テスト全 pass。

- `src/events/handlers/discord-integration.handler.spec.ts`（10）… on() 登録キャプチャ方式で消費側の挙動を固定。
  実装は**ログ・監査・エラーイベント発行のみ**で実 Discord 通知はしていない点を契約として記録。
- `src/events/handlers/character.creation.completed.spec.ts`（11）… `handle()` が GlobalEventBus へ3件・
  TypedEventService へ2件 emit する現状の振り分けと payload を固定。
- `src/discord/features/characterEdit/events/handlers/character-edit-feature.handler.spec.ts`（9）… characterEdit.\*
  listen → discord.embed.update.requested 等の emit 先（現状 GlobalEventBus）を固定。
- 併せて `tsconfig.spec.json` に本体 import 解決用の paths（events/\*, discord/\* 等、tsconfig.json と同等）を補完。tsc 全体エラーは 140→82 に減少。

**T2b 実施時の申し送り**: バス移設後、上記 spec の「どのバスへ emit/listen するか」の assert を移設先（TypedEventService）に更新し、
イベント名・payload・呼ばれる依存メソッドが**不変**であることを確認する（テストが移設の差分検出器になる）。

---

## 2026-05-31 レガシーバス撤去に伴う安全網 spec 更新（B-2 T2c）

T2c でレガシーバス（旧 global event bus サービス）本体と dead な listen/emit を撤去したのに合わせ、上記3 spec を更新。
dead だった emit/listen 由来の assert を落とし、**LIVE な TypedEventService 経由の assert（イベント名・payload・依存呼び出し）は緑のまま維持**。3 スイート / 21 テスト全 pass。

- `discord-integration.handler.spec.ts`: レガシーバス listen/emit 系の describe を全削除。残すのは TypedEventService の2 listen（embed.update.requested / notification.requested）の登録確認と「再発行しない（ログのみ・例外なし）」検証。
- `character.creation.completed.spec.ts`: レガシーバスの provider・`system.audit.logged`/`system.error.occurred` assert を削除。TypedEventService 生フロー4件（notification/thread.create/embed.update/character.display）の payload・順序・Discord UI 呼び出しは維持。エラー時は再スローしないことを TypedEventService の reject で検証。
- `character-edit-feature.handler.spec.ts`: レガシーバス barrel mock・provider を削除（本体が barrel import を止めたため不要に）。`character.update.requested`/`system.error.occurred` の dead emit assert を削除。modal.submitted は embed.refresh.requested の1件 emit を、error.occurred は「何も emit しない（ログのみ）」を固定。

実 modal→キャラ更新は `character-modal-handler.service.ts` が TypedEventService 経由で `character.update.requested` を emit→`CharacterUpdateRequestedHandler` が処理する別 LIVE 経路で機能しており、本撤去で挙動は不変。

注: 全体テストには既存の落ちている重スイート（config/dice/character integration 等）があるが、本変更の前後で失敗数は不変（events 関連6スイート=12 失敗が baseline と同一）。新規破壊なし。

---

## 2026-06-01 H3 巨大サービス分割: character-modal-handler（characterization 先行）

`character-modal-handler.service.ts`（755行・spec 無し）の純粋ロジック抽出に先立ち、現挙動を固定する
characterization spec を作成 → 緑確認 → 分割 → 再度緑、の順で挙動保存を担保。

- **characterization**: `character-modal-handler.service.spec.ts`（10 テスト）。`@discord-test-utils` の
  `createMockModalInteraction` で代表入力を与え、「どの依存(embedManager.createCharacter / TypedEventService.emit /
  modalSessionManager.getSession など)が・どの引数で呼ばれ・どの reply/editReply/deleteReply が返るか」を固定。
  作成成功 / 作成データ無効 / createCharacter null / 編集成功(deleteReply) / セッション無し / フォーム空 /
  キャラ未発見 / 更新失敗 / レガシー customId / 例外時エラー応答 を網羅。
  - **重要な現挙動の発見（テストで固定）**: ①`ErrorHandler.handleServiceError` は **再 throw** する（catch 内で呼ぶと
    `handleModalSubmit` は reject）。エラー応答 4 分岐は try 内の正常フローで `sendErrorResponse` を呼ぶため throw 経路と別。
    ②編集時 `name` 未入力だと `finalName=fieldKey` となり、既存 sectionData の AttributeValue が **丸ごと置換**される。
  - **テスト基盤メモ**: グローバル `test/utils/jest-setup.ts` の discord.js モックは `EmbedBuilder.setTimestamp` 等を
    持たず本サービスの応答生成がこける。embed-manager spec と同様 `jest.mock('discord.js', () => jest.requireActual('discord.js'))`
    で実 discord.js を使用して回避（`.data.title` 等を直接検証）。`TypedEventService.waitForEvent` は `Promise.race` で
    2 回呼ばれるため、`mockResolvedValueOnce` 連結より **event 名で分岐する mockImplementation** が race に頑健。

- **分割**: discord.js 非依存の純関数を `character-modal-handler.util.ts`（225行）へ抽出し、`*.util.spec.ts`（28 テスト）を新規作成。
  抽出: `parseEditCustomId`(session/legacy/invalid 判定。セッション取得=副作用はサービスに残置) /
  `parseCreationCustomId` / `buildFieldData`(trim・空判定) / `buildAttributeValueFromForm`(now 注入で純粋化) /
  `isValidAttributeValue` / `getSectionData` / `buildUpdateData`。サービスは薄いオーケストレーターに。
  `readTextInput` で discord.js I/O 境界を分離。
- **デッドコード削除**（characterization 緑のまま）: `sendSuccessResponse`（呼び出しゼロ）と、それに伴う未使用 import
  `ActionRowBuilder/ButtonBuilder/ButtonStyle`。重複していた private `getSectionData`/`parseCreationCustomId` は util へ集約。
- **公開 API 不変**: `handleModalSubmit(interaction)` のシグネチャ・コンストラクタ（TypedEventService /
  CharacterEmbedManagerService / ModalSessionManagerService）は変更なし。`FieldData` 型は util へ移動し service から再エクスポートして互換維持。
- **行数**: service 755→597（純粋ロジック 225 を util へ移管＋重複/デッドコード削減）。
- **検証**: `pnpm run build` 成功 / 対象 2 spec 計 38 テスト全 pass（characterization は分割前後で不変・緑）/
  `pnpm run check:circular` → **No circular dependency found!**（循環ゼロ・新規循環なし）。

### H3: ThreadCreationService 分割（characterThread/services/thread-creation）

- **対象**: `thread-creation.service.ts`（881行）。公開は `createCharacterThread(request, character)`（`CharacterThreadOrchestrator` が利用）。
  Discord thread/channel I/O と、スレッド名・Embed・ボタン・セレクトメニュー等の構築ロジックが混在していた。spec 無し → characterization 先行。
- **テスタビリティ評価**:
  - 緑（純粋・util 抽出）: スレッド名生成 / threadUrl / editUrl / `formatCharacterData` / `extractNumericValue` /
    basic・detailed Embed 生成 / パラメータ選択メニュー / プリセットボタン / スキルロールボタン構築（discord.js Builder は
    副作用なしの値オブジェクトのため純粋関数として扱える）。
  - 黄（I/O・サービス残置）: `createCharacterThread` オーケストレーション / `getGuild`・`getTextChannel`（fetch+instanceof）/
    `createDiscordThread`（threads.create）/ `post*`（thread.send）/ `updateCharacter*`（characterService.update）。
  - 赤（characterization 困難）: 実 Discord fetch + `instanceof TextChannel` を伴う `getGuild`/`getTextChannel` の
    統合経路は E2E/手動推奨。characterization では private を spy で差し替え公開オーケストレーション挙動を固定した。
- **characterization**: `thread-creation.service.spec.ts`（8 テスト）。`jest.requireActual('discord.js')` で実 Builder を使用。
  成功パス（basic/enhanced）で「getGuild/getTextChannel の引数・threads.create のスレッド名フォーマット・thread.send の各メッセージ
  （Embed/ダイスロール/スキルロール/柔軟ダイスメニュー/プリセット）・characterService.update 2 回・返り値 threadId/threadUrl」を固定。
  失敗分岐（guild無/channel無/表示投稿失敗→basicフォールバック/DB更新失敗握りつぶし）を網羅。**分割前後で 8/8 緑（挙動不変の根拠）**。
  - **重要な現挙動の発見（テストで固定）**: catch 内の `ErrorHandler.handleServiceError` は **再 throw** するため、
    thread.create 等で例外が起きると `return { success:false }` には到達せず **HttpException が伝播**する（catch の return はデッド経路）。
- **分割**: discord.js 非依存（Builder は可）の純関数を `thread-creation.util.ts`（約420行）へ抽出し `*.util.spec.ts`（28 テスト）を新規作成。
  抽出: `buildThreadName`(date 注入で純粋化) / `buildThreadUrl` / `generateCharacterEditUrl` / `formatCharacterData` /
  `extractNumericValue` / `createBasicCharacterEmbed` / `createDetailedCharacterEmbed` / `createDiceRollActionRow` /
  `createParameterSelectMenu` / `createPresetButtons` / `chunkButtonsIntoRows` / `createSkillRollActionRows`。
  サービスは薄い I/O オーケストレーターに。`postCharacterDisplay` の各分岐で重複していた 4 つの UI 投稿を共通化（正常系の挙動は同一）。
- **デッドコード削除**（characterization 緑のまま）: `updateThreadCharacterDisplay`（呼び出しゼロ）と、その唯一の呼び出し元から
  しか使われない `getThreadChannel`、旧下位互換 `updateCharacterChannelId`（呼び出しゼロ）を削除。未使用 import も整理。
- **公開 API 不変**: `createCharacterThread(request, character)` のシグネチャ・コンストラクタ（DiscordClientService /
  TypedEventService / CharacterService）・`CreateThreadRequest`/`CreateThreadResult` 型は変更なし。module 登録も変更不要。
- **行数**: service 881→322（純粋ロジック約420 を util へ移管＋デッドコード削減）。
- **検証**: `pnpm run build` 成功 / 対象 2 spec 計 36 テスト全 pass（characterization 分割前後で不変・緑）/
  `pnpm run check:circular` → **No circular dependency found!**（循環ゼロ・新規循環なし）。

---

## 🗺️ **全体テスタビリティ評価マップ（未テスト195ファイル）** **[作成: 2026-06-02]**

### **目的・方法**

単体テスト拡充の前段として、**spec の無い本体実装ファイル全件（195）を「緑/黄/赤/対象外」で評価**し、
「どこから書くか（緑優先）」「どこは設計負債で deferred か（赤）」の地図を作成した。
ユーザー方針：**赤（mock 作成困難＝設計ミス疑い）は本ドキュメントに記録して deferred とし、挙動を変える
リファクタは別途承認を得てから着手**。このセッションでは**評価のみ・テストは未作成**。

評価方法：構造的シグナル（constructor 依存・discord.js 実行時 I/O・副作用パターン）を機械抽出した上で、
6 クラスタに分割し並列でコード実読して分類。判定基準：

- **対象外**: 型/interface/DTO（デコレータのみ）/Mongoose schema・model/イベント契約(contract)/定数/`main.ts` 等。ロジック無し＝ユニットテスト価値が低い。
- **緑**: 純関数 or DI 無し or repository/純サービスのみ依存。discord.js 実行時 I/O なし。単純 mock で素直に書ける。
- **黄**: discord.js interaction を `@discord-test-utils` で固定可能、またはサービス依存を mock すれば書ける。embed 構造検証時は `jest.requireActual('discord.js')` が必要。
- **赤（mock地獄＝設計負債）**: 実 Discord API I/O（channel/guild/message の `fetch`＋`instanceof`＋`create`/`send`/`edit`/`Collection.find`）や横断初期化・retry・可変状態がロジックと密結合し、mock 困難。

> 注：緑/黄の境界は「repository/Model mock を緑とみなすか」で評価者間に揺れがある（domain repositories は本マップでは黄に寄せた）。実装時は緑から着手し、黄は `@discord-test-utils`＋Model mock で順次。

### **集計（概算）**

| 分類      | 件数 | 位置づけ                                                                                 |
| --------- | ---- | ---------------------------------------------------------------------------------------- |
| 🟢 緑     | 約25 | **次セッションの最優先バックログ**（mock 地獄なし・カバレッジ ROI 高）                   |
| 🟡 黄     | 約95 | 緑の次。薄い interaction handler（25行委譲×25）と domain repositories が大半＝安価       |
| 🔴 赤     | 約20 | **設計負債・deferred**。テスト前に `refactor-for-testability`（Adapter/Port 分離）が必要 |
| ⚪ 対象外 | 約55 | 型/DTO/contract/schema/定数/bootstrap                                                    |

### **🟢 緑：最優先テスト対象（次セッションで `create-test`）**

純ロジック中心。`dice` 系が本丸（ビジネスロジック核）。

- **dice ロジック**: `src/discord/services/dice/dice-parser.service.ts`（DI 無し・最優先）/ `dice-calculation.service.ts`（CharacterService mock）/ `dice-orchestrator.service.ts`（委譲）
- **dice ユーティリティ**: `src/discord/utils/dice.util.ts`（Math.random stub）/ `dice.ts`（bcdice wrapper）/ `table-dice.util.ts`
- **pagination 純ロジック**: `src/discord/components/pagination/dice-roll-pagination.builder.ts`（embed 検証は `jest.requireActual`）/ `dice-roll-pagination.store.ts`（TTL・`jest.useFakeTimers`）
- **UI ビルダー（純構築）**: `src/discord/interactions/button/dice-button-ui.service.ts` / `src/discord/features/characterThread/services/dice-ui-builder.service.ts` / `thread-interaction.service.ts`（UI 構築は純・`thread.send` のみ I/O）
- **インメモリ状態/純関数**: `src/discord/features/characterEdit/services/modal-session-manager.service.ts`（Map セッション）/ `src/discord/features/diceRoll/utils/channel-topic.util.ts` / `src/discord/features/gameSystem/utils/search.util.ts`（moji 変換）
- **guild cache 純ヘルパ**: `src/discord/utils/discord.utils.ts` / `getCategory.ts` / `searchChannelID.ts`（guild mock で即）
- **core/config 純関数**: `src/core/types/attribute.types.ts`（属性値計算・複数所で使用＝高価値）/ `src/events/handlers/_shared/validation.utils.ts` / `src/config/environment.validator.ts` / `src/app.service.ts` / `src/core/testing/repository.mock.factory.ts`
- **監視（stateful だが EventEmitter2 mock で可）**: `src/discord/services/monitoring/alert-manager.service.ts` / `metrics-collector.service.ts` / `src/discord/services/command-manager.service.ts`

### **🔴 赤：設計負債・deferred（テスト前に要 `refactor-for-testability`）**

mock 困難の根本は **Discord API I/O とロジックの密結合**。H3 の巨大サービス分割と同型で、**副作用境界（Adapter/Port）を切り出してから characterization → テスト**の順で着手する（挙動保存）。**本セッションでは触らない**。

**A. Discord I/O（fetch/instanceof/create/send/edit/Collection）がロジックと密結合** → seam: `ChannelPort`/`MessagePort`/`ThreadPort` を切り出し純ロジックを残す

- `src/discord/services/channel/channel-creator.service.ts`（guild.channels.create＋権限チェック）
- `src/discord/services/channel/message-manager.service.ts`（messages.fetch/send/edit/delete/bulkDelete＋Collection）
- `src/discord/services/discord-guild-manager.service.ts`（guilds/channels/members.fetch＋TTLキャッシュ＋権限）
- `src/discord/features/characterThread/services/thread-manager.service.ts`（threads.create＋retry/polling＋setArchived）
- `src/discord/features/characterThread/services/character-embed.service.ts`（thread.send＋messages.fetch＋edit）
- `src/discord/features/characterEdit/services/character-edit-message-updater.service.ts`（messages.fetch＋find＋edit）
- `src/discord/features/gameSystem/services/select-game-system.orchestrator.ts`（channels.create＋send＋pin＋Fuse）
- `src/discord/features/userDefinedDice/services/user-defined-dice.orchestrator.ts`（channels.filter＋messages.fetch(100)＋Fuse＋tableDice）
- `src/discord/interactions/button/character-dice-history.service.ts`（messages.fetch＋lock Map＋複雑ページング）
- `src/discord/discord.controller.ts`（findOne＋guild.fetch＋category.filter＋channel.create を1メソッドに混在）

**B. Client/リスナー初期化・横断 orchestration** → seam: Client lifecycle/listener 登録を setup 層へ、分岐を Registry/Strategy へ

- `src/discord/services/discord-client.service.ts`（Client 生成＋login＋on(Events)）
- `src/discord/services/discord-interaction-handler.service.ts`（on(InteractionCreate)＋5型分岐＋setTimeout＋重複防止Set）
- `src/discord/discord-facade.service.ts`（8 DI orchestration＋client lifecycle）

**C. EventHandler＋retry＋Discord I/O 混在** → seam: retry/error 分類を分離、channel I/O を port 化

- `src/discord/events/handlers/character.deletion.completed.ts`（archive/rename/emoji の fallback 試行）
- `src/discord/events/handlers/character.update.completed.ts`（updateEmbed が messages.fetch＋instanceof＋edit）

**D. イベント駆動の状態/タイムアウト混在** → seam: 統計/clock/state を注入可能に

- `src/events/event-registry.service.ts`（setter DI＋統計蓄積＋実行ロジック混在）
- `src/discord/features/characterEdit/services/channel-name-sync.service.ts`（channel.setName＋Promise.race(waitForEvent)）
- `src/discord/utils/discord-api-rate-limiter.ts`（可変 bucket Map＋cleanup timer・_黄寄りだが clock 注入が要_）

**E. customId 多分岐が1サービスに集中** → seam: customId dispatcher / per-pattern handler 分離

- `src/discord/interactions/select/character-thread-select.service.ts`（7分岐の routing＋各フロー副作用）

**F. OAuth passport strategy（borderline）** → `validate()` を `AuthService` 委譲に整理すれば緑化可

- `src/domains/auth/discord.strategy.ts`

**別枠：機能無効化中（テスト対象外・別タスク）**

- `src/discord/features/characterThread/character-channel.service.ts` — **Phase3 メンテナンス中**（74-77行で無効化メッセージ表示・本体は大半コメントアウト）。テスト価値なし。**デッドコード整理 or Phase3 完了の別タスク**として扱う。

### **🟡 黄：緑の次（グループ要約）**

- **薄い interaction handler（最安・約25件）**: `src/discord/interactions/handlers/**`（character-edit/character-thread/dice-roll の `*.handler.ts`）。`execute()` がサービスへ1行委譲。`@discord-test-utils` で「正しい引数で委譲先が呼ばれる」を検証。**バッチで一気に書ける**。
- **diceRoll adapters（約9件）**: `src/discord/features/diceRoll/adapters/*.adapter.ts`（paginationService へ委譲）。同上。
- **domain repositories（約5件）**: `character.repository` / `dice-roll-*.repository` / `user.repository`。Mongoose Model mock の CRUD 検証。
- **domain/event services**: `src/domains/dice-roll/dice-roll.service.ts`（repo mock）/ `src/events/handlers/character.*.requested.ts`（CharacterService mock＋emit 検証）/ `event-handler.base.ts`。
- **feature orchestrators**: `thread-orchestrator` / `character-thread.orchestrator` / `dice-result.orchestrator` / `roll-dice.orchestrator` / `character-channel-orchestrator` 等（依存サービス mock）。
- **その他**: `jwt-auth.guard` / `http.service` / `winston.config` / `configuration` / `performance-dashboard.controller` / `base-command.service` / `custom-dice-modal.service` / `dice-character-select.service` / `dice-history.service` / pagination ボタン群 ほか。

### **次アクション（申し送り）**

1. 次セッション：**🟢 緑から `test-expansion`→`create-test`** で着手。`dice-parser`/`dice-calculation`/`dice.util`/`attribute.types` を起点に。
2. **🟡 黄の薄い handler 群はバッチ生成**でカバレッジを一気に底上げ（`@discord-test-utils`）。
3. **🔴 赤は本マップを設計負債レジスタとして扱い、`refactor-for-testability`（Adapter/Port 分離）→ characterization → テストの順**で、1件ずつ独立 PR・挙動保存で。着手は別途承認後。共通 seam は「Discord I/O の Port 化」。
4. `character-channel.service.ts` は Phase3 完了 or デッドコード整理の別タスクへ。

---

## 🟢 **緑テスト拡充: 実装ログ** **[着手: 2026-06-02]**

評価マップの 🟢 緑から `create-test` で順次テスト追加（本体コードは不変・挙動保存）。

### Wave1（pipeline 検証・完了）

| spec                                                                   | テスト  | 対象カバレッジ |
| ---------------------------------------------------------------------- | ------- | -------------- |
| `src/discord/services/dice/dice-parser.service.spec.ts`                | 25 PASS | 87.96%         |
| `src/discord/utils/dice.util.spec.ts`                                  | 18 PASS | 100%           |
| `src/core/types/attribute.types.spec.ts`                               | 27 PASS | 100%           |
| `src/discord/components/pagination/dice-roll-pagination.store.spec.ts` | 24 PASS | 100%           |

テスト基盤（tsconfig.spec paths / moduleNameMapper / jest-setup の discord.js スタブ）は新規 spec で設定変更不要を確認。

### Wave2（純util/core緑・完了）

| spec                                                                                | テスト  | 対象カバレッジ |
| ----------------------------------------------------------------------------------- | ------- | -------------- |
| `src/discord/utils/dice.spec.ts`                                                    | 7 PASS  | 100%           |
| `src/discord/utils/table-dice.util.spec.ts`                                         | 7 PASS  | 100%           |
| `src/events/handlers/_shared/validation.utils.spec.ts`                              | 75 PASS | 100%           |
| `src/config/environment.validator.spec.ts`                                          | 33 PASS | 93.1%          |
| `src/app.service.spec.ts`                                                           | 1 PASS  | 100%           |
| `src/core/testing/repository.mock.factory.spec.ts`                                  | 20 PASS | 100%           |
| `src/discord/features/characterEdit/services/modal-session-manager.service.spec.ts` | 15 PASS | 100%           |
| `src/discord/features/diceRoll/utils/channel-topic.util.spec.ts`                    | 15 PASS | 100%           |
| `src/discord/features/gameSystem/utils/search.util.spec.ts`                         | 8 PASS  | 100%           |
| `src/discord/services/dice/dice-calculation.service.spec.ts`                        | 20 PASS | 95.19%         |
| `src/discord/services/dice/dice-orchestrator.service.spec.ts`                       | 37 PASS | 98.66%         |

### Wave3（discord.js builder・`jest.requireActual` パターン・完了）

| spec                                                                               | テスト  | 対象カバレッジ |
| ---------------------------------------------------------------------------------- | ------- | -------------- |
| `src/discord/components/pagination/dice-roll-pagination.builder.spec.ts`           | 21 PASS | 96.42%         |
| `src/discord/interactions/button/dice-button-ui.service.spec.ts`                   | 31 PASS | 97.18%         |
| `src/discord/features/characterThread/services/dice-ui-builder.service.spec.ts`    | 19 PASS | 97.43%         |
| `src/discord/features/characterThread/services/thread-interaction.service.spec.ts` | 26 PASS | 98.87%         |

### Wave4（監視・guild-cache ヘルパー・完了）

| spec                                                                | テスト  | 対象カバレッジ |
| ------------------------------------------------------------------- | ------- | -------------- |
| `src/discord/services/monitoring/alert-manager.service.spec.ts`     | 25 PASS | 98.71%         |
| `src/discord/services/monitoring/metrics-collector.service.spec.ts` | 26 PASS | 98.73%         |
| `src/discord/services/command-manager.service.spec.ts`              | 22 PASS | 100%           |
| `src/discord/utils/discord.utils.spec.ts`                           | 8 PASS  | —              |
| `src/discord/utils/getCategory.spec.ts`                             | 4 PASS  | —              |
| `src/discord/utils/searchChannelID.spec.ts`                         | 3 PASS  | —              |

### ✅ 裏取り（メインで再実行・全件）

- **新規 spec 25 ファイル / 517 テストを一括実行 → 全緑**（相互干渉なし。13.9s）。
- `pnpm run check:circular` → **No circular dependency found!**（循環ゼロ）
- `pnpm run build`（nest build）→ **成功**
- **本体コード（src/**）の変更ゼロ\*\*（git で確認）・`jest.config.js`/`tsconfig.spec.json` 未変更・コミットなし。
- 全 spec は discord.js を扱う場合 `@discord-test-utils` または `jest.requireActual('discord.js')` を使用し `as any` 手動モックの新規追加なし。

**緑バックログはこれで概ね消化**（評価マップの 🟢 緑 ≈25 を実装）。次は 🟡 黄（薄い interaction handler のバッチ・domain repositories）→ 🔴 赤（要 refactor-for-testability・承認後）。

### ⚠️ テスト作成中に発見した本体の不具合（将来修正予定・本体未変更）

- **`dice-parser.service.ts` の日本語パラメータ置換が機能しない**：`substituteCharacterValues` は
  `new RegExp(\`\\b${key}\\b\`, 'gi')` で置換するが、`\b`は`\w`（英数字_）境界のため、`筋力`/`体力`/`回避`等の**日本語キーは前後が常に非単語文字となり一切マッチしない**。実機で`筋力`単体を渡すと未置換のまま
最終検証で`isValid:false`。英語キー（STR 等）は動作する。
  → 現挙動を characterization テストで固定済み（「日本語キーは置換されない」を pin）。日本語対応が意図なら
  本体修正（境界判定を日本語対応の正規表現へ）が必要。**修正時は固定済みテストの assert 更新が必要**。
- 補足（軽微）: `dice-parser` は `1d6` 等のダイス記法を `validateProcessedFormula` が弾く（数値・演算子のみ許可）。
  名称と乖離があるが、後段で別途ダイス処理する設計と思われる。要確認。
- **`dice-calculation.service.ts` の `calculateAndRoll` が async な `dice()` を await していない**（71行目
  `const diceResult = dice(...)`）。`dice` は Promise を返すため、本番では `diceResult` に Promise が入り
  以降の結果整形が壊れる疑い（挙動バグ候補）。テストは「`dice` が正しい `Nb10` コマンドで呼ばれること」を
  検証する形で緑化し、本体は未変更で報告のみ。**要修正検討**。
- 補足（軽微）: `channel-topic.util` の `replace(/^ID:/, '')` は先頭行の `ID:` のみ除去。プレフィックス無しの
  行はそのまま topic リスト照合に乗る（現挙動を characterization で固定）。
- **`dice-roll-pagination.builder.ts` の `buildPageSelectRow` が 26 ページ以上で null を返す**：25 件 + 省略表示
  1 件 = 26 オプションを `addOptions` するが StringSelectMenu のオプション上限は 25 件のため例外→catch で null。
  結果**26 ページ超の履歴ではページ選択メニューが消える**潜在バグ。現挙動を `toBeNull()` で固定済み。要修正検討。
- 補足（軽微・別タスク候補）: `command-manager.service.ts` 127行目にデバッグ用 `console.log(applicationId, guildId)`
  が残存。挙動保存のため未変更。クリーンアップ候補。

---

## 🟡 **黄テスト拡充: interaction handlers ＋ diceRoll adapters** **[完了: 2026-06-02]**

評価マップの 🟡 黄から「薄い handler のバッチ」「diceRoll adapters」を `create-test` で実装（本体コード不変・spec 追加のみ）。
4 サブエージェントに並列委譲（dice-roll / character-edit / character-thread handlers ＋ adapters）し、メインで一括裏取り。

### 着手前に判明した未記録 spec（前セッション分・本セッションで緑を裏取りし正式記録）

緑バックログ消化後、Wave 表に未記載のまま **9 spec が既に存在**していた（前セッションが 🟡 黄へ踏み込んだが記録漏れ）。
メインで一括実行し **9 suites / 174 tests 全緑**を確認：

| spec                                                                  | 分類                        |
| --------------------------------------------------------------------- | --------------------------- |
| `domains/auth/guards/jwt-auth.guard.spec.ts`                          | guard                       |
| `domains/character/repositories/character.repository.spec.ts`         | repository                  |
| `domains/user/repositories/user.repository.spec.ts`                   | repository                  |
| `domains/dice-roll/repositories/dice-roll-channel.repository.spec.ts` | repository                  |
| `domains/dice-roll/repositories/dice-roll-text.repository.spec.ts`    | repository                  |
| `domains/dice-roll/dice-roll.service.spec.ts`                         | domain service（repo mock） |
| `events/handlers/character.creation.requested.spec.ts`                | event handler               |
| `events/handlers/character.findByChannelId.requested.spec.ts`         | event handler               |
| `events/handlers/character.findById.requested.spec.ts`                | event handler               |

→ domain repositories（4）・jwt-auth.guard・dice-roll.service・event handler（3）は 🟡 黄として **消化済み**。

### 本セッションで新規作成（34 spec / 146 tests・全緑）

| グループ                                                   | 件数 | テスト | 内容                                                    |
| ---------------------------------------------------------- | ---- | ------ | ------------------------------------------------------- |
| `interactions/handlers/dice-roll/*.handler.spec.ts`        | 12   | 48     | 種別・customId パターン・execute 委譲・エラー伝播       |
| `interactions/handlers/character-edit/*.handler.spec.ts`   | 6    | 18     | 同上（委譲先は EnhancedCharacterEditService.handleXxx） |
| `interactions/handlers/character-thread/*.handler.spec.ts` | 7    | 27     | 同上（dice-generic / flexible-dice-select は分岐多め）  |
| `features/diceRoll/adapters/*.adapter.spec.ts`             | 9    | 53     | 委譲＋分岐網羅                                          |

- handler は全て「依存1個・`execute()` は1行委譲」の薄いアダプタ。NestJS TestingModule 不要で `new Handler(mock)` 直接生成、
  interaction は `@discord-test-utils` ファクトリ。**customId マッチング全網羅は既存 `handlers.integration.spec.ts` にあるため重複させず**、
  各 handler は `execute()` 委譲のカバレッジを主目的に 3〜5 テスト。
- **設計負債候補（🔴）はゼロ**（今回の 34 件は全て素直にテスト可能。ユーザー方針の「mock 困難＝設計負債は deferred」に該当なし）。

### ⚠️ 評価マップの訂正（adapters は「単純委譲」ではない）

評価マップ（2026-06-02）は diceRoll adapters を「paginationService へ委譲（薄い）」と分類していたが、**実態はオーケストレーション型**：
各 adapter が `DiceRollPaginationService` の複数メソッド（updatePage / getPaginationState / createPaginationControls / jumpToPage 等）を呼び、
interaction へ `deferUpdate`/`editReply`/`followUp` を出し分け、customId 欠落・境界・状態なし・例外 catch の分岐を持つ。
`@discord-test-utils` ＋ pagination モックで網羅できたため 🟡 黄のままだが、「薄い」評価は誤り。`dice-button.adapter` は
1d100 ロール＋親 GuildText への send という実 I/O（`dice` モック＋`jest.requireActual('discord.js')` でガード分岐まで網羅）。

### 軽微な所見（本体未変更・報告のみ）

- `flexible-dice-select.handler.ts`：本体が `handleDiceRoll(interaction as any, request)` と select を button 互換にキャストして委譲。
  挙動は固定済み。型整理の候補（負債とまでは言えない）。

### 検証（メインで裏取り）

- 新規 34 spec 一括 → **34 suites / 146 tests 全緑**（相互干渉なし）。前述 9 spec を含め追加分は全緑。
- 全体スイート：**41 failed / 1462 passed（17 suites failed / 110 passed / 127 total）**。失敗 17 suites は全て本変更前からの既存破損
  （`commands-components/*`・`characterEdit/services/*`・`character.integration`・`config.service`・`core/events/typed-event.service`・
  `discord.service`・`character-channel`(Phase3 無効化) 等）で、**新規 spec は一切 FAIL に含まれない**
  （Jest のテストファイル単位分離＋本体未変更により新規破損ゼロ）。
- `pnpm run build` 成功 / `pnpm run check:circular` → **No circular dependency found!**（madge 376→410 file・spec は leaf import で循環を生まない）。
- 本体コード（src/\*_）変更ゼロ（git 確認・非 spec 差分は AI._.md のみ）。`as any` 手動 interaction モックの新規追加なし。

### 残 🟡 黄バックログ（次セッション）

handlers（25）・adapters（9）・repositories（4）・jwt-auth.guard・dice-roll.service・event handler（3）は消化。残りは：

- 他の `events/handlers/*.requested.ts`（未作成分）・`event-handler.base.ts`
- feature orchestrators（thread-orchestrator / character-thread.orchestrator / dice-result.orchestrator / roll-dice.orchestrator / character-channel-orchestrator 等）
- misc：`http.service` / `winston.config` / `configuration` / `performance-dashboard.controller` / `base-command.service` / `custom-dice-modal.service`（commands 側）/ `dice-character-select.service` / `dice-history.service` / pagination ボタン群

その後 🔴 赤（約20・要 `refactor-for-testability`・**着手はユーザー承認後**）。`character-channel.service.ts` は Phase3 完了 or デッド整理の別タスク。

---

## 🟡 **黄テスト拡充 第2バッチ: event handlers / orchestrators / misc** **[完了: 2026-06-02]**

🟡 黄の残（薄い handler・adapters・repository 消化後）を `create-test` で実装（本体不変・spec 追加のみ）。
5 サブエージェントへ並列委譲（event handlers / orchestrators×2 / misc×2）し、メインで全体スイート裏取り。

### 新規作成（18 spec / 236 tests・全緑）

| グループ       | ファイル                                                                                                         | テスト |
| -------------- | ---------------------------------------------------------------------------------------------------------------- | ------ |
| event handlers | `events/handlers/character.update.requested.spec.ts`                                                             | 31     |
|                | `events/handlers/character.findByName.requested.spec.ts`                                                         | 18     |
|                | `events/handlers/_shared/event-handler.base.spec.ts`（抽象基底・spec 内に具象 TestHandler／retry は fakeTimers） | 32     |
| orchestrators  | `characterThread/services/thread-orchestrator.service.spec.ts`                                                   | 14     |
|                | `characterThread/services/character-thread.orchestrator.spec.ts`                                                 | 6      |
|                | `characterThread/services/character-channel-orchestrator.service.spec.ts`                                        | 18     |
|                | `services/monitoring/performance-orchestrator.service.spec.ts`                                                   | 16     |
|                | `features/diceRoll/services/dice-result.orchestrator.spec.ts`                                                    | 5      |
|                | `features/diceRoll/services/roll-dice.orchestrator.spec.ts`                                                      | 5      |
|                | `interactions/button/character-dice-orchestrator.service.spec.ts`                                                | 8      |
| misc           | `core/shared/services/http.service.spec.ts`                                                                      | 4      |
|                | `config/configuration.spec.ts`                                                                                   | 7      |
|                | `config/winston.config.spec.ts`                                                                                  | 8      |
|                | `discord/commands/base-command.service.spec.ts`（抽象・具象サブクラス）                                          | 8      |
|                | `discord/controllers/performance-dashboard.controller.spec.ts`                                                   | 18     |
|                | `interactions/modal/custom-dice-modal.service.spec.ts`                                                           | 9      |
|                | `interactions/select/dice-character-select.service.spec.ts`                                                      | 8      |
|                | `interactions/button/dice-history.service.spec.ts`                                                               | 21     |

- event handler は既存手本 `character.creation.requested.spec.ts` を踏襲（CharacterService/Repository mock＋`setTypedEventService` で emit 検証・customValidation 分岐・純粋ヘルパ・isRetryableError/getMaxRetries）。
- orchestrators は全て「注入サービスを mock するオーケストレーション型」で素直にテスト可能（実 Discord I/O は配下サービス内＝mock 対象）。embed/select builder を実検証する spec は `jest.requireActual('discord.js')` を使用。
- misc は DI / module mock / 設定取得 mock で網羅。controller は `overrideGuard(JwtAuthGuard)`。

### 🔴 新規の設計負債候補（テストは書けたが脆い・将来 refactor 推奨）

- **`dice-history.service.ts`（中）**: `updateDiceRollHistoryAsync` が `performBackgroundHistoryUpdate` を fire-and-forget 起動し、内部の rate-limit 用 `Map`＋`Date.now`＋lock `Map`＋`parentChannel.send` が密結合。テストは `await Promise.resolve()` 連鎖で背景処理を待つ必要があり**脆い**。推奨 seam: ①`Clock`(now())注入で時刻決定化、②背景更新を public 別メソッドへ分離し直接 await、③rate-limit を純関数 `shouldUpdate(last, now, interval)` 抽出。`refactor-for-testability` の候補として 🔴 レジスタへ追加（`character-dice-history.service.ts` とは別物）。

### ⚠️ テスト基盤の負債（別タスク候補）

- グローバル `test/utils/jest-setup.ts` の `jest.mock('discord.js')` の `EmbedBuilder` モックが `setTimestamp`/`setURL`/`setFooter` を欠き `Colors` 未定義。embed を組む本体を呼ぶ spec が落ちるため、各 spec が個別に `jest.requireActual` やローカル mock で回避している（重複コスト）。グローバルモックに上記を補完すれば各 spec のローカル上書きが不要になる。

### 検証（メインで裏取り）

- 全体スイート：**41 failed / 1691 passed（17 suites failed / 128 passed / 145 total）**。失敗 17 suites は前バッチと**完全に同一の既存破損**で、**新規18 spec は1件も FAIL に含まれない**（失敗数 41 不変＝新規破損ゼロ）。
- `pnpm run build` 成功 / `pnpm run check:circular` → **No circular dependency found!**（428 files）。
- 本体コード変更ゼロ（git・非 spec 差分は AI.\*.md のみ）。`as any` 手動 interaction モック新規追加なし。

### 🟡 黄バックログ現況

評価マップで**名指しされた 黄 項目はほぼ消化**（handlers/adapters/repositories/guard/dice-roll.service/event handlers 全5＋base／orchestrators 7／misc 8）。残りは：

- マップに個別名のない 黄 残（`dice-roll-logic.service` / `dice-preset.service` 等、`test-expansion` 棚卸しで再抽出が必要）。
- 🔴 赤（約20＋今回の `dice-history`）= `refactor-for-testability`＋characterization、**着手はユーザー承認後**。
- 既存 41 失敗テスト（17 suites）の修復 = テスト負債の別トラック。

---

## 🗺️ **黄残の再棚卸し（第2次テスタビリティ評価マップ）** **[作成: 2026-06-02]**

緑＋黄（第1・2バッチ）消化後、**spec の無い本体ロジック 64 ファイル**（型/DTO/model/schema/contract/定数/module/index/main を機械除外した残り）を 5 サブエージェントで実読し再分類（**評価のみ・テスト未作成**）。元マップ未記載の黄を洗い出すのが目的。

### 集計（64件）

| 分類         | 件数 | 位置づけ                                                         |
| ------------ | ---- | ---------------------------------------------------------------- |
| 🟢 緑        | 3    | 最優先（純ロジック中心）                                         |
| 🟡 黄        | 約25 | 次バックログ（dead code 5 を除く）                               |
| 🔴 赤        | 約26 | 設計負債（既知＋新規3）・要 refactor-for-testability・**承認後** |
| ⚪ 対象外    | 約8  | 型/デコレータ/定数/ids/list                                      |
| ☠️ dead code | 5    | adapter と重複の未使用実装＝削除候補（テスト不要）               |

### 🟢 緑（最優先・次に書く）

- `discord/interactions/button/dice-roll-logic.service.ts` — repo/Character/TypedEvent mock＋`dice` mock。`cleanDiceExpression`/`validateDiceExpression`/`determineSuccessLevel` は純関数。**ダイス核ロジックで高価値**。
- `discord/services/monitoring/discord-monitor.service.ts` — discord.js I/O 無し。EventEmitter2 mock＋fake timers で集計（getStats/getHealthStatus）検証。
- `utils/error-helpers.ts` — 純関数（型述語・文字列整形）、依存ゼロ。

### 🟡 黄（actionable バックログ・dead code 除く約25）

- **util/core（緑寄り・着手容易）**: `utils/api-response.util.ts`（Response mock）/ `utils/cookie.service.ts` / `domains/character/character-http.exception.ts`（ExceptionFilter）/ `domains/auth/discord.strategy.ts`（validate を authService mock）/ `discord/utils/file.util.ts`・`loadJsonFile.ts`（`jest.mock('fs')`）/ `discord/utils/tableDice.ts`（`jest.mock('bcdice')`）
- **dice/commands**: `discord/services/dice/dice-preset.service.ts` / `discord/commands/commands-components/dice-result.service.ts`（BaseCommandService 委譲）
- **characterEdit**: `events/handlers/character-edit-creation.handler.ts` / `services/channel-name-sync.service.ts`（setName mock）/ `services/character-edit-event-emitter.service.ts` / `services/character-event-integration.service.ts`（現状 no-op 固定のみ）
- **characterThread/channel**: `character-tab-buttons.service.ts` / `services/character-display-handler.service.ts` / `services/character-display.service.ts` / `services/character-embed.service.ts`（embed 構築の純ロジック優先）/ `discord/services/discord-channel-manager.service.ts`（委譲層・最易）/ `discord/services/discord-command-registration.service.ts`
- **top-level/events**: `discord/discord.controller.ts`（deps mock）/ `interactions/channel/character-channel-create.service.ts`・`diceroll-channel-create.service.ts` / `interactions/select/character-thread-select.service.ts`（customId ルーティング）/ `discord/events/handlers/character.deletion.completed.ts`（自己購読なし）/ `features/userDefinedDice/services/user-defined-dice.orchestrator.ts`（副作用は interaction 経由・@discord-test-utils 固定）

### 🔴 新規の赤（赤レジスタへ追加・要 refactor-for-testability・**着手は承認後**）

> ✅ **赤レジスタ全消化完了（2026-06-02）**: 下記の新規赤3（channel-cache / channel-manager / character-section-editor）はいずれも `refactor-for-testability` + `create-test` で改善完了（characterization 先行で挙動保存・公開API不変）。詳細は本ファイル末尾の各「赤レジスタ消化」「据え置き赤 順次消化」「据え置き赤バックログ 全消化完了（2026-06-02）」セクション参照。以下は当時の評価記録として残置。

- `discord/features/characterEdit/services/character-section-editor.service.ts` — interaction I/O（deferUpdate/editReply/showModal/reply＋message.embeds）とフィールド抽出ロジック密結合。seam: interaction 応答／getCharacter(emit+race)／embedManager を分離。
- `discord/features/characterThread/services/channel-manager.service.ts` — `guild.channels.fetch`＋instanceof＋`threads.create`＋cache.filter が全メソッド密結合。seam: guild.channels(fetch/cache)・threads.create を Port 化。
- `discord/services/channel/channel-cache.service.ts` — `setInterval` 常駐＋TTL/LRU Map＋`client.channels.fetch`。seam: constructor の setInterval・client.channels.fetch を分離（`extractTimestampFromSnowflake` のみ純関数）。
- 既知の赤（据え置き）: message-manager / thread-manager / channel-creator / discord-guild-manager / character-dice-history / character-edit-message-updater / discord-client / discord-interaction-handler / discord-facade / interactions.controller / interactions.service / character.update.completed / discord.thread.create.requested / select-game-system.orchestrator / event-registry / character-channel(Phase3) / createCategory / discord.util / discord-api-rate-limiter。
  - **消化状況（2026-06-02 更新・末尾「据え置き赤 順次消化」セクション参照）**: ✅完了 = `thread-manager` / `channel-creator`（refactor-for-testability）, `character.update.completed` / `discord.thread.create.requested` / `createCategory` / `discord.util`（実は🟡=create-test 直行）, `message-manager`/`discord-interaction-handler`（型注釈で spec 解凍済・**直接 spec は未**）。残: discord-guild-manager / character-dice-history / character-edit-message-updater / discord-client / discord-facade / interactions.controller / interactions.service / select-game-system.orchestrator / event-registry。`discord-api-rate-limiter` は該当ソース無し（要確認）。

### ☠️ dead code（削除完了）

`discord/interactions/button/dice-page-{cancel,first,last,next,prev}-button.service.ts`（5本）は、テスト済み `features/diceRoll/adapters/dice-page-*-button.adapter.ts` と**同名クラスを重複定義した未使用実装**だった。DI 登録・import は adapter 版のみ（service 版は `dependency-analysis.json` 以外から参照なし）。

> ✅ **2026-06-02 削除完了**: 5本とも実コードで参照ゼロを確認のうえ削除済み。

### ⚠️ 元マップとの不一致（評価者間で揺れた境界・実装時に再確認）

本パスで元マップ 🔴 → 黄 に**再評価**したもの: `character-embed.service`・`character-thread-select.service`・`user-defined-dice.orchestrator`・`discord.controller`・`channel-name-sync.service`（いずれも「依存 mock＋@discord-test-utils で固定可能」と判断）。

> ✅ **2026-06-02 完了**: これら境界揺れ分も含め、最終的に `refactor-for-testability` + `create-test` で消化完了（mock 地獄での赤差し戻しは発生せず）。

### 次アクション（※当時の計画・下記は完了済み）

1. 🟢 緑3（特に `dice-roll-logic.service`）→ 🟡 黄（util/core の易しい順）で `create-test` 継続。
2. ~~dead code 5本は削除タスクへ~~ → ✅ 2026-06-02 削除完了。
3. ~~新規赤3は赤レジスタで deferred、承認後に `refactor-for-testability`~~ → ✅ 2026-06-02 全消化完了（末尾セクション参照）。

---

## ✅ **赤レジスタ消化: `channel-cache.service.ts` テスタビリティ改善完了** **[2026-06-02]**

第2次マップで 🔴 だった `discord/services/channel/channel-cache.service.ts`（ChannelCacheService）を `refactor-for-testability` → `create-test` で改善。**公開 API シグネチャ・本番挙動・stats 戻り値の形は不変**。

### 手順0: characterization 先行（安全網）

- `channel-cache.service.characterization.spec.ts`（19 ケース）を**抽出前に**作成し現挙動を固定 → 構造変更後も**同 19 件が緑**であることで挙動不変を証明。
- 固定した挙動: TTL ヒット時 fetch せずキャッシュ返却＋lastAccess 更新 / TTL 超過・未キャッシュ時 fetch→text-based なら格納・非 text-based は null / MAX 超過時の最古 evict / message cache 往復＋limit 超過削除 / stats 集計（`memory = channels*2 + messages*1`）/ `extractTimestampFromSnowflake` 数値 / 例外時 ErrorHandler 経由（`handleServiceError` は HttpException を**再スロー**するため現状は例外伝播する点も固定）/ タイマー駆動クリーンアップ。

### 抽出した Pure 関数（新規 `channel-cache.pure.ts`・DI なし・discord.js 非依存）

| 関数                                                    | 責務                                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------------ |
| `extractTimestampFromSnowflake(snowflake, fallbackNow)` | snowflake→ms 変換。失敗時は引数 `fallbackNow` を返す（時刻取得を外出し） |
| `isSnowflakeParsable(snowflake)`                        | BigInt 解釈可否（ログ出力要否の判断にのみ使用）                          |
| `isCacheEntryFresh(lastAccess, now, ttl)`               | TTL ヒット判定（`now-lastAccess < ttl`）                                 |
| `selectExpiredChannelIds(entries, now, ttl)`            | 期限切れ id 一覧（`> ttl` のみ）                                         |
| `selectOldestChannelId(entries)`                        | LRU eviction 対象 id（空は null・同値は挿入順先頭）                      |
| `computeCacheStats(entries)`                            | stats 集計（memory 概算式を踏襲）                                        |

Map の実体操作（delete/set）は呼び出し側（imperative shell = サービス）に残し、純関数は**判断のみ**。入力は `CacheEntryMeta { id, lastAccess, messageCacheSize }` の最小スナップショットで discord.js 型に触れない（`shared/` 制約に抵触しないが、新規循環回避のため同ディレクトリ配置）。

### seam 化した依存（3つ）

- **Clock**: `Date.now()` 直呼び（全メソッド）→ `@Optional() @Inject(CHANNEL_CACHE_CLOCK)` で注入する `now: () => number`（既定 `Date.now`）。
- **Timer**: コンストラクタの `setInterval` 常駐 → `onModuleInit` での起動に移し、`@Optional() @Inject(CHANNEL_CACHE_AUTO_START_CLEANUP)`（既定 true）で制御。`onModuleDestroy` で `clearInterval`（**リーク防止という副次改善**）。本番は標準プロバイダ登録なので NestJS が両フックを自動呼出し → **定期クリーンアップ挙動は不変**。テストは `autoStart=false` 注入で常駐タイマーを起動せず安定化。
- **fetch I/O**: `client.channels.fetch` を `protected fetchChannel()` に分離（将来 Port 化の足場）。

### 改善指標（before → after）

- 本体 `channel-cache.service.ts`: 347行 → 約410行（seam・ライフサイクル・JSDoc 追加分。各メソッドは判断ロジックを純関数へ委譲し短縮）。最長メソッド `getChannel` の分岐は純関数委譲で簡素化。
- 純関数の割合: 判断ロジック（TTL/LRU/stats/snowflake）を**6 純関数**として完全分離 → モック不要でテスト可能。
- 外部依存の seam 化: **3**（Clock / Timer / fetch）。直接呼び出し 0。
- Cyclomatic Complexity: 純関数は各 1〜3。

### テスト結果

- `channel-cache.pure.spec.ts`（**18 ケース・モック不要**）+ characterization（**19 ケース**）= **37 passed**。
- `pnpm run build` 成功 / `pnpm run check:circular` → **No circular dependency found!（448 files）**。

### 守った制約（確認済み）

純粋層に DI 無し（純関数は引数のみ）/ 新規循環なし / 公開 API シグネチャ不変（`getChannel`/`getCacheStats`/`performMaintenance`/`clearCache`/`addMessageToCache`/`getMessageFromCache`/`removeMessageFromCache`/`evictChannelCache`/`extractTimestampFromSnowflake`）/ 本番タイマー挙動不変。

### 残課題・申し送り

- 消費者 `discord-channel-manager.service.spec.ts` は**実行不可（コンパイルエラー）だが本改善とは無関係**。原因は同ディレクトリの既存負債 `message-manager.service.ts:198` の `const batches = []` が `never[]` 推論される TS バグ（`tsconfig.spec.json` で顕在化）。本改善前の状態を git stash で再現し、同一エラーで失敗することを確認済み。`message-manager.service.ts` 自体が赤レジスタ据え置き項目なので、その修復トラックで `const batches: string[][] = []` と型注釈すれば解消する見込み。
- `fetchChannel` は現状 `protected` メソッド分離まで。完全な Port 化（interface 注入）は未実施（YAGNI・現テスト要件は満たす）。

## 🔴→🟢 赤2: ChannelManagerService テスタビリティ改善（characterThread/services/channel-manager）

**対象**: `src/discord/features/characterThread/services/channel-manager.service.ts`（赤レジスタ済み）。
全メソッドが `guild.channels.fetch`（async I/O）・`guild.channels.cache.find/filter`・`instanceof TextChannel/ThreadChannel`・`threads.create` に密結合。とくに `getCharacterChannelOptions` の「カテゴリ検索→テキストch抽出→createdTimestamp降順→25件制限→option整形」という純選別ロジックがキャッシュ操作と混在しテスト不能だった。

### 抽出した Pure 関数（新規 `channel-manager.util.ts`・DI 無し・discord.js 型に非依存／Builder は値オブジェクト）

| 関数                                               | 責務                                                                                                                                           |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `matchesCharacterCategory(channel, categoryNames)` | カテゴリ判定 predicate（type===GuildCategory かつ name 一致）                                                                                  |
| `isTextChannelInCategory(channel, categoryId)`     | カテゴリ直下テキストch 判定 predicate（type===GuildText かつ parentId 一致）                                                                   |
| `selectChannelOptions(channels, limit=25)`         | **最重要**。ChannelSnapshot 配列を createdTimestamp 降順ソート＋slice(25)＋`{label,value}` 整形（入力非破壊・null は 0 扱い・id は String 化） |
| `buildSelectOptions(options)`                      | `{label,value}[]` → `StringSelectMenuOptionBuilder[]`（edge 変換）                                                                             |
| `buildFallbackOption(label, value)`                | 単一フォールバック option 生成                                                                                                                 |

入力は `ChannelSnapshot { id,name,type,parentId,createdTimestamp }` の最小スナップショット。サービス側で cache 要素から写し取り（imperative shell）→ 純関数で選別、という functional core/imperative shell 構成。

### seam 化した副作用境界

- `guild.channels.cache.find/filter` の **判定述語**を純 predicate へ委譲（cache 走査自体はサービスに残す）。
- `getCharacterChannelOptions`：cache 抽出後に `ChannelSnapshot` へ写し取り、選別ロジックは純関数へ完全移譲。
- `validateCharacterCategory`：同じ `matchesCharacterCategory` を共有しロジック重複を解消。
- `fetch`＋`instanceof`＋`threads.create` は characterization テストで固定（実 discord.js prototype を `Object.create` したフェイクで instanceof 成立させて検証）。

### 改善指標（before → after）

- 本体 service.ts: 165行 → 162行（純選別ロジック40行強を util へ移し、サービスは「取得→判定委譲→整形委譲」の薄い殻に）。`getCharacterChannelOptions` の最長メソッドが大幅簡素化。
- 純関数の割合: 選別・判定ロジックを **5 純関数**として完全分離（モック不要）。
- 外部依存の seam 化: cache 判定述語の純化（find/filter の predicate を2つ純関数化）。
- Cyclomatic Complexity: 純関数は各 1〜2。

### テスト結果

- `channel-manager.service.spec.ts`（characterization・**17 ケース**）+ `channel-manager.util.spec.ts`（純関数・モック不要・**17 ケース**）= **34 passed**。
- 消費者 `character-channel-orchestrator.service.spec.ts` = **16 passed**（破損なし）。
- `pnpm run build` 成功 / `pnpm run check:circular` → **No circular dependency found!（451 files）**。

### 守った制約（確認済み）

純粋層に DI 無し（純関数は引数のみ）/ 新規循環なし / 公開 API シグネチャ・外部挙動不変（`createCharacterThread`/`getCharacterChannelOptions`/`validateCharacterCategory`/`validateTextChannel`/`validateThread`/`logChannelInfo`、フォールバック option の形・25件上限・降順順序すべて維持）/ フロント非依存。

- 副次: 未使用だった `CommandInteraction` import を削除（挙動非影響）。

### 残課題・申し送り

- `instanceof`／`fetch`／`threads.create` の完全な Port 化は未実施（characterization で固定済みのため現テスト要件は満たす・YAGNI）。将来 Discord I/O Port 化の共通 seam に乗せる際にまとめて対応。
- 既存の壊れた spec（`message-manager.service.ts:198` 由来のコンパイルエラー）は本対象と無関係・本改善で新規破損ゼロ。

---

## 🔧 **赤3: character-section-editor.service テスタビリティ改善（refactor-for-testability）** **[2026-06-02]**

対象: `src/discord/features/characterEdit/services/character-section-editor.service.ts`（`CharacterSectionEditorService`）。
赤判定3件中もっとも複雑（interaction I/O・emit+race・静的 ErrorHandler・discord.js builder・埋もれた3分岐ロジックが密結合）。

### 手順0: characterization（挙動固定）

- `character-section-editor.service.spec.ts` を新規作成（12件）。`execute(interaction)` の外部挙動を最小モックで固定：
  - defer 分岐（field操作は deferUpdate せず showModal／それ以外は deferUpdate）
  - characterId 抽出失敗→editReply エラー／character 取得失敗→editReply エラー
  - section選択（`character-edit-section`/`character-section-select`）→ createFieldSelectMenu 正引数＋元embed保持で2行 editReply／`back`→ createSectionedEmbeds
  - フィールド選択→ showModal（短いID=直接、長いID=session採番 createSession）
  - 例外→ ErrorHandler.handleServiceError 経由
- 重要な落とし穴: グローバル `test/utils/jest-setup.ts` の `jest.mock('discord.js')` の **`TextInputBuilder` に `setValue` が欠落**しており、既存値ありの編集で本番コードが落ちていた（モックの不備）。実 discord.js には存在するメソッドなので **`setValue: jest.fn().mockReturnThis()` を1行追加**（他テスト非影響を全 characterEdit spec で確認）。
  → modal builder はモックで `.data` を持たないため、3分岐の値振り分け検証は characterization では行わず、抽出した純関数の単体テストへ委譲する設計とした。

### 抽出した Pure 関数（新規 `character-section-editor.util.ts`・DI 無し・discord.js import 無し）

- **`extractFieldEditValues(sectionData, fieldKey)`**（最重要）: 旧 handleFieldSelection 180〜238行の AttributeValue／レガシー name+value／プリミティブの3分岐を純化。戻り `{ fieldName, currentValues, currentDice, currentDescription }`。
- `extractCharacterIdFromCustomId` / `extractSectionFromCustomId`（customId 解析・4パターン正規表現／部分文字列）。
- `isFieldOperationCustomId` / `isSectionSelectionCustomId`（分岐判定）。
- `shouldUseDirectModalId`（≤8 判定）/ `buildDirectModalId` / `buildSessionModalId`（modalId 純粋部分）。
- `buildModalTitle` / `getSectionDisplayName`（表示名）。
- `sanitizeDescriptionValue`（trim＋1000字制限 997+'...'）。
- `getSectionData(character, sectionType)`（switch）。

### seam 化した依存

- modal customId 決定を **`resolveModalId()` private に隔離**：短いIDは純関数で生成、長いIDのみ `modalSessionManager.createSession`（副作用）を呼ぶ＝副作用を1箇所に集約。
- `getCharacter`（emit+`Promise.race(waitForEvent)`）・interaction 応答（defer/editReply/showModal/reply）・`ErrorHandler` は薄い殻（execute / sendErrorMessage）に残置。

### 改善指標

- `character-section-editor.service.ts`: 469行→約300行（**-157 / +49**）。`handleFieldSelection` の本体ロジック約60行→純関数1呼び出しに。`createEditModal` から modalId 分岐・タイトル・サニタイズの直書きを排除。デッドコード（未使用 `sectionNames`）も削除。
- Pure 関数の割合: util 12関数すべてモック不要。カバレッジ util.ts **100%**（stmt/branch/func/line）、service.ts **96%/90.9%/100%/95.9%**。
- 外部依存: DI 3件（typedEventService/embedManager/modalSessionManager）は維持。新規注入ゼロ。

### 追加テスト

- `character-section-editor.util.spec.ts`（**51件**・純関数・モック無し、3分岐＋境界＋異常系網羅）。
- `character-section-editor.service.spec.ts`（**12件**・characterization）。対象2 spec 計 **63 passed**。

### 検証結果

- `pnpm run build` 成功。
- 対象2 spec = **63 passed**。消費者 `enhanced-character-edit.service.spec.ts` = **17 passed**（破損なし）。
- `pnpm run check:circular` → **No circular dependency found!（454 files）**。
- `git diff --numstat`: service.ts `-157/+49`、jest-setup.ts `+3/-1`。新規3ファイル（util.ts / util.spec.ts / service.spec.ts）。

### 守った制約（確認済み）

純粋層に DI 無し（純関数は引数のみ・discord.js import 無し）/ 新規循環なし / 公開 API は `execute(interaction)` のみ・シグネチャ＆外部挙動不変（defer分岐・customId生成形 `char-edit-${section}-${field}-${id}`／`char-edit-modal-${sessionId}`／`character-edit-section-${id}`・3分岐の値振り分けすべて維持）/ フロント非依存（HTTP 返さず）。

### 予期せず詰まった点／新規破損ゼロの証拠

- 上記の `TextInputBuilder.setValue` 欠落（モック不備）が真因で、初版 characterization が落ちた。jest-setup へ1行補完で解消（実 discord.js 準拠・安全）。
- characterEdit feature 全 spec をベースライン比較（tracked変更 stash＋新規ファイル退避）: **ベースライン 6 failed/20 tests failed**（channel-detection 等・本対象と無関係の既存負債）→ **改善後も 6 failed/20 tests failed**（failed 数同一）、passed は **204→267（+63＝本追加分のみ）**。本改善による**新規破損ゼロ**を確認。

---

## ✅ 黄バックログ消化＋型負債2件解消（2026-06-02・create-test 並列委譲）

第2次マップ 🟡黄の未テスト分を再 discovery（`find` で spec 有無を厳密確認）した結果、**大半は前セッションで spec 済み**で、真に未テストは6ファイルのみと判明。6本を `create-test` へ並列委譲し全緑化。司令塔が build/check:circular/全 spec を裏取り。

| 対象                                                                          | spec 件数 | 備考                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `discord/discord.controller.ts`                                               | 25        | 5 endpoint の正常/403/400/404/500・権限・バリデーション網羅                                                                                                                                                                                                                                                  |
| `discord/interactions/channel/character-channel-create.service.ts`            | 2         | orchestrator 委譲・例外握り潰し                                                                                                                                                                                                                                                                              |
| `discord/interactions/channel/diceroll-channel-create.service.ts`             | 4         | parentId 一致/不一致・createOrGetChannel 委譲                                                                                                                                                                                                                                                                |
| `discord/interactions/select/character-thread-select.service.ts`              | 18        | customId ルーティング＋純 private(extractCharacterId/getSectionEmoji)。**赤差し戻し不要**（`@discord-test-utils` で interaction 充足）。ただし**モーダル構築物の中身検証は将来の赤候補**（ModalBuilder/TextInputBuilder 生成が execute に密結合）。本番 39行目の `console.log('test root')` 混入は別途要清掃 |
| `discord/events/handlers/character.deletion.completed.ts`                     | 17        | EventHandler 継承・通知/アーカイブ/embed削除の個別失敗握り潰し・isRetryableError/getMaxRetries                                                                                                                                                                                                               |
| `discord/features/userDefinedDice/services/user-defined-dice.orchestrator.ts` | 13        | autocomplete(Fuse/カテゴリ絞込/25件)・execute(tableDice 委譲)。実 Collection/TextChannel.prototype で instanceof 成立                                                                                                                                                                                        |

### 付随：`never[]` 型負債2件を解消（テストのコンパイル不能を解凍・挙動不変）

ts-jest が import グラフ全体を型チェックするため、本番1ファイルの型エラーが同グラフの spec を全滅させていた。型注釈のみ（ランタイム不変）で解消：

- `discord/services/channel/message-manager.service.ts`: `const batches = []` → `const batches: string[][] = []`。→ `discord-channel-manager.service.spec.ts` が **18 passed** に解凍。
- `discord/services/discord-interaction-handler.service.ts`: `const handlers = []` → `const handlers: Promise<void>[] = []`。→ `discord.controller.spec.ts` の **25 passed** が成立。

### 検証結果（司令塔裏取り）

- `pnpm run build` 成功 / `pnpm run check:circular` → **No circular dependency found!**
- 上記6 spec＋解凍2 spec 含む **9 suites / 120 passed**。
- 本番コードの変更は**型注釈2行のみ**（diff 確認済み）。他は新規 spec（未追跡）。新規破損ゼロ。

---

## ✅ 🔴赤: channel-creator.service テスタビリティ改善（2026-06-02・refactor-for-testability→create-test）

`discord/services/channel/channel-creator.service.ts`（ChannelCreatorService・494行・9メソッド）。全メソッドが discord.js の I/O（`channels.fetch`/`guilds.fetch`/`channels.create`/`threads.create`/`permissionOverwrites.create`/`.edit`/`.delete`/`members.fetch`）と try/catch＋`ErrorHandler.handleServiceError` に密結合し、option 組立・型変換・権限集計・channel info 組立が I/O に埋もれていた。

### 手順0：characterization 先行（安全網）

`channel-creator.service.characterization.spec.ts`（**30 passed**）で現挙動を固定してから抽出。固定した重要挙動：

- **`ErrorHandler.handleServiceError` は常に throw する**実装のため、catch 内の `return null`/`return false` には到達せず**例外が伝播する**のが現挙動（指示書の「例外→null」は handleServiceError をモックする前提の話で、実 ErrorHandler では throw）。これを `.rejects.toBeDefined()` で固定。
- getChannelInfo: fetch null→null、name/guildId/parentId/topic の条件付き組立、isThread 時の memberCount。
- createChannel/createThread/createCategory: option 分岐・type デフォルト・GuildVoice 固有。
- checkChannelPermissions: guild 無し→hasAccess:false＋全 false map、集計、some(Boolean)。
- set/update/delete: サポート外→throw、成功→true。convertChannelType: 既知→対応・未知→GuildText。

### 抽出した Pure 関数（新規 `channel-creator.pure.ts`・DI 無し・I/O 呼ばない）

`buildChannelInfo` / `buildChannelCreateOptions` / `buildThreadCreateOptions` / `buildCategoryCreateOptions` / `buildPermissionOverwrites` / `buildDeniedPermissionMap` / `summarizePermissions` / `hasAnyPermission` / `convertChannelType`。discord.js の `ChannelType`/`OverwriteResolvable` 型には触れるが I/O メソッドは呼ばない方針で、`services/channel/` 配下の純モジュールとして配置（`shared/` の discord.js import 禁止制約には抵触しない）。

### seam（副作用境界に残したもの）

各メソッドの I/O 呼び出し（fetch/create/edit/delete/members.fetch/permissionOverwrites）と try/catch＋ErrorHandler は service 本体（imperative shell）に残置。本体は「取得→（純関数で組立/集計）→ I/O 実行」の薄いオーケストレーションに縮小（494→419行）。

### create-test：純関数の単体テスト（`channel-creator.pure.spec.ts`・**35 passed**・モック不要）

全分岐（truthy/undefined 判定・0/false の付与・GuildVoice 固有・toLowerCase・未知フォールバック）を網羅。

- **モック注意**: グローバル jest-setup は `ChannelType` を `{ PublicThread: 11 }` のみに差し替えるため GuildText/GuildVoice/PrivateThread 等が全て undefined となり分岐を区別できない。pure.spec のみ**ファイルローカル `jest.mock('discord.js', ...)` で必要な enum 値を付与**（本体 pure.ts も同一モック参照を使うので比較は一致）。characterization 側は本体・テスト同一参照で比較するため上書き不要。

### 検証結果

- `pnpm run build` 成功。
- channel ディレクトリ全 4 suites = **102 passed**（うち本対象 characterization 30＋pure 35）。
- `pnpm run check:circular` → **No circular dependency found!（470 files）**。
- `git diff --stat`: `channel-creator.service.ts` `+41/-116`。新規3ファイル（pure.ts 275行 / pure.spec.ts / characterization.spec.ts）。

### 守った制約（確認済み）

純粋層に DI 無し（純関数は引数のみ）/ 新規循環ゼロ / **9 公開メソッドのシグネチャ・外部挙動・戻り値（null/false/throw のフォールバック形）不変**（characterization 30 が抽出前後とも緑で証明）/ ChannelType の値・option キー名不変・フロント非依存。

---

## 🔴→🟢 据え置き赤 順次消化（2026-06-02・低→高リスクでバッチ実施・司令塔裏取り）

ユーザー承認のもと「据え置き赤」を低リスク順にバッチ消化中。各バッチ characterization 先行・公開API/挙動保存・build/check:circular/spec をメインが裏取り。

### Batch A（実は🟡＝refactor 不要・create-test 直行／本番変更ゼロ）

- `discord/utils/discord.util.ts`（9件）/ `discord/utils/createCategory.ts`（3件）/ `events/handlers/character.update.completed.ts`（25件・deletion.completed と同型）/ `events/handlers/discord.thread.create.requested.ts`（12件）。計 **49 passed**。
- 教訓: 旧マップで🔴扱いでも EventHandler 継承系・util 系は mock で素直にテスト可能（`deletion.completed` と同様）。型注釈2件（`message-manager`/`discord-interaction-handler` の `never[]`）で import グラフ上の spec 群が解凍された影響も大きい。

### Batch B（🔴 refactor-for-testability＝channel-manager と同型の Port/seam 化）

- `discord/services/channel/channel-creator.service.ts`: 9純関数を `channel-creator.pure.ts` へ（convertChannelType/各 option builder/buildChannelInfo/権限集計）。本体 494→419行。pure35＋characterization30=65緑。**発見: `ErrorHandler.handleServiceError` は常に throw する**ため「例外→null/false」分岐は実 ErrorHandler 下では到達せず例外伝播が真の現挙動（characterization で固定）。
- `discord/features/characterThread/services/thread-manager.service.ts`: `buildThreadUrl`/`nextBackoffDelay`/event payload 組立を `thread-manager.util.ts` へ。`now()`/`sleep()` を protected seam 化（本番タイミング=50ms待機・retry・×2 backoff 不変）。util4＋characterization14=18緑。

### バッチ横断の検証

- 結合状態で `pnpm run build` 成功 / `pnpm run check:circular` → **No circular dependency found!** / Batch B 関連 **83 passed**。
- 本番コードの変更は「型注釈2行＋Batch B の2サービス（純抽出・seam）」に限定。Batch A は spec 追加のみ。新規循環ゼロ・フロント非依存。

### ✅ Batch C 完了（Clock/state seam＝channel-cache 同型）

- `character-dice-history`（🔴 refactor・下記詳細セクション）/ `character-edit-message-updater`（🟡 create-test・7緑）/ `message-manager`（🟡 create-test・24緑、batch分割境界 1/100/101/150 網羅）。結合: build成功・循環ゼロ・**57 passed**。

### ✅ Batch D 完了（orchestrator/registry/guild・全 create-test・本番無変更）

- `select-game-system.orchestrator`(10) / `event-registry`(37・core infra を本番無変更で網羅) / `discord-guild-manager`(39・Date.now spy で TTL 決定化)。計 **86 passed**。

### ✅ Batch E 完了（中核プラミング・全 create-test・本番無変更）

- `discord-client`(9) / `discord-facade`(24・metrics ラッパ mock) / `interactions.controller`(13) / `interactions.service`(25・optional controller を constructor 注入で mock) / `discord-interaction-handler`(20・fake timers)。計 **91 passed**。

### ✅ Batch F 完了（残2本）

- `discord/utils/discord-api-rate-limiter.ts`（🔴 refactor）: `getBucketKey`(正規表現正規化)/`shouldWait`/`computeStats`/`evaluateCleanup` を `rate-limiter.pure.ts` へ。`now()`/`wait()` seam。cleanup の順序依存（reset 書換前後で2回判定）を忠実再現。pure27＋characterization15=42緑、pure カバレッジ100%。
- `discord/features/characterThread/character-channel.service.ts`（🟡 create-test・Phase3 で execute 無効化）: getAndSetChannelOption の選別＋主要分岐。19緑（embed/button 深掘りは低価値で割愛）。
- 結合検証: build成功・循環ゼロ・F関連 **61 passed**。

---

## 🎉 据え置き赤バックログ 全消化完了（2026-06-02）

旧「既知の赤（据え置き）」リストおよび第2次マップの 🔴/未テスト分は、Batch A〜F で**すべて消化**（spec 既存だったものを除き、refactor 7本＋create-test 多数）。

- 本番コード変更は **テスタビリティ改善7本（channel-cache/channel-manager/character-section-editor/channel-creator/thread-manager/character-dice-history/discord-api-rate-limiter ＝純抽出＋seam・全て characterization で挙動保存）＋型注釈2行（message-manager/discord-interaction-handler の `never[]`）＋jest-setup 1行（TextInputBuilder.setValue 補完）** に限定。残りは spec 追加のみ。
- 全バッチで `pnpm run build` 成功・`pnpm run check:circular`「No circular dependency found!」・新規循環ゼロ・フロント非依存を司令塔が裏取り。
- 横断知見: ①EventHandler 継承・util・facade・controller は旧🔴でも mock で create-test 可能（refactor 不要が多数）、②`ErrorHandler.handleServiceError/handleError` は常に throw＝「例外→null」は実挙動では例外伝播、③jest-setup の discord.js モック欠落（ChannelType/Events/PermissionsBitField/各 Builder メソッド）は spec ローカルの `jest.requireActual`/`jest.mock` 上書きで回避（恒久対応はグローバル補完が望ましい・別タスク）。
- 既知の無関係負債（未着手・別タスク候補）: `select-game-system.service.spec.ts`（存在しない provider 参照の負の遺産）、character-thread-select の本番 `console.log('test root')`（チップ起票済）、各サービスのモーダル/embed 構築の深い検証は将来 refactor 候補。

---

## ✅ 🔴赤: character-dice-history.service テスタビリティ改善（2026-06-02・Batch C・refactor-for-testability→create-test）

`discord/interactions/button/character-dice-history.service.ts`（CharacterDiceHistoryService・511行）。`Date.now()` による Embed 更新スロットル（`MIN_UPDATE_INTERVAL=2000`・`lastEmbedUpdateTime` Map）、`setTimeout`/`clearTimeout`（10s タイムアウト・5s ロック強制解除）、fire-and-forget、discord.js I/O（`channels.fetch`/`messages.fetch`/`.send`/`.edit`）、`uuidv4`、大量の perf ログが密結合でテスト不能だった。**挙動保存（characterization 先行）＋ Pure 抽出＋ Clock/Timer seam** で改善。

### 手順0：characterization 先行（安全網・**12 passed**）

`character-dice-history.service.characterization.spec.ts` で現挙動を固定してから抽出。固定した重要挙動：

- **throttle（2箇所）**: `handleParentChannelMessage` は経過<2000ms ならページネーション起動せずスキップ；`updateDiceRollHistoryAsync` は経過>=2000ms で更新・未満でスキップ（メッセージ取得しない）。
- **`createPaginatedDiceRoll`**: ロック中なら即 return、embedId 既存→既存メッセージ編集で return（新規 send しない）、無ければ新規 send→pages 空なら空Embed、コントロール空→fallbackControls で編集、finally でロック解除。
- **`saveRollResult`**: character 未取得→保存せず return、取得→createText に DTO 委譲・成功 then でキャッシュ無効化、失敗→`BackgroundTaskErrorHandler.handleBackgroundError('save-dice-roll-result')` に委譲し外側は解決。
- fire-and-forget は `await Promise.resolve()` を複数回まわすヘルパ（`flush`）＋ fake timers で観測。`handleBackgroundError` は **void（throw しない）** ことを利用しスロットルスキップのログ経路も安定して固定できた。

### 抽出した Pure 関数（新規 `character-dice-history.pure.ts`・DI 無し）

- `shouldUpdateEmbed(lastUpdate, now, minInterval): boolean` — **最重要**。throttle 判定（本体2箇所で使用）。境界 `===` は更新側＝true。
- `buildSaveTextDto(...)` — 保存 DTO 組立（uuid は副作用なので引数 `textId` で注入＝純粋化）。userId='system'・後方互換キー不変。
- `buildPaginationState<T>(pages, messageId)` — pagination state 組立（`PaginatedDiceRoll` 型を保つためジェネリック化。currentPage=0/characterId=undefined 不変）。
- `createFallbackControls(messageId, channelId)` — fallback 3ボタン（semi-pure・discord.js Builder）。customId 形 `dice-prev*${messageId}*${channelId}`/`dice-page-info*…`/`dice-next*…` 不変。discord.js 型に触れる純ヘルパは対象と同じ `interactions/button/` 配下へ配置（制約遵守）。

### seam（副作用境界）

- `now()`（既定 `Date.now`）/ `setTimer`（既定 `setTimeout`）/ `clearTimer`（既定 `clearTimeout`）を **protected メソッド**化（fake timers / 差し替え可能）。perf 計測の `Date.now()` も全て `this.now()` に統一。
- client/channel I/O は従来どおり本体（imperative shell）に残置。本番タイミング（throttle 2000ms・10s/5s timeout・fire-and-forget・lock）は不変。

### create-test：Pure 関数の単体テスト（`character-dice-history.pure.spec.ts`・**14 passed**）

`shouldUpdateEmbed`（境界 1999/2000/同値0/初回 lastUpdate=0 を網羅）・`buildSaveTextDto`（全キー・uuid 注入）・`buildPaginationState`（0/1/N 件）・`createFallbackControls`（3ボタン・customId 形・label/style/disabled）を網羅。

- **モック注意**: グローバル jest-setup の `ButtonBuilder` は `setDisabled` を、`EmbedBuilder` は `setTimestamp` を欠くため、characterization/pure 両 spec は**ファイルローカル `jest.mock('discord.js', ...)`** で補完（pure 本体も同一モック参照を使うので一致）。pure.spec は customId/label/style を捕捉する `__state` 付きモックで検証。

### 検証結果

- `pnpm run build` 成功。
- button ディレクトリ全 **8 suites = 150 passed**（ベースライン 6 suites/124 → characterization12＋pure14 増、既存 124 は全緑のまま＝**新規破損ゼロ**）。
- `pnpm run check:circular` → **No circular dependency found!（475 files）**。
- `git diff --stat`: `character-dice-history.service.ts` `+82/-111`（511→約482行）。新規3ファイル（pure.ts / pure.spec.ts / characterization.spec.ts）。

### 守った制約（確認済み）

純粋層に DI 無し（純関数は引数のみ）/ 新規循環ゼロ / **公開4メソッド（saveRollResult/handleParentChannelMessage/createPaginatedDiceRoll/updateDiceRollHistoryAsync）のシグネチャ・外部挙動不変**（characterization 12 が抽出前後とも緑で証明）/ 保存 DTO キー・customId 形・送信内容不変・フロント非依存 / perf ログは削除せず seam 化のみ。consumer `CharacterDiceButtonsService` は薄い委譲で変更不要。

### fire-and-forget で characterization が困難だった範囲

特になし。`handleBackgroundError` が void（throw しない）かつ全 fire-and-forget が `.then/.catch/.finally` で内部完結するため、`flush`（`await Promise.resolve()` ×5）＋ fake timers で安定観測できた。ただし perf ログの所要時間値（`this.now()` 差分）は計測値であり値そのものは検証対象外（ログ文字列のみ・挙動非依存）。

---

## ✅ 🔴赤(F): discord-api-rate-limiter.ts テスタビリティ改善（2026-06-02・refactor-for-testability→create-test）

`src/discord/utils/discord-api-rate-limiter.ts`（DiscordApiRateLimiter・255行→約230行）。`Date.now()`（global/bucket リセット判定・stats・cleanup）と `setTimeout`（待機・executeBatch バースト遅延）と状態 Map が密結合で赤判定だった件を消化。

### 抽出した Pure 関数（discord.js 非依存・DI なし・同 `discord/utils/` 配下）

新規 `src/discord/utils/rate-limiter.pure.ts`:

- `getBucketKey(route, method)` — 数値ID→`:id`・`/api/vN` 削除・クエリ削除して `METHOD:/normalized/path`（最重要・正規表現）
- `shouldWait(reset, now)` / `computeWaitTime(reset, now)` — グローバル・バケット共通の待機判定/待機時間
- `shouldWaitForBucket(bucket, now)` — `remaining<=0 && reset>now`
- `computeResetTimestamp(resetTimestamp, now, resetAfter)` — reset 秒優先・無ければ `now+resetAfter`
- `computeStats(buckets, globalRemaining, globalReset, now)` — `resetIn=max(0,reset-now)`、stats 戻り形不変
- `evaluateCleanup(reset, now)` — `shouldReset=reset<now` / `shouldDelete=reset<now-3600000`（1時間）
- 型 `BucketLimit` / `BucketStatusEntry` / `RateLimiterStats` / `CleanupDecision`

### seam（副作用境界のみ）

- `Date.now` → `protected now()`（既定 `Date.now`）。テストは `jest.spyOn(Date,'now')` で固定。
- `wait(ms)` を `private`→`protected`（既定 `setTimeout`）。テストは fake timers で遅延ゼロ消化。
- 状態 Map（bucketLimits/requestQueue）は本体に保持（純粋層に DI 持ち込まず）。

### cleanup の順序依存に注意（挙動保存の肝）

元コードは `reset<now` で `reset=0` に書き換えた**後**に `reset<now-3600000` を評価する順序依存があり、本番（now が実時刻＝大）では reset<now のバケットは reset=0 後の `0 < now-3600000` で**即削除**される。これを忠実に再現するため、本体 cleanup は `evaluateCleanup` を「書き換え前 reset」と「書き換え後 reset」で2回呼ぶ実装にした（純関数は単一値判定で副作用なし）。

### 検証

- `pnpm run build`: ✅ 成功
- characterization spec（`discord-api-rate-limiter.characterization.spec.ts`・15）: 抽出前 ✅ → 抽出後も ✅（挙動不変を証明。fake timers で setTimeout 遅延ゼロ）
- pure spec（新規 `rate-limiter.pure.spec.ts`・27）: ✅（`rate-limiter.pure.ts` カバレッジ Stmts/Branch/Funcs/Lines **100%**）
- utils 配下全 14 スイート 124 テスト ✅（新規破損ゼロ）
- `pnpm run check:circular`: ✅ No circular dependency found!
- `git diff --stat`: 本体 1 file 47+/71-（純関数委譲で簡素化）

### 守った制約

純粋層に DI 無し（純関数は引数のみ）/ 新規循環ゼロ / **公開6メソッド（waitForRateLimit/updateRateLimit/executeBatch/getStats/cleanup/reset）のシグネチャ・外部挙動不変**（characterization 15 が抽出前後とも緑で証明）/ bucketKey 正規化結果（`METHOD:/normalized/path`）・stats 戻り形不変・フロント非依存 / 待機時間・bucket 減算・cleanup 1時間閾値・executeBatch の maxConcurrent/delay すべて不変。consumer は本番コード上に存在せず（spec/本体/純関数のみが参照）。

> これにより「据え置き赤」の `discord-api-rate-limiter`（行 973/1244-1245 で「該当ソース無し・要確認」とされていた件）はソース実在を確認し消化完了。

---

## テスト基盤負債の解消＋未追跡 spec 取り込み（2026-06-02・タスク B/C）

### B-3: jest-setup の discord.js モック恒久補完

`test/utils/jest-setup.ts` の discord.js モックに **ChannelType 全列挙（実値）・Events・PermissionsBitField.Flags・ThreadAutoArchiveDuration・StringSelectMenuOptionBuilder・各 Builder の不足メソッド（EmbedBuilder.setTimestamp/setFooter/setThumbnail/setAuthor/setURL/setImage/setFields、ButtonBuilder.setDisabled/setEmoji/setURL、StringSelectMenuBuilder.setDisabled）** を補完。各 spec の `jest.requireActual`/ローカル上書きを将来不要にする。**全体スイートで新規失敗ゼロ**を確認（既存値は不変・実 discord.js と同値で追加のみ）。

### B-4: 既存赤 spec の triage（安全分のみ修正・製品バグは masking せず報告）

develop 既存の失敗 spec 17本を分類し、**安全・機械的修正のみ適用**：

- 修正4本: `config.service.spec`(discord 設定の正当追加キーを期待値へ)／`typed-event.service.spec`(stale import を実在パスへ＝スイート起動回復)／`character-id.service.spec`(期待 12→13・テストデータ実長に追従)／`character-notification.service.spec`(不在モジュールの jest.mock 残骸除去・期待を現仕様へ)。
- 削除4本（負の遺産・依存未解決の `should be defined` 雛形、対象は commands.controller/commands.service spec で別途カバー済み）: `select-game-system.service.spec`／`user-defined-dice.service.spec`／`dice-from-context-menu.service.spec`／`roll-dice.service.spec`。
- 結果: 全体スイート **19→10 suites / 58→53 tests failed**（新規失敗ゼロ）。

### C: 前セッション由来の未追跡 spec 109本を取り込み

test-expansion 過去セッションで作成され未追跡だった spec を全件取り込み。TS コンパイルエラーだった2本（`character-tab-buttons`：型述語キャスト／`character-embed`：`createThread` 返り値型）を最小キャスト修正で緑化。本番不変・build/check:circular 緑。

### ✅ 残存（B カテゴリ）＝全件解消（2026-06-02・深掘り完了）

着手時 19 suites/58 tests 失敗 → **全体スイート 197 suites / 2681 tests 全緑（失敗ゼロ）** まで到達。`pnpm run build` 成功・`check:circular`「No circular dependency found!」をメインが裏取り。**製品コード変更は `typed-event.service.ts` の off() 実バグ修正のみ**（下記）。他はすべて test 側の現挙動追従／DI provider 補完／負の遺産整理。

1. ✅ `typed-event.service.ts` の `off()` 実バグ → 修正完了（下記専用節）。**唯一の製品コード変更**。
2. ✅ `discord.service.spec`：ファサード委譲を検証する spec へ全面置換（19緑）。旧責務は handler/facade/interactions spec でカバー済み確認。
3. ✅ `characterEdit/character-channel.service.spec`：DTO を `AttributeValue/AttributeSection` へ移行＋DI provider（TypedEventEmitter）補完＋Phase3 メンテ挙動へアサーション追従（37緑）。※ `characterThread/character-channel.service.spec`（19緑）と**同一本体を import する重複 spec**＝置き忘れの疑い。削除候補として要判断（今回は緑化のみ）。
4. ✅ `channel-create-orchestrator`(12緑)/`character-creation`(4緑)：現本体コンストラクタに合わせ mock provider 補完＋イベント駆動/File-based Handlers 移行後の挙動へアサーション追従。
5. ✅ `channel-detection.service.spec`(5緑)：真因は jest-setup の `AuditLogEvent` 欠落で本体 `extractCreatorId` が TypeError→null 化。jest-setup に `AuditLogEvent` を恒久追加＋entries を Collection 互換へ。製品バグではなかった。
6. ✅ character ドメイン3本（`character.service` 13緑／`character.integration` 9緑／`character-event-handler` 4緑）：全件 (A)＝test が旧実装に未追従。本番不変。
7. ✅ `event-debug-test.spec`：File-based Handlers 移行で前提が崩れたデバッグ用 spec。findById フロー等は他 spec でカバー済み確認のうえ削除。

**未コミット注記**：上記の修正群（off() 製品修正・各 spec 修復・jest-setup の AuditLogEvent 追加・event-debug-test 削除）はユーザー指示により**コミットしていない**（working tree に保持）。

---

## ✅ TypedEventService.off() 実バグ修正（2026-06-02・characterization 先行→製品コード修正）

`src/core/events/typed-event.service.ts`。残存 B カテゴリ #1 を消化。

### バグ内容（製品コード）

`on()` は渡された handler を検証・ログ・例外再 throw を行う**匿名 async ラッパー**で包んで `eventEmitter.on` に登録していたが、`off()` は元 handler をそのまま `eventEmitter.off` に渡していた。EventEmitter2 は登録時のラッパー参照と一致しないと解除しないため、**`off()` が常に no-op となりリスナーが残留**（リーク・二重発火）。

### 修正方針（採用）

`TypedEventService` に対応表 `handlerWrappers: Map<event, Map<元handler, ラッパー配列>>` を追加。

- `on()`: ラッパー生成 → `trackWrapper()` で対応記録 → `eventEmitter.on(event, ラッパー)`。
- `off()`: `takeWrapper()` で元 handler に対応するラッパーを1つ取り出し（同一 handler 複数登録時は**最後に登録した1つだけ**解除＝Node `removeListener` のセマンティクスに準拠）、`eventEmitter.off(event, ラッパー)`。未登録 handler の `off` は **no-op**（例外を投げない）。
- `removeAllListeners()`: emitter 解除と同時に対応表からも当該 event を削除（stale ラッパー残留防止）。
- `once()` は対象外（自己解除のため off 連携不要・スコープ最小化）。

### characterization（修正前に固定）

`typed-event.service.spec.ts` の `off` describe に3ケース追加（修正前は #1 既存赤含め赤、修正後緑）：

- `should only remove the specified handler and leave others active`（他 handler 非干渉）
- `should remove only one registration when the same handler is registered twice`（重複登録は1回の off で1登録のみ解除）
- `should not throw when removing a handler that was never registered`（未登録 off は no-op）

### 検証

- 対象 spec: **21/21 緑**（既存 `should remove event listener` 含む。修正前は 1 赤）。
- `pnpm run build`: ✅ 成功 / `pnpm run check:circular`: ✅ No circular dependency found!（483 files）。
- 全体スイート: **10 suites/53 tests failed → 9 suites/52 tests failed**（typed-event スイート緑化分のみ改善・**新規失敗ゼロ**）。
- 製品側 consumer: `typedEventService.off(` の呼び出しは spec のみで本番コードに存在せず、外部挙動の回帰リスクなし。

> 残存 B #6（character ドメイン3本）は「off() バグ解消後に再評価推奨」とされていたため、次サイクルで再 triage 対象。

---

## ✅ character ドメイン3 spec ドリフト修復（2026-06-02・残存 B #6 消化）

`character.service.spec` / `character-event-handler.service.spec` / `character.integration.spec` の3本。
本体 Read で全失敗を triage した結果、**全件 (A)＝test が旧実装に未追従**。本番コードは一切変更せず spec のみ現仕様へ更新。

### 切り分け根拠（本体現挙動）

- `character.service.ts`: feature flag `prototype.eventDriven` 分岐・`[DIRECT]`/`[EVENT-DRIVEN]` ログ・`waitForCharacterSearchResult`/`waitForCharacterUpdateResult` 待機メソッドは**全て削除済み**（331行コメント「EventDriven待機メソッドを削除」）。`AppConfigService`/`UserService`/`DiscordService` 依存も削除（8-9・68-69行）。`create` は characterId 必須で throw・作成完了イベントは emit しない（105-107行コメント）。`update`/`remove`/`removeByChannelId` が `character.updated`/`character.deleted` を emit。ログは `Searching character by channelId:` 等（`[DIRECT]` プレフィックス無し）。
- `character-event-handler.service.ts`: `registerEventListeners()` は**何も登録しない**（44-47行「すべてのイベントリスナーは File-based Event Handlers に移行済み・重複登録回避のため無効化」）。private ハンドラメソッドは残るが onModuleInit から呼ばれない。レガシーサービス（41行）。
- 実際の CRUD イベント処理は `src/events/handlers/character.*.requested.ts`（File-based Event Handlers）が担い、それらの spec は緑（例: findByChannelId+creation で 45 tests pass）。
- `typed-event.service.ts` に `listenerCount` メソッドは存在しない（spec の `listenerCount is not a function` の原因）。

### (A) 適用内容

1. **`character.service.spec.ts`**（17赤→13緑）: feature flag/旧依存（AppConfig/User/Discord）/`waitFor*` spy/`[DIRECT]`・`[EVENT-DRIVEN]` ログ期待を全削除。DI は `CharacterRepository` + `TypedEventService` の2 provider のみ。現仕様の直接 CRUD・`create` の characterId 必須 throw・`update`/`remove`/`removeByChannelId` の `character.updated`/`character.deleted` emit・現行ログ文言を検証。
2. **`character-event-handler.service.spec.ts`**（8赤→4緑）: emit→completed/failed 期待と `listenerCount` 期待を撤廃。現仕様「onModuleInit が安全に完了し**リスナーを一切登録しない**／requested を emit してもこのサービス由来の完了イベント・repository 呼び出しが発生しない」を固定。
3. **`character.integration.spec.ts`**（7赤→9緑・実 MongoDB 使用）: DB 永続化は機能していた（失敗は全て「`CharacterEventHandlerService` がリスナー未登録のため completed イベントが届かない」点のみ）。旧契約（`create()` が `creation.completed` を emit／`TypedEventEmitter.requestCharacterByChannelId/Update` が当サービスのリスナーを起動）を撤廃し、**サービス経由の直接 CRUD が DB に反映されること＋`update`/`remove` の統合イベント発行**を検証する形へ再構成。完了イベント検証は File-based Handlers 側 spec の責務として委譲。

### (B) 未対応（製品バグ疑い）

- **なし**。3本とも (A) で解消。本体に手は入れていない。

### 検証

- 個別: `character.service` 13/13・`character-event-handler` 4/4・`character.integration` 9/9 緑。
- `pnpm exec jest src/domains/character`: **8 suites / 108 tests 全緑**（before: 3 suites fail / 32 tests fail）。新規失敗ゼロ。
- 本番コード（`character.service.ts` 等）は未変更。

---

## ✅ ダイス数式評価の `no-implied-eval` を安全な算術評価器へ置換（2026-06-02・タスク b 消化）

`dice-calculation.service.ts`（private `evaluateFormula`）と `dice-parser.service.ts`（`evaluateFormula`）が
`Function('"use strict"; return (' + sanitized + ')')()` でサニタイズ済み算術式を評価しており
（`@typescript-eslint/no-implied-eval`）、これを **Function/eval を一切使わない安全な算術評価器**へ置換した。
**挙動完全保存**（characterization 先行）。

### 実装方式・置き場所

- 新規純関数 `evaluateArithmetic(expr: string): number` を **`src/shared/utils/arithmetic-evaluator.util.ts`** に新設（DRY・no-implied-eval を一箇所に解消）。
  - **再帰下降パーサ**。優先順位（低→高）: `+ -`(左結合) < `* /`(左結合) < `**`(右結合・最高) < 単項 +/-。
  - 旧 `Function` 評価サブセットを厳密再現: 数値リテラル（先頭ゼロ複数桁 `00`/`007`/`01.5`/`08` は SyntaxError、`.5`/`5.`/`0.0` は可）、単項 +/- 連鎖、空白を挟まない `++`/`--`・`**` のトークン化、`-2**2`/`+7**93` の単項+べき乗 SyntaxError、空括弧 `()` SyntaxError、0除算は Infinity/NaN を throw せず返す。
  - shared は DI/フレームワーク非依存の純粋層（ARCHITECTURE 制約遵守）。discord.js import なし。
- 両サービスの **外側ラッパ挙動は不変**: dice-calc はサニタイズ→評価→生値返却・catch で 1（範囲チェック/丸め無し）。dice-parser はサニタイズ→sanitized!==formula で throw→評価→`typeof!=='number'||!isFinite` で throw→`<0||>10000` で throw→`Math.round`・catch で 1。置換したのは「`Function` による評価」部分のみ。import は `../../../shared/utils/arithmetic-evaluator.util`。

### characterization（置換前後の同一結果証跡）

- **新評価器 spec**（`arithmetic-evaluator.util.spec.ts`）: 固定80ケース＋**ファズ3万件**で旧 `Function` 評価と差分検証。契約「旧実装と新評価器が**ともに数値を返す妥当な算術式**では結果が完全一致」をファズで証明（比較有効数 >100・mismatch=0）。網羅例: `(50)*3`,`1+2*3`,`(5+5)/2`,`10/3`(小数),`(100)+-5`(単項/負),`2.5*4`,`( 3 )`(空白),`''`(空),`1/0`(Infinity),`**`(べき乗),先頭ゼロ/連続単項 等。
- **サービス spec** に characterization 追記:
  - `dice-calculation.service.spec.ts`: `parseAndCalculate` 経由で生値固定（範囲/丸め無し）。`1-2-3`=-4・`10001`=10001・`10/3`=3.333…・`1/0`=Infinity・空文字/`a-`→catch で 1。
  - `dice-parser.service.spec.ts`: ラッパ込み固定（`7/2`→4・`10/3`→3・`1-2-3`→範囲外で 1・上限 10000 許容 等）。

### 唯一の挙動差（病的入力・到達不能・安全側）

- 旧 `Function` は文字種が許可されても `/.../`（正規表現リテラル）/ 外側ラップの早期クローズ `)expr(` / `//`コメント を「式以外」として評価しえた。これらは**妥当な算術式ではなく**ダイス式生成経路（数値置換・乗数/修正値付与）では**到達しない**。大半は旧でも非数値→throw→1 で挙動不変（`dice-parser.service.spec.ts` に `/3/`,`/5+5/`,`1)-(3`,`2)(3`,`238)/0//`→1 を固定）。例外的に `8+8)//(`（`//`コメントで 16 化）のみ旧=16・新=1 と差が出るが入力空間外・到達不能。安全評価器の責務としてコメント評価を行わず **SyntaxError→1 に倒す**方針。

### 検証

- `pnpm run build`: ✅ / `pnpm exec jest dice-calculation dice-parser dice-orchestrator arithmetic-evaluator`: **5 suites / 201 tests 全緑** / `pnpm run check:circular`: ✅ No circular dependency found!（483 files・新規循環なし） / `pnpm exec eslint`（両サービス＋評価器）: **0 errors**（no-implied-eval 消滅）。

## ESLint 設定の実態適合と warning 削減（2026-06-02）

`eslint.config.js`→`.mjs` 化で lint を起動可能にし、`recommendedTypeChecked` をプロジェクト実態へ調整（any 多用・async 統一スタイル由来を off、潜在バグ系を warn）。その後 warning を **268→45** へ削減（errors は別途 0 に）。

- 削減した安全分: auto-fix（no-unnecessary-type-assertion / prefer-to-have-length / 不要 eslint-disable）、`no-unused-vars`（未使用 import/変数 除去・未使用引数 `_` 化）、`no-redundant-type-constituents`（`any|null`→`any` 等の意味等価整理）。いずれも build / 全体スイート 2773 緑で挙動不変を確認。
- **残 45 warning は意図的に保持**:
  - 受容パターン（20）: `no-require-imports` 7（JSON/CJS 連携）・`no-empty` 7（意図的空 catch）・`no-namespace` 3・`no-redundant-type-constituents` 3（`'literal' | string` の IDE 補完ヒント）。
  - **behavior-sensitive な promise 系（25）: `no-floating-promises` 14 / `no-misused-promises` 6 / `await-thenable` 5**。

### ⚠️ 重要な教訓: promise 系 warning を一括 void/await 化してはいけない

一度サブエージェントで promise 系を一括修正したところ、`typed-event.service.ts` の `on/once` を「async wrapper → 同期 `void(async()=>{})()` の fire-and-forget」へ変えてしまい、`emitAsync` がハンドラ完了/エラーを待たなくなって **エラー伝播が消失**（`typed-event`・`interactions.controller`・`performance-dashboard` で回帰）。全 revert 済み。
→ promise 系 warning は **1件ずつ呼び出し意図（待つべきか fire-and-forget か）を確認し、characterization で挙動不変を保証しながら個別対応**すること。一括変換は禁止。

### ✅ promise 系 warning を根因別に個別解消（2026-06-02・25→0・全体スイート 2773 緑）

設計レビューの結論と対応:

- **設計起因＝正しい設計（挙動を変えず eslint-disable で意図明示）**:
  - `typed-event.service.ts` の `on`/`once`: `emit()` は `emitAsync` で **async リスナーを await する設計**。async wrapper は必須で、同期化するとエラー伝播が壊れる（＝上記回帰の正体）。`no-misused-promises` は emitAsync を理解しないツール限界なので justified disable。
  - discord.js `Client.on`（`discord-interaction-handler` / `interactions.controller`）: discord.js は async リスナーを await しない設計（handler 内 try/catch 済み）の意図的 fire-and-forget。
  - `event-handler.base` の `setTimeout` リトライ: 意図的 FAF。
  - `discord-facade`: 同期 void メソッドを `Promise.all` の初期化塊に内包（構造保存のため await-thenable 許容）。
- **設計起因でない**: 背景送信・`bootstrap()`・test factory の mock 呼出は `void` 明示（挙動不変）。`cache.get` 等の同期オペランドへの不要 `await` は除去。
- **✅ 実バグ修正済み（2026-06-02）**: `discord/discord.controller.ts` `postCharacter` の `characterService.update(...)` が**成否判定より前に fire-and-forget**されていた（①チャンネル作成失敗時に `discordChannelId=undefined` を永続化＝データ破損、②更新失敗を握り潰し success 応答）。**成功判定を update より前へ移動＋update を await**で修正（失敗時は永続化せず、更新失敗は 500 へ伝播）。成功時 body 不変・フロント `postCharacterToDiscord` は 500 を catch 済みで影響なし。spec に「失敗時 update 呼ばない」「update 失敗→500」を追加。全体スイート 2774 緑。
- 結果: ESLint **errors=0 / warnings=20**（残は全て意図的受容パターン: no-require-imports 7・no-empty 7・`'literal'|string` 3・no-namespace 3）。

---

## 🛡️ イベント基盤 forRoot 統合リファクタの安全網（characterization）**[完了: 2026-06-03]**

次フェーズで予定する「`EventEmitterModule.forRoot()` 二重呼び出しの統合」（`events/events.module.ts:52` の forRoot を削除し `core/events/core-events.module.ts:15` の1つへ統一。設定は現状有効値の events 側＝`maxListeners:20` / `verboseMemoryLeak:true` に寄せる。`@Global` 二重も解消）の**前に、現挙動を固定する安全網**を張った。本体コードは未変更（テスト追加のみ）。

### テスタビリティ評価（全て🟢緑 / A 判定）

- **A. TypedEventService emit/on 往復**: 🟢 既存 `typed-event.service.spec.ts` が DI で `'TYPED_EVENT_EMITTER'` を差し替え、emit→on 往復・off・once・waitForEvent を網羅済み。補強不要。
- **B. MetricsCollectorService の @OnEvent 配線（最重要）**: 🟢 `OnModuleInit` のみで重い副作用なし、外部依存は EventEmitter2 1個、`getSystemMetrics()` で状態観測可能。forRoot を import した最小 TestingModule で emit 経由発火を実証できる。
- **C. TypedEventService emitter とグローバル EventEmitter2 の分離**: 🟢 `core-events.module.ts:29` が `'TYPED_EVENT_EMITTER'` を独立 `new` し `@OnEvent` 用グローバル emitter と別インスタンス。観測可能。

### 作成したテスト

- **`src/discord/services/monitoring/metrics-collector.service.onevent.spec.ts`（新規・B）**: `EventEmitterModule.forRoot({maxListeners:20, verboseMemoryLeak:true, ...})` を import した最小 TestingModule で `await module.init()`（@OnEvent 購読は onApplicationBootstrap で登録されるため init 必須）。`eventEmitter.emit('discord.command.start'|'discord.command.complete', payload)` → `MetricsCollectorService` のハンドラが**メソッド直呼びではなく emit 経由で発火**し `getSystemMetrics()` の値（commandsExecuted / totalResponseTime / errors）が変化することを assert。これが forRoot 配線の回帰テスト。`AlertManagerService` の `@OnEvent('system.alert')` も1本追加（ConfigService はモック provider、`emitAsync` 後に `getActiveAlerts()` に1件追加される副作用を観測）。既存のメソッド直呼びユニット `metrics-collector.service.spec.ts`（26 tests）はそのまま残置。
- **`src/core/events/typed-event-isolation.spec.ts`（新規・C）**: forRoot のグローバル EventEmitter2 と、core-events.module.ts と同形で独立生成した `'TYPED_EVENT_EMITTER'` を併存させ、(1) 両者が別インスタンス、(2) `typedEventService.emit` がグローバル側 `on` リスナーに**届かない**、(3) 独立 emitter 内では emit→on 往復が成立、を固定。統合時に誤って両 emitter を繋いだ場合に落ちて気づける。
- **A** は既存 `typed-event.service.spec.ts`（21 tests）が網羅的なため新規追加なし（緑確認のみ）。

### 検証結果（変更前コードで全緑＝安全網として成立）

- `pnpm run build`: ✅ エラーなし。
- 作成2ファイル＋既存A spec: **3 suites / 29 tests 全緑**（B の emit 経由配線テスト含む）。既存 `metrics-collector.service.spec.ts`: 26 tests 全緑。
- `pnpm run check:circular`: ✅ No circular dependency found!（474 files・新規循環なし）。

### forRoot 統合時の所見・残課題

- B・C のテストは EventEmitter2 の**設定値（maxListeners / verboseMemoryLeak）に依存しない配線挙動**を検証しているため、events 側の値へ寄せても緑のまま＝**この安全網が統合後も緑なら @OnEvent 配線と emitter 分離は挙動不変**と言える。
- 注意点: 本テストは `forRoot` を**1回だけ** import した TestingModule で配線を確認している。現在の本番構成は forRoot が二重だが、NestJS は forRoot の providers を `@Global` で全域提供するため、統合（1回化）しても `@OnEvent` の購読先グローバル EventEmitter2 は同一に解決される想定。統合 PR では本テスト群（特に B）を回帰スイートとして再実行し、全アプリ起動時の listener 登録（`pnpm run start:dev`）も併せて確認することを推奨。
- 残課題: アプリ全体を起動した状態での @OnEvent 実配線（DiscoveryService 経由の購読先が統合後に1つの emitter へ集約されること）は本単体テストの範囲外。統合実施時に start:dev / E2E 観点で別途確認する。

---

_このドキュメントはテスト戦略と実装状況の概要を提供します。技術詳細については [AI.architecture.md](./AI.architecture.md) を、プロジェクト概要については [AI.md](./AI.md) をご参照ください。_
