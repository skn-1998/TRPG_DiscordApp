# Discord 層 統合設計書

**最終更新**: 2026-08-05（CH-9 実態同期。本文の基底は 2026-05-30 のスナップショット）
**ステータス**: 設計確定。**Phase 0（customId 統一）完了** / **Phase 1（diceRoll Feature 自立）完了** / Phase 2 以降進行中
**関連**: [AI.discord.md](./AI.discord.md) / [interactions/README.md](./interactions/README.md) / [interactions/MIGRATION_GUIDE.md](./interactions/MIGRATION_GUIDE.md)

> ℹ️ 本書の現状評価・As-Is 記述は 2026-05-30 時点の表現を含む。以後の進捗（diceRoll feature 移管、`InteractionsService` の characterEdit 特例分岐撤去、#88 customId 契約化、#89 characterThread 死蔵経路 1,618 行削除など）の正本は **`AI.refactor.md`** を参照。登録 handler の実数は §11（production 登録 **27 件**・module 内訳 6/8/8/5）。`interactions/handlers/handlers.integration.spec.ts` の pin **24** はうち characterSheet の hub 系 3 handler を含まない部分集合を検証している。

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

| #   | 問題                                                                                                                      | 深刻度 |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ------ |
| A   | **InteractionsModule が God Module**（registry + handlers + adapters + pagination + monitoring）                          | 🔴     |
| B   | **ルーティング経路が 3 層並存**（Map キャッシュ → InteractionsService 特例 → Registry）                                   | 🔴     |
| C   | **customId 契約が分散・不統一**（handler 不一致 → pagination 無反応）                                                     | 🔴     |
| D   | **循環依存 + legacy fallback**（`forwardRef`, InteractionsService の特例分岐）                                            | 🟠     |
| E   | **UI / 状態 / 外部取得が同一 Service に混在**                                                                             | 🟠     |
| F   | **旧実装の並存**（`interactions/button/` vs `features/diceRoll/adapters/`）                                               | 🟡     |
| G   | **Legacy 資産**（`DiscordService` @deprecated ラッパー, 未使用 Map ルーティング等。※`DiscordFacadeService` は存続＝§4.5） | 🟡     |

---

## 3. 現状アーキテクチャ（As-Is）

```
Discord.js Event
  → DiscordInteractionHandlerService（E-5 で Map キャッシュ層を撤去済み・type 振り分けのみ）
    → InteractionsService.execute()（characterEdit 特例 if は撤去済み・全件 Registry へ委譲）
      → InteractionRegistryService.route()（InteractionsController は経由しない）
        → PatternMatcherService.findBestMatch() → handler.execute()
```

### Module 依存（問題箇所）

```
DiscordModule ──forwardRef──► InteractionsModule
InteractionsModule ──providers──► monitoring（重複所有） / legacy metrics path
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
│   └── interactions.module        ← export は registry 系のみ（controller は G5-a で削除済み）
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

### 4.5 DiscordFacadeService の位置づけ（2026-06-03 決着・存続）

**結論: `discord-facade.service.ts` は存続させ、`discord/core` のオーケストレーション・ファサードとして正式に位置づける（§4.1 の `core/` に記載済み）。**

旧調査メモ `docs/history/DISCORD_SERVICES_ANALYSIS.md` の「Phase 1 で廃止・`TypedEventService` で完全代替可能」は**事実誤認のため撤回**する。実コード（`discord-facade.service.ts`）にイベント発行（`emitEvent` 等）は存在せず、ファサードの実責務は次の 3 つ:

1. **起動オーケストレーション** `initializeDiscord()` — `main.ts` から起動時に一度呼ばれ、client/interactions/commands/guildManager/channelManager の `Promise.all` 初期化（旧 `TypedEventEmitter` の client アタッチは E-4c（2026-07-07）で空クラスごと撤去）、Discord Client 初期化、初期化メトリクスを束ねる。
2. **REST `DiscordController` の裏付け** — `verifyChannelAccess` / `verifyGuildAccess` / `verifyGuildManagePermission` / `sendMessage` / `createChannel` / `getGuildInfo` / `getChannelInfo`。各操作を `PerformanceOrchestratorService` の監視でラップして専門サービスへ委譲。
3. **ヘルス・統計の集約** — `getHealthStatus` / `getPerformanceStats`（performance dashboard 経路）。

#### REST操作の契約（2026-07-12）

**問題**: `sendMessage` / `createChannel` で、専門serviceのDiscord SDKオブジェクトをfacadeがそのまま返す一方、controllerは `{ success, messageId/channelId, error }` を前提としていた。この不一致により、Discord操作が成功してもHTTP応答の `success` が欠落した。また、HTTPで受理した単数 `embed`、16進文字列の色、文字列のチャンネル種別がSDK境界まで正規化されていなかった。

**事前条件**:

- メッセージ送信には `content`、単数 `embed`、複数 `embeds` のいずれかが必要で、利用者は対象チャンネルへのアクセス権を持つ。
- Embed色は `0..0xFFFFFF` の整数、または `#RRGGBB` 形式とし、後者はDTO境界で整数へ変換する。
- `create-channel` はguild channelだけを作る。親テキストチャンネルが必要な `thread` は400で拒否し、通常テキストチャンネルへ暗黙変換しない。
- チャンネル作成を伴う REST `create-channel` / `post-character` とスラッシュコマンド `create-dice-channel` は、対象ギルドでのユーザーの基底権限 `ManageChannels` を必要とする。呼び出しチャンネル限定の overwrite による付与は、ギルド全体のチャンネル作成を許可しない。
- `create-channel` で permission overwrite を指定する場合（非空 `permissions`）は、さらに呼び出し元の `ManageRoles` と、overwrite で指定した各権限（allow/deny の全キー）の保持を要求する（Discord ネイティブの overwrite 編集意味論に準拠）。判定の粒度は非対称: **`ManageChannels` / `ManageRoles` は guild 基底 AND（parent 指定時）カテゴリ実効の両方**を要求する意図的過剰制限（Bot による代理作成のため）、**overwrite で指定した各権限**は parent 指定時はカテゴリ実効のみ・なしは guild 基底で判定する。不足は既存の permission-denied と同じ 403 に分類する。`permissions: []` は overwrite 無指定扱いのままとする。

**成功時の事後条件**:

- facadeはSDK `Message` / `Channel` を外部へ返さず、`{ success: true, messageId }` または `{ success: true, channelId }` を返す。
- 単数 `embed` と複数 `embeds` はcontrollerで一つの配列へ正規化する。
- 文字列のチャンネル種別はchannel managerでDiscord `ChannelType` へ変換してからSDK実装へ渡す。文字列・数値ともguild channelの許可集合外はSDK呼出前に拒否する。

**失敗時の事後条件**:

- 専門serviceが `null` またはIDを持たない値を返した場合、facadeは必ず `{ success: false, error }` を返し、失敗メトリクスを記録する。
- 専門serviceが例外を投げた場合、facadeは失敗メトリクスを記録して再送出し、controllerがHTTP例外へ変換する。
- 失敗応答に成功IDは存在せず、成功応答に `error` は存在しない。

**不変条件**:

- controllerおよびfrontendはDiscord SDKオブジェクトの構造を判定しない。
- 入出力契約は `interfaces/discord-operation-{options,result}.interface.ts` に置き、facade・manager・SDK実装で共有する。
- SDK型への変換はSDK直前のmanager境界に閉じ込め、HTTP DTOへ逆流させない。

これらは `TypedEventService`（疎結合な domain イベント）とは責務が異なり、置換できない。`§4.2 目標フロー` 図に facade が現れないのは、あの図が **interaction ルーティング専用**（Discord.js Event → dispatcher → registry → handlers）だからであって、除外＝廃止意図ではない。bootstrap と REST 裏付けは別レイヤーの関心事である。

**`DiscordService`（@deprecated ラッパー）は削除済み**（2026-08-05 実測: ファイル不存在・`main.ts:58-60` は `app.get(DiscordFacadeService)` で facade を取得し `initializeDiscord()` を呼ぶ直 get）。現在の実ランタイム経路は

```
main.ts / discord.controller.ts
  → DiscordFacadeService
    → discord-client / interactions / commands / guildManager / channelManager / performanceOrchestrator
```

で、ラッパー段は存在しない。facade 周辺で残る Phase 4 作業は `discord/core/` への移動のみ（Phase 4 全体には `commands/` の feature 移動・`'discord-facade'` リテラル棚卸し等が未完了で残る＝下記チェックリスト）。

> 補足: `events/contracts/index.ts` の `source: ... | 'discord-facade' | string` は `| string` 込みの非強制リテラルで、facade が当該イベントを発行している実体はない（残存ラベル）。Phase 4 整理時に併せて棚卸し。

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

`DiceRollCharacterProviderService`（`features/diceRoll/services/pagination/dice-roll-character-provider.service.ts`。Phase 1 で `components/pagination/` から移管済み）は **ports への第一歩**。

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

### 6.3 Legacy（廃止済み・2026-08-05 実測）

| 操作                      | Legacy 形式                                             | 現状                                                               |
| ------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------ |
| 前/次/先頭/末尾           | `dice-prev*`, `dice-next*`, `dice-first*`, `dice-last*` | 生成コード 0 件。adapter は全て `DicePageCustomId.template()` 経由 |
| アンダースコア形式        | `dice_page_prev_{channelId}` 等                         | 生成元 `interactions/button/` ディレクトリごと削除済み             |
| キャラスレッド pagination | `dice-prev*{msg}*{ch}`                                  | 生成元 `character-dice-buttons.service.ts` 削除済み                |

**Legacy 形式の生成元は全て消滅済み。** `dice-roll.custom-id.spec.ts` が legacy 形式（`dice-prev*...`）を parse 拒否する負例 pin を保持しており、parser が legacy を受理する退行は spec で検出される（新規 generator による raw literal 再導入までは保証しない）。

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
**状態**: ✅ 完了（2026-08-05 実測確認）。Factory / Parser 統一と legacy 廃止は達成済み（§6.3）。

- [x] `dice-page-*` を canonical に固定（生成・handler 登録済み）
- [x] `character-dice-buttons.service.ts` の `dice-prev*` — ファイル自体が削除済みで対象消滅
- [x] adapter の `setCustomId` を canonical 化 — pagination/select 関連 7 adapter が `DicePageCustomId.template()` / `DiceCharacterSelectCustomId.template()` 経由（実測。残る `dice-button.adapter.ts` の `'dice_button'` は単発ボタンの別系統 literal で legacy `dice-prev*` 系ではない）
- [x] Handler pattern と Factory の一致を spec で固定（`dice-roll.custom-id.spec.ts` の三者一致＋legacy 拒否 pin・`handlers.integration.spec.ts` の pattern match 検証）
- [x] pagination state / spec を 1-indexed 前提に統一（`dice-roll-pagination.service.ts` は `currentPage: 1` 初期化・0-index 痕跡 0 件を実測）
- [x] 未参照の `interactions/button/dice-page-*.service.ts` を削除（2026-06-02。正は `features/diceRoll/adapters/dice-page-*-button.adapter.ts`）

**触らない**: Module 分割、Registry 一本化

---

### Phase 1 — diceRoll Feature 自立（最優先の構造改善）

**目的**: 変更を diceRoll feature 内で完結させる  
**規模**: 2〜3 PR
**状態**: ✅ 完了。diceRoll の handlers / adapters / pagination / custom-id は `features/diceRoll/` 側で所有し、`DiceRollFeatureModule.onModuleInit()` から Registry に明示登録する。`InteractionsModule` 側の diceRoll provider / export 所有は撤去済み。

| 移動元                                 | 移動先                          |
| -------------------------------------- | ------------------------------- |
| `interactions/handlers/dice-roll/*`    | `features/diceRoll/handlers/`   |
| `components/pagination/*`              | `features/diceRoll/pagination/` |
| `interactions/button/dice-*`（残存分） | 削除 or adapters に統合         |

- [x] `DiceRollFeatureModule` が handlers / adapters / pagination / ports / custom-id をすべて own
- [x] `OnModuleInit` で Registry に diceRoll handler を登録
- [x] `InteractionsModule` から diceRoll 関連 provider / export をすべて削除

---

### Phase 2 — Interactions 基盤の slim 化

**規模**: 1〜2 PR

- [ ] `InteractionsModule` export を Registry + PatternMatcher のみに
- [ ] monitoring の二重登録解消
- [x] `DiscordInteractionHandlerService` の Map キャッシュ廃止（E-5・2026-07-07・`491ddac`。dedup Set／5分 setTimeout も撤去し dispatcher → InteractionsService(Registry) の直結へ）
- [x] `InteractionsService.execute()` の特例 if を Handler へ移管（characterEdit 特例分岐は撤去済み・全件 Registry 委譲。撤去経緯は同ファイルの JSDoc に記録）
- [x] `ModuleRef.get(InteractionsController)` 経路を削除し、Registry 直接委譲へ寄せる
- [x] `InteractionRegistryService` の `ModuleRef` 依存を削除し、明示登録のみへ寄せる

---

### Phase 3 — customId 横断整理（feature ごと）

優先: diceRoll → characterEdit → characterThread

- [x] 各 feature に `custom-id/` を設置（契約モジュール実数: diceRoll 2・characterEdit 6・characterThread 9。#88 で raw literal 13 箇所→Factory 参照化・探索側 probe の契約定数化・ACTION_REASON 導出化まで完了）
- [ ] `AI.discord.md` に customId 仕様表を維持
- [ ] flexible-dice 命名規則の段階的統一（`flexible-dice-param*` / `flexible_dice_` の 2 系統は現存・別系統のまま）

---

### Phase 4 — core 抽出 & Legacy 削除

> `DiscordFacadeService` は §4.5 の決着により**存続**（`core/` へ移動）。Legacy の `DiscordService` ラッパーは削除済み（§4.5）。

- [ ] `DiscordFacadeService` を `discord/core/` へ移動（§4.1 To-Be 配置）
- [x] `main.ts` の初期化を `DiscordFacadeService` 直 get へ置換済み（`main.ts:58-60` で facade を `app.get` し `initializeDiscord()` を呼ぶ 2 行を実測）
- [x] `discord.controller.ts` の `DiscordService` 注入を `DiscordFacadeService` 直注入へ置換済み（`verifyGuildManagePermission` / `getBotStatus` 等の利用経路も移管済み）
- [x] `DiscordService` deprecated を削除済み（2026-08-05 実測: ファイル不存在・production TypeScript の import/値参照 0 件）
- [ ] `events/contracts/index.ts` の `'discord-facade'` 残存リテラルを棚卸し
- [x] レガシー global event bus 等 legacy events 削除（B-2 T2c, 2026-05-31）
- [ ] `commands/` を各 feature の `commands/` へ段階移動
- ~~`RegisterHandler` デコレータ + 自動登録~~（**取り下げ** — 未使用のまま死蔵化し G5-e 2026-08-05 で
  削除。登録は各 feature module の `registerHandlers()` 明示列挙を正とする）

---

## 8. テスト戦略

| 対象                      | 種別                       | 置き場所                                               |
| ------------------------- | -------------------------- | ------------------------------------------------------ |
| customId Factory / Parser | pure unit                  | `features/diceRoll/custom-id/*.spec.ts`                |
| pagination state / cache  | unit                       | `features/diceRoll/pagination/*.spec.ts`               |
| CharacterProvider (port)  | unit（mock）               | `features/diceRoll/ports/*.spec.ts`                    |
| Handler ↔ pattern 一致    | integration-ish            | `handlers.integration.spec.ts`（feature 単位に分割可） |
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

## 11. 参考: 登録済み Interaction Handler 一覧（2026-08-05 実測）

> ⚠️ **production の登録総数は 27 件**（各 feature module の `registerHandlers` 実物列挙・内訳 6/8/8/5）。`handlers.integration.spec.ts` の `totalHandlers` pin は **24** で、characterSheet の hub 系 3 handler を含まない部分集合を検証している。#89（2026-08-05・`32186df`）は死蔵だった `character-thread-select` handler を削除し production **28→27**（spec は 25→24）。同 handler の唯一の production builder（未使用 `data` フィールドの `.setCustomId('character-thread-select')`）には生成・消費の実経路がなかった。

### Character Edit（6・CharacterEditModule）

refresh / create / compact-view / edit-section / field / modal

### Dice Roll（8・DiceRollFeatureModule）

dice-page prev / next / first / last / cancel / select、dice-char-select、dice-roll modal

### Character Thread（8・CharacterThreadFeatureModule）

character-thread-create / character-tab / flexible-dice-param / dice-generic / flexible-dice-select / skill-roll / ability-roll / preset-dice quick-roll

### Character Sheet（5・CharacterSheetDiscordFeatureModule）

roll-palette / resource-delta / hub-group-select / hub-panel-navigation / hub-group-browser-navigation

**旧「未登録・不一致」は解消済み**: `dice-prev*` 系の Legacy 生成元は消滅（§6.3）。#89 は死蔵 `character-thread-select*` 経路を削除し、スレッド作成は live の `character-thread-create` 系経路のみになった。

---

## 12. 関連ファイル

| ファイル                                                                | 役割                                                                                                                                                                |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `interactions/interactions.module.ts`                                   | slim 化進行中（feature import / monitoring は P1-A 撤去済・残整理は Phase 2）                                                                                       |
| `interactions/registry/interaction-registry.service.ts`                 | ルーティング中核（本番 dispatch は `findBestMatch` → `getMatchScore` の 1 本）                                                                                      |
| `interactions/interactions.controller.ts`                               | **削除済み**（第5群 G5-a `c3b4d1b`・2026-08-05。production 消費者 0 の裁定どおり commands.controller と共に撤去）                                                   |
| `interactions/interactions.service.ts`                                  | 特例分岐・ModuleRef とも撤去済み。Registry へ委譲する薄い層                                                                                                         |
| `services/discord-interaction-handler.service.ts`                       | type 振り分けのみ（Map キャッシュは E-5 撤去済み）→ InteractionsService 直結                                                                                        |
| `features/diceRoll/services/pagination/dice-roll-pagination.builder.ts` | canonical customId 生成元（`.setCustomId` の実装はここ。同 dir の pagination.service は builder を呼ぶ側。Phase 1 で `components/pagination/` から feature へ移管） |
| `features/diceRoll/dice-roll.module.ts`                                 | Phase 1 で拡張した Module                                                                                                                                           |
