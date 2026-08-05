# Interactions 移行ガイド

**最終更新**: 2026-05-30  
**参照**: [../DESIGN.md](../DESIGN.md)

Registry 方式への移行と、InteractionsModule から feature への所有権移譲手順。

---

## 移行ステータス

| 項目                                      | 状態                                                             |
| ----------------------------------------- | ---------------------------------------------------------------- |
| `InteractionsController` → Registry 委譲  | ✅ 完了                                                          |
| Handler 登録 + Registry 基盤              | ✅ 完了（登録総数は handlers.integration.spec を正・現在 23 件） |
| customId 契約の一本化                     | 🟡 diceRoll pagination は着手済み / 他 feature は未完了          |
| diceRoll → FeatureModule 分離             | ✅ 完了                                                          |
| InteractionsModule slim 化                | 🟡 一部着手 / 未完了                                             |
| ルーティング 1 本化（Map / 特例 if 削除） | ❌ Phase 2 未着手                                                |

---

## Phase 0: customId 統一

**PR 単位で完結させる。Module 構造は触らない。**

### チェックリスト

1. `features/diceRoll/custom-id/dice-page.custom-id.ts` を新設
2. ✅ `dice-roll-pagination.builder.ts` の `setCustomId(...)` を Factory 呼び出しに置換
3. `character-dice-buttons.service.ts` の `dice-prev*` → `dice-page-prev*`
4. ✅ `features/diceRoll/adapters/dice-page-*-button.adapter.ts` の template customId を更新
5. ✅ 各 Handler の `getCustomIdPattern()` を `DicePageCustomId.patterns.*` に統一
6. ✅ `handlers.integration.spec.ts` に Factory ↔ pattern 一致テストを追加
7. pagination state / spec を 1-indexed 前提に統一
8. ✅ 未参照の `interactions/button/dice-page-*.service.ts` を削除（2026-06-02 削除済み。正は `features/diceRoll/adapters/dice-page-*-button.adapter.ts`）

### 検証

```powershell
cd TRPG-SERVER
pnpm test -- handlers.integration.spec
pnpm test -- dice-roll-pagination
```

---

## Phase 1: diceRoll Feature 分離

**状態**: 完了。diceRoll handlers / adapters / pagination / custom-id は `features/diceRoll/` 側で所有し、`DiceRollFeatureModule.onModuleInit()` から Registry へ明示登録する。

### 移動手順

1. ディレクトリ作成

   ```
   features/diceRoll/
     handlers/      ← interactions/handlers/dice-roll/*
     pagination/    ← components/pagination/*
     ports/         ← dice-roll-character-provider.service.ts
     custom-id/
   ```

2. import パスを一括更新

3. `DiceRollFeatureModule` を拡張
   - pagination / ports / custom-id を providers に追加
   - diceRoll handlers を providers に追加
   - `implements OnModuleInit` で `registry.registerHandlers([...])`

4. `InteractionsModule` から削除
   - dice-roll handlers
   - pagination services
   - diceRoll adapters（InteractionsModule 側の duplicate provide）

5. `DiceRollFeatureModule` は `InteractionRegistryModule` を import する

`InteractionsModule` が `DiceRollFeatureModule` を import しないこと。feature 側が registry を import して handler を登録する一方向依存にする。

### 完了条件

- diceRoll 関連の変更が `features/diceRoll/` 内で完結する
- `InteractionsModule` に diceRoll adapter / pagination が存在しない

---

## Phase 2: Interactions slim 化

### チェックリスト

1. `InteractionsModule.exports` を以下のみに
   - `InteractionRegistryService`
   - `PatternMatcherService`

2. `DiscordInteractionHandlerService`
   - `buttons` / `modals` / `selects` Map を削除
   - 全 component interaction を `interactionsService.handleInteraction()` → Registry へ

3. `InteractionsService.execute()`
   - `character-section-select-*` 等の特例 if を該当 Handler へ移管
   - ✅ `ModuleRef.get(InteractionsController)` 経路は削除済み。現在は `InteractionRegistryService.route()` へ直接委譲

4. `PerformanceOrchestratorService` 等を `DiscordModule` のみで provide

5. `forwardRef(() => InteractionsModule)` の必要性を再評価・削除

6. ✅ `InteractionRegistryService` の `ModuleRef` 依存を削除し、handler は module からの明示登録に統一

---

## Phase 3: 他 Feature の customId 整理

characterEdit → characterThread の順。

各 feature に `custom-id/` を設置し、[DESIGN.md §6](../DESIGN.md#6-customid-契約) の形式に従う。

---

## Phase 4: Legacy 削除

- `DiscordService`（deprecated ラッパー）
- `interactions/button/` 残存ファイル
- レガシー global event bus 等（`events/` 側と連動）→ 撤去済み（B-2 T2c, 2026-05-31）

---

## 新 Handler 追加手順（現行）

1. `src/discord/features/{feature}/handlers/xxx.handler.ts` を作成（基底クラス継承。
   `interactions/handlers/` 配下には base/ と integration spec しか無い — handler 本体は
   feature 側が所有する）
2. `getCustomIdPattern()` / `getInteractionType()` / `execute()` を実装
3. FeatureModule.providers に追加
4. FeatureModule の `onModuleInit` の `registerHandlers([...])` に追加
5. `handlers.integration.spec.ts` に pattern テストを追加し、**登録配列と `totalHandlers` pin も
   更新**する
6. customId 生成側が Factory 経由であることを確認
7. **登録台帳の正本 = [DESIGN.md §11](../DESIGN.md) を更新**する（本手順書・
   `document/interaction-registry.md`（歴史文書）は台帳を持たない — 正本は DESIGN.md §11 の 1 つ）

---

## トラブルシューティング

### 「⚠️ このインタラクションは現在処理できません。」

1. ログの customId を確認
2. `interactionRegistry.debugInfo()` で未登録集計を確認
3. [DESIGN.md §6.3](../DESIGN.md#63-legacy廃止対象) の Legacy 形式で生成されていないか確認
4. Handler pattern と生成 customId の prefix が一致するか確認
5. **登録済み handler の防衛枝**の可能性を確認（H1-c1/c2・2026-08-05）: registry pattern は
   通過したが handler 側の契約（create の basic/cancel・field の edit/add）に一致しない場合、
   同文言＋`Unsupported character create/field customId:` の warn ログが出る。この場合
   2 の未登録集計には**現れない** — warn ログの有無で 1〜4 と切り分ける

### Handler が意図しないものにマッチする

- `PatternMatcherService.detectConflicts()` が起動時に警告を出す
- より具体的な pattern（完全一致 > 長い prefix > 正規表現）を使用する
