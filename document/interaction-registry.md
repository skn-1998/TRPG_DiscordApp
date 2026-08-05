 # Interactions Registry 移行まとめ

> ⚠️ **歴史文書（2026-08-05 注記）**: 本書は Registry 移行の計画時点のスナップショットであり、
> 移行は**完了済み**。以下の「現在の構成」「旧経路」「未移行」の記述は当時のもので現状と一致しない
> （handlers は各 feature へ移管済み・登録は各 feature module の registerHandlers・
> interactions.controller と character-dice 経路は削除済み・generic select 経路は
> H1-c2 で専用入口化）。**現況の正本は `TRPG-SERVER/src/discord/DESIGN.md`**。
 
 ## 目的
 - Discord.jsのインタラクション処理を **if分岐からRegistry方式へ移行**
 - Event駆動の構造（`events/`）とパターンを合わせる
 - CustomIdパターン単位で責務を分離する
 
 ## 現在の構成
 - `TRPG-SERVER/src/discord/interactions/registry/`
   - `interaction-registry.service.ts`
   - `pattern-matcher.service.ts`
 - `TRPG-SERVER/src/discord/interactions/handlers/`
   - `base/` に抽象ハンドラー
   - `character-edit/`, `character-thread/`, `dice-roll/` にカテゴリ別ハンドラー
 - `TRPG-SERVER/src/discord/interactions/interactions.module.ts`
   - `OnModuleInit()` でハンドラーを一括登録
 
 ## 主なハンドラー分類
 - **Character Edit**
   - `character-edit-*`, `character-section-select-*`, `character-field-*` など
 - **Character Thread**
   - `character-thread-*`, `flexible-dice-param*`, `flexible_dice_*`
 - **Dice Roll**
   - `dice-page-*`, `dice-roll-*`, `dice-character-select` など
 
 ## ルーティングの流れ
 1. `InteractionsController.handleInteraction()` が受け取る
 2. `InteractionRegistryService.route()` に委譲
 3. `PatternMatcherService` が `customId` を照合してハンドラー選択
 4. 該当ハンドラーの `execute()` が実行
 
 ## 今後の整理ポイント
 - 旧 `InteractionsService.execute()` での特例処理を段階的に縮小
 - `interactions/README.md` と `MIGRATION_GUIDE.md` の補完
 - `customId` 仕様の一覧表を移行ドキュメントに統合

## 次の対応方針
### 1. 移行完了度の可視化
- Registry対象のハンドラー一覧を確定し、未移行のcustomIdと処理経路を洗い出す
- `InteractionRegistryService.getStatistics()` の出力を使い、実運用ログから未登録パターンを検出
- `pattern-matcher` の競合警告を整理し、衝突・重複パターンを解消

### 2. 旧処理（特例ハンドリング）の整理
- `InteractionsService.execute()` の特例分岐を、該当ハンドラーへ段階的に移管
- `character-section-select-*` / `character-edit-*` / `character-field-*` をRegistry側で完結させる
- 旧処理削除後のフォールバックは `InteractionsController` の未登録応答に統一

### 3. customId仕様表の一本化
- `customId` の命名規則とパターンを1表に統合（type/用途/遷移/担当ハンドラー）
- `interactions/README.md` または `MIGRATION_GUIDE.md` へ集約し、ここから参照する
- `character-thread` と `flexible-dice` の二系統を並列表記して混乱を防止

### 4. ドキュメント補完
- `TRPG-SERVER/src/discord/interactions/README.md` に全体概要と登録手順を記載
- `MIGRATION_GUIDE.md` に段階的移行の手順と完了条件を明記

---

## 洗い出し結果（Registry対象／未移行 customId）

### Registry対象ハンドラー一覧（現行）
#### Character Edit
- `character-refresh-`（button）→ `CharacterEditRefreshHandler`
- `character-create-(basic|cancel)-`（button/regex）→ `CharacterEditCreateHandler`
- `character-compact-view-`（button）→ `CharacterEditCompactHandler`
- `character-(edit-section|section-select)-`（select/regex）→ `CharacterEditSectionHandler`
- `character-field-`（select）→ `CharacterEditFieldHandler`
- `char-edit(-modal)?-`（modal/regex）→ `CharacterEditModalHandler`

#### Dice Roll
- `dice-page-prev`（button）→ `DicePagePrevHandler`
- `dice-page-next`（button）→ `DicePageNextHandler`
- `dice-page-first`（button）→ `DicePageFirstHandler`
- `dice-page-last`（button）→ `DicePageLastHandler`
- `dice-page-cancel`（button）→ `DicePageCancelHandler`
- `dice-page-select`（select）→ `DicePageSelectHandler`
- `dice-character-select`（select）→ `DiceCharacterSelectHandler`
- `roll*custom`（button）→ `DiceRollCustomHandler`
- `preset-dice*`（button）→ `DiceRollPresetHandler`
- `roll*{diceExpression}`（button/regex: `^roll\*\d+d\d+`）→ `DiceRollGeneralHandler`
- `roll*{skill}_{channelId}`（button/regex: `^roll\*[^_]+_`）→ `DiceRollSkillHandler`
- `custom-dice-modal` / `param-dice-modal*{characterId}`（modal/regex）→ `DiceRollModalHandler`

#### Character Thread
- `character-thread-select`（select/regex）→ `CharacterThreadSelectHandler`
- `character-thread-create-select`（select）→ `CharacterThreadCreateHandler`
- `character-tab*{channelId}*{tabType}`（button）→ `CharacterTabHandler`
- `flexible-dice-param*{characterId}`（select）→ `FlexibleDiceParamHandler`
- `flexible_dice_{channelId}`（select）→ `FlexibleDiceSelectHandler`
- `character-dice*{action}*{characterId}`（button）→ `CharacterDiceHandler`
- `dice_generic_{diceType}_{channelId}`（button）→ `DiceGenericHandler`

### 旧経路で処理されている customId（Registry未依存）
- `character-section-select-` / `character-edit-` / `character-field-`  
  - 経路: `InteractionsService.execute()` → `CharacterSectionEditorService.execute()`  
  - 備考: Registry側にも一致パターンがあるため、経路の統一が必要

### 未移行・未登録の customId（処理経路の洗い出し）
- `dice-prev*`, `dice-next*`, `dice-first*`, `dice-last*`, `dice-cancel*`  
  - 生成元: `features/diceRoll/adapters/*` / `interactions/button/*`  
  - Registry側に対応ハンドラーなし（`dice-page-*` と名称が不一致）
- `dice-page-info*{messageId}*{channelId}`  
  - 生成元: `interactions/button/character-dice-buttons.service.ts`  
  - Registry側に対応ハンドラーなし
- `skill*{skillId}*{channelId}`  
  - 生成元: `interactions/button/dice-button-ui.service.ts`  
  - Registry側は `roll*` 系のハンドラーのみ（命名不一致）
- `character-modal`  
  - 定義元: `interactions.list.ts`, `features/characterEdit/events/character-edit.ids.ts`  
  - Registry側に対応ハンドラーなし
- `thread-create-character`  
  - 生成元: `features/characterThread/character-channel.service.ts` / `character-channel-orchestrator.service.ts`  
  - Registry側に対応ハンドラーなし
- `add-chara-info`, `change-chara-info`  
  - 定義元: `interactions.list.ts`（互換用のダミー定義）
  - Registry側に対応ハンドラーなし
