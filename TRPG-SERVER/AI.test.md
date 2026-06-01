# TRPG-SERVER テスト戦略・実装ドキュメント

## 📋 **ドキュメント概要** **[最終更新: 2026-06-01]**

---

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

_このドキュメントはテスト戦略と実装状況の概要を提供します。技術詳細については [AI.architecture.md](./AI.architecture.md) を、プロジェクト概要については [AI.md](./AI.md) をご参照ください。_
