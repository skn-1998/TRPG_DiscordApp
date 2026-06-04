# TRPG-SERVER リファクタリング設計メモ

このドキュメントは TRPG-SERVER のリファクタリングに関する調査・方針・進捗を記録する正本。
全体方針の上位は `src/ARCHITECTURE.md`、依存・ドメインは `AI.architecture.md` / `AI.domain.md` を参照。

---

## 2026-06-04 P1-A 後続 InteractionsService.execute() の characterEdit 特例分岐を撤去（コミット `2640395`・Codex レビュー済）

P1-A の残「execute() 特例 → Registry 経路」を実施。**characterization は既存 `interactions.service.spec.ts` が現挙動を固定済み**だったため、それを土台に移管。

### Phase 1 で確定した挙動差（撤去の安全性根拠）

- `discord-interaction-handler.service` の buttons/modals/selects Map は常に空 → 全 interaction が `InteractionsService.execute()` 経由。execute() は StringSelect の `character-section-select-*`/`character-edit-*`/`character-field-*` を `CharacterSectionEditorService.execute()` へ**直接**委譲し、Registry の `CharacterEditSectionHandler`(`^character-(edit-section|section-select)-`)/`CharacterEditFieldHandler`(`character-field-`) を**影で潰す legacy bypass**だった。
- 両 registry handler は `EnhancedCharacterEditService.handleSelectMenuInteraction()` → `sectionEditor.execute()` を呼ぶ。**happy path は両経路とも sectionEditor.execute で同一**。
- 差分: registry 経路は ①`characterEdit.section.selected`/`.field.selected` を追加発火（**購読者ゼロ**＝contract 定義のみ・観測影響なし）、②エラー時の挙動（特例＝ephemeral reply「セクション選択の処理中にエラーが発生しました。」＋rethrow / registry＝log＋購読者ゼロの error event・reply なし）。→ **実質差は「section-select エラー時の ephemeral reply の有無」のみ**（happy path 不変）。

### 実施

- `interactions.service.ts`: execute() の characterEdit 特例分岐を撤去し、全 interaction を `handleInteraction()`（Registry）へ委譲。`CharacterSectionEditorService` の import / constructor inject を撤去。
- `interactions.service.spec.ts`: execute() の characterEdit セレクト3テストを「Registry へ委譲（registry.route 呼び出し）」へ更新、特例 error テスト2件を削除、sectionEditor mock/provider を除去（Phase 5: バス変更に伴う呼び出し先 expectation 更新）。

### 検証（司令塔裏取り・`/code-review` 含む）

- build 成功 / check:circular No circular dependency found!(479) / jest interactions.service + handlers.integration + registry + characterEdit = **31 suites 425 tests 緑** / start:dev で `CharacterEditSectionHandler`/`CharacterEditFieldHandler` の registry 登録・handler 総数 30(不変)・Cannot resolve なし＝**characterEdit セレクトが registry 経路で正規 handler に届くことを実機確認**。
- `/code-review`(high): 正確性バグなし。挙動差は上記の意図した error-path 差のみ。隣接 cleanup（`discord-interaction-handler.service.ts:172-174` の冗長 `character-section-select-` if＝特例撤去で fallthrough と dead-equivalent）を follow-up に記録。

### コミット状況・残（Codex レビュー結果反映）

- **コミット済 `2640395`**。Codex が「execute 特例撤去は安全（happy path 不変／error 時は汎用エラー応答経路へ・専用文言は follow-up polish で可）」「prep（ModuleRef/Controller 撤去）と同一ファイル・同一目的なので分離せずまとめてコミットしてよい」と承認。
- **ChannelCreate 移設 完了（コミット `c27d155`・Codex 設計承認済）= P1-A 完了**:
  - 新規 `CharacterEditChannelCreateListenerService`（characterEdit feature・OnModuleInit で `DiscordClientService.on(Events.ChannelCreate)` 登録・handler は旧 `InteractionsService.handleChannelCreate` と同一＝GuildText のみ→`ChannelCreateOrchestratorService.execute`・error は log して握りつぶす）。CharacterEditModule providers に追加。
  - `InteractionsService`: `handleChannelCreate()`/`loadClient()` と `ChannelCreateOrchestratorService` inject を撤去（thin service 化）。`InteractionsController`: dead な `handleCommand()`/`handleChannelCreate()`/`client`/`ChannelCreateOrchestratorService` inject を撤去（handleCommand 呼出元ゼロ）。`discord-facade`: `loadClient` 呼び出し＋未使用化した InteractionsService inject を撤去。
  - **`InteractionsModule` から `CharacterEditModule` import を撤去 → interactions core は feature module を一切 import しない（§8 達成）**。imports は `InteractionRegistryModule`＋`EventEmitterModule` のみ。
  - 検証: build / check:circular **No circular(481)** / jest characterEdit+interactions+facade **35 suites 481 緑** / start:dev で `CharacterEditChannelCreateListenerService` の ChannelCreate 登録ログ・handler 総数30不変・Cannot resolve なし / `/code-review`(focused) handler ロジック旧と同一・正確性バグなし＝挙動不変。
- 残（軽微 follow-up・別 commit）: `discord-interaction-handler.service.ts:172-174` の冗長 `character-section-select-` if（特例撤去で fallthrough と dead-equivalent）を削除。

---

## 2026-06-04 P1-A InteractionsModule slim 化（monitoring/DiceServices 撤去・挙動不変）＋ execute() 特例の挙動差を特定

Codex 司令塔の委譲（`CLAUDE_HANDOFF.md` P1-A）。InteractionsModule を Registry + thin service へ寄せる。
**挙動不変で安全な module slim 化のみ実施**し、挙動影響のある execute() 特例撤去は Phase 1 分析の結果を記録して後続に残した。コミット `0ccf0d5`（interactions.module.ts のみ）。

### 実施（挙動不変・`0ccf0d5`）

- 監視サービス（PerformanceOrchestrator/MetricsCollector/Alert/DiscordMonitor）の providers/exports を InteractionsModule から撤去。**DiscordModule が既に同4サービスを providers/exports で所有**しており、InteractionsModule 側は重複登録（Metrics/Alert は `@OnEvent` を持つため重複インスタンスで二重 @OnEvent 登録になっていた）。撤去で単一所有・単一登録に。start:dev で各サービスが**1回のみ初期化**されることを確認。
- `DiceServicesModule` の import / re-export を撤去（構造課題③ Part B 以降 interactions は dice を直接使わず、diceRoll/characterThread feature は DiceServicesModule を直接 import するため re-export 依存もなし。commands/discord も未使用を grep 確認）。
- 未使用の `CharacterModule` import を撤去（InteractionsService/Controller は CharacterService を inject しない）。
- 検証: build 成功 / check:circular No circular dependency found!(479) / start:dev で「successfully started」・BOT 起動・登録 handler 総数 30(不変)・monitoring 単一初期化・Cannot resolve/実エラーなし＝挙動不変。

### ★ Phase 1 分析: execute() characterEdit 特例撤去は「挙動影響あり」（後続・要 characterization）

interactions の interaction dispatch 実経路を実コードで確認:

- `DiscordInteractionHandlerService` の buttons/modals/selects Map は**常に空**（register\* 呼び出し元ゼロ）→ 全 button/select/modal は `InteractionsService.execute()` へフォールバック＝**execute() が実経路**。
- `InteractionsService.execute()` は StringSelectMenu の `character-section-select-*`/`character-edit-*`/`character-field-*` を `CharacterSectionEditorService.execute()` へ**直接**委譲（Registry をバイパス）。それ以外は `handleInteraction()`→`routeInteraction()`→`InteractionRegistryService.route()`。
- Registry には `CharacterEditSectionHandler`(`^character-(edit-section|section-select)-`)・`CharacterEditFieldHandler`(`character-field-`) が登録済みだが、上記特例が**先に握るためバイパスされている**。両 handler は `EnhancedCharacterEditService.handleSelectMenuInteraction()` → `sectionEditor.execute()` を呼ぶ。

**等価性の結論**: happy path は両経路とも `sectionEditor.execute(interaction)` で**同一**。ただし Registry 経路は ①`emitSectionSelected` を追加発火、②エラー処理が異なる（特例＝ephemeral reply「セクション選択の処理中にエラーが発生しました。」＋rethrow / Registry＝`emitError`＋`handleServiceError`・reply なし）。→ **特例撤去は error path・イベント発火が変わる挙動変化**。ハンドオフ目標「挙動は変えない」かつ skill の安全網方針に従い、blind 撤去はしない。

### 残（P1-A 後続・要 characterization／一部 Codex 判断）

1. **execute() 特例撤去 → CharacterEditModule import 撤去**: `interactions.service.spec.ts` で現挙動（特例の委譲先・error 時 reply）を characterization 固定 → Registry 経路へ寄せる（emitSectionSelected/error 差を許容する設計判断 or handler 側で reply 等価化）→ `CharacterSectionEditorService` inject 除去。
2. **ChannelCreate 委譲**: `InteractionsService.loadClient()`→`handleChannelCreate()`→`ChannelCreateOrchestratorService.execute()`。これは interaction でなく Discord channel event。feature/discord-event 側へ移せれば `ChannelCreateOrchestratorService` inject も外れ、**CharacterEditModule import を完全撤去**できる。影響大なら残件（ハンドオフ明記）。
3. 上記2つが解けて初めて InteractionsModule の最後の feature import（CharacterEditModule）が外れる。

---

## 2026-06-03 構造課題③ Part B characterThread の feature 移管・CharacterThreadFeatureModule import 撤去（挙動不変）

③ 最終段の characterThread 分。handler 7個と委譲先サービスを feature 所有へ移し、interactions.module から
**CharacterThreadFeatureModule import を撤去**＝interactions core が characterThread feature を import しない形へ是正。
コミット `1975af6`（27ファイル）。実装は nestjs-best-practices サブエージェントへ委譲し、**司令塔が build/circular/start:dev で再裏取り**。

### 実施

- handler 7個(+spec): `interactions/handlers/character-thread` → `features/characterThread/handlers`（rename）。
- `CharacterThreadSelectService`(+spec): `interactions/select` → `features/characterThread/services`（characterThread 3 handler 専用・CharacterThreadOrchestrator を inject）。
- character-dice クラスタ4ファイル(+spec): `interactions/button` → `features/characterThread/services`（CharacterDiceButtonsService=character-dice handler 専用 DI provider／CharacterDiceHistoryService=`new` 生成の plain class／character-dice-format.util・character-dice-history.pure=純関数）。
- `CharacterThreadFeatureModule`: 7 handler＋CharacterThreadSelectService＋CharacterDiceButtonsService を providers 追加、`OnModuleInit` で registry 登録、imports に `InteractionRegistryModule`・`DiceServicesModule`・`DiceRollModule`・`DiceRollPaginationModule` を追加（**forwardRef 新規なし**）。
- `interactions.module`: 上記の import/provider/export/onModuleInit を全撤去し **CharacterThreadFeatureModule import を撤去**。不要化した `DiceRollModule`/`DiceRollPaginationModule` import も撤去。class 本体は空（OnModuleInit 不要に）。
- `interactions/button`・`interactions/select`・`interactions/handlers/character-thread` は空になり消滅。

### 設計メモ

- `CharacterDiceButtonsService` が `DiceRollPaginationService` を使うため `CharacterThreadFeatureModule → DiceRollPaginationModule`（feature→feature）依存が生じるが、pagination は leaf module で逆流なし＝循環なし（check:circular 475 で実証）。

### 検証（司令塔がサブエージェント報告を再裏取り）

- `pnpm run build` 成功 / `pnpm run check:circular`：**No circular dependency found!（475 files）** / `pnpm jest`（features/characterThread + interactions）= **34 suites / 499 tests 緑** / `pnpm run start:dev`：characterThread handler 7個の registry 登録（CharacterThreadFeatureModule.onModuleInit 経由）・**登録総数 30（移管前と同数＝欠落/二重なし）**・`Cannot resolve`/実エラーなし＝**挙動不変を実機確認**。

### ③ の到達点・残

- diceRoll / characterEdit / characterThread の handler は**全て feature 所有**・各 feature module が registry 登録（§8 の handler 所有形を達成）。
- interactions.module の feature module import は **CharacterThreadFeatureModule 撤去済み**。**残るは `CharacterEditModule` のみ**＝`InteractionsService` の旧 if 分岐 `execute()`（`interactions.service.ts:164-199` で `CharacterSectionEditorService` を使用）が障壁。Registry 代替を characterization で確認のうえ旧経路を撤去すれば CharacterEditModule import も外せる（**挙動影響あり・要承認**）。

---

## 2026-06-03 構造課題③ characterEdit handler の feature 移管（Part A・挙動不変）＋ §8 完全撤去の真の障壁を特定

③ 最終段（interactions.module の feature module import 全撤去）に着手。characterEdit から実施。**handler 所有は feature へ
移したが、CharacterEditModule import の撤去は別の深い結合がブロック**することが判明（重要）。コミット `a5369cf`。

### Part A 実施（handler 6個を feature 所有へ・コミット `a5369cf`）

- characterEdit interaction handler 6個(+spec) を `interactions/handlers/character-edit/` → `features/characterEdit/handlers/` へ rename（base class は `interactions/handlers/base` 参照、service は `../enhanced-character-edit.service`）。
- `CharacterEditModule`: 6 handler を providers 追加・`InteractionRegistryModule` を import・`OnModuleInit` で registry 登録（diceRoll と同方式）。CharacterEditModule は `discord-event-handlers.module` も import するため singleton 維持＝onModuleInit が走り登録される。
- `interactions.module`: 6 handler の provider/constructor/onModuleInit 登録を撤去。
- 検証: build / check:circular(475) / jest 30 suites 400 tests 緑 / start:dev で characterEdit handler 6個の registry 登録(CharacterEditModule 経由)・無エラー＝挙動不変。

### ★ §8「feature module import 全撤去」の真の障壁（Phase 1 で特定）

handler 移管だけでは import は外せない。interactions 常駐コードが feature サービスに結合しているため：

- **characterEdit（撤去ブロック・挙動影響あり）**: `InteractionsService`（interactions core 中核）が `CharacterSectionEditorService` を inject し、**旧 if 分岐ルーティング**（`interactions.service.ts:164-199` の `execute()`）で `character-section-select-`/`character-edit-`/`character-field-` を手動ルーティングしている（「discord-interaction-handler 互換のため」）。これは Registry が置き換えるはずの旧経路（CharacterEditSection/FieldHandler が同 customId を担当）。CharacterEditModule import を外すにはこの旧 execute() 経路の撤去が前提＝**Registry が完全代替するか確認のうえ削除する挙動影響リファクタ**。なお `InteractionsService` の `CharacterUIService` 注入は**未使用（dead injection）**。
- **characterThread（撤去 feasible・InteractionsService 結合なし）**: interactions 常駐で characterThread feature を使うのは `CharacterThreadSelectService`(interactions/select/) のみ（`CharacterThreadOrchestrator` を inject）。これは characterThread 3 handler 専用。handler 7本＋`CharacterThreadSelectService`＋`CharacterDiceButtonsService`(character-dice handler 専用) を feature へ移せば CharacterThreadFeatureModule import は撤去可能（diceRoll Step5b 規模。`CharacterDiceButtonsService` は `CharacterDiceHistoryService` 等 interactions/button 常駐への依存があり整理要）。

### 残（③ 全体）

- **characterThread 移管（Part B）**: 7 handler ＋ CharacterThreadSelectService ＋ CharacterDiceButtonsService（＋CharacterDiceHistory 整理）を feature へ → CharacterThreadFeatureModule import 撤去。挙動不変リファクタ。
- **characterEdit の InteractionsService 旧 execute() 撤去**: Registry 代替を安全網で確認 → 旧 if 分岐削除 → CharacterUIService(dead) と CharacterSectionEditorService 注入を除去 → CharacterEditModule import 撤去。**挙動影響ありのためユーザー承認＋characterization 必須**。

---

## 2026-06-03 構造課題③ Step5b orchestrator/dice ロジックの feature 移管・DiceServicesModule 新設（挙動不変）

③（H4 / §8）の **diceRoll 分の完了ステップ**。Step5a（CustomDiceModalService 移管）に続き、orchestrator と
共有 dice ロジックを整理して **DiceRollFeatureModule の `InteractionsModule` import を撤去**＝feature ⇄ interactions core
の結合を解消。**Option A（services/dice 中立配置）を採用し2分割で実施**（ユーザー承認済み）。コミット `352683a`(5b-1)・`354a53f`(5b-2)。

### Phase 1 の確定事実（単語境界 grep で精緻化）

- 真に共有なのは `DiceRollLogicService` のみ（orchestrator→feature ＋ character-thread handler 2本(dice-generic/flexible-dice-select)→interactions）。依存は domains/core のみのクリーンな leaf。
- `DiceHistoryService`・`DiceButtonUIService` は **orchestrator 専用**（`character-dice-buttons` が使うのは別物 `CharacterDiceHistoryService`。`git grep "DiceHistoryService"` の部分一致に注意）→ orchestrator と共に feature へ。
- `DicePresetService`/`DiceOrchestratorService` 等 services/dice 群は上流（interactions/features）依存ゼロ＝leaf module 化可能。

### Step5b-1（reorg・`352683a`）: DiceServicesModule 新設

- `discord/services/dice/dice-services.module.ts`（DiceServicesModule）を新設。providers/exports = `DiceRollLogicService`(移設)・`DiceOrchestratorService`・`DiceCalculationService`・`DiceParserService`・`DicePresetService`。imports = `DiceRollModule`・`CharacterModule`（TypedEventService は core-events @Global）＝leaf module。
- `dice-roll-logic.service`(+spec) を `interactions/button` → `services/dice` へ rename（同 depth で相対 import 不変）。
- `interactions.module`: 5サービスの ad-hoc provide（§5.3 違反）を撤去し `DiceServicesModule` を import＋**re-export**（commands/discord/feature の下流互換維持）。character-thread handler 2本の import パス更新。

### Step5b-2（移管・import 撤去・`354a53f`）

- `CharacterDiceOrchestratorService`・`DiceButtonUIService`・`DiceHistoryService`(+spec) を `interactions/button` → `features/diceRoll/services` へ rename（depth 差のため相対 import を絶対 `src/` へ書換）。
- diceRoll handler 4本（custom/general/preset/skill）の orchestrator import を feature 内パス（`../../services/...`）へ更新。
- `dice-roll.module`(feature): 3サービスを providers 追加、imports に `DiceServicesModule`・`DiceRollModule`(DiceHistoryService の DiceRollService) を追加し、**`InteractionsModule` import を撤去**。
- `interactions.module`: 移管3サービスの import/provider/export を撤去（character-thread の DiceRollLogicService・character-dice-buttons の DicePresetService は DiceServicesModule から解決）。

### 検証（各段で司令塔裏取り）

- 5b-1: build 成功 / check:circular **No circular dependency found!(475)** / jest 9 suites 202 tests 緑 / start:dev で character-thread handler 登録・無エラー。
- 5b-2: build 成功 / check:circular **No circular dependency found!(475)** / jest **47 suites 461 tests 緑** / start:dev で DiceRollSkill/General/Custom/Preset/Modal・DiceGeneric/FlexibleDiceSelect の registry 登録・無エラー起動＝**feature が InteractionsModule なしで全 dice handler を解決＝挙動不変**。

### 到達点・残

- **diceRoll feature は interactions core を import しない**（`InteractionRegistryModule` のみ）。§8「feature が registry に handler を登録」の diceRoll 分は**完了**。dice 計算・ロジックは中立 `DiceServicesModule`(services/dice) が所有（§5.3/§6 是正・旧 interactions ad-hoc provide を解消）。
- 残（③ 全体）: characterEdit/characterThread の handler も feature 登録へ → 最終的に `interactions.module` の feature module import（`CharacterEditModule`/`CharacterThreadFeatureModule`）を全撤去。

---

## 2026-06-03 構造課題③ Step5a CustomDiceModalService を feature へ移管（挙動不変）

③ の続き（Step5 = orchestrator/modal を feature へ移し `dice-roll.module` の `InteractionsModule` import 撤去）の
**第一弾**。Phase 1 で「Step5 は単純移動でなく共有 dice モジュールの設計が必要」と判明したため、**結合のない
`CustomDiceModalService` だけ先行移管**する安全な独立コミット（`16c4c03`）。InteractionsModule import 撤去は
orchestrator 移管（共有 primitive モジュール化＝Step5b）で達成予定。

### Phase 1 の発見（dice クラスタの結合）

- `CustomDiceModalService`：interactions/button 依存ゼロ（`CharacterService`＋`DiceOrchestratorService`(services/dice) のみ）→ **単独で feature へ移せる**。
- `CharacterDiceOrchestratorService`：`DiceButtonUIService`(専用)＋`DiceRollLogicService`(character-thread handler 2本も使用)＋`DiceHistoryService`(character-dice-buttons も使用) に依存し、さらに `DiceHistoryService→DiceRollPaginationService` と結合が密。共有 primitive を「feature 所有」か「`discord/services/dice` 中立」かは設計判断・循環リスクありで Step5b に分離（ユーザー承認済みの段階分割）。

### 実施（Step5a・コミット `16c4c03`）

- `custom-dice-modal.service.ts`(+spec) を `interactions/modal/` → `features/diceRoll/services/`（rename。サービスは絶対 import のみ／spec は同ディレクトリ相対のため移動でパス不変）。`interactions/modal/` は空に。
- `dice-roll-modal.handler`(+spec) の import を `../../services/custom-dice-modal.service` へ更新。
- `interactions.module`：CustomDiceModalService の import/provider/export を撤去（消費者は feature の modal handler のみ＝interactions core 消費者なし）。
- `dice-roll.module`(feature)：CustomDiceModalService を provider 追加。`CharacterService` 解決のため `CharacterModule` を import（**forwardRef なし**・feature→domains の許容方向）。`DiceOrchestratorService` は既存 `InteractionsModule` export 経由で解決。

### 検証（司令塔裏取り）

- `pnpm run build` 成功 / `pnpm run check:circular`：**No circular dependency found!（474 files）**（feature→CharacterModule で循環増えず）。
- `pnpm jest`（custom-dice-modal + dice-roll-modal handler + handlers.integration + registry）：**5 suites / 85 tests 緑**。
- `pnpm run start:dev`：**Nest application successfully started** / `DiceRollModalHandler [modal] → ^(custom|param)-dice-modal` を registry 登録 / `Cannot resolve`・DI 失敗・実エラーなし＝**実機で挙動不変**（feature 所有の CustomDiceModalService が CharacterService(CharacterModule)・DiceOrchestratorService(InteractionsModule export) を解決）。

### 残（Step5b・未着手）

- `CharacterDiceOrchestratorService`（＋専用 `DiceButtonUIService`）を feature へ移し、共有 primitive（`DiceRollLogicService`/`DiceHistoryService`）を共有モジュール化（`discord/services/dice` 中立配置 or feature 配下のどちらかを要設計判断）。完了後に `dice-roll.module` の `InteractionsModule` import を撤去。
- その後 characterEdit/characterThread も feature 登録へ → `interactions.module` の feature module import を全撤去（§8 目標形）。

---

## 2026-06-03 構造課題③ diceRoll 移管（handler/pagination を interactions core → feature・挙動不変）

構造課題③（H4 / ARCHITECTURE §8「feature 側が registry に handler を登録」・§5.3「provider 所有」）の本体ステップ。
InteractionRegistryModule 分離（第一歩・下記）に続き、diceRoll の interaction handler と pagination の**所有権を
InteractionsModule から DiceRollFeatureModule 配下へ移管**。実装コミット `fde91e8`（61ファイル・rename 35＋新規 module）。
サブエージェント実装 → **司令塔が報告を再裏取りしてコミット・記録**（報告に誤りあり・下記）。

### 実施

- handler 12個(+spec): `interactions/handlers/dice-roll/` → `features/diceRoll/handlers/dice-roll/`（rename）。
- pagination 11ファイル: `discord/components/pagination/` → `features/diceRoll/services/pagination/`（rename・`components/pagination` は空に）。
- 新規 `DiceRollPaginationModule`（pagination 2 service を providers/exports、`DiceRollModule`(domains) を import）。
- `DiceRollFeatureModule`: handler 12 を providers 化＋`OnModuleInit` で `InteractionRegistryService.registerHandlers` に自登録（集中→分散）。`InteractionRegistryModule`＋`DiceRollPaginationModule` を import。
- `interactions.module`: diceRoll handler/adapter/pagination の配線を全撤去。button 系の pagination 解決用に `DiceRollPaginationModule` のみ import。

### 設計判断（2点）

- **差分1（pagination 独立モジュール化）**: interactions core の `CharacterDiceButtonsService`/`DiceHistoryService`(button/) が `DiceRollPaginationService` を直接 inject するため、pagination を独立 `DiceRollPaginationModule` に切り出し、interactions と feature の双方が import（相互 import＝循環を回避）。所有権は feature 配下＝§5.3 の精神に合致。
- **差分2（Step5 未達）**: `dice-roll.module`(feature) の `InteractionsModule` import は維持。diceRoll handler が `CharacterDiceOrchestratorService`(interactions/button/)・`CustomDiceModalService`(interactions/modal/) を inject するため。`DiceRollFeatureModule → InteractionsModule` の一方向のみで、InteractionsModule は feature を import しないため循環なし。

### 検証（司令塔が報告を再裏取り）

- サブエージェント報告「interactions→diceRoll 依存 grep ゼロ」は**不正確**と判明。実際は interactions(button系) が `DiceRollPaginationService`/`DiceRollPaginationModule` を import 継続（＝差分1 の意図した依存）。**ただし循環は生んでいない**ことを check:circular で実証。「ハンドラ配線は撤去・pagination 依存は残置」が実態。
- `pnpm run build` 成功 / `pnpm run check:circular`：**No circular dependency found!（474 files）**。
- `pnpm jest`（registry + features/diceRoll + interactions/button + handlers.integration）：**40 suites / 445 tests 緑**（報告の 31+36+150 を内包）。
- `pnpm run start:dev`：**Nest application successfully started** / DiscordBOT 起動(TRPG*BOT#8068) / **diceRoll handler 12個が InteractionRegistryService に各1回登録**（dice-page-prev/next/first/last/cancel/select・dice-char-select・`^roll\*[^*]+\_`・`^roll*\d+d\d+`・roll*custom・preset-dice\*・`^(custom|param)-dice-modal`）/ ERROR・Cannot resolve なし＝**実機で挙動不変を確認**。

### コミット範囲（pathspec・前作業の未コミット物は温存）

- `fde91e8` は diceRoll/interactions/pagination 配下のみ（`git commit --only` で pathspec 指定）。前作業由来の未コミット（doc 削除7本・構造課題⑤の characterEdit 追加分・`character.service.spec.ts` の net-zero ノイズ・大量の CRLF only `M`）は index/working tree に温存し巻き込まない。

### 残（③ の続き・未着手）

- **Step5**: `CharacterDiceOrchestratorService`(button/)・`CustomDiceModalService`(modal/) を feature へ移し、`dice-roll.module` の `InteractionsModule` import を撤去（差分2 の解消）。
- characterEdit/characterThread の handler も feature 登録へ → 最終的に `interactions.module` の feature module import を全撤去（§8 目標形）。
- **follow-up（docs）**: `interactions/README.md`（前作業で未コミット）が「Phase 1 未着手＝InteractionsModule 所有」と記載しており本移管で陳腐化。`interactions/MIGRATION_GUIDE.md` ともども現状（diceRoll は feature 所有）へ要更新。本コミットでは前作業の未コミット .md を巻き込まないため未着手。

---

## 2026-06-03 デッドコード除去（参照パス／過去形イベント）ブランチ `refactor/ref-path-deadcode-cleanup`

司令塔が grep＋実ファイルで実証した2件のデッドを**挙動不変で除去**。独立コミット単位の2タスク。

### タスク1: `CharacterEventHandlerService` をファイルごと削除（完全デッド）

- 実体: `onModuleInit`→`registerEventListeners()` はログ1行のみで**何も登録しない**（File-based Handlers へ移行済み・登録無効化済み）。private ハンドラ群（update/search/searchById/searchByName/generateUniqueShortCharacterId）は呼び出し元ゼロ。外部 inject ゼロ。
- 着手前 grep 再確認: 参照は `character.module.ts` の import/providers/exports 3箇所＋`character-event-integration.service.ts` の doc コメント言及のみ。実 DI ゼロ。
- 実施: `character-event-handler.service.ts` と `.spec.ts` を削除。`character.module.ts` の providers/exports/import から除去。
- 副作用は onModuleInit のログ1行のみ＝削除で挙動不変。

### タスク2: 過去形デッドイベント `character.updated` / `character.deleted` の emit を全廃

- **購読者ゼロ再実証**: 非テストコードに `.on`/`@OnEvent`/`waitForEvent`/`once`/registry 購読なし。`EventRegistryService` の登録対象は requested 系5ハンドラのみ（過去形なし）。`events/handlers/character-event.handler.ts` は**実在せず**（DESIGN.md の記載が陳腐化）。discord が購読するのは完了形 `character.update.completed`/`character.deletion.completed`（別経路）。→ 過去形 emit は誰にも届かないデッド。
- 実施: emit 7箇所削除（`character.service.ts` 5＝update/updateField/updateFieldByChannelId/remove/removeByChannelId、`character.controller.ts` 2＝update/remove）。`removeByChannelId` の emit 専用だった事前 `findByChannelId` 取得も除去。service が `TypedEventService`/`EVENT_NAMES` を完全未使用化したため import・コンストラクタ注入を削除（controller は discord.\* emit で継続使用のため残置）。
- 未参照定義の整理: `EVENT_NAMES.CHARACTER_UPDATED`/`CHARACTER_DELETED`（参照ゼロ）を**削除**。contracts 型キー `'character.updated'`/`'character.deleted'` は spec が「emit しないこと」を型安全に検証するため**残置し DEPRECATED コメント付与**（新規 emit 禁止を明記）。`character.created` は今回対象外で温存。
- 安全網テスト更新: service.spec / controller.spec の「過去形を emit する」検証を「**emit しないことを確認**」へ反転。integration.spec の `once('character.updated'|'character.deleted')` 待受を「payload が null（=emit されない）＋DB 反映/削除は従来どおり」へ更新。completed 系・discord.\* 系の検証は維持。

### 検証

- `pnpm run build` 成功（タスク1後・タスク2後とも）。
- `pnpm jest src/domains/character`：**7 suites / 115 tests 緑**（integration 含む。当環境は DB モック有効で integration も全9件緑＝新規破損ゼロ）。
- `pnpm run check:circular`：**No circular dependency found!**（新規循環なし）。

---

## 2026-06-03 構造課題⑤ 巨大サービス分割（CharacterEmbedManagerService・挙動保存）

`discord/features/characterEdit/services/character-embed-manager.service.ts`（612行）を `refactor-for-testability` で分割。**公開 API シグネチャ・外部挙動不変**。

### 手順・抽出

- **手順0 characterization 先行**：既存 spec が公開メソッド出力（Embed の title/color/fields、メニュー options、footer 切り詰め、send 呼び出し）を固定。変更前緑を確認。
- Embed/ボタン/メニュー生成の純関数10（`buildBasicEmbed`/`buildSectionEmbed`/`buildEditComponents`/`buildCharacterDiceRollButtons`/`buildFieldSelectMenu`/`buildNewCharacterEmbed`/`buildCharacterCreatedEmbed` 等）を `characterEdit/utils/character-embed.util.ts`（Character→Builder を返す純関数）へ抽出。service の各公開メソッドは util へ1行委譲。
- 副作用（`sendSectionedEmbeds`=channel.send / `createCharacter`=typedEventService.emit）は service に残置。

### 制約遵守（ARCHITECTURE）

- util に DI 無し（TypedEventService を渡さない）。discord.js 依存のため §12 通り **feature 配下**（shared でない）に配置。`EmbedSectionType` は util を正本に service が re-export し既存10ファイルの import 互換維持。新規循環なし。

### 改善指標・検証（司令塔裏取り）

- **service 612 → 180 行**（整形ロジックを全て util へ。残るは副作用2メソッド＋orchestration）。util 純関数割合100%。
- create-test で純関数に +22 ケース追加（data undefined/空/24件超 footer/add専用/未知null 等の分岐網羅）。
- `pnpm run build` 成功 / `pnpm jest src/discord/features/characterEdit`：**21 suites・310 tests 緑**（characterization 33 含む＝挙動不変） / `pnpm run check:circular`：**No circular dependency found!**

---

## 2026-06-03 構造課題④ 横断コードを §12 決定表へ再配置（挙動保存）

ARCHITECTURE §12 決定表違反（`src/utils/` に横断コードが滞留）を是正。**ファイル移動＋import 更新のみ・ロジック不変**。

### 実施（移動4＋import 更新48ファイル）

- 純粋関数 → `src/shared/utils/`：`error-helpers.ts`（isErrorWithMessage/getErrorMessage）・`crypto.util.ts`（鍵引数注入・config非依存）。
- DI サービス → `src/core/http/`：`cookie.service.ts`（@Injectable・Express Response 操作）・`error-handler.ts`（Logger/framework 依存・参照42）。
- 全 import 元（48 .ts）のパスを新配置へ更新。`api-response.util.ts` は提案通り温存。

### 検証（司令塔裏取り）

- 旧パス（`src/utils/error-handler` 等）への参照ゼロを grep 確認。
- `pnpm run build` 成功（import 解決の総合チェック）。
- `pnpm run check:circular`：**No circular dependency found!**（core/http へ移した error-handler が逆流を作らないことを確認）。
- 移動4ファイルの spec：**64 tests 緑**（ロジック不変）。

### 運用メモ・提案（未実施＝別タスク）

- 委譲サブエージェントは報告直前に malformed tool call で失敗したが、**移動＋import 更新の作業自体は完了**しており、司令塔が build/circular/spec/grep で挙動保存を裏取りした。
- 提案（要判断・未実施）：①`api-response.util.ts`（実装参照ゼロ・spec のみ）の廃止 ②`error-handler.ts` の `process.env.NODE_ENV` 直読みを AppConfigService 経由へ（DI 化で挙動が変わりうるため今回は process.env のまま移動） ③型 `src/types/*`→`core/types`（`express/index.d.ts` は tsconfig 型解決のため除外）。

---

## 2026-06-03 構造課題②（ARCHITECTURE §9 domain 純粋性）フェーズ1/2（ブランチ `refactor/ref-path-deadcode-cleanup`）

ARCHITECTURE §9（domain は TypedEventService 直接依存・feature event 名直書きを避ける）/ §15（event name の文字列直書き追加を禁止）違反のうち、**挙動不変で安全な範囲のみ**を実施。emit の層移譲（§9 本丸）は設計判断を要するため **提案に留め未実装**（下記フェーズ3提案）。

### フェーズ1: 安全網（characterization）強化

- 既存 `character.service.spec.ts` / `character.controller.spec.ts` は update/remove 等の主要 emit を既に固定済みだった。**未カバーだった emit 経路**にテスト追加：
  - service: `updateField`（`character.updated` / updateType=`updateField-<field>`）、`updateFieldByChannelId`（同 + channelId）。各々「成功時 emit」「未検出時 emit しない」。
  - controller: `createDiscordThread`（`discord.thread.create.requested`）、`displayCharacterOnDiscord`（`discord.character.display.requested`）。emit payload・未検出404・未認証401・displayType 既定値 enhanced を固定。
- **変更前コードで緑**を確認（service+controller 50 tests green）＝characterization 成立。test-expansion 評価は全対象 **緑(A)**（短関数・依存2–3・副作用は emit/log のみ mock 可・分岐単純。唯一の黄要素「event 名直書き」はフェーズ2の是正対象そのもの）。

### フェーズ2: feature event 名の直書き→定数化（挙動不変）

- `src/events/contracts/index.ts` に **`EVENT_NAMES`** 定数を新設。`as const satisfies Record<string, keyof CharacterEventContracts>` で契約に存在する名前のみ許可（タイポ・契約乖離をコンパイル時に検出）。
- 直書き文字列を置換（同じ event 名・payload で emit ＝ 挙動不変）：
  - `character.service.ts`: `character.updated`×3 / `character.deleted`×2 → `EVENT_NAMES.*`
  - `character.controller.ts`: `character.updated` / `character.deleted` / `discord.thread.create.requested` / `discord.character.display.requested`
  - `character-event-handler.service.ts`（**全体がデッドコード**＝後述）: `character.update.failed` / `findByChannelId.completed|failed` / `findById.completed|failed` / `findByName.completed|failed`
- 残る直書きはコメントアウト済みデッド行（service の行91）のみ。
- 検証: `build` 成功・character domain **119 tests green**（integration の実 emit 経路含む＝定数化後も挙動不変を実証）・`check:circular` 循環ゼロ（`domains/character → events/contracts` は純粋型/定数 import で新規依存方向なし。元から event-handler が同 import 済み）。

### フェーズ3提案（emit 層移譲・★未実装。承認後に別途）

§9 本丸＝「domain から TypedEventService inject を撤去し feature/application 層が publish」の構造変更。判明した実態を踏まえた提案：

1. **`character.updated` / `character.deleted`（過去形）には実購読者が存在しない**。grep 実証：`.on('character.updated'|'character.deleted')` はソース上ゼロ。discord の File-based handler が購読するのは `character.update.completed` / `character.deletion.completed`（完了形）。→ これら過去形 emit（service 5・controller 2）は **発火しても届かない可能性が高い**。移譲より先に「本当に不要なら削除」を検討すべき（要・発火経路の最終確認）。リスク低だが purచase不明なため要設計判断。
2. **`character-event-handler.service.ts` は全体がデッドコード**。`registerEventListeners()` がコメント通り無効化（リスナー登録スキップ）され、`handleCharacterUpdateRequested`/`SearchRequested` 等の private メソッドはどこからも呼ばれない。`onModuleInit` も実質ログのみ。ファイル先頭コメントも「レガシー・将来削除予定」と明記。→ **ファイルごと削除候補**（spec も連動）。今回は直書き排除のため定数化のみ実施（削除は別タスクで上申）。
3. **`discord.thread.create.requested` / `discord.character.display.requested`（controller の2エンドポイント）** は discord 側に実購読者あり（`DiscordThreadCreateRequestedHandler` 等）。これらは「domain controller が discord feature event を直接 publish」する §9 違反。移譲先候補：character feature 用の application/orchestrator 層を新設するか、これらエンドポイント自体を discord feature 側へ移すか。**購読側挙動が変わる危険があり、循環依存（domains→features 逆流）回避の設計が必要**。要・承認。

> 結論: フェーズ1/2 は挙動不変で完了。フェーズ3は「過去形 emit の生死確認＋デッドハンドラ削除」を先行する方が安全で、emit 層移譲（新 orchestrator or discord 移設）はその後。いずれも独断実装せず提案に留めた。

---

## 2026-06-03 参照・経路の全体監査（読み取り専用・コード未変更）

「各関数がどう使われるか（参照・呼び出し経路）」「現構成の妥当性」「保守リスクのあるフォルダ」を洗い出すため、`src/` を8区画に分け**フォルダ単位でサブエージェント（読み取り専用）を並列起動**し、grep で参照を実証。**司令塔（メイン）が報告を裏取りし、矛盾・誤報告を是正**。コードは一切変更していない（build/check:circular 未影響）。

### 司令塔の裏取りで確定した事実（grep 実証）

- **`core/events/typed-event.service.ts:3` が `../../events/contracts` を import**（`core/events → src/events` の依存方向違反＝実害は「イベント契約型の置き場所」問題）。※events 担当の「参照なし」報告は**誤り**、core 担当が正しい。
- **イベント基盤が二重 `@Global`**：`core/events/core-events.module.ts:12` と `events/events.module.ts:49` の両方を `app.module.ts:31,36` が import。`@Global` は他に config のみ（正当）。
- **`src/auth/` は0ファイル（空の残骸ディレクトリ）**。`from '*/auth'` 参照ゼロ＝削除安全。
- **`discord/utils/convertToJSON.ts`（3関数）は非spec参照ゼロ＝デッド確定**。
- **`core/dto/domain.dto.ts`（DtoDomainFactory/PaginationDto/SearchDto）は非spec参照ゼロ＝デッド確定**。
- `discord.embed.update.requested` / `discord.notification.requested` は **emit されている**（`discord/events/handlers/character.creation.completed.ts:129,159`・`characterEdit/.../character-edit-feature.handler.ts:121`）。※events 担当の「emit地点不明＝デッドイベント疑い高」は**誤り**。`src/events/handlers/discord-integration.handler.ts` はログ購読のみ（実処理は各 feature・仕様通り）。
- `discord/utils/getCategory.ts`・`createCategory.ts` は各1関数。discord-utils 担当が主張した「`discord.util.ts` に同名関数あり＝重複」は**裏取りで確認できず（要再精査・重複と断定しない）**。

### 確定デッドコード／低リスク整理候補（build/check:circular で裏取り前提）

| 対象                                                                                                                                                                                                        | 根拠                                                                       | リスク |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------ |
| `src/auth/`（空ディレクトリ）                                                                                                                                                                               | 0ファイル・参照ゼロ                                                        | 低     |
| `discord/utils/convertToJSON.ts`                                                                                                                                                                            | 非spec参照ゼロ                                                             | 低     |
| `core/dto/domain.dto.ts` の3 export                                                                                                                                                                         | 非spec参照ゼロ                                                             | 低     |
| `CharacterEventHandlerService` の `UserService` inject（`character-event-handler.service.ts:5,19`）                                                                                                         | `userService.` 呼び出しゼロ（未使用注入）                                  | 低     |
| `interactions/channel/*`（character-channel-create / diceroll-channel-create）, `interactions/select/dice-character-select.service.ts`, `interactions/modal/custom-dice-modal.service.ts` の adapter 重複側 | Module 登録のみで handler は features/adapters 版を import（**要再精査**） | 中     |

### 構造的な保守リスク（要設計判断・既知 H 課題と対応）

1. **core/events ⇄ src/events の責務分割が未確定**（H2 の積み残し）。`typed-event.service`(core) がイベント契約(src/events/contracts) に依存し、@Global も二重。→ contracts を `core/events` 配下へ寄せ、@Global を1本化する案。**挙動保存テスト必須**。
2. **domain 純粋性違反（ARCHITECTURE §9）**：`character.service.ts`(10,70/emit 158,201,231,258,285)・`character.controller.ts`(28,58/emit 210,245,309,349)・`character-event-handler.service.ts` が `TypedEventService` を直接 inject＋feature event 名を直書き。→ event emit を feature/application 層へ移譲（H5/Step5）。**安全網テスト必須**。
3. **interactions core → features の import 29行**（既知 H4・Registry 移行途中）。handler/controller/service/module/`interactions.list.ts` が features を import。ARCHITECTURE §8 目標は「feature 側が registry 登録」で向きが逆。→ Step4 diceRoll Feature 分離と同調して是正。
4. **横断コード置き場所違反（§12 決定表・H1 積み残し）**：`utils/error-handler.ts`→`core/http`、`utils/error-helpers.ts`→`shared`、`utils/cookie.service.ts`→`core/http`、`utils/crypto.util.ts`→`shared`、`utils/api-response.util.ts`→廃止 or `core/http`（実装参照ゼロ・spec のみ）。型 `src/types/*`→`core/types`（express 拡張は例外）。
5. **巨大サービス**：`characterEdit/services/character-embed-manager.service.ts`(612)・`character-modal-handler.service.ts`(597)・`characterThread/character-channel.service.ts`(549・Phase3 で一部無効化中)。Embed 生成ロジックが characterEdit/characterThread 3箇所に分散＝共通 util 抽出余地。

### 健全と確認できた箇所（現構成維持で良い）

- commands 層は features への薄い委譲アダプタとして**生存・重複なし**（CommandsController のみ参照希薄＝別途精査）。
- domain の依存方向は良好（user→auth 再混入なし・H6 維持・循環ゼロ）。Repository/Entity/DTO 基盤は明確。
- events の File-based Registry・request-response パターン・逆流ゼロ（src/events→features なし）は健全。
- core/http の interceptor/filter/decorator は auth/user/character で実使用・宙吊りなし。

### 次にやること（着手はユーザー承認後・各々小PR・安全網テスト先行）

- [x] 低リスク整理を**全て実施済み（2026-06-03、下記記録参照）**：`src/auth` 空ディレクトリ削除（git管理外）／`convertToJSON`（＋spec）削除／`domain.dto.ts` ファイル全体削除（AttributeObject 含め参照ゼロ）／`CharacterEventHandlerService` の未使用 UserService inject 削除（＋spec整合）。build成功・循環ゼロ。
- [x] 中リスク（interactions/channel・select・modal の重複 adapter）を実コード再精査のうえデッド確定→削除（**2026-06-03 完了、下記記録**）。
- [x] 構造課題① **イベント基盤の forRoot 二重・@Global 二重を解消（2026-06-03 完了、下記記録）**。安全網テスト先行＋start:dev 実機検証で挙動不変を証明。
- [x] 構造課題② **domain の event 名直書きを EVENT_NAMES へ集約（§9/§15・2026-06-03 完了、下記記録）**。emit 層移譲（§9本丸）は購読者ゼロ等の発見とともに提案に留め未実装。
- [x] 構造課題④ **横断コードを §12 決定表へ再配置（2026-06-03 完了、下記記録）**。error-helpers/crypto.util→shared、cookie.service/error-handler→core/http。挙動保存。
- [x] 構造課題⑤ **巨大サービス分割: CharacterEmbedManagerService を純関数抽出（612→180行・2026-06-03 完了、下記記録）**。characterization 緑で挙動不変。
- [x] デッドハンドラ `CharacterEventHandlerService` 削除・過去形イベント `character.updated`/`character.deleted` の emit 全廃（購読者ゼロ実証・2026-06-03 完了、下記記録）。
- [~] 構造課題③（interactions→features 向き是正 H4・大規模）**第一歩 = registry の独立 `InteractionRegistryModule` 分離 完了（2026-06-03、下記記録）**。**第二歩 = diceRoll handler/pagination の feature 移管 完了（2026-06-03、コミット `fde91e8`・上記記録・start:dev で handler 12 登録確認・挙動不変）**。残: **Step5a＝CustomDiceModalService 移管 完了（`16c4c03`）／Step5b＝orchestrator/button-ui/history を feature へ移管・DiceServicesModule 新設・`dice-roll.module` の InteractionsModule import 撤去 完了（`352683a`+`354a53f`）＝diceRoll feature ⇄ interactions 結合を解消（§8 diceRoll 分 完了）**。**characterEdit handler の feature 移管 完了（Part A・`a5369cf`）**。**characterThread handler/サービスの feature 移管＋CharacterThreadFeatureModule import 撤去 完了（Part B・`1975af6`・挙動不変）**。残はただ1つ: characterEdit の CharacterEditModule import 撤去＝`InteractionsService` の旧 if 分岐 execute()（CharacterSectionEditorService 使用）の撤去が前提＝**挙動影響ありで承認＋characterization 必須**（詳細は上記「真の障壁」節）。これを除き §8 の feature module import 撤去は diceRoll/characterThread で達成。
- [ ] 残バックログ: `api-response.util` 廃止（**spec oracle で現役→spec 改修とセット**）／`error-handler` の AppConfig化／型 `src/types/*`→`core/types`（**tsconfig 調整要**）／contracts の DEPRECATED 過去形型最終削除。

---

## 2026-06-03 構造課題③ 第一歩: registry を独立 InteractionRegistryModule に分離（挙動不変）

H4（interactions→features の向き是正・§8 目標「feature 側が registry に handler を登録」）の**安全な第一歩**。handler 移動は伴わず、DI 構造の整理のみ＝挙動不変。

### 現状（司令塔の精査）

- `InteractionRegistryService`/`PatternMatcherService` は `interactions.module` の providers に直接登録され、onModuleInit が全 handler を集中登録。
- `interactions.module` は `CharacterEditModule`/`CharacterThreadFeatureModule`（feature module）を import（§8 違反）。
- feature→InteractionsModule の import は `features/diceRoll/dice-roll.module.ts:4,15` の1箇所のみ。

### 実施

- 新規 `discord/interactions/registry/interaction-registry.module.ts`（`InteractionRegistryModule`、@Global 無し、registry/pattern-matcher を providers/exports）。
- `interactions.module`：registry/pattern-matcher を providers から外し `InteractionRegistryModule` を import（exports は re-export で public API 同一）。onModuleInit の集中登録は不変。

### 検証（司令塔裏取り）

- `pnpm run build` 成功 / `pnpm jest src/discord/interactions/registry` **36 tests 緑** / `pnpm run check:circular` **No circular dependency found!**（新規循環なし）。
- `pnpm run start:dev`：`InteractionRegistryModule dependencies initialized`、**全 handler が registry に登録**（CharacterEdit/DicePage/DiceRoll/CharacterThread 系の customId パターン）、ERROR/Cannot resolve なし＝**挙動不変を実機確認**。

### 後続ステップ（段階的・未着手）

1. `features/diceRoll/dice-roll.module.ts` の import を `InteractionsModule`→`InteractionRegistryModule` へ細くする（interactions→feature 全体依存を断つ足場）。
2. diceRoll handler 群を `interactions/handlers/dice-roll/` → feature 側へ移し、`DiceRollFeatureModule` の onModuleInit が自分の handler を registry 登録（集中→分散）。挙動固定テスト＋start:dev で routing 不変を都度証明。
3. 同様に characterEdit/characterThread も feature 登録へ。最終的に `interactions.module` の feature module import を撤去。

---

## 2026-06-03 構造課題① イベント基盤の forRoot/@Global 二重を解消（安全網先行・挙動不変）

### 精査で判明した実態（重要）

イベント基盤は「TypedEventService 1系統に統一済み」と記載されていたが、**実際は emitter が2系統併存**していた：

- **TypedEventService**：`core-events.module.ts` が独自に `new` した `TYPED_EVENT_EMITTER`（character.\* / EventRegistry が使用）。
- **グローバル EventEmitter2**：`EventEmitterModule.forRoot()` 由来（`@OnEvent` 8箇所＝diceRoll・monitoring系、直接 inject 5箇所が使用）。
- 両者は**別インスタンス**で互いに独立（TypedEventService.emit はグローバル `@OnEvent` に届かない）。

問題：`EventEmitterModule.forRoot()` が **2回**呼ばれ（`core-events.module:15`・`events.module:52`、設定相違）ARCHITECTURE §15 違反。`@Global` も二重（core-events・events）。app.module の import 順（CoreEvents 先→Events 後）で forRoot は**後勝ち**＝events 側設定（maxListeners:20 / verboseMemoryLeak:true）が現状有効値だった。

### 安全網（characterization・変更前に緑を確認）

test-expansion→create-test で3点を固定（全項目テスタビリティ🟢）：

- A. `typed-event.service.spec.ts`（既存）— TypedEventService の emit/on 往復（独自 emitter 経路）。
- **B（最重要）`metrics-collector.service.onevent.spec.ts`（新規）** — `EventEmitterModule.forRoot` を組んだ最小 TestingModule で `eventEmitter.emit('discord.command.start'/'complete')` → ハンドラが**メソッド直呼びでなく emit 経由で発火**し状態変化することを固定。AlertManager の `@OnEvent('system.alert')` も1本。
- C. `typed-event-isolation.spec.ts`（新規）— 独自 emitter とグローバル EventEmitter2 が別インスタンスである現状を固定。

### 変更（2ファイルのみ）

- `core/events/core-events.module.ts`：forRoot 設定を events 側の現状有効値へ統一（`maxListeners 10→20`・`verboseMemoryLeak false→true`、他は同一）。
- `events/events.module.ts`：`EventEmitterModule.forRoot()` を imports から削除、exports の `EventEmitterModule` を削除、`@Global()` を削除、未使用 import（`Global`/`EventEmitterModule`）を整理。グローバル EventEmitter2 は **CoreEventsModule（@Global）の forRoot 1つで全域供給**。EventsModule の exports（EventRegistryService/DiscordIntegrationHandler）は外部 DI ゼロのため @Global 解消で誰も壊れない（grep 確認済み）。

### 検証結果（司令塔裏取り）

- `pnpm run build` 成功。
- 安全網3 spec：**29 tests 緑のまま**（＝挙動不変の証明）。B の emit 経由配線テストも緑。
- `pnpm run check:circular`：**No circular dependency found!**（474 files・新規循環なし）。
- `pnpm run start:dev`：**「Nest application successfully started」**／全 InstanceLoader 初期化成功／monitoring 系（@OnEvent 保持）初期化／TypedEventService ハンドラ登録／**DiscordBOT 起動（TRPG_BOT#8068）**／MaxListeners 警告・ERROR・Unhandled なし。

### 残課題（派生）

- `discord/interactions/interactions.module.ts:206` の `EventEmitterModule` import は CoreEventsModule の @Global forRoot が供給するため冗長だが、今回は未変更（別途整理可）。
- **emitter 2系統併存そのもの**（TypedEventService 独自 emitter ↔ グローバル @OnEvent）は設計判断事項。将来 monitoring を TypedEventService 契約へ寄せるか、現状の分離を正とするかは別課題。`src/events/AI.event.md` の「1系統統一」表現は実態（2 emitter）に合わせた追補が必要。

---

## 2026-06-03 中リスク整理 実施（interactions 重複 adapter のデッド削除・挙動不変）

監査の中リスク候補を**司令塔が実行経路まで遡って再精査**し、デッド4件を確定して削除した。

### 再精査で判明した実行経路の真実

- Discord interaction の実行は `InteractionRegistryService.registerHandlers([...])`（`interactions.module.ts` onModuleInit）に登録された **handler 経由のみ**。channel/select/modal の各サービスは「handler の委譲先 provider」で、handler が DI しなければ実行されない。
- `discord-interaction-handler.service.ts` の `registerButton/registerModal/registerSelectMenu` は**定義のみで呼び出し元ゼロ**（`this.buttons/modals/selects` Map は常時空→`interactionsService.execute` へフォールバック）＝**旧登録経路は死亡**。配列収集（getModals 等）経路も無い。
- `DiceCharacterSelectService` と `CustomDiceModalService` は**同名クラスが2箇所に定義された DI 地雷**。handler の import 先が現役、もう一方がデッド（非対称）：
  - `dice-character-select.handler.ts:4` → `features/diceRoll/adapters/dice-character-select.adapter`（**adapters版が現役**）。
  - `dice-roll-modal.handler.ts:4` → `interactions/modal/custom-dice-modal.service`（**interactions/modal版が現役**）。

### 削除した4件（spec 連動・module 登録除去）

| 削除（デッド）                                                      | 現役の正                                                                                 | module 登録除去                                   |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `interactions/channel/character-channel-create.service.ts`（+spec） | controller が `ChannelCreateOrchestratorService` を直接実行(interactions.controller:106) | `interactions.module.ts` import/providers/exports |
| `interactions/channel/diceroll-channel-create.service.ts`（+spec）  | 同上                                                                                     | 同上                                              |
| `interactions/select/dice-character-select.service.ts`（+spec）     | `features/diceRoll/adapters/dice-character-select.adapter.ts`（温存）                    | 登録なし（import 元ゼロ）                         |
| `features/diceRoll/adapters/custom-dice-modal.adapter.ts`（+spec）  | `interactions/modal/custom-dice-modal.service.ts`（温存）                                | `dice-roll.module.ts` import/providers/exports    |

計 削除8ファイル・編集2ファイル（module 2本）。

### 検証結果（司令塔裏取り）

- `pnpm run build` 成功（**S4 の同名トークン DI 解決もエラーなし**。残る `CustomDiceModalService` 参照は全て現役 interactions/modal版へ解決）。
- `pnpm run check:circular`：**No circular dependency found!**（472ファイル・新規循環なし）。
- 現役側2ファイル（adapters dice-character-select / interactions modal）は未編集で残存・参照ゼロ確認。

### 残課題（派生）

- `interactions/select/character-thread-select.service.ts` は今回対象外（別途精査）。
- 同名クラス2実装の DI 地雷は今回2組を解消したが、`features` ↔ `interactions` 間で責務が二重化する構造（H4 Registry 移行の途中状態）は残る。Step4 で向きを揃える際に解消。

---

## 2026-06-03 低リスク整理 実施（デッドコード／未使用注入の一掃・挙動不変）

上記監査で確定した低リスク整理候補のうち3点を、**独立コミット可能な単位**で実施。挙動を変えない除去であり、各ステップ後に build・check:circular で裏取り（S3 は spec も実行）。コミットはメインが別途まとめて行う。

### S1: `discord/utils/convertToJSON.ts` 削除（デッドコード）

- 削除: `src/discord/utils/convertToJSON.ts`（`filterAndFormatInput` / `convertCharacterInfoToJson` / `convertCharacterJsonToString` の3関数）と専用テスト `convertToJSON.spec.ts`。
- 裏取り: 非spec参照ゼロを grep 再確認。barrel(`core/dto` 等の index)経由 re-export なし。spec は3関数専用で生存関数を含まず。
- 検証: build OK / `No circular dependency found!`。

### S2: `core/dto/domain.dto.ts` 削除（ファイル全体・デッド）

- サブエージェントは当初 `DtoDomainFactory` / `PaginationDto` / `SearchDto` の3 export のみ削除し、混在していた `AttributeObject` 型を「範囲外」として温存した。
- **司令塔の裏取りで `AttributeObject` も非spec参照ゼロ**と判明（`grep -rn AttributeObject src` が空）。残す意味がないため**ファイルごと削除**へ切り替え。
- `core/dto` に barrel(index.ts)は存在せず、`domain.dto` への import 参照もゼロ。
- 検証: build OK / `check:circular`「No circular dependency found!」/ `grep domain.dto|AttributeObject src` 全消滅。

### S3: `CharacterEventHandlerService` の未使用 `UserService` inject 削除

- 変更: `character-event-handler.service.ts` から `UserService` の import(旧5行) と constructor の `private readonly userService: UserService`(旧19行) を削除。`userService.` 呼び出しはコード内ゼロ＝未使用注入。クラス本体・public/private メソッドは不変。
- spec 整合: `character-event-handler.service.spec.ts` から `UserService` の import / `mockUserService` / provide / `expect(mockUserService.addCharacterId).not.toHaveBeenCalled()` を削除（呼ばれないものの assert は不要）。
- `character.module.ts` の providers から本サービスは削除していない（現役・3件参照）。
- 検証: build OK / `No circular dependency found!` / `pnpm test character-event-handler.service.spec.ts` = **4 passed**。

---

## 2026-06-03 ドキュメント整合性監査・整理（全 .md を現行仕様へ追従）

リファクタ進展（H1〜H10 / Phase S / H6 循環解消 / テスタビリティ評価）に対し、`.md` 群（node_modules 除く全 42 本）が陳腐化していたため、**ドキュメント毎にサブエージェントを起動して現行コード・正本と照合**し、不整合を是正した。司令塔（メイン）が照合結果を裏取りし、機械的編集は編集サブエージェントへ委譲、判断を要する編集（AI.md 刷新・AI.features.md・削除・本記録）はメインが実施。コードは一切変更していない（build/check:circular に影響なし）。

### 横断的に是正した陳腐化（事実）

- 「型安全性100%完全達成」= 誇張（実態 any 多数・非テスト約230件）→ 現実的表現へ。対象: `AI.md` / `AI.architecture.md`(両) / `AI.domain.md` / `AI.types.md`。
- 「循環は UserDomain⇄AuthDomain のみ許容」= H6（2026-06-01）で解消済み・**現在ゼロ**へ統一。対象: `AI.domain.md` / `src/ARCHITECTURE.md`（現状表）/ `src/discord/AI.discord.md` / `src/events/DESIGN.md`。
- 「イベント駆動移行100%/3系統バス」→ `TypedEventService` 1系統（`core/events`）へ統一済みに修正。`src/events/DESIGN.md` の TypedEventService 配置を `shared/application`→`core/events`（T4 反映漏れ）へ訂正。`src/events/AI.event.md` は現状節と履歴の境界を明示。
- デッドコード3点（`character-id.service.ts`/`character.schema.ts`/`CharacterEventHandlerService`）の「削除可」誤判定に訂正注記（現役）。対象: `document/refactoring-audit-2026-05-30.md` ほか。
- `npm run`→`pnpm run`、カバレッジ等の古い数値スナップショットに「最新は AI.test.md」注記。

### 削除（役目を終えた一過性メモ / 空ファイル）7 本

`AI.discord.md`(root, src 版と重複) / `src/claude.md`(旧実行トレース) / `INTERACTION_REGISTRY_IMPLEMENTATION.md`(空) / `src/type-error-fixes.md`(解消済み) / `コメントアウト箇所管理.md` / `adapters復旧必要性分析.md`(復旧不要で決着) / `postFlexibleDiceMenu-flow-analysis.md`(解決済み)。
※ `CLAUDE_HANDOFF.md` は委譲フローの運用ファイルのため**維持**（空テンプレ）。

### 改稿・新規

- `README.md`(root): NestJS 雛形 → プロジェクト固有（pnpm / Quick Start / `test:e2e:tc` / 正本リンク）。
- `src/discord/features/characterEdit/README.md`: 実在しない旧ファイル記述を削除し実構成（`EnhancedCharacterEditService` 中心）へ全面改稿。
- `AI.features.md`(空)→ 正本（DESIGN.md / features README）への索引文書として整備。
- `AI.md`: 冒頭サマリ刷新（正本ポインタ追加）・専門ドキュメント索引を正本/履歴に再編・末尾の無意味断片を削除・Phase 3 を履歴明示。
- `src/discord/{DESIGN.md, interactions/README.md, MIGRATION_GUIDE.md, features/README.md, services/channel/README.md}`: Phase 0/1 進捗・削除済み 5 サービス・型表記を実態へ追従。

### 派生課題（ドキュメント整理の範囲外＝別タスク）

- ~~`discord-facade.service.ts` は現役だが DESIGN の目標フローから除外＝**廃止計画が宙ぶらりん**（Phase 1 で要決着）。~~ → **決着（2026-06-03・ドキュメントのみ／コード不変）**: 実コード精査の結果、**facade は存続**で確定し DESIGN.md §4.5 に明記。旧メモ `DISCORD_SERVICES_ANALYSIS.md` の「Phase1 廃止／TypedEventService 代替」は事実誤認（facade に `emitEvent` は無く、`initializeDiscord` 起動オーケストレーション＋REST `DiscordController` 裏付け＋ヘルス集約が実責務でイベント発行はしない）のため撤回。`§4.2 目標フロー` 図に無いのは図が interaction ルーティング専用だから。**実ランタイム経路は `main.ts`/`discord.controller` → `DiscordService`(@deprecated ラッパー) → `DiscordFacadeService` → 各専門サービス**で、`DiscordFacadeService` を直接注入するのはラッパーのみ（Grep 確認）。よって真の廃止対象は `DiscordService` ラッパーであり、DESIGN.md Phase 4 に「main.ts/discord.controller を facade 直注入へ置換 → ラッパー削除」を具体化。**挙動を変える置換は安全網テスト＋ユーザー承認後**（本記録時点では未着手＝コード不変）。
- ~~`src/discord/features/characterEdit/index.ts` の `CharacterEditServiceFactory` が実在しない `./character-channel-create.service` を `require`＝**デッドコード**（呼ぶと失敗）。~~ → **削除済み（2026-06-03）**: 呼び出し元ゼロ（Grep 確認）の未使用 Factory を class ごと削除。実サービス（ChannelDetectionService/CharacterCreationService/CharacterNotificationService）は `./services` から export 済みで DI 経由利用のため挙動不変。検証: build 成功 / check:circular「No circular dependency found!」/ characterEdit spec 21 suites・292 tests 緑。

---

## 2026-06-02 テスタビリティ評価マップ作成（テスト負債レジスタ＝赤リスト）

単体テスト拡充の前段として、spec の無い本体実装 **195 ファイルを緑/黄/赤/対象外で評価**（評価のみ・テスト未作成）。
詳細マップは [AI.test.md](./AI.test.md) の「全体テスタビリティ評価マップ」を正本とする。

**リファクタ観点の要点**：mock 困難＝設計負債の **🔴 赤 約20 件**は、根本原因が **Discord API I/O（fetch/instanceof/create/send/edit/Collection）とロジックの密結合**。H3 巨大サービス分割と同型で、**副作用境界（`ChannelPort`/`MessagePort`/`ThreadPort` 等の Adapter）を切り出してから characterization → テスト**の順で挙動保存して進める。赤の全リストと seam は AI.test.md に記載。

進め方：赤は1件ずつ独立 PR・`refactor-for-testability`（ARCHITECTURE 制約注入：純粋層に DI を持ち込まない／循環を増やさない）で。**挙動を変える着手は別途ユーザー承認後**。`character-channel.service.ts` は Phase3 メンテ中（無効化）のためデッドコード整理 or Phase3 完了の別タスク。

**進捗（2026-06-02 続き）**: 🟢 緑（≈25）に続き 🟡 黄を消化中。interaction handlers（25）・diceRoll adapters（9）・domain repositories（4）・jwt-auth.guard・dice-roll.service・event handler（3）まで spec 追加完了（本体不変・循環ゼロ・build 成功）。**赤（mock 困難＝設計負債）は今回も着手せず deferred 維持**。テスト進捗の正本は [AI.test.md](./AI.test.md)。マップの訂正：diceRoll adapters は「薄い委譲」ではなく pagination 複数メソッドを呼ぶオーケストレーション型だった（テスト可能なので 🟡 のまま）。

**進捗（2026-06-02 さらに続き＝黄 第2バッチ）**: event handlers（update/findByName/`event-handler.base`）・feature orchestrators 7（thread/character-thread/character-channel/performance/dice-result/roll-dice/character-dice）・misc 8（http.service/configuration/winston.config/base-command.service/performance-dashboard.controller/custom-dice-modal.service/dice-character-select.service/dice-history.service）に spec 追加（計 18 spec/236 test・本体不変・循環ゼロ・build 成功・全体スイートの既存 41 失敗は不変）。これで**評価マップで名指しの 🟡 黄はほぼ消化**。

- **新規 🔴 設計負債候補（赤レジスタへ追加）**: `discord/interactions/button/dice-history.service.ts` — fire-and-forget 背景処理＋`Date.now` rate-limit `Map`＋lock `Map`＋`parentChannel.send` が密結合でテストが脆い。seam: Clock 注入／背景更新を public 分離／rate-limit を純関数化。**着手はユーザー承認後**（`character-dice-history.service.ts` とは別物）。
- **テスト基盤の負債**: グローバル `test/utils/jest-setup.ts` の discord.js モックが `EmbedBuilder.setTimestamp`/`setURL`/`setFooter`/`Colors` を欠き、各 spec が個別回避。グローバル補完が望ましい（別タスク）。

**棚卸し更新（2026-06-02・黄残の再評価）**: spec 無しロジック 64 件を 5 並列で再分類（正本は AI.test.md 第2次評価マップ）。

- **新規 🔴 赤3 → 全て改善完了（2026-06-02・承認後 refactor-for-testability 実施）**: 詳細は AI.test.md 赤1/赤2/赤3。各々 characterization 先行→純関数抽出→seam 化→create-test、**公開 API シグネチャ・外部挙動不変**を緑テストで証明。司令塔が build/check:circular/対象テストを裏取り。
  - `discord/services/channel/channel-cache.service.ts` … Clock/Timer(setInterval→onModuleInit)/fetch を seam 化、snowflake/TTL/LRU/stats を `channel-cache.pure.ts` へ抽出。37 件緑。
  - `discord/features/characterThread/services/channel-manager.service.ts` … 選別ロジック(sort/slice25/map)とカテゴリ判定 predicate を `channel-manager.util.ts` へ抽出。34 件緑。
  - `discord/features/characterEdit/services/character-section-editor.service.ts` … customId 解析・getSectionData・modalId 判定・サニタイズ・最重要のフィールド値抽出(AttributeValue/レガシー/プリミティブ3分岐)を `character-section-editor.util.ts` へ抽出（469→約300行）。63 件緑＋消費者 17 件緑。
  - 全工程で `pnpm run build` 成功・`check:circular` 「No circular dependency found!」・新規循環ゼロを確認。グローバル `jest-setup.ts` に discord.js モック欠落の `TextInputBuilder.setValue` を1行補完（既存テスト非影響）。
  - 既知の別負債（本改善と無関係・据え置き）: `message-manager.service.ts:198` の `const batches = []` が `never[]` 推論で `discord-channel-manager.service.spec.ts` がコンパイル不可。`const batches: string[][] = []` の型注釈で解消見込み。チップ起票済み。
- **dead code 検出 → 削除済み（2026-06-02）**: `discord/interactions/button/dice-page-{cancel,first,last,next,prev}-button.service.ts` 5本は adapter 版（`features/diceRoll/adapters/dice-page-*-button.adapter.ts`・テスト済み・DI 登録済み）と重複の**未使用実装**だった。削除前検証で、全 import が adapter 版を指し（interactions.module.ts / dice-roll.module.ts / 各 handler）、`button/...-button.service` への実コード参照がゼロであることを Grep で確認のうえ削除。検証結果：`pnpm run build` 成功／`features/diceRoll/adapters` テスト 9 suites・53 件緑／`check:circular` は「No circular dependency found!」。残る `*.service` 言及は dependency-analysis.json / DESIGN.md / MIGRATION_GUIDE.md のドキュメント側のみ（必要に応じ別途整理）。
- 残 actionable バックログ: 🟢 緑3（`dice-roll-logic.service` 等）／🟡 黄 約25。次は緑→黄で `create-test` 継続。

---

## 2026-06-01 H6 AuthModule⇄UserModule 循環の解消（forwardRef 撤去・挙動保存）

ブランチ `refactor/auth-user-cycle-h6`。最後まで残っていた `domains/auth/auth.module.ts ⇄ domains/user/user.module.ts`（forwardRef）を解消。ARCHITECTURE §10（AuthService→UserService 許容 / UserModule→AuthModule 原則禁止 / 共通 port 切り出し）に準拠。**認証・トークン検証の挙動は不変**。

循環の真因：`JwtAuthGuard` が `AuthService` を注入していたため、guard を使う UserModule が AuthService→UserService を引き込んで循環していた。さらに UserController が `AuthService.validateToken` を直接利用。

破断方式（JWT 検証 primitive を下位モジュールへ抽出）：

- **新設 `JwtTokenService`**（`src/domains/auth/token/jwt-token.service.ts`）：`AuthService.validateToken`/`parseJwt` のロジックをそのまま移設。依存は `JwtService` のみ（UserService に依存しない）。検証ロジック・例外・戻り値は不変。
- **新設 `AuthTokenModule`**（`src/domains/auth/token/auth-token.module.ts`）：`JwtModule.registerAsync`（旧 AuthModule の設定を移設）と `ConfigModule` を import し、`JwtTokenService` / `JwtAuthGuard` / `JwtModule` を providers/exports。`@Global` 不使用の下位共通モジュール。
- **`JwtAuthGuard`**：`AuthService` 注入 → `JwtTokenService` 注入へ繋ぎ替え（`request.user = payload` 等の挙動は不変）。
- **`AuthService.validateToken`/`parseJwt`**：`JwtTokenService` へ委譲する薄いラッパに変更（AuthController の validate-token 等の既存呼び出しは挙動不変）。
- **`UserController`**：`AuthService` 注入を撤去し `JwtTokenService` を注入（findOne の validateToken）。`JwtAuthGuard` は AuthTokenModule 由来。`JwtTokenPayload` は型 import のまま。

モジュール配線 before/after：

- `AuthModule`：`forwardRef(() => UserModule)` → 通常 import に戻す。`JwtModule` 登録を撤去し `AuthTokenModule` を import＋**re-export**（下流の Character/Discord が従来どおり AuthModule 経由で JwtAuthGuard を解決できるよう互換維持）。providers から `JwtAuthGuard` 除去。
- `UserModule`：`forwardRef(() => AuthModule)` を削除し `AuthTokenModule` を import。これで user→auth(module) が消滅。

検証結果：

- `pnpm run build`：成功。
- `pnpm run check:circular`：**No circular dependency found!（0 件）**。これまで許容していた auth⇄user が消滅し、循環ゼロを達成。
- `pnpm test src/domains/auth src/domains/user`：5 suites / 66 tests 緑。既存 spec のモック構造を追従（auth.service.spec は実体 JwtTokenService を登録、user.controller.spec は AuthService モック→JwtTokenService モックへ）。新規 `jwt-token.service.spec.ts`（有効/無効トークン検証）を追加。
- `pnpm run start:dev`：AuthTokenModule/UserModule/AuthModule/CharacterModule/DiscordModule の DI 解決成功、"Nest application successfully started"。

---

## 2026-06-01 H9-character エラーハンドリング統合（character.controller・挙動完全保存）

ブランチ `refactor/error-handling-h9-character`。対象は `domains/character/character.controller.ts`（9 メソッド全てが `@Res()`＋手動 try/catch＋`ApiResponseUtil` 直呼び）。auth/user と同様に `core/http` の `ResponseInterceptor`＋例外フィルタへ controller スコープで置換し、**envelope/status/message/error/errorCode を完全保存**。`ApiResponseUtil` 本体・他 controller・core/http 共通実装は不変。グローバル登録なし。

### auth/user との差分と最小追加

character は汎用 `ApiResponseUtil.error` ではなく**専用ヘルパ**（`authenticationError`/`notFoundError`/`internalServerError`）を使っており、これらは `errorCode` と固定 `message`（'認証エラー'/'未発見エラー'/'サーバーエラー'）を持つ `ErrorResponse` サブクラスを生成していた。共通 `HttpExceptionFilter` は `errorCode` を再現できないため、character スコープ専用に最小追加した（`src/domains/character/character-http.exception.ts`）。

- **`CharacterHttpExceptionFilter`（`@Catch()`）**：`CharacterAuthenticationException`→`AuthenticationErrorResponse`(401)、`CharacterNotFoundException`→`NotFoundErrorResponse`(404)、それ以外→`InternalServerErrorResponse`(500)。いずれも core/http の DTO を再利用するため envelope は `ApiResponseUtil.authenticationError/notFoundError/internalServerError` と完全一致。
- 成功封筒化は共通 `ResponseInterceptor`＋`@ResponseMessage`/`@HttpCode` を流用。**meta を持つ一覧系**（findAll/summaries）は interceptor が meta を落とすため、`SuccessResponse(data, message, meta, uuidv4())` を直接 return（interceptor は `instanceof SuccessResponse` を素通し）して meta を保存。

### エンドポイント別 保存マッピング

| method                     | success (status / message)                                                                | error                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| create                     | 201 / 'キャラクターを作成しました'                                                        | 認証欠落 401(authenticationError,'認証トークンがありません') / DB 500(internalServerError) |
| findAll                    | 200 / 'キャラクター一覧を取得しました'（meta 付き）                                       | 同上 401 / 500                                                                             |
| findUserCharacterSummaries | 200 / 'キャラクターサマリーを取得しました'（meta 付き）                                   | 同上 401 / 500                                                                             |
| findOne                    | 200 / 'キャラクターを取得しました'                                                        | not found 404(notFoundError,'キャラクター') / 500                                          |
| update                     | 200 / 'キャラクターを更新しました'（character.updated emit）                              | 404 / 500                                                                                  |
| remove                     | 200 / 'キャラクターを削除しました'（`{message,characterId}`・character.deleted emit）     | 404 / 500                                                                                  |
| updateDiscordEmbed         | 200 / 'キャラクター情報の取得が完了しました'                                              | 認証 401 / not found 404 / 500                                                             |
| createDiscordThread        | 201 / 'Discordスレッド作成を開始しました'（discord.thread.create.requested emit）         | 401 / 404 / 500                                                                            |
| displayCharacterOnDiscord  | 200 / 'Discordキャラクター表示を開始しました'（discord.character.display.requested emit） | 401 / 404 / 500                                                                            |

Discord 連携 3 メソッドは cookie/redirect の副作用が無く、`@Res()` を完全に return 化（`@SkipResponseWrapper` 不要）。`extractAuthenticatedUser` は `UnauthorizedException`→`CharacterAuthenticationException` に変更（catch 経由の authenticationError と同一 envelope）。

### 検証結果

- `git grep '@Res()' character.controller.ts`：0 件。
- `pnpm run build` 成功。
- `pnpm test character.controller.spec.ts`：**26/26 緑**。spec は新方式（戻り値/throw 検証）＋実機同様の interceptor/filter を介した最終 envelope を `ApiResponseUtil.success/authenticationError/notFoundError/internalServerError` と requestId/timestamp 除き完全一致比較。
- `pnpm run check:circular`：**No circular dependency found**（新規循環なし。character-http.exception は core/dto のみ参照）。
- 既存の `character.integration.spec.ts`（実 DB 依存・トランザクション/イベント）は**変更前から 7 failed の pre-existing**（stash で確認、本変更と無関係）。`character.crud.spec.ts` は単独実行で 9/9 緑（フル並列実行時のみ DB 競合で flaky）。

### 残課題

- 実 HTTP 経由の E2E は未実施。最終的に auth/user/character を共通フィルタ＋グローバル登録へ寄せる際、character の専用 errorCode 保存をどう一般化するか（共通 `HttpExceptionFilter` の `ApiError` 拡張 or 専用例外の昇格）を検討。

## 2026-06-01 H9 エラーハンドリング統合（auth/user controller のみ・挙動完全保存）

ブランチ `refactor/error-handling-h9`。対象は `domains/auth/auth.controller.ts` と `domains/user/user.controller.ts` の 2 つのみ。`character.controller` 他・`ApiResponseUtil` 本体は不変。**レスポンス形（envelope/status/message）を一切変えない**ことを成功条件に、`@Res()`＋try/catch＋`ApiResponseUtil` 直呼びの NestJS アンチパターンを宣言的方式へ置換した。

### 追加した仕組み（`src/core/http/`、controller スコープ適用・グローバル登録なし）

- **`ResponseInterceptor`**：ハンドラ戻り値を `ApiResponseUtil.success` と同一の `SuccessResponse(data, message, undefined, uuidv4())` でラップ。message は `@ResponseMessage` メタ（無ければ '成功'）。`SuccessResponse` 既存インスタンスは二重ラップしない。
- **`HttpExceptionFilter`（`@Catch()`）**：throw を `ApiResponseUtil.error` と同一の `ErrorResponse(errorMessage, label, undefined, undefined, stack, uuidv4())` に整形。
  - `ApiError`（独自 `HttpException`）が throw された場合は最優先で status/label/errorPayload を採用（個別 404/401 分岐の再現）。
  - 素の例外は `@ApiErrorResponse(status, label)` メタを fallback として適用（= 変換前の「catch が全エラーを固定 status＋固定 label に潰す」挙動の再現）。メタも無ければ既定 500/'エラーが発生しました'。
- **デコレータ**：`@ResponseMessage(msg)` / `@ApiErrorResponse(status,label)` / `@SkipResponseWrapper()`（redirect・空返却の非封筒化マーカー）。
- envelope は `ApiResponseUtil` と**同一クラス（`SuccessResponse`/`ErrorResponse`）・requestId=uuid・timestamp**を再利用し形を完全一致。

### エンドポイント別 保存マッピング

auth: validate-token=success 200/'成功'・error 401/'トークン検証に失敗しました' ／ login=200/'成功'・401/'ログインに失敗しました'（code 無し BadRequestException も catch 同様 401 に潰れる挙動を保存）／ logout=200/'成功'・500/'ログアウトに失敗しました'（失敗時ログ出力も保持）／ getUser=200/'成功'・not found は `ApiError(404,'エラーが発生しました','ユーザーID … が見つかりません')`／DB エラー 500/'ユーザー情報の取得に失敗しました'。discordLoginCallback は動的 redirect のため `@Res({passthrough})`＋`@SkipResponseWrapper()`＋`@ApiErrorResponse(401,'Discord認証コールバックに失敗しました')`。
user: 全 success 200/'成功'。create=err 500/'ユーザー作成に失敗しました'、findOne=500/'ユーザー取得に失敗しました'（not found は `ApiError(404,…,'ユーザーが見つかりません')`）、getDiscordGuilds=500/'Discord Guild一覧取得に失敗しました'（user 不在 `ApiError(401,…,'認証トークンがありません')`）、update/addCharacter/removeCharacter/remove も同様に各 500 ラベル＋not found 404。全エンドポイント `@HttpCode(200)` で 200 を保存。

### 検証結果

- `pnpm run build` 成功。
- `pnpm test src/domains/auth src/domains/user src/core/http`：6 suites / 67 tests 緑。controller spec は「戻り値/throw を検証」＋「実機同様の interceptor/filter を介した最終 envelope が変換前の `ApiResponseUtil.success/error` と一致（requestId/timestamp 除き完全一致）」を保証。interceptor/filter 単体テストも追加。
- `pnpm run check:circular`：許容済み UserDomain⇄AuthDomain 1 件のみ（新規循環なし。core/http は依存を一方向に保つ）。
- `@Res()`（引数なし）：対象 2 controller で 0 件。残る `@Res({passthrough:true})` は cookie 設定/redirect の副作用境界のみで、レスポンス本体は interceptor/filter が封筒化。

### 残課題・注意

- `discordLoginCallback` は動的 redirect のため `@Res({passthrough:true})` を維持。`@HttpCode` でなく redirect なので envelope 対象外。passthrough で redirect 後にハンドラが undefined を返す経路は controller spec では緑だが、実 HTTP（redirect 後の二重送信有無）は **E2E 未検証**。本番投入前に手動/E2E で redirect 動作の確認推奨。
- `ApiResponseUtil` は character 等が継続使用のため温存。将来 character spec の AttributeValue ドリフト解消後、同方式を character.controller へ展開し最終的にグローバル登録へ寄せる案。

## 2026-05-30 全フォルダ監査を実施（NestJS ベストプラクティス照合）

`src` 直下10フォルダ（domains, discord, events, core, config, auth, middleware, shared, types, utils）に
専任サブエージェントを割り当て、4視点（設計・依存／コード品質／テスト・保守性／未完成・負債）＋
`nestjs-best-practices` スキル（40ルール）で「劣っている点」を洗い出した。

- 詳細レポート: `document/refactoring-audit-2026-05-30.md`
- フォルダ別の生所見: `outputs/refactor-audit/findings/<folder>.md`（セッション作業領域）

### 監査で判明した構造的問題（3点）

1. **横断コードの置き場所の乱立** — `core`/`shared`/`utils`/`types` が重複し、`core/shared`⇔`src/shared`、
   型置き場が `src/types`/`core/types`/`shared/types` の3系統に分散。規約が未確立。
2. **複数の移行が同時に途中停止** — イベントバス一本化、Discord Interactions の Registry 移行、
   `process.env`→`AppConfigService` 集約、`forwardRef` 撤廃、エラーハンドリング統合がいずれも新旧並存。
3. **ドキュメントと実装の乖離** — 「型安全100%」「循環依存0」の主張に対し、`any` が約360件（非テスト約230件）・
   `forwardRef` 循環・`process.env` 直読み（約25ファイル）が残存。

### High 優先課題（横断）

- H1 横断レイヤー責務未確立 / H2 **イベントバス3系統**（EventBusService/GlobalEventBusService/TypedEventService）
  ＋registry/router/manager 三重 / H3 Discord 巨大サービス / H4 Interactions 新旧並存（InteractionsModule が feature を import）/
  H5 ドメイン純粋性の崩れ（Controller の @Res 手動レスポンス＋デッドコード3点）/ H6 auth 二重構造(forwardRef 循環) /
  H7 設定アクセス非集約 / H8 型安全性の実態乖離(`req.user: any`, any 約230件) / H9 エラーハンドリング三重化 /
  H10 純粋層への混入＋機密ログ(`crypto.util.ts` の config 参照, `auth.controller.ts` のトークン console.log)

### 特に緊急（セキュリティ）

- `auth.controller.ts:103-133` 等が **JWT トークン / Authorization ヘッダを console.log 出力**している。
  機密漏洩リスクのため最優先で除去すること。

### 確認されたデッドコード（domains）

- `character-id.service.ts`（利用箇所ゼロ、ID生成は別3系統に分散）
- `character/schemas/character.schema.ts`（zod 248行、参照ゼロの未配線並行実装）
- `CharacterEventHandlerService`（自称レガシー、リスナー登録は空・private 群は呼び出し元なし）

> ⚠️ **2026-05-31 訂正（実コード再確認）**: 上記デッドコード3点の判定は**実態と乖離しており当てにできない**。
>
> - `character-id.service.ts`（`CharacterIdService`）は **4ファイルで参照・使用中**（`CharacterCreationRequestedHandler`
>   経由でキャラ作成のユニーク ID 採番に使われる現役経路）。「利用箇所ゼロ」は**誤り**。削除すればキャラ作成が壊れる。
> - `character/schemas/character.schema.ts` は参照1件、`CharacterEventHandlerService` は参照3件あり、完全な死蔵とは限らない。
> - **結論: これらは安易に削除しない。削除前に必ず実コードで再精査すること。** 監査レポートの同記述も同様に要訂正。

### 推奨着手順（ARCHITECTURE.md の移行順序に整合）

1. 規約の明文化（横断コード／型の置き場所の決定表、`req.user` の any 排除）
2. 機密ログの即時除去（auth.controller のトークン出力）→ console.\* の Logger 統一に着手
3. events/DESIGN.md 作成 → バス3系統を TypedEventService へ統一・registry 一本化・contracts 逆流依存撤去・
   EventsModule/InteractionsModule の feature import 排除
4. 設定集約（AppConfigService に typed accessor、process.env/生 ConfigService 置換、crypto 鍵もここへ）
5. エラーハンドリング統合（単一 ErrorHandler ＋例外フィルタ、Controller の @Res＋try/catch を戻り値方式へ）
6. デッドコード一掃 ＋ Discord 巨大サービス分割（diceRoll Feature 分離から）、domain の event 直接依存除去
7. auth/user の forwardRef 解消（port 切り出しで UserModule→AuthModule を断つ。src/auth と domains/auth 統合。最後に実施）

各ステップは小さな PR に分割し、`pnpm run build` → `pnpm run start:dev` → `pnpm run check:circular`
で循環参照を確認する（UserDomain⇄AuthDomain のみ許容）。

### 次にやること

- [x] 横断コード／型の置き場所の決定表を作成し本書と `AI.types.md` に追記 → **H1 完了（2026-06-01）**：`src/ARCHITECTURE.md` §12 を決定表化（core=DIサービス/インフラ、shared=純粋関数、utils 解消方針、型は core/types 一本化、express 拡張は例外）。`AI.types.md` に正本ポインタ追記。適用（utils/types のファイル移動）は挙動保存の小 PR で順次。
- [x] `auth.controller.ts` 等の機密 console.log を削除（セキュリティ最優先）→ **Phase S で完了（下記）**
- [x] `src/events/DESIGN.md` を作成（バス一本化の具体設計）→ **完了（2026-05-31）**。T1〜T5 まで実施済み。
- [ ] High 課題を Issue / Phase plan 化して着手順に並べる

---

## 2026-05-31 Phase S（セキュリティ最優先）完了

ブランチ `refactor/security-phase-s`。計画書 `document/refactor-phase-S-plan.md` の S1〜S4 を実施。
各ステップは nestjs-best-practices スキルのサブエージェントに委譲し、`pnpm run build` /
`pnpm run check:circular` で検証（循環は許容の UserDomain⇄AuthDomain 1件のみ、新規循環なし）。

### S1: 機密ログ除去（完了）

- `auth.controller.ts`: `console.log('Authorization'/'headers')`（JWT・全ヘッダ漏洩）、
  `User object to save` の `JSON.stringify(user)`（discord access/refresh token 漏洩）等、計7行削除。
- `auth.service.ts`: `console.log(redirectUri)`、params 全ループ debug（**client_secret 漏洩**）、
  Discord プロフィール全体 JSON 出力 等、計8行削除。
- **判断: login レスポンス body の `token: jwt` は削除しない。** フロント（Remix loader
  `trpg-remix-app/app/features/auth/api/authLoader.tsx`）が `auth.token` に依存しており、消すと
  ログインが壊れる。「Cookie 専用移行」は別 Issue（下記 残課題）。

### S2: 機密 env 必須化 ＋ crypto 鍵の config 集約（完了）

- `config/environment.validator.ts`: `JWT_SECRET` / `DISCORD_TOKEN_ENCRYPTION_KEY` に最小長32文字検証、
  `REDIRECT_URL` は値がある場合のみ URL 形式検証を追加（エラーに機密値は出さず長さのみ表示）。
- crypto を**純粋関数 ＋ DI サービス**に分離（ARCHITECTURE 方針＝utils は純粋関数のみ）：
  - `utils/crypto.util.ts` … 鍵を引数で受け取る純粋関数化（process.env 直読み廃止）。
    アルゴリズム `aes-256-gcm`・鍵導出 `scryptSync(key,'salt',32)`・フォーマットは維持＝**後方互換あり**。
  - `core/shared/services/crypto.service.ts`（新規）… `@Injectable`、`AppConfigService` から
    `security.discordTokenEncryptionKey` を取得し CryptoUtil へ委譲。`SharedModule` に登録・export。
  - 呼び出し元（`auth.service.ts` 6箇所、`user.service.ts` 1箇所）を CryptoService 注入へ置換。
  - spec: `crypto.util.spec.ts` を鍵引数対応に更新、`crypto.service.spec.ts` 新規（往復・鍵未設定エラー）。

### S3: CORS 二系統解消（完了）

- no-op の `middleware/cors.middleware.ts` を削除。`app.module.ts` から `NestModule`/`configure()`/
  `CorsMiddleware` 配線を撤去（`import { Module }` のみに）。CORS は `main.ts` の `enableCors` に一本化。
- `main.ts`: 未使用の `import cors from 'cors'` を削除。`frontendUrl` 空時に fail-fast するガードを追加し
  `origin` を確定値化（`credentials: true` 維持）。`cors` npm パッケージは未使用＝削除可（未削除・報告のみ）。

### S4: req.headers['user'] 無検証認証導線を Guard 一本化（完了）

- `character.controller.ts` の `extractAuthenticatedUser` と `user.controller.ts` の `getDiscordGuilds`
  から `req.headers['user']` の `JSON.parse` フォールバックを除去し、`JwtAuthGuard` が設定する
  `req.user`（`express/index.d.ts` で `JwtTokenPayload` 宣言済み）のみを使用。`as unknown as` キャスト除去。
- 対象ルートは全て `@UseGuards(JwtAuthGuard)` 付与済み（抜けなし）。

### ⚠️ Phase S 完了後の重要な運用上の注意・残課題

- **【対応済み】** S2 の最小長32文字検証は **`NODE_ENV=production` のときのみ強制**（dev/test は緩和）に調整。
  必須チェック（値の存在）と `REDIRECT_URL` 形式検証は全環境で維持。これによりローカル/開発は既存の短い秘密
  （12文字）でも起動でき、本番のみ強い秘密を要求する。`environment.validator.ts` の `validate()` 内で
  `if (result.NODE_ENV === 'production')` ガードにより実装。dev=success / prod=fail を dist 直叩きで確認済み。
  - ⚠️ **本番デプロイ時の注意**: 本番 env の `JWT_SECRET` / `DISCORD_TOKEN_ENCRYPTION_KEY` は32文字以上が必須。
    `JWT_SECRET` 変更 → 既存 JWT 無効化（再ログイン、影響小）。`DISCORD_TOKEN_ENCRYPTION_KEY` 変更 →
    scrypt 出力が変わり**既存 DB の暗号化 Discord トークンが復号不能**（ユーザーは Discord 再連携が必要）。
    本番で鍵を伸ばす場合は移行計画（再認証フローの案内等）が必要。
- **【別 Issue】** login レスポンス body の `token: jwt` を廃し Cookie(httpOnly) 専用へ移行する。
  フロント（Remix loader が body token で自前 Cookie を設定）の改修が前提。
- **【別 Issue／既存負債】** `auth.controller.spec.ts`・`auth.service.spec.ts`・`user.controller.spec.ts`・
  `user.service.spec.ts`・`character.controller.spec.ts` 等が **Phase S 着手前から** 型/メソッド/モジュール
  不整合でコンパイル不能。Phase S の変更は新規破損を加えていない（stash ベースライン比較で確認済み）が、
  これら spec の修復は別タスク。
- **【未着手】** `cors` パッケージの package.json からの削除、`discord.controller.ts` の独自
  `AuthenticatedRequest` 型一本化（Phase T 型整理へ）。

---

## 2026-05-31 次フェーズ計画（整理）

Phase S 完了後の状況を実コードで再確認し、着手順を整理した。`process.env` 直読みは監査の「約25」ではなく
**実際は9ファイル**（非 spec）。デッドコード3点の判定は誤り（上の訂正注記参照）。

### A. 現ブランチ（refactor/security-phase-s）の締め

- [x] auth/user の壊れた spec を修復（4 suites / 62 tests green）。Guild 系メソッドは Auth→User へ移管済みと判明（`AI.test.md` 記載）。
- [x] pre-commit フックの健全化（`git add .` 撤去・ステージ限定）とテンプレート同期、`prettier.config.js` の CommonJS 化。
- [x] 監査の「デッドコード3点」記述を訂正（本書・監査レポート）。
- [ ] **develop へマージ**（前に `pnpm run build`→`start:dev`→`check:circular` の最終確認。push 要否はユーザー判断）。
- [ ] Phase S スピンオフのバックログ化（下記「別 Issue」群：token の Cookie 専用移行 / 未使用 `cors` パッケージ削除 / 本番 env 32文字必須の周知）。

### B. High 課題（ARCHITECTURE.md の移行順・推奨シーケンス）

1. **H7 設定集約** … `process.env` 直読みを `AppConfigService` へ。**DI 可能な3クラスは移行完了**（2026-05-31, ブランチ `refactor/config-aggregation`）：`channel-cache.service`・`discord-command-registration.service`・`performance-dashboard.controller`。`DISCORD_CACHE_TTL`/`MESSAGE_CACHE_LIMIT`/`CHANNEL_CACHE_LIMIT`/`TEST_MOCK_DISCORD` を schema/validator/configuration/ConfigPaths へ追加し `discord.*` で公開、NODE_ENV は既存 `app.environment` を使用。
   - **残**（DI 困難・別途）：`core/dto/api-response.dto.ts`・`utils/error-handler.ts` の NODE*ENV 直読み（DTO/静的 util で DI 不可）。設定層の読み取り（`config.service`・`configuration` の PROTOTYPE*\*・`environment.validator`）は env→config 境界として維持。
2. **H2/H4 イベントバス一本化＋Interactions registry** … **完了（2026-05-31）**。`events/DESIGN.md` の T1〜T5 を全実施し、安全網テスト（挙動固定）＋build/check:circular/start:dev で挙動不変を都度証明しつつ develop へ段階マージ。
   - **T1**: デッドな `EventRouterService` 撤去。
   - **T2(a/b/c)**: レガシー `GlobalEventBusService` を完全撤去し**バスを `TypedEventService` 1系統に統一**（3系統並存を解消）。生フローは型付き契約に追加のうえ移設、dead 利用は削除。
   - **T3**: events→features 逆流を解消。完了系4ハンドラを `src/discord/events/handlers/`（`DiscordEventHandlersModule`）へ移設し `TypedEventService.on` 自己購読化。EventsModule の feature `forwardRef` import を撤去 → events 層は domains/core/shared 依存のみ。
   - **T4**: `TypedEventService` を `shared/application`→`core/events` へ移設、@Global `CoreEventsModule` 新設、旧 `src/shared/shared.module` 削除（import 48ファイル更新）。
   - **T5**: `src/events/AI.event.md` 冒頭に現状の正アーキテクチャ節を追加し以降を履歴と明示。
   - 正本は `src/events/AI.event.md` 冒頭節＋`src/events/DESIGN.md`。登録は events 層=EventRegistry（File-based）／discord 層=自己購読 の2経路。監査の「contracts 逆流」は実在せず、逆流は handlers→features / EventsModule→feature の import だった（T3 で是正済み）。
3. **H9 エラーハンドリング統合** … **auth/user controller 完了（2026-06-01, ブランチ `refactor/error-handling-h9`）**。`core/http` の controller スコープ例外フィルタ＋レスポンスインターセプタへ置換、envelope/status/message を完全保存（詳細は冒頭 2026-06-01 節）。残: character 他は spec ドリフト解消後に展開し、最終的にグローバル登録へ寄せる。
4. **H3/H5 Discord 巨大サービス分割** … pagination 等の分割＋（再精査後の）デッド整理（中〜大）。
   - **H3 `character-dice-buttons.service.ts` 分割完了（2026-06-01, ブランチ `refactor/discord-service-split-dicebuttons`, 挙動保存）**：848→287 行。純粋整形ロジック（getResultEmoji/formatResultText/getSuccessText/formatDiceRollResultAsText）を `button/character-dice-format.util.ts`（discord.js/Nest 非依存・§12 の feature 配下 util）へ抽出し新規ユニットテスト 23 件追加。履歴・保存・ページネーション表示（saveRollResult/createPaginatedDiceRoll/updateDiceRollHistoryAsync/handleParentChannelMessage/createFallbackControls＋throttle/lock 状態）を `button/character-dice-history.service.ts` へ抽出。公開 API（data/execute/handleDiceRoll/コンストラクタ）不変。コンストラクタ不変制約のため history service は注入済み依存から内部 `new` で生成・再利用（DI provider 追加なし＝module 無変更）。既存 21 テスト緑維持、build 成功、check:circular 循環ゼロ。残デッド：`handleParentChannelMessage` は未呼び出し（移設のみ・削除は別タスク）。
5. **H6 auth/user forwardRef 解消** … port 切り出し＋`src/auth`/`domains/auth` 統合。影響最大＝最後（大）。
6. 随時: **H1/H8** 横断コード・型の置き場所決定表＋`any` 削減。

### C. テスト負債（別トラック）

- `character`/`discord` 系 spec が **AttributeValue モデルドリフト**でコンパイル不能（Phase S 着手前から）。`test-expansion`/`create-test` で別タスク修復。auth/user spec は A で修復済み。

### 進め方

各 High 課題は `trpg-refactor` スキル（理解→nestjs-best-practices へ実装委譲→build/check:circular 検証→AI.\*.md 記録）で小さな PR に分割して進める。循環参照は UserDomain⇄AuthDomain のみ許容。
