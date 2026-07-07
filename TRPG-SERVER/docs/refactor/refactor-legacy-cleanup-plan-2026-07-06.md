# 古い書き方・重複・未使用コード 掃除計画書（C 系列）

**作成日:** 2026-07-06
**ステータス:** C-1 完了（2026-07-07・コミット `c27c224`）／C-8 事前調査完了（案A 実行可・ユーザー GO 待ち。調査詳細は AI.refactor.md 2026-07-07 節）／C-2 以降 未着手
**診断の記録:** `AI.refactor.md`『2026-07-06 全体クリーンアップ分析』節
**上位方針:** `src/ARCHITECTURE.md`（§11 Config / §12 置き場所決定表 / §15 禁止事項）
**関連計画:** `refactor-event-design-plan-2026-07-06.md`（E-1〜E-6・イベント設計）— 本書は E 系列と**独立実施可能**な掃除系スライスを扱う。重複する項目は E 系列へ吸収し、本書では扱わない。

---

## ベースライン（2026-07-06 司令塔実測）

```
pnpm run build          # exit 0
pnpm run check:circular # No circular dependency found!（480 files）
pnpm run test           # 187 suites / 2613 tests 全緑
```

- 未コミットの作業ツリー（F5+F10 撤去・2026-06-10/11 修正）込みの実測値。**各 slice 完了時にこの基準へ戻ること**（テスト数は意図的な削除/追加分のみ増減を許容し、差分を記録する）。
- 既知の警告: jest 終了時「worker process has failed to exit gracefully」（タイマー teardown リーク疑い・全緑には影響なし→ C-10 で扱う）。

## 分析方法

Explore サブエージェント3系統（未使用コード/古い書き方/重複）＋司令塔の grep 裏取り。エージェント報告のうち司令塔裏取りで**訂正した項目**:

- `DiceOrchestratorService.sendToParentChannel` は dead ではなく **live**（`custom-dice-modal.service.ts:123` が呼ぶ）。
- `discord.utils.ts` の `handleError` は「ErrorHandler で置換可能」ではなく **import 元ゼロ＝ファイルごと dead 候補**。
- console.\* は 14 箇所ではなく**非テスト 31 箇所 / 9 ファイル**。
- `recordRateLimit`/`triggerAlert` の非 spec ヒットは別クラス（alert-manager / discord-monitor）の同名メソッド定義であり、`PerformanceOrchestratorService` 側の外部呼び出し元ゼロは維持（ただし連鎖の liveness は C-3 で要再確認）。

## 分析結果サマリ

### ① 未使用コード

| 対象                                                                                                                                                                                     | 根拠（裏取り状況）                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm 依存 5 件: `@aws-sdk/client-dynamodb` `@aws-sdk/util-dynamodb` `dynamoose` `pg` `express-session`                                                                                    | src+test 参照ゼロ（司令塔 grep 済・確度高）                                                                                                                                                                                                                    |
| `typeorm` + `@nestjs/typeorm`                                                                                                                                                            | src 参照ゼロ。test のみ 3 ファイル（`test/config/test-db.config.ts` / `test/mocks/mock-typeorm.module.ts` / `test/mocks/mock.module.ts`）が型 import（司令塔 grep 済）                                                                                         |
| 配置間違い: `@types/uuid` `eslint-plugin-import` が dependencies                                                                                                                         | package.json 実見。devDependencies へ（uuid v11 は型同梱のため @types/uuid 自体不要の可能性）                                                                                                                                                                  |
| `DiceOrchestratorService` の 7 メソッド: `parseFormula` `evaluateFormula` `convertToDiceNotation` `getServiceStats` `legacyCalculateAndRoll` `legacyParseAndCalculate` `executeNotation` | 外部非 spec 参照ゼロ（司令塔 grep 済。F10 の残・AI.refactor.md 2026-06-10 の残課題リストと一致）。**`sendToParentChannel`/`sendToParentChannelBasic`/`calculateAndRoll`/`executeBasicNotation`/`getResultEmoji`/`getBasicResultEmoji` は live のため絶対残す** |
| `src/discord/utils/discord.utils.ts`（`handleError`）                                                                                                                                    | import 元ゼロ（司令塔 grep 済・確度高）                                                                                                                                                                                                                        |
| `PerformanceOrchestratorService.recordRateLimit` / `triggerAlert`                                                                                                                        | 外部呼び出し元 spec のみ（エージェント報告・**連鎖 liveness 要再確認**: orchestrator→discord-monitor/alert-manager の委譲チェーン全体が dead か、client hook 等から発火するか）                                                                                |
| `DiscordInteractionHandlerService.getHandlerStats` / `clearExpiredInteractions`                                                                                                          | spec のみ。**E-5（3層ルーティング1本化）で同サービスを解体予定のため E-5 へ吸収**（本書では扱わない）                                                                                                                                                          |
| lint script の陳腐化 ignore: `src/DB/**/*` `src/domains/discord/**/*`                                                                                                                    | 両ディレクトリ実在せず（司令塔確認済）                                                                                                                                                                                                                         |
| `app.module.ts` の adapters コメントアウト残存                                                                                                                                           | 既知（AI.md 2026-05-30 メモ「最終整理のみ別タスク」）                                                                                                                                                                                                          |

### ② 古い書き方

**再発ゼロを確認した規約**（対応不要・良好）: `process.env` 直接参照（本番=config 内部の許容例外のみ）/ `forwardRef` / `@Global()` / Nest `ConfigService` 直 inject / `ModuleRef.get` / RxJS `toPromise()` / 旧イベント系統（EventRouterService 等）/ 旧命名 DTO（PartialInput\*）。

| 対象                                | 規模・根拠                                                                                                                                                                                                                                                                              |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| console.log/error/warn 直接使用     | 非テスト **31 箇所 / 9 ファイル**（司令塔 grep 済）。diceRoll pagination 3 ファイルに集中＋`custom-dice-modal` `command-manager` `discord.utils`(dead候補) `loadJsonFile`。`config/configuration.ts`・`environment.validator.ts` は起動時バリデーション（DI 前）＝許容例外              |
| discord.js 非推奨 `ephemeral: true` | 4〜5 箇所（`core/http/error-handler.ts:157,164,174` / `commands-components/character-thread.service.ts`）。`MessageFlags.Ephemeral` へ                                                                                                                                                  |
| 非テスト `any` 約 204 件            | event contracts 系に集中（`character-events.contract.ts` 27 / `unified-event-contracts.ts` 24 / characterEdit contracts 25 …）→ **E-4a（契約一本化）と同時に解消するのが効率的**。本書では独立 slice にしない                                                                           |
| tsconfig 第2段階フラグ未有効        | `noUnusedLocals` `noUnusedParameters` `noImplicitOverride` `exactOptionalPropertyTypes` が false のまま（2025-01 の段階計画から停止中）                                                                                                                                                 |
| **依存バージョン不整合**            | Nest core v10.4.20 に対し **v11 系サテライト**（`@nestjs/config@4` `@nestjs/mongoose@11` `@nestjs/typeorm@11` `@nestjs/schedule@6`）＋ **`express@5.1.0`**（platform-express v10 は express4 前提。src から `from 'express'` の直 import 多数＝型と実体の乖離が潜在）。pnpm ls で実測済 |

### ③ 重複

| クラスタ                           | 系統数・根拠                                                                                                                                                                                                                    | 統合難易度                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `sendToParentChannel` private 実装 | **5 handler に重複**（ability-roll / character-skill-roll / dice-generic / flexible-dice-select / preset-dice-quick-roll の各 handler 内 private）＋ services/dice 側の 2 実装（orchestrator→calculation 委譲）。司令塔 grep 済 | 低〜中（実装差分の棚卸しが前提）                                       |
| エラーハンドリング                 | 3 系統: `core/http/error-handler.ts`（static）/ `core/http/http-exception.filter.ts`（filter）/ `discord/utils/discord.utils.ts`（→dead 候補・C-3 で削除）                                                                      | filter と static は責務が異なり共存可。dead 削除で実質 2 系統に収束    |
| キャラクター embed 生成            | 2〜3 系統: characterEdit `character-embed.util.ts`（純関数・§12 準拠＝正）vs characterThread `character-embed.service.ts` / `character-display.service.ts`（service 内で構築＋送信）                                            | 高（副作用と構築が混在。中期・要設計）                                 |
| ダイス計算・記法パース             | 5 系統以上: `utils/dice.util` / `services/dice/`（parser / calculation / roll-logic / orchestrator）/ commands-components 各 service。責務境界（誰がパース責任者か）が不明確                                                    | 高（中期・要設計。C-2 の dead 撤去で orchestrator が痩せてから再評価） |
| interaction 応答パターン           | ほぼ統一済み（replied/deferred チェック→editReply/followUp）。追加共通化は任意                                                                                                                                                  | －（対応不要）                                                         |
| エラーメッセージ文言ぶれ           | 「キャラクターが見つかりません」系の表記ゆれ複数                                                                                                                                                                                | 低（優先度低・スタイル統一のみ）                                       |

---

## スライス計画（C-1〜C-10・リスク昇順）

### 検証ゲート（各 slice 共通）

```
pnpm run build          # exit 0
pnpm run check:circular # No circular dependency found!
pnpm run test           # 全 suite（基準: 187 suites / 2613 tests。意図的増減は差分を記録）
pnpm run start:dev      # DI 解決・handler 登録数（現 23）・エラーなし（DI/provider を触る slice は必須）
```

- 各 slice は独立コミット（pathspec 限定・CRLF churn 非混入）。
- 純粋な dead-code 削除・依存削除は characterization 前倒し不要（trpg-refactor Phase 3 例外規定＝build/全 suite/start:dev で担保。この判断を各 slice 記録に残す）。
- 挙動に影響し得る slice（C-4/C-5/C-7）は着手前に現挙動の characterization を確認/追加する。

### C-1: 未使用 npm 依存の削除（低リスク・テスト前倒し不要）

- **C-1a**: `@aws-sdk/client-dynamodb` `@aws-sdk/util-dynamodb` `dynamoose` `pg` `express-session` を `pnpm remove`（参照ゼロ裏取り済）。
- **C-1b**: `typeorm` `@nestjs/typeorm` を削除。**前提**: test 側 3 ファイル（`test-db.config.ts` / `mock-typeorm.module.ts` / `mock.module.ts` の typeorm import 部）の利用実態を確認し、未使用なら test ヘルパーごと削除、使用中なら型を置換。
- **C-1c**: `@types/uuid` `eslint-plugin-import` を devDependencies へ移動（@types/uuid は uuid v11 型同梱なら削除）。
- **C-1d**: lint script の陳腐化 ignore 2 件（`src/DB` / `src/domains/discord`）を除去。
- **検証**: `pnpm install` → 共通ゲート＋`pnpm run lint` が従来同等に走ること。**完了条件**: 全 suite 187/2613 緑・start:dev 正常。

### C-2: DiceOrchestratorService の dead 7 メソッド撤去（F10 完遂・低リスク）

- 撤去: `parseFormula` / `evaluateFormula` / `convertToDiceNotation` / `getServiceStats` / `legacyCalculateAndRoll` / `legacyParseAndCalculate` / `executeNotation` ＋対応 spec describe。
- **残す（live・絶対に触らない）**: `calculateAndRoll` / `executeBasicNotation` / `getResultEmoji` / `getBasicResultEmoji` / `sendToParentChannel` / `sendToParentChannelBasic`（custom-dice-modal.service が使用）。
- **cascade 確認**: 撤去後に `DiceParserService` / `DiceCalculationService` 側で孤児化する public メソッド（例: parserService.parseFormula の呼び出し元が orchestrator のみだった場合）を再 grep し、孤児化したら同 slice 内で撤去。
- **検証**: 共通ゲート。テスト数減は削除 spec 分と一致することを記録。

### C-3: dead ファイル・dead メソッド撤去 第2弾（低〜中リスク）

- **C-3a**: `src/discord/utils/discord.utils.ts` を削除（着手時に import 元ゼロを再 grep してから）。
- **C-3b**: `PerformanceOrchestratorService.recordRateLimit` / `triggerAlert` — **着手前に liveness 連鎖を確定**（discord-monitor / alert-manager への委譲チェーン全体が dead か、discord.js client の rateLimit hook 等から発火する経路が無いか）。dead 確定なら撤去、live なら「監視系の配線状況」として AI.discord.md に記録のみ。
- **C-3c**: `app.module.ts` の adapters コメントアウト残存の最終整理（既知・削除のみ）。
- **注**: `DiscordInteractionHandlerService.getHandlerStats` / `clearExpiredInteractions` は **E-5 で吸収**（ここでは触らない。二重作業禁止）。
- **検証**: 共通ゲート＋撤去シンボル残存参照ゼロ grep。

### C-4: `sendToParentChannel` 5 重複の共通化（中リスク・挙動保存）

- 5 handler（ability-roll / character-skill-roll / dice-generic / flexible-dice-select / preset-dice-quick-roll）の private `sendToParentChannel` を共通ヘルパへ集約（置き場所は §12 決定表: discord.js 依存＋DI 不要なら feature 配下 util、複数 feature 横断なら要判断）。
- **前提の棚卸し**: 5 実装の diff（引数型 ButtonInteraction/StringSelectMenuInteraction・メッセージ整形・fallback 有無）を先に取り、**挙動差があれば統合せず記録して縮小**（挙動を変えないことが最優先）。
- **動作保証テスト**: 既存 handler spec の親チャンネル投稿 assert が安全網。着手前に対象 spec 緑を確認し、統合後も**同じ spec が緑のまま**であることで挙動不変を証明。
- **検証**: 共通ゲート＋handlers.integration.spec（登録 23 不変）。

### C-5: console.\* → Logger 統一（中リスク・出力先のみ変化）

- 対象: diceRoll pagination 3 ファイル / `custom-dice-modal.service.ts` / `command-manager.service.ts` / `loadJsonFile.ts`（計 31 箇所のうち config 2 ファイルは起動時バリデーション＝許容例外として残す。discord.utils は C-3a で削除済み想定）。
- Nest `Logger` へ置換（ログレベルは console.log→debug/log、console.error→error を基本に文脈判断）。
- **動作保証**: ログ以外の挙動（戻り値・分岐・reply）に触らないこと。既存 spec が console を assert していないか先に確認（していれば spec 側を Logger spy へ更新）。
- **検証**: 共通ゲート。

### C-6: `ephemeral: true` → `MessageFlags.Ephemeral`（低リスク）

- 対象: `core/http/error-handler.ts:157,164,174` / `commands-components/character-thread.service.ts`（着手時に全数再 grep）。
- discord.js v14.14 の deprecation 対応。ユーザー可視挙動は不変（ephemeral 応答のまま）。
- **検証**: 共通ゲート＋対象 spec（error-handler.spec 等）緑。

### C-7: DiscordService（deprecated ラッパー）解体（中リスク・DI 変更）

- 現状: `discord.service.ts` は `DiscordFacadeService` への薄い委譲ラッパー（deprecated 明記済・spec も委譲検証のみ）。注入元 4 サイト: `discord.controller.ts` / `discord-guild-manager.service.ts` / `discord-interaction-handler.service.ts` / `main.ts`。
- 手順: ①各注入元を `DiscordFacadeService`（または適切な下位サービス）直依存へ移行（1 サイト＝1 sub-slice 可）→ ②全サイト移行後にラッパー＋spec 削除・module providers 整理。
- **動作保証テスト**: 各注入元の既存 spec（呼び出し先 mock の差し替えのみ・emit/reply/戻り値不変を固定）。
- **注**: `discord-interaction-handler.service.ts` は E-5 の解体対象でもある。**E-5 を先に実施する場合は当該サイトを E-5 に委ね、C-7 は残り 3 サイトに縮小**（着手時に E-5 の進捗を確認）。
- **検証**: 共通ゲート＋start:dev 必須（DI 解決・handler 登録 23 不変）。

### C-8: 依存バージョン整合（要ユーザー判断・単独ブランチ）

- 現状（pnpm ls 実測）: `@nestjs/core 10.4.20` + `@nestjs/config 4.0.2` / `@nestjs/mongoose 11.0.3` / `@nestjs/schedule 6.0.1` / `express 5.1.0`（`@nestjs/typeorm 11` は C-1b で消える）。src は `from 'express'` を多数直 import しており、実行系（platform-express v10 内の express4）と型（top-level express5）が乖離。
- **選択肢**（実施前にユーザー判断）:
  - **案A: Nest v11 へ全面アップグレード**（core/common/platform-express/cli/testing を v11 へ）。サテライトの peer が正規化される。影響大・単独ブランチ・全 suite＋E2E＋start:dev 必須。
  - **案B: サテライトを v10 互換へ降格＋express を ^4 へピン**（config@3 / mongoose@10（mongoose8 対応可否要確認）/ schedule@4-5）。ダウングレードは機能退行の逆リスクあり。
  - **案C: 現状維持を明示記録**（動作実績はある。express の型乖離だけ `@types/express@^4` で緩和済みの可能性を確認し、リスクを AI.development.md に記録）。
- **推奨**: まず C-1 完了後に `pnpm ls --depth 1 | grep -i unmet` 等で peer 警告を実測し、警告実態を見てから A/B/C を選ぶ。**本 slice のみ「テストが緑でも実行時差が出得る」ため start:dev＋主要 E2E（test:e2e）まで回す**。
- **2026-07-07 事前調査済み（詳細: AI.refactor.md 同日節）**: ユーザー方針は案A。実測の結果、express 直 import 17 ファイルは全て型のみ・ワイルドカードルートゼロ・express4 削除 API 使用ゼロ・main.ts アダプタ非依存で、**案A のブロッカーなし**。要 bump: core 系一式→^11＋jwt@11/passport@11/axios@4/swagger@8+＋reflect-metadata@^0.2＋@types/express@5（config/mongoose/schedule/event-emitter/mapped-types は既に ^10||^11 で変更不要）。e2e spec 0 本のため test:e2e は start:dev＋Discord 実機 smoke で代替。**ユーザー GO 待ち**。

### C-9: tsconfig 第2段階の段階有効化（中リスク・C-2/C-3 後）

- 順序: `noImplicitOverride` → `noUnusedLocals` → `noUnusedParameters`（`exactOptionalPropertyTypes` は event contracts の any 解消＝E-4 完了後に再評価）。
- C-2/C-3 の dead 撤去後に実施することで修正量を最小化。各フラグ 1 コミット。
- **検証**: build（=型チェック）＋全 suite。機械的修正（未使用 import/変数の削除・`override` 付与）のみで、ロジック変更を紛れ込ませない。

### C-10: jest worker teardown リーク調査（低優先・テスト基盤）

- 全 suite 実行末尾の「worker process has failed to exit gracefully」を `--detectOpenHandles` で特定（channel-cache 等のタイマー系が候補）。テスト側 teardown（`unref()` / afterAll cleanup）で解消。
- **検証**: 全 suite 緑のまま警告消滅。

---

## 実施順序と依存関係

```
C-1（依存削除）→ C-2（dice dead）→ C-3（dead 第2弾）   … 独立・低リスク・いつでも可
C-4 / C-5 / C-6                                          … 相互独立・C-3a（discord.utils 削除）だけ C-5 より先
C-7 は E-5 の進捗を確認してから（同一ファイルを触るため。推奨: E-5 後に縮小版で実施）
C-8 は単独ブランチ・ユーザー判断後（C-1 完了が前提）
C-9 は C-2/C-3 完了後
C-10 は独立・任意タイミング
E-2〜E-4（イベント設計）とは衝突しない（any 削減は E-4a と同時実施を推奨）
```

## スコープ外（本計画ではやらない）

- イベント設計の是正（E-1〜E-6・既存計画書）。
- キャラクター embed 生成の統一・ダイス計算の責務再整理（**中期・要設計**。characterization を張ってから別計画書化。C-2 で orchestrator が痩せた後に再評価）。
- any 削減の独立実施（E-4a 契約一本化と同時が効率的）。
- フロントエンド（F1/F2/F6）・CI 導入（F3）・プリセット本格ルール（F7）・creation source 分岐（F11）。
- 挙動変更を伴う機能改善全般。
