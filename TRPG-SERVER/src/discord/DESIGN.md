# Discord 層 統合設計書

**最終更新**: 2026-05-30  
**ステータス**: 設計確定・Phase 0 一部着手 / 未完了  
**関連**: [AI.discord.md](./AI.discord.md) / [interactions/README.md](./interactions/README.md) / [interactions/MIGRATION_GUIDE.md](./interactions/MIGRATION_GUIDE.md)

---

## 1. 目的

`src/discord` 配下のアーキテクチャを評価し、現状の問題・目標境界・段階的リファクタ計画を一本化する。

**設計の方向性は正しい**（Feature 分割 + Registry + Orchestrator + Event 駆動）が、**Registry 移行が入口のみ完了**しており、所有権・customId 契約・Module 依存が未整理の中間状態にある。

---

## 2. 現状評価

### 総合スコア: **78 / 100**（良好だが移行途中）

| 観点               | スコア | コメント                                        |
| ------------------ | ------ | ----------------------------------------------- |
| レイヤー分離・責務 | 85     | features / services / interactions の意図は明確 |
| 拡張性             | 82     | Registry + Orchestrator パターンは妥当          |
| 一貫性             | 65     | 旧実装と新実装が並存、customId 不統一           |
| 保守性             | 72     | InteractionsModule 肥大、手動 handler 登録      |
| テスト             | 70     | Registry 周りは充実、feature 層は薄い           |
| ドキュメント       | 60     | 移行ドキュメントが未整備だった（本書で補完）    |

### 2.1 合意できる問題一覧

| #   | 問題                                                                                             | 深刻度 |
| --- | ------------------------------------------------------------------------------------------------ | ------ |
| A   | **InteractionsModule が God Module**（registry + handlers + adapters + pagination + monitoring） | 🔴     |
| B   | **ルーティング経路が 3 層並存**（Map キャッシュ → InteractionsService 特例 → Registry）          | 🔴     |
| C   | **customId 契約が分散・不統一**（handler 不一致 → pagination 無反応）                            | 🔴     |
| D   | **循環依存 + ModuleRef**（`forwardRef`, `ModuleRef.get(InteractionsController)`）                | 🟠     |
| E   | **UI / 状態 / 外部取得が同一 Service に混在**                                                    | 🟠     |
| F   | **旧実装の並存**（`interactions/button/` vs `features/diceRoll/adapters/`）                      | 🟡     |
| G   | **Legacy 資産**（`DiscordService`, 未使用 Map ルーティング等）                                   | 🟡     |

---

## 3. 現状アーキテクチャ（As-Is）

```
Discord.js Event
  → DiscordInteractionHandlerService（Map キャッシュ、未登録時フォールバック）
    → InteractionsService.execute()（character 系特例 if 分岐あり）
      → InteractionsController.handleInteraction()
        → InteractionRegistryService.route()
          → handlers/* → adapters / legacy services
```

### Module 依存（問題箇所）

```
DiscordModule ──forwardRef──► InteractionsModule
InteractionsModule ──providers──► diceRoll adapters, pagination, monitoring（重複所有）
DiceRollFeatureModule ──imports──► InteractionsModule  ← 循環
```

### InteractionsModule の問題

- providers / exports が 40 以上
- `PerformanceOrchestratorService` 等が `DiscordModule` と二重登録
- feature 実装を所有しており「shared container」化している

---

## 4. 目標アーキテクチャ（To-Be）

### 4.1 フォルダ構成

```
discord/
├── core/                          ← 新設（既存を移動・集約）
│   ├── discord-client.service
│   ├── discord-facade.service
│   ├── interaction-dispatcher     ← DiscordInteractionHandlerService を縮小
│   └── command-registration
│
├── interactions/                  ← ルーティング基盤のみ
│   ├── registry/
│   ├── pattern-matcher/
│   ├── handlers/base/
│   ├── interactions.controller
│   └── interactions.module        ← export は registry 系のみ
│
├── features/
│   ├── diceRoll/
│   │   ├── handlers/
│   │   ├── adapters/              ← interaction execute ロジック
│   │   ├── pagination/
│   │   ├── ports/                 ← CharacterProvider 等
│   │   ├── custom-id/             ← Factory + Parser + 定数
│   │   ├── commands/
│   │   └── dice-roll.module.ts
│   ├── characterEdit/
│   ├── characterThread/
│   ├── gameSystem/
│   └── userDefinedDice/
│
├── shared/                        ← feature 横断の純粋ユーティリティ
│   ├── custom-id/                 ← 共通パーサ基底（任意）
│   └── discord-ui-builders/
│
├── commands/                      ← 当面維持、中長期で feature/commands へ
├── services/dice/                 ← 計算エンジン（feature 非依存）
└── services/monitoring/           ← core または DiscordModule のみで provide
```

### 4.2 目標フロー

```
Discord.js Event
  → core/interaction-dispatcher（type 振り分けのみ）
    → interactions/registry.route()
      → features/*/handlers/*.handler
        → features/*/adapters or orchestrators
          → domains/* or ports/*
```

### 4.3 最重要原則

> **InteractionsModule は feature 実装を所有しない。**  
> 役割は「受け取った interaction を登録済み handler に渡す」だけ。

### 4.4 目標 Module 依存

```
DiscordModule
  ├── CoreModule
  ├── InteractionsModule（registry のみ export）
  ├── DiceRollFeatureModule
  ├── CharacterEditModule
  └── CharacterThreadFeatureModule

DiceRollFeatureModule
  ├── imports: DiceRollModule(domain), CharacterModule, InteractionsModule（registry のみ）
  ├── providers: handlers, adapters, pagination, ports, custom-id
  └── onModuleInit: registry.registerHandlers([...diceRoll handlers])

InteractionsModule
  ├── imports: feature module を import しない
  ├── providers: Registry, PatternMatcher, Controller, InteractionsService（薄い委譲）
  └── exports: InteractionRegistryService, PatternMatcherService のみ
```

FeatureModule が `InteractionsModule` から Registry を import し、自身の `onModuleInit` で handler を登録する。  
`InteractionsModule` 側が feature module を import すると所有権が逆流し、God Module 化と循環依存が再発するため禁止する。

---

## 5. レイヤー責務

| レイヤー               | やること                                     | やらないこと                    |
| ---------------------- | -------------------------------------------- | ------------------------------- |
| **core**               | Client 初期化、イベント購読、Facade          | customId 解析、ビジネスロジック |
| **interactions**       | Registry、PatternMatcher、Handler 基底       | pagination、adapter、monitoring |
| **feature/handlers**   | customId パターン定義、`execute` の 1 行委譲 | Embed 生成、DB アクセス         |
| **feature/adapters**   | Discord interaction の応答処理               | ルーティング登録                |
| **feature/pagination** | 状態管理、Embed/Component 組み立て           | Character 取得（→ port 経由）   |
| **feature/ports**      | 外部データ取得（Character、Event 等）        | Discord.js UI                   |
| **feature/custom-id**  | 生成・解析・パターン定数                     | 処理ロジック                    |
| **services/dice**      | ダイス計算・パース（純粋）                   | Discord UI                      |

### ports パターン（進行中の良い例）

`DiceRollCharacterProviderService`（`components/pagination/dice-roll-character-provider.service.ts`）は **ports への第一歩**。

- pagination service → embed/component/state 操作に専念
- character 取得・event request/response → provider/port に隔離

---

## 6. customId 契約

### 6.1 原則

1. **生成**は Factory のみが行う（文字列直書き禁止）
2. **解析**は Parser のみが行う
3. **Handler pattern**は定数を参照する
4. **テスト**で Factory ↔ Parser ↔ Handler pattern の三者一致を保証する

### 6.2 diceRoll ページネーション（Canonical）

**正（採用）**: `dice-roll-pagination.service.ts` が生成する形式

| 操作       | Canonical customId                         | Handler pattern    |
| ---------- | ------------------------------------------ | ------------------ |
| 先頭       | `dice-page-first*{messageId}*{channelId}`  | `dice-page-first`  |
| 前         | `dice-page-prev*{messageId}*{channelId}`   | `dice-page-prev`   |
| 次         | `dice-page-next*{messageId}*{channelId}`   | `dice-page-next`   |
| 末尾       | `dice-page-last*{messageId}*{channelId}`   | `dice-page-last`   |
| キャンセル | `dice-page-cancel*{messageId}*{channelId}` | `dice-page-cancel` |
| ページ選択 | `dice-page-select*{messageId}*{channelId}` | `dice-page-select` |
| キャラ選択 | `dice-char-select*{messageId}*{channelId}` | `dice-char-select` |

### 6.3 Legacy（廃止対象）

| 操作                      | Legacy 形式                                             | 生成元（例）                                            |
| ------------------------- | ------------------------------------------------------- | ------------------------------------------------------- |
| 前/次/先頭/末尾           | `dice-prev*`, `dice-next*`, `dice-first*`, `dice-last*` | `features/diceRoll/adapters/*`, `interactions/button/*` |
| アンダースコア形式        | `dice_page_prev_{channelId}` 等                         | `interactions/button/dice-button-ui.service.ts`         |
| キャラスレッド pagination | `dice-prev*{msg}*{ch}`                                  | `interactions/button/character-dice-buttons.service.ts` |

**Legacy は Registry handler に届かず「未登録インタラクション」になる。Phase 0 で解消する。**

### 6.4 フレキシブルダイス（別系統として明示）

| 系統      | customId                            | 用途                                      |
| --------- | ----------------------------------- | ----------------------------------------- |
| param 系  | `flexible-dice-param*{characterId}` | パラメータ選択 → モーダル                 |
| select 系 | `flexible_dice_{channelId}`         | ダイスタイプ選択 → 即時ロール or モーダル |

無理に 1 つに統合せず、命名規則（kebab-case + `*` 区切り）を Phase 3 で段階的に揃える。

### 6.5 custom-id モジュール API 例

```typescript
// features/diceRoll/custom-id/dice-page.custom-id.ts
export const DicePageCustomId = {
  prev: (messageId: string, channelId: string) => `dice-page-prev*${messageId}*${channelId}`,

  parse: (customId: string) => {
    const [action, messageId, channelId] = customId.split('*')
    return { action, messageId, channelId }
  },

  patterns: {
    prev: 'dice-page-prev',
    next: 'dice-page-next'
    // ...
  }
}
```

---

## 7. 段階的リファクタ計画

### Phase 0 — customId 統一（即効性・不具合直結）

**目的**: pagination 無反応・handler 不一致を止める  
**規模**: 1〜2 PR
**状態**: 一部着手済み。`dice-page-*` 生成・`dice-char-select` handler・pagination `currentPage: 1` は反映済みだが、Factory / Parser 統一と legacy 廃止は未完了。

- [ ] `dice-page-*` を canonical に固定
- [ ] `character-dice-buttons.service.ts` の `dice-prev*` を `DicePageCustomId` 経由に変更
- [ ] adapter の `setCustomId('dice-prev*')` 等を canonical に合わせる
- [ ] Handler pattern と Factory の一致を integration test で固定
- [ ] pagination state / spec を 1-indexed 前提に統一
- [ ] 未参照の `interactions/button/dice-page-*.service.ts` を削除

**触らない**: Module 分割、Registry 一本化

---

### Phase 1 — diceRoll Feature 自立（最優先の構造改善）

**目的**: 変更を diceRoll feature 内で完結させる  
**規模**: 2〜3 PR

| 移動元                                 | 移動先                          |
| -------------------------------------- | ------------------------------- |
| `interactions/handlers/dice-roll/*`    | `features/diceRoll/handlers/`   |
| `components/pagination/*`              | `features/diceRoll/pagination/` |
| `interactions/button/dice-*`（残存分） | 削除 or adapters に統合         |

- [ ] `DiceRollFeatureModule` が handlers / adapters / pagination / ports / custom-id をすべて own
- [ ] `OnModuleInit` で Registry に diceRoll handler を登録
- [ ] `InteractionsModule` から diceRoll 関連 provider / export をすべて削除

---

### Phase 2 — Interactions 基盤の slim 化

**規模**: 1〜2 PR

- [ ] `InteractionsModule` export を Registry + PatternMatcher のみに
- [ ] monitoring の二重登録解消
- [ ] `DiscordInteractionHandlerService` の Map キャッシュ廃止
- [ ] `InteractionsService.execute()` の特例 if を Handler へ移管
- [ ] `ModuleRef.get(InteractionsController)` をコンストラクタ注入に置換
- [ ] `InteractionRegistryService` の `ModuleRef` 依存を削除し、明示登録のみへ寄せる

---

### Phase 3 — customId 横断整理（feature ごと）

優先: diceRoll → characterEdit → characterThread

- [ ] 各 feature に `custom-id/` を設置
- [ ] `AI.discord.md` に customId 仕様表を維持
- [ ] flexible-dice 命名規則の段階的統一

---

### Phase 4 — core 抽出 & Legacy 削除

- [ ] `DiscordService` deprecated 削除（Facade 移行完了後）
- [x] レガシー global event bus 等 legacy events 削除（B-2 T2c, 2026-05-31）
- [ ] `commands/` を各 feature の `commands/` へ段階移動
- [ ] `RegisterHandler` デコレータ + 自動登録（任意・低優先）

---

## 8. テスト戦略

| 対象                      | 種別                       | 置き場所                                               |
| ------------------------- | -------------------------- | ------------------------------------------------------ |
| customId Factory / Parser | pure unit                  | `features/diceRoll/custom-id/*.spec.ts`                |
| pagination state / cache  | unit                       | `features/diceRoll/pagination/*.spec.ts`               |
| CharacterProvider (port)  | unit（mock）               | `features/diceRoll/ports/*.spec.ts`                    |
| Handler ↔ pattern 一致   | integration-ish            | `handlers.integration.spec.ts`（feature 単位に分割可） |
| Registry route            | mocked interaction         | `features/diceRoll/handlers/*.spec.ts`                 |
| `/dice-result` 経路       | mocked Discord interaction | commands or feature commands                           |

**原則**: pagination / custom-id / ports は mock なし unit test を優先。Discord.js mock は handler/adapter 層まで。

---

## 9. スコープ外（やらないこと）

- 全 feature を一度に Module 分割しない
- Phase 1 完了前に characterEdit / characterThread の Handler 移動
- `shared/custom-id` を最初から全 feature 共通抽象化しない（diceRoll で型を固めてから横展開）
- Phase 0 前に Registry 一本化を試みない

---

## 10. 成功指標

| マイルストーン  | 期待スコア | 条件                                  |
| --------------- | ---------- | ------------------------------------- |
| 現状            | 78/100     | —                                     |
| Phase 0+1 完了  | 85/100     | customId 統一 + diceRoll feature 自立 |
| Phase 2〜4 完了 | 90/100     | Interactions slim 化 + Legacy 削除    |

---

## 11. 参考: 登録済み Interaction Handler 一覧（2026-05-30 時点）

### Character Edit（6）

`character-refresh-`, `character-create-*`, `character-compact-view-`, `character-edit-section-`, `character-field-*`, character-edit modal 系

### Dice Roll（10）

`dice-page-prev/next/first/last/cancel`, `dice-page-select`, `dice-char-select`, roll/skill/general/custom/preset/modal 系

### Character Thread（7）

`character-thread-select`, `thread-create-character`, `character-tab*`, `flexible-dice-param*`, character-dice, dice-generic, `flexible_dice_`

**未登録・不一致の代表例**: `dice-prev*` 系（Legacy 生成）、一部 `thread-create-character` の経路差異

---

## 12. 関連ファイル

| ファイル                                                | 役割                                   |
| ------------------------------------------------------- | -------------------------------------- |
| `interactions/interactions.module.ts`                   | 現状の God Module（リファクタ対象）    |
| `interactions/registry/interaction-registry.service.ts` | ルーティング中核                       |
| `interactions/interactions.controller.ts`               | Registry 委譲済み                      |
| `interactions/interactions.service.ts`                  | 特例分岐・ModuleRef 残存               |
| `services/discord-interaction-handler.service.ts`       | Map キャッシュ・3 層ルーティングの起点 |
| `components/pagination/dice-roll-pagination.service.ts` | canonical customId 生成元              |
| `features/diceRoll/dice-roll.module.ts`                 | Phase 1 で拡張する Module              |
