# イベント設計・discord⇔domains 接続 リファクタリング計画書

**作成日:** 2026-07-06
**ステータス:** 未着手（計画のみ・コード変更なし）。**ただし 2026-07-07 の Codex 全体バランスレビューにより、E-2（特に E-2a/E-2e＝必ずタイムアウトする実挙動バグ 2 箇所）は C 系列 C-3 以降の掃除より優先して次に着手すると決定**（C-8 の develop マージ後に開始。詳細は AI.refactor.md 2026-07-07 節と C 計画書の割り込みルール）。
**診断の記録:** `AI.refactor.md`『2026-07-06 設計評価』節（本書の元になった診断・裏取り結果）
**上位方針:** `src/ARCHITECTURE.md`（依存方向・§7 Events 方針・§15 禁止事項）/ `src/events/DESIGN.md` / `src/discord/DESIGN.md`

---

## 背景（診断サマリ）

2026-07-06 の設計評価（discord アプリケーション層⇔ドメイン層の接続・イベント設計）で、以下を実コードで裏取りした。

- **健全:** 依存方向は discord→domains の一方向のみ（逆流ゼロ・forwardRef ゼロ・discord 層からの Mongoose 直アクセスゼロ）。Interaction Registry と feature 自己登録は設計通り機能。
- **問題:** イベント設計に構造問題が集中。特に「イベントバスを同一プロセス内のクエリ RPC として使う `waitForEvent` パターン」は、**必ずタイムアウトする順序バグ 2 箇所**を含む実挙動バグ。ほかにバス 2 インスタンス残存・dead contracts 10+ 件・契約の二重管理・永続化モデルの discord 層露出。

本書はこれらを bounded slice（E-1〜E-6）に分解した実施計画である。

## 検証方針（各 slice 共通）

```
pnpm run build          # nest build（コンパイル）
pnpm run check:circular # madge --circular（「No circular dependency found!」が正常）
pnpm run test           # 関連 spec → マージ前は全 suite（AI.test.md の教訓: suite 単位の未実行緑に注意）
pnpm run start:dev      # DI 解決・registry 登録数・pattern conflict なしを確認
```

- 挙動を変える slice は **characterization-first**（現挙動を RED/GREEN で固定してから変更）。
- 各 slice は独立コミット（pathspec 限定・CRLF churn を巻き込まない）。問題時は slice 単位で revert。

---

## E-1: イベント RPC 順序バグの是正（優先度1・実挙動バグ）

### 対象と現状（実コード確認済み）

`TypedEventService.emit()` は `emitAsync` でハンドラ完走まで await し、ハンドラ
（例 `src/events/handlers/character.findByChannelId.requested.ts:50`）は `.completed` を**同期チェーン内で発行**する。
つまり `await emit()` が返った時点で応答イベントは発火済み。その**後**に `waitForEvent` を登録する次の 2 箇所は
**構造的に毎回 3〜5 秒タイムアウト**する。

| 箇所                                                                               | 現象                                                                                           |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `src/discord/features/characterThread/services/character-display.service.ts:60-71` | emit → wait の順。3 秒待って必ず timeout → catch → null 返却（キャラ未検出扱い）               |
| `src/discord/features/characterEdit/services/channel-name-sync.service.ts:64-78`   | emit → wait の順。**DB 更新はハンドラ内で成功しているのに** 5 秒 timeout → false（失敗）を報告 |

### 変更内容

- 本命は E-2（DI 直呼び化）で当該コードごと消すこと。**E-2 を直接実施するなら E-1 は独立 slice として不要**。
- E-2 より先に止血だけ先行する場合: wait（`Promise.race`）の登録を emit より**前**に移す（他 6 サービスと同じ wait 先行順）。

### 検証

- characterization: 現挙動（timeout → null / false）を spec で固定 → 修正 → timeout なしで結果取得に更新。
- channel-name-sync は「更新成功時に true が返る」ことを明示的に assert。

---

## E-2: イベント RPC（クエリ/コマンドの request-response）の DI 直呼び化（優先度1・設計）

### 対象と現状（実コード確認済み・waitForEvent 利用の 8 サービス 11 箇所）

| サービス                                                                     | 待機イベント                                              | 備考                                          |
| ---------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------- |
| `characterThread/services/character-display.service.ts:69-70`                | findByChannelId.completed/failed                          | **emit→wait の壊れ順**（E-1）                 |
| `characterEdit/services/channel-name-sync.service.ts:76-77, 149-150`         | update.completed/failed, findByChannelId.completed/failed | :64 経路は**壊れ順**（E-1）                   |
| `characterEdit/enhanced-character-edit.service.ts:385-386, 416-417`          | findByChannelId / findById                                | wait 先行（動作はする）                       |
| `characterEdit/services/character-embed-manager.service.ts:114-115`          | creation.completed/failed                                 | creation は通知連鎖の起点を兼ねる（下記注意） |
| `characterEdit/services/character-modal-handler.service.ts:317-318, 357-358` | update / findById                                         | modal→更新の LIVE 経路                        |
| `characterEdit/services/character-section-editor.service.ts:297-298`         | findById                                                  |                                               |
| `diceRoll/services/pagination/dice-roll-character-provider.service.ts:44-45` | findById                                                  |                                               |

構造問題（順序が正しい箇所にも共通）:

1. **correlationId が無い** — `waitForEvent` は「そのイベント名の次の 1 件」を取るだけ。並行インタラクション時に他リクエストの応答と混線し得る。
2. **リソースリーク** — `Promise.race` の負け側 waiter は timer と once リスナーが残存し、timeout 時の reject は unhandled rejection になる（`TYPED_EVENT_EMITTER` は `maxListeners: 10`・`verboseMemoryLeak: false` で警告も出ない）。
3. **2 経路併存** — 同じ「channelId からキャラ取得」が DI 直呼び（約 20 箇所）とイベント RPC の 2 経路にあり、S-1（projection 不足）型の**片経路だけ直るバグ**の温床。

### 変更内容

**方針: correlationId を導入して直すのではなく、同一プロセス内のクエリ/コマンドをイベントで行うこと自体をやめる。**

- 各サービスに `CharacterService`（必要に応じ `DiceRollService`）を DI 注入し、`findByChannelId` / `findById` / 更新系を直接呼ぶ。
- イベントは**通知（fire-and-forget）専用**に限定する（`character.*.completed` → discord/events/handlers の UI 更新連鎖は現行のまま）。
- `waitForEvent` はテスト用途に格下げ（production コードでの新規利用は禁止事項へ）。

**slice 分割（サービス単位・クエリ系から着手）:**

- E-2a: `character-display.service.ts`（findByChannelId → DI 化。E-1 を包含）
- E-2b: `dice-roll-character-provider.service.ts` / `character-section-editor.service.ts`（findById 系）
- E-2c: `enhanced-character-edit.service.ts`（findByChannelId / findById）
- E-2d: `character-modal-handler.service.ts`（findById ＋ update。update は `character.update.requested` → handler 経由が LIVE 経路のため、**DI 化するか requested 発行を残すかを事前に棚卸し**。DI 化する場合は update.completed 通知の発行責務を移す先を決める）
- E-2e: `channel-name-sync.service.ts`（update ＋ findByChannelId。E-1 を包含）
- E-2f: `character-embed-manager.service.ts`（creation。**注意:** `character.creation.requested` の発行は `CharacterCreationRequestedHandler` → `creation.completed` → discord 側 UI 更新の連鎖起点を兼ねる。単純 DI 化すると通知連鎖が切れるため、「CharacterService 直呼び＋ completed 通知は継続発行」等の形を設計してから着手）

### 検証

- 各 slice: 対象サービス spec（characterization → DI 化 → 緑）＋ `handlers.integration.spec`（registry 登録数不変）。
- E-2 完了時: `findBy*.completed/failed` の受け手が waitForEvent の一時 once のみだったことから、恒常購読者ゼロを grep で確認（E-3 の前提）。

---

## E-3: dead contracts / dead emit の撤去（優先度2・掃除）

### 対象と現状（emit/listen 全数調査済み）

**発行のみ・恒常購読者ゼロ（dead emit）:**

| イベント                                                                                                      | 発行元（例）                                                                                              |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `character.creation.failed` / `character.update.failed`                                                       | `events/handlers/character.creation.requested.ts:299` / `character.update.requested.ts:265`               |
| `character.findBy*.completed/failed`（E-2 完了後）                                                            | `events/handlers/character.findBy*.requested.ts`                                                          |
| `diceroll.execute.completed/failed`                                                                           | `services/dice/dice-roll-logic.service.ts:61,90`（購読者ゼロは AI.discord.md 2026-06-11 でも確認済み）    |
| `discord.message.send.requested`                                                                              | `characterEdit/enhanced-character-edit.service.ts:78,98,347,498`                                          |
| `discord.message.embed.update` / `discord.embed.character.update.requested`                                   | `character-display.service.ts:244,270` / `character-display-handler.service.ts:106` ほか                  |
| `characterEdit.section.selected` / `characterEdit.field.selected` / `characterEdit.creation.completed/failed` | `character-edit-event-emitter.service.ts` / `character-edit-creation.handler.ts:81,97`（as any キャスト） |
| `discord.character.display.completed/failed`                                                                  | `character-display-handler.service.ts:73,88`                                                              |
| `character-thread.creation.failed` / `discord.thread.create.failed`                                           | `thread-orchestrator.service.ts:91` / `discord.thread.create.requested.ts:67`                             |
| `discord.interaction.start` / `discord.interaction.processed`                                                 | `interactions/interactions.service.ts:36,52,67,80`（**素の EventEmitter2 へ発行＝型付きバスのバイパス**） |

**購読のみ・発行者ゼロ（dead listener / dead contract）:**

- `characterEdit.validation.completed`（`character-edit-feature.handler.ts:30`）
- `characterEdit.creation.requested`（`character-edit-creation.handler.ts:43`）
- `discord.channel.create.*` / `event.processing.failed` / `event.dead.letter`（契約定義のみ・未使用）

**未使用ヘルパー:** `TypedEventEmitter.requestDiceRoll()`（`core/events/typed-event.service.ts:273`。`diceroll.execute.requested` は発行箇所ゼロ・購読者ゼロ）。

### 変更内容

- dead emit / dead listener / 未使用契約・ヘルパーを撤去する。**残す場合（将来の失敗監視など）は購読者を実装して生かすかを個別判断**し、判断結果を AI.event.md に記録する。
- `interactions.service.ts` の素の EventEmitter2 注入＋メトリクス emit は撤去（monitoring 系へ正式配線する場合は TypedEventService の契約付きイベントとして再設計）。
- 撤去は「発行しているから連携が動いている」という誤読の解消が目的。1 slice = 1 系統（character.\*.failed 系 / diceroll 系 / characterEdit 系 / interaction メトリクス系）で分割。

### 検証

- 各 slice: grep で撤去シンボル・イベント名の残存参照ゼロ / build / 全 suite / start:dev。

---

## E-4: 契約の一本化とバス 1 インスタンス化（優先度2）

### 対象と現状（実コード確認済み）

1. **契約の二重管理:** `events/contracts/unified-event-contracts.ts`（events 層ハンドラが参照）と `events/contracts/index.ts` の `AppEventContracts`（TypedEventService / TypedEventEmitter が参照）が並存。payload 形状に重複と差分がある。
2. **マジック文字列:** `EVENT_NAMES` 定数は 8 件のみで、残り 20+ イベントは文字列直書き（ARCHITECTURE §15「event name の文字列直書き追加」禁止と緊張）。`characterEdit.creation.*` は契約外で `as any` キャストあり。
3. **バス 2 インスタンス:** `core/events/core-events.module.ts` が `EventEmitterModule.forRoot()`（素の EventEmitter2）と `'TYPED_EVENT_EMITTER'`（別 new）の**両方**を提供。素のバスと typed バスは相互に届かない。

### 変更内容

- E-4a: 契約を `unified-event-contracts.ts` へ統合し、`AppEventContracts` を統合後の型から導出（または撤去）。`characterEdit.*` を契約へ正式追加し `as any` を排除。
- E-4b: `EVENT_NAMES`（または型リテラル参照）を全イベントに完備し、文字列直書きを一掃。
- E-4c: EventEmitter2 を 1 インスタンスへ（**順序注意:** E-3 で素の EventEmitter2 注入箇所を先に撤去してから `EventEmitterModule.forRoot()` を除去する。逆順だと DI 解決エラー）。`maxListeners` / `verboseMemoryLeak` の設定値も 1 箇所に集約して見直す。

### 検証

- build / tsc 0 errors / 全 suite / start:dev（イベント配信の生存確認: creation → completed → UI 更新連鎖）。

---

## E-5: 3 層ルーティングの 1 本化（優先度3・discord/DESIGN.md Phase 2 の実行）

### 対象と現状

`src/discord/services/discord-interaction-handler.service.ts`:

- buttons/modals/selects の **Map キャッシュは登録箇所ゼロ（dead 構造）**のまま fallback 分岐だけが残る（Map → `InteractionsService.execute()` → Registry の 3 層）。
- `InteractionsService` と二重の「応答済みチェック」。
- `clearExpiredInteractions()` は filter が常に true で全件削除する実装。`processedInteractions` は interaction 1 件ごとに 5 分の setTimeout を張る。

### 変更内容

- Map キャッシュと register\* API を撤去し、dispatcher → Registry の直結へ（discord/DESIGN.md Phase 2 チェックリストと合流）。
- 応答済みチェックの重複解消、`processedInteractions` / `clearExpiredInteractions` の要否見直し（discord.js が同一 interaction を二重配信しない前提なら撤去候補）。

### 検証

- `handlers.integration.spec` の登録数不変 / start:dev で batch 登録数・pattern conflict なし / 全 suite。

---

## E-6: entity/schema 分離とドメイン境界の是正（優先度3・中期・スコープ定義のみ）

### 対象と現状

- `Character` は Mongoose `@Schema` クラスそのもの（`domains/character/models/character.model.ts`）で、discord 層 30+ ファイルに型露出。entity/schema 未分離が「Character 型と Entity 型の不一致（TS エラー 22 個・AI.discord.md 記載）」の根因。モデル自体に `discordChannelId` / `discordThreadId` / `threadId`（後 2 者は重複疑い）が埋まる。
- `domains/character/character.controller.ts:294,334` が `discord.thread.create.requested` / `discord.character.display.requested` を発行＝ドメインパッケージが Discord ユースケースを知る（ARCHITECTURE §9「domain はイベント発行しない・feature/application 層が発行する」と緊張）。
- ファイル規模: domains 39 vs discord 198（features 119）。Web/Discord 双方から使うべきロジック（例: ダイス履歴の保存キー解決）が discord 層にあり Web から再利用できない。

### 変更内容（本計画では実施しない・別計画書に切り出す）

- discord 層へ露出する型の DTO/entity 化（最低限、@Schema 直参照の段階的置換）。
- `character.controller.ts` のイベント発行の置き場所判断（application/feature 層へ移すか、controller＝application 層と明文化するか）。
- `discordThreadId` / `threadId` の重複棚卸し。
- 共通ビジネスロジックの domains 側への引き上げ候補の棚卸し。

---

## 実施順序と依存関係

```
E-2（a→f。E-1 は E-2a/E-2e に包含。止血先行する場合のみ E-1 単独）
  → E-3（E-2 完了で findBy*.completed/failed も dead 化してから一括掃除）
    → E-4（E-3 で素バス注入を撤去してから forRoot 除去）
E-5 は独立（いつでも可・discord/DESIGN.md Phase 2 と同一）
E-6 は中期・別計画書
```

## スコープ外（やらないこと）

- 分散イベント基盤（外部キュー・DLQ・リトライ永続化）の導入はしない（in-process の EventEmitter2 で十分）。
- correlationId 方式の request-response 基盤化はしない（E-2 の方針＝クエリをイベントで行わない、と矛盾するため）。
- customId 契約の横断整理（discord/DESIGN.md Phase 3）・commands の feature 移動（Phase 4）は本計画に含めない。
