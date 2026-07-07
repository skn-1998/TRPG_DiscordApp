# TRPG-SERVER リファクタリング設計メモ

このドキュメントは TRPG-SERVER のリファクタリングに関する調査・方針・進捗を記録する正本。
全体方針の上位は `src/ARCHITECTURE.md`、依存・ドメインは `AI.architecture.md` / `AI.domain.md` を参照。

---

## 2026-07-07 C-8 マージ＋E-2a/E-2e′ 完了（イベント RPC 是正の第1弾・実バグ2箇所解消）

ユーザー「進めてOK」により C-8 マージ→E-2 着手（Codex バランスレビューの推奨順序どおり）。

### C-8 マージ（`959abeb`・--no-ff）

`refactor/nest-v11-upgrade` を develop へマージ。マージ後 develop で build 0 / No circular / 全 186 suites 2541 tests 緑を再確認。
**Nest v11 環境が正式に develop の基準になった**（手動 smoke はユーザー任意・チェックリストは前節）。ブランチは不要になったら削除可。

### E-2a 完了（`9e92fb6`・nestjs-best-practices 委譲・characterization-first）

`CharacterDisplayService.createCharacterEmbed` のイベント RPC（emit 後 waitForEvent＝**構造的に毎回3秒タイムアウト→null**）を
`CharacterService.findByChannelId` の DI 直呼びへ置換。**タブボタンのキャラ表示バグが解消**。spec は Assert 不変で Arrange のみ
DI mock 化＋「旧 RPC へ戻っていない」回帰ガード（Codex Low 指摘反映）。`findByChannelId.completed/failed` の恒常購読者ゼロは
裏取り済み（@OnEvent・`on()` 両方 grep＋Codex 第三者確認）＝通知連鎖影響なし。旧 events handler の掃除は E-3 で実施。

### E-2e′ 完了（`50926be`・計画訂正: DI 化 → dead 削除）

**計画からの重要訂正**: `ChannelNameSyncService` は module 登録と spec のみで**本番呼び出し元ゼロの dead サービス**と確定
（動的解決含め Codex 第三者検証済み）。DI 化ではなくファイルごと削除（S-5b の CharacterChannelService と同型）。
「DB 更新成功でも 5 秒 timeout で false 報告」の壊れ RPC も呼び出し元ごと消滅。
**注意（E-2d の前提知識）**: `character.update.completed` には `CharacterUpdateCompletedHandler`（discord/events・
`getEventName()` 経由の間接登録のため literal grep では発見不可）という**恒常購読者が存在**する。E-2d（character-modal-handler の
update DI 化）では completed 通知の発行責務の移し先を必ず設計すること。

### 検証（司令塔実測・両 slice）

build 0 / check:circular **No circular(476)** / 全 **185 suites 2533 tests 緑**（−1 suite/−8 tests＝削除 spec 分・新規破損ゼロ）/
start:dev **handler 23 不変・DI エラー 0** / Codex スコープレビュー: 正確性指摘なし・Low 1件（回帰ガード）は反映済み。

### 次にやること

- **E-2b**（dice-roll-character-provider / character-section-editor の findById 系 DI 化）→ E-2c → E-2d（↑注意事項参照）→ E-2f。
- E-2 完了後: E-3（dead contracts/emit 撤去・findBy\*.completed/failed も対象化）→ E-4。C-3/C-6 は並行可。

---

## 2026-07-07 await バグ修正＋C-8 実施（Nest v11・ブランチ上）＋Codex 定期レビュー体制開始

ユーザー指示「C-8 GO・await バグも修正・Codex に定期的にスコープ狭めたレビューと全体バランスレビューをさせる」に基づく。
以後のリファクタでは **slice ごとの Codex スコープレビュー＋節目の全体バランスレビュー**を標準運用とする。

### await バグ修正（develop・コミット `61ef9d4`）

C-2 レビューで検出した `dice-calculation.service.ts:63` の await 漏れを修正（1行）＋ spec の `mockReturnValue`→`mockResolvedValue` 化
（再発時に `toBe(sentinel)` が RED になる回帰テスト）。build 0 / 対象 spec 80 緑 / No circular(478) / 全 186 suites 2541 tests 緑 /
**Codex スコープレビュー LGTM**（await 化で rejection が try/catch の success:false 契約へ正しく収まる・services/dice の dice() 呼び出し
3箇所に同種漏れなし）。param-dice-modal（計算式ダイス）経路の本番バグが解消。

### C-8 実施（ブランチ `refactor/nest-v11-upgrade`・コミット `97dbbef`・**マージは実機 smoke 後**）

コード変更ゼロ・依存 bump のみ: core 系一式 10.4.20→**11.1.27** / cli→11.0.23 / jwt→11.0.2 / passport→11.0.5 / axios→4.0.1 /
swagger→11.4.5 / reflect-metadata→0.2.2 / @types/express→5.0.6（config/mongoose/schedule/event-emitter/mapped-types は据え置き）。

- 検証: peer 警告なし / **build 型エラーゼロ**（事前調査の「数件〜十数件」想定より良好）/ No circular(478) / 全 **186 suites 2541 tests 緑** /
  start:dev で **handler 23 登録・Discord クライアント初期化成功（766ms）・GET / 200・未知ルート 404 JSON**（express5 実ランタイム確認）。
- **Codex スコープレビュー: マージ可・Critical/High なし**。Medium 1件＝`passport-discord@0.1.4`（deprecated）の実 OAuth は
  単体テストで拾えないため**手動 smoke 必須**。Low: express5 query parser 既定変更（現 @Query はスカラー2件で実害低）・
  swagger は decorator のみで `SwaggerModule.setup` 不在（OpenAPI 生成運用があれば schema diff 要確認）。
- **マージ前の手動 smoke チェックリスト（Codex 起案・ユーザー実施）**:
  1. Discord OAuth ログイン一式（`/auth/discord` → callback → JWT cookie 属性 → validate-token → logout）
  2. フロント origin からの credentials 付き CORS リクエスト
  3. JSON body 系 API（POST /character 等）
  4. 実 Discord でボタン/select/modal の代表 customId ルーティング（ダイスロール一式）
- **注意**: node_modules は現在 v11 状態。develop 側で作業を続ける場合は `pnpm install` で v10 に戻すこと（マージ後は不要）。

### Codex 全体バランスレビュー結果（要旨・計画へ反映済み）

総合「C-1/C-2/C-8 の進め方自体は妥当だが、**優先順位に歪み**」:

1. **E-2（イベント RPC の DI 直呼び化）を C-3 以降の掃除より優先すべき**。E-2 は「必ず 3〜5 秒タイムアウト」「DB 更新成功でも false 報告」
   という**実挙動バグ**を含む（E-2a: character-display / E-2e: channel-name-sync が最優先）。
2. 推奨順序: **C-8 を閉じる（smoke→マージ）→ E-2a/E-2e → E-2 残り → E-3 → E-4**。並行余地は C-3/C-6 のみ。
   C-7 は E-5 と同一ファイルのため後回し、C-4/C-5 は E-2/E-4 後に再評価。
3. 計画書追記事項（→ 両計画書へ反映済み）: 優先順位の割り込みルール／C-8 の完了条件に smoke 手順明記／
   DI・依存バージョン・bus を触る slice は全 suite 必須／E-6 の前段棚卸し slice 追加検討。

### 次にやること（バランスレビュー反映後）

1. **ユーザー: C-8 の手動 smoke → GO なら `refactor/nest-v11-upgrade` を develop へマージ**。
2. マージ後、**E-2a/E-2e（イベント RPC の実バグ 2 箇所の DI 化）へ着手**（E 計画書参照・characterization 前倒し必須）。
3. C-3 は E-2 と並行可の範囲で実施。C-8 GO 済みのため案B/C は破棄。

---

## 2026-07-07 C-2 完了（dead dice メソッド撤去・F10 完遂）＋既存 latent bug 1 件検出

C-1 に続き C-2 を実施（nestjs-best-practices へ委譲・司令塔裏取り）。**コミット `c8aa131`**（10 ファイル・+29/-1119）。

### 計画からの訂正（司令塔 grep 裏取り）

- 撤去対象は計画の 7 → **8 メソッド**（`parseAndCalculate` も非 spec 呼び出し元ゼロ＝2026-06-10 残課題リストどおり dead）。
- カスケード確定: **DiceParserService は消費者が orchestrator の dead ラッパーのみ＝丸ごと削除**（F10 の DicePresetService と同型）。
  DiceCalculationService 側も public `parseAndCalculate`・`FlexibleDiceResult`・孤児化 private `applyMultiplierAndModifier` を削除
  （live `calculateAndRoll` は multiplier/modifier を inline 処理・共有 private は維持＝挙動不変）。
- orchestrator の残存 live 6 メソッド: `calculateAndRoll` / `executeBasicNotation` / `getResultEmoji` / `getBasicResultEmoji` /
  `sendToParentChannel` / `sendToParentChannelBasic`（constructor は calculationService 単独注入へ）。

### 検証（司令塔実測）

build 0 / check:circular **No circular(478)**（-2 ファイル整合）/ 全 **186 suites 2541 tests 緑**（-1 suite/-72 tests＝削除 spec 分・
新規破損ゼロ）/ start:dev **handler 8+6+9=23 不変・DI エラー 0**（EADDRINUSE 1 件は検証プロセスの多重起動＝環境要因・コード無関係）/
削除シンボル残存参照ゼロ（残りは live メソッド JSDoc の歴史記述 1 行のみ）/ diff レビュー 3 角度（読み取り専用制約付き）: **C-2 起因 finding 0**。

### ★レビューで検出した既存 latent bug（C-2 スコープ外・未修正・要対応）

**`dice-calculation.service.ts:63` の await 漏れ**: `const diceResult = dice(\`${targetValue}b10\`)`—`dice()`は async のため`diceResult`は **Promise のまま**`DiceCalculationResult.diceResult`に入る。消費者`custom-dice-modal.service.ts:83-84`は
Promise が truthy なので通過し`.rands.reduce`で **TypeError → param-dice-modal（計算式ダイス）経路は本番でエラー返信**になる。
spec は`mockReturnValue`（本来 `mockResolvedValue`）＋orchestrator 全 mock のため緑のまま見逃し。
**修正は 1 行（await 追加）＋spec の mockResolvedValue 化**だが挙動変更＝バグ修正のため C-2 に混ぜず別タスク化。

### 次にやること

- **await 漏れバグ修正**（上記・優先）→ C-3（dead 第2弾: discord.utils.ts 削除・PerformanceOrchestrator liveness 確定・app.module コメント整理）。

pull（origin/develop の PR #12 取り込み・マージ `5a9e393`・コンフリクトなし）後、
`docs/refactor/refactor-legacy-cleanup-plan-2026-07-06.md` の C-1 を trpg-refactor スキルで実施。**コミット `c27c224`**。

### C-1 実施内容（計画からの差分を含む）

- **C-1a**: `@aws-sdk/client-dynamodb` `@aws-sdk/util-dynamodb` `dynamoose` `pg` `express-session` 削除（参照ゼロ再裏取り）。
- **C-1b**: `typeorm` `@nestjs/typeorm` 削除。裏取り結果: `test-db.config.ts`・`mock-typeorm.module.ts` は**利用元ゼロ→ファイルごと削除**。
  `mock.module.ts` は typeorm 由来（`getRepositoryToken(Character)` provider＋`mockCharacterRepository`）のみ除去し
  Mongoose mock・UserService mock は維持。なお **e2e spec は 0 本**（`*.e2e-spec.ts` 不存在・`TestAppModule` 利用元ゼロ）＝
  e2e インフラ全体が休眠と判明（下記スコープ外記録）。
- **C-1c**: `@types/uuid` は**削除**（uuid@11.1.0 が `dist/cjs/index.d.ts` 同梱・build で裏取り）。`eslint-plugin-import` は
  flat config・旧 eslintrc とも参照ゼロのため計画の「devDeps へ移動」から**削除に格上げ**。
- **C-1d**: lint script の ignore 2 件除去（両ディレクトリ実在せず＝lint 対象集合は不変）。
- 純削除系のため characterization 前倒しは省略（計画書の例外規定を適用・build/全 suite/start:dev で担保）。

### 検証（司令塔実測）

build exit 0 / check:circular **No circular(480)** / 全 **187 suites 2613 tests 緑**（ベースライン完全一致）/
lint 従来同等 / start:dev **DI エラー 0・handler 登録 8+6+9=23 不変** / diff レビュー（6 角度並列）**正確性 finding 0**。

### C-8 事前調査結果（案A=v11 全面アップグレードのリファクタリング観点評価・コード変更なし）

ユーザー方針「新しい方（v11）に合わせたい。ただしコードが汚くて難しくないか先に確認」を受けた実測調査。
**結論: 「コードが汚くて難しい」懸念は当たらない。案A は単独ブランチの 1 slice として実行可能（難易度: 低〜中）。**

- 環境: Node v20.17.0（Nest 11 要件を満たす）。nest-cli は標準 tsc ビルダー（webpack 非使用）。
- サテライト peer 実測（node_modules の peerDependencies 直読）:
  - **既に ^10||^11 対応＝変更不要**: config@4.0.2 / mongoose@11.0.3 / schedule@6.0.1 / event-emitter@3.0.1 / mapped-types@2.1.0
  - **v11 化と同時に要 bump（peer ≤10）**: `@nestjs/jwt@10→11` / `@nestjs/passport@10→11` / `@nestjs/axios@3→4` /
    `@nestjs/swagger@7.4→8+`（decorator 利用 9 ファイル・機械的）＋ core/common/platform-express/testing/cli/schematics→^11
  - **必須随伴**: `reflect-metadata 0.1.14→^0.2`（Nest 11 要件・package.json は ^0.1.13）/ `@types/express 4→5`（platform-express@11 は express5）
- コード側の地雷（実測でほぼ無し）:
  - `from 'express'` 直 import は **17 ファイル全てが型 import（Request/Response）のみ**＝実行時 API 依存なし
  - ワイルドカードルート（express5 で構文変更）**ゼロ** / express4 削除 API（res.sendfile 等）使用**ゼロ**
  - `@Query` はスカラー 2 箇所のみ（express5 の query parser 既定変更の影響なし）
  - main.ts は素の `NestFactory.create`＋cookieParser＋enableCors のみ（アダプタ固有コード・カスタムロガーなし）
- 想定作業: 依存 bump 一式 → build の型エラー修正（@types/express@5 の Request/Response 型差分が中心・数件〜十数件想定）→
  全 suite → start:dev → Discord 実機 smoke。計画書の指示どおり単独ブランチ。e2e spec は 0 本のため test:e2e は実質 start:dev＋実機で代替。
- **状態: ユーザーの最終 GO 待ち**（実測上のブロッカーなし）。

### スコープ外記録（別 slice 候補）

- **lint 既存 error 1 件**: `character-edit-channel-create-listener.service.spec.ts:37` の `no-unsafe-enum-comparison`
  （C-1 とは無関係の既存負債。lint script は --fix 付きだが本件は auto-fix 不可）。
- **休眠 e2e インフラ**: `TestAppModule`＋`MockModule` は利用元ゼロ（e2e spec 0 本）・`mockCharacters` の不要 export・
  UserService mock の providers/exports 重複。**C-3（dead 第2弾）で「削除 or e2e 整備」をユーザー判断のうえ扱う**。

### 次にやること

- C-2（DiceOrchestratorService の dead 7 メソッド撤去）から続行。
- C-8 はユーザー GO で単独ブランチ実施（上記調査どおり）。

---

## 2026-07-07 未コミット分の一括コミット（ユーザー承認・5コミット・pathspec 限定・コード変更なし）

2026-06-10〜07-06 に検証済みのまま未コミットだった全差分を、作業系統別に5コミットへ分割してコミット。
いずれも 2026-07-06 ベースライン（build 0 / check:circular No circular / 全 187 suites 2613 tests 緑）で
検証済みの状態をそのまま分割したもの（新規コード変更なし）。作業ツリーはクリーン。

- `02410f1` refactor(discord): **F5** postActionButtons dead path 撤去（4ファイル・-78行）
- `139b6fe` refactor(dice): **F10** DicePresetService ごと dead preset チェーン撤去（8ファイル・+50/-525）
- `f8d5073` fix(dice): **履歴保存修正2件**（2026-06-10 custom modal 保存欠落＋06-11 スレッド内保存キー実親化・5ファイル。
  dice-roll.module.ts の F10 docstring 追従は DiceRollModule 再 import と同一ハンクのためここに同乗）
- `215fd10` docs: AI.\*.md 更新・計画書2本（E/C 系列）・キャラシート提案書一式・ロードマップ（21ファイル）
- `aead1aa` chore(skills): trpg-domain-\* 5本新設＋trpg-architecture/trpg-refactor 配線（7ファイル）

### 記録の陳腐化訂正（重要）

- 2026-06-07 節の「develop はローカル 108 コミット先行・origin push 判断待ち」は**解消済み**。現在は push 済みで、
  逆に **origin/develop がローカルより 2 コミット先行**（PR #12 front-intro-ai マージ＋フロント Skills 導入）。
  **次回作業前に pull で取り込むこと**（分岐防止）。
- stash 3件（`作業中の変更を一時保存`＋WIP 2件）が残存・棚卸し未実施。

### 次にやること

- origin/develop の先行 2 コミットを pull で取り込む。
- C-1（未使用 npm 依存 7 件削除）から着手。C-8（依存バージョン整合）はユーザー判断待ち。

---

## 2026-07-06 全体クリーンアップ分析: 古い書き方・重複・未使用コードの洗い出し（診断＋計画のみ・コード変更なし）

ユーザー依頼「コードベース全体を分析して古い書き方・重複・未使用コードを洗い出し、テストが通る状態を維持したまま順番にリファクタリング計画を追記」。trpg-refactor スキル＋Explore 3系統（未使用/古い書き方/重複）＋司令塔 grep 裏取りで実施。

### ベースライン（司令塔実測）

build exit 0 / check:circular **No circular(480)** / 全 **187 suites 2613 tests 緑**（未コミットの F5+F10・2026-06-10/11 修正込み。AI.test.md 直近記録と一致）。jest 終了時に worker teardown リーク警告あり（全緑には影響なし）。

### 主要な発見（詳細と全リストは計画書へ）

- **未使用 npm 依存 7 件**（司令塔 grep 裏取り済・src+test 参照ゼロ）: `@aws-sdk/client-dynamodb` `@aws-sdk/util-dynamodb` `dynamoose` `pg` `express-session`、＋`typeorm`/`@nestjs/typeorm`（src ゼロ・test の mock 3 ファイルのみ）。`@types/uuid`/`eslint-plugin-import` は dependencies 配置間違い。
- **dead コード**: `DiceOrchestratorService` の 7 メソッド（F10 残課題リストと一致・外部非 spec 参照ゼロ確定。**`sendToParentChannel` は live** ＝ 2026-06-10 残課題リストの候補 8 件から 1 件訂正）／`discord/utils/discord.utils.ts` は **import 元ゼロ＝ファイルごと dead**／`PerformanceOrchestratorService.recordRateLimit`・`triggerAlert`（連鎖 liveness 要再確認）／lint script の実在しないディレクトリ ignore 2 件。
- **古い書き方**: console.\* 直接使用 **非テスト 31 箇所/9 ファイル**（diceRoll pagination に集中）／discord.js 非推奨 `ephemeral: true` 4〜5 箇所／**依存バージョン不整合**（Nest core v10 に v11 系サテライト `@nestjs/config@4`・`@nestjs/mongoose@11`・`@nestjs/schedule@6` ＋ `express@5`。src から express 直 import 多数＝型と実体の乖離が潜在）／tsconfig 第2段階フラグ未有効。**再発ゼロ確認**: process.env・forwardRef・@Global・ConfigService 直 inject・ModuleRef.get・旧バス系統。
- **重複**: `sendToParentChannel` private 実装が **5 handler に重複**／エラーハンドリング 3 系統（うち 1 つは dead 候補）／キャラ embed 生成 2〜3 系統・ダイス計算 5 系統（いずれも中期・要設計）。any 非テスト約 204 件は event contracts に集中＝ **E-4a と同時解消が効率的**。

### 実施計画

- **`docs/refactor/refactor-legacy-cleanup-plan-2026-07-06.md` に C-1〜C-10 の bounded slice として策定済み**（リスク昇順・各 slice の動作保証テスト方針・検証ゲート・E/F 系列との依存関係を定義）。
- 順序: C-1（依存削除）→ C-2（dice dead 撤去=F10 完遂）→ C-3（dead 第2弾）→ C-4〜C-6（重複統合/console/ephemeral）→ C-7（DiscordService ラッパー解体・E-5 進捗確認後）→ C-8（バージョン整合・**要ユーザー判断**）→ C-9（tsconfig 第2段階）→ C-10（jest リーク）。
- E 系列（イベント設計計画）とは独立実施可能。`DiscordInteractionHandlerService` の dead メソッドは E-5 へ吸収（二重作業禁止）。

### 次にやること

- C-1 から順に着手（C-1〜C-3 は純粋な削除系＝characterization 前倒し不要の例外規定を適用、build/全 suite/start:dev で担保）。
- C-8（Nest v11 アップグレード / v10 整合ダウングレード / 現状維持記録）はユーザー判断待ち。

---

## 2026-07-06 ドメイン別 設計ガイドスキル作成（trpg-domain-\*・5本）

ユーザー依頼「下位モデル（Opus/Codex）が参照して設計不備にならないよう、ドメインごとの責務・役割・
やること・やらないことを整理したスキルを作成」。skill-creator スキルのワークフローに沿い、
Explore 3系統（auth/user・character/dice-roll・discord features）で実コードを裏取りしてから執筆。

- **新規スキル（`.claude/skills/`・git 管理）**: `trpg-domain-auth` / `trpg-domain-user` /
  `trpg-domain-character` / `trpg-domain-dice-roll` / `trpg-domain-discord`。
  各スキルは 役割・構成マップ・公開API・やること/やらないこと・既知の落とし穴・検証手順 を定義。
  同日の設計評価で確定した禁止事項（**イベント RPC（waitForEvent）禁止・素の EventEmitter2 禁止・
  H6 循環の再導入禁止・S-1 projection の罠・スレッド保存キーの意味論**）を明文化して下位モデルの再発を防ぐ。
- **エコシステム配線**: `trpg-architecture`（地図）にドメインスキル一覧の節を追加、`trpg-refactor`（司令塔）の
  役割分担と委譲プロンプトの型に「該当 trpg-domain-\* スキルの禁止事項を委譲プロンプトへ注入」を追加。
- 注意: `AI.domain.md` の「イベント駆動パターン」例（requestCharacterSearch）は現方針（クエリは DI 直呼び）と
  矛盾する旧例のため、各スキルで明示的に「踏襲しない」と記載した。

---

## 2026-07-06 設計評価: discord 層⇔ドメイン層の接続・イベント設計（診断のみ・コード変更なし）

ユーザー依頼「TRPG-SERVER の設計評価（discord アプリケーション層とドメイン層の繋がり・イベント設計）」。
trpg-architecture スキル＋Explore 2系統（discord→domains 依存全数・イベント emit/listen 全数）＋司令塔裏取りで診断。

### 健全（裏取り済）

- 依存方向は discord→domains の一方向のみ（逆流ゼロ・実コード forwardRef ゼロ・discord 層からの Mongoose 直アクセスゼロ）。
- Interaction Registry（明示登録・競合検出・未登録統計）と feature 自己登録方式は設計通り機能。

### 発見した構造問題（優先度順）

1. **イベント RPC（waitForEvent + Promise.race）の構造バグ**: `character-display.service.ts:60-71` / `channel-name-sync.service.ts:64-78` は emit（emitAsync＝ハンドラが同期チェーンで完走し `.completed` は発火済み）の**後**に waitForEvent を登録するため**必ず 3〜5 秒タイムアウト**。channel-name-sync は DB 更新成功でも false を報告。correlationId が無いため併走時は他リクエストの応答と混線し得る（wait 先行の他 6 サービスも同様）。Promise.race の負け側 waiter は timeout 時 unhandled rejection ＋ once リスナー残存。**推奨: クエリ系 11 箇所はイベントをやめ CharacterService/DiceRollService の DI 直呼びへ**（イベントは通知専用に限定）。
2. **バス 2 インスタンス残存**: `core-events.module.ts` は `EventEmitterModule.forRoot()`（素の EventEmitter2）と `'TYPED_EVENT_EMITTER'`（別 new）の両方を提供。`interactions.service.ts:36-85` は素のバスへ `discord.interaction.start/processed` を emit（恒常購読者ゼロ＝dead）。
3. **dead contracts 10+ 件**: `character.*.failed` 全て・`diceroll.execute.*`・`discord.message.send.requested`・`characterEdit.section/field.selected` 等が emit のみ（`findBy*.completed/failed` は waitForEvent の一時 once のみが受け手）。
4. **契約の二重管理**: `unified-event-contracts.ts` と `contracts/index.ts`（AppEventContracts）が並存。EVENT_NAMES 定数は 8 件のみで残りはマジック文字列、`characterEdit.creation.*` は契約外（as any キャストあり）。
5. **ドメイン層の薄さ／永続化モデル露出**: domains 39 ファイル vs discord 198（features 119）＝ビジネスロジックの主体が discord 層。Character（Mongoose @Schema）が discord 層 30+ ファイルに型露出（entity/schema 未分離・`discordThreadId`/`threadId` 重複）。`domains/character/character.controller.ts:294,334` が `discord.*` イベントを発行＝ドメインパッケージが Discord ユースケースを知る（ARCHITECTURE §9 と緊張）。同一クエリ（findByChannelId）に DI 直呼びとイベント RPC の 2 経路が併存（S-1 projection 型の片経路バグの温床）。
6. 3 層ルーティング残存（`DiscordInteractionHandlerService` の Map キャッシュ（登録ゼロ）→ InteractionsService → Registry。DESIGN.md Phase 2 未了）。

### 次にやること（提案・未着手）

- **実施計画を `docs/refactor/refactor-event-design-plan-2026-07-06.md` に策定済み**（E-1〜E-6 の bounded slice・依存順序・検証手順・スコープ外を定義）。
- 問題 1 の 2 箇所は実挙動バグのため優先修正候補（正攻法はイベント RPC の DI 化＝クエリをイベントで行わない → 計画 E-2）。
- 問題 2〜4 は events 統合の追加 slice（dead emit 撤去=E-3・契約一本化/素バス排除=E-4）。問題 5 は entity/schema 分離の中期テーマ（E-6・別計画書に切り出し予定）。

---

## 2026-06-10 F5+F10 dead-code 掃除（trpg-refactor スキル・nestjs-best-practices へ2 slice 委譲・司令塔裏取り）

ユーザー依頼「次の作業は何か」→ 残課題棚卸し（本ファイル「次にやること」＋ `docs/reviews/project-issues-report-2026-06-05.md`）からユーザー選択で **F5（postActionButtons dead path）と F10（dice services の dead preset メソッド）の撤去**を実施。純粋な dead-code 削除のため characterization 前倒しは省略（build / check:circular / 既存 spec で挙動不変を担保＝Phase 3 例外規定・理由記録）。**合計 -582行/+47行・未コミット**。

### Slice 1 — F5: `postActionButtons` dead path 撤去（4ファイル・-78行）

- 撤去: `ThreadInteractionService.postActionButtons`（`character_edit_`/`dice_roll_`/`character_info_` ボタン生成。唯一の呼び出し元 `thread-orchestrator.service.ts:79` はコメントアウト済＝dead を司令塔が実コードで裏取り）＋当該コメント行＋`thread-interaction.service.spec` の describe＋`handlers.integration.spec` の dead path characterization（その it しか含まない describe ごと削除・**登録数 23 期待値は不変**）。

### Slice 2 — F10: dead preset チェーン撤去（DicePresetService 丸ごと・6ファイル）

- 司令塔裏取りで **記録（メソッドのみ）より広い dead** と確定: `DiceOrchestratorService` の live 利用は `custom-dice-modal.service` の6メソッド（calculateAndRoll / executeBasicNotation / getResultEmoji / getBasicResultEmoji / sendToParentChannel / sendToParentChannelBasic）のみ。preset 系4メソッド（`handlePresetDiceRoll`/`createPresetButton`/`validatePresetConfig`/`legacyHandlePresetDiceRoll`）は production 呼び出し元ゼロ、`DicePresetService` の参照は orchestrator 委譲のみ → **サービス丸ごと dead**（`preset-dice*` handler は S-5c で撤去済み）。
- 撤去: orchestrator の preset 4メソッド＋`presetService` 注入＋`getServiceStats` の言及、`dice-preset.service.ts`(+spec) 削除、`dice-services.module` providers/exports、`services/dice/index.ts` re-export、orchestrator spec の preset describe（constructor 引数 3→2）。
- docs/docstring 追従（司令塔が直接実施）: `dice-roll.module.ts`/`character-thread-feature.module.ts` の docstring、`services/dice/README.md`（dice-preset 節を撤去注記化・現役プリセットは characterThread の `PresetDiceQuickRollHandler` へ誘導）、`AI.discord.md`。

### 検証（司令塔再裏取り）

- build exit 0 / check:circular **No circular(480)**（削除2ファイル分減・整合）/ **全スイート 187 suites 2625→2603 tests 緑**（−1 suite/−22 tests＝削除した dead spec 分と整合・新規破損ゼロ）/ **start:dev 正常起動・batch 8+6+9＝23 handler 不変・tsc 0 errors・DI 解決エラーなし** / 撤去シンボルの残存参照ゼロ（grep・.ts）/ `/code-review`（medium・7 angle）**finding ゼロ**。

### 残課題（スコープ外・記録のみ）

- `DiceOrchestratorService` の他の呼び出し元ゼロ候補: `legacyCalculateAndRoll` / `legacyParseAndCalculate` / `executeNotation` / `parseFormula` / `evaluateFormula` / `convertToDiceNotation` / `parseAndCalculate` / `getServiceStats`（live は上記6メソッドのみ）。撤去は別 slice（要 grep 再確認）。

### 次にやること

- 本2 slice のコミット（ユーザー承認時・slice 単位・pathspec 限定）。
- 既存残: develop の origin push 判断 / F1+F2（フロント jest roots・characterCreate 空送信）/ F7 プリセット本格ルール / CI 導入・CRLF churn 根治（.gitattributes）。

---

## 2026-06-07 ブランチ `refactor/ref-path-deadcode-cleanup` を develop へマージ（trpg-refactor スキル・司令塔）＋マージ前ブロッカー修正

ユーザー依頼「色々 develop にマージしたい」。調査の結果、**develop 未マージは本ブランチ1本のみ**（他の H1/H3/H6/H9/T2-T5/B-2/events/config/security 系は全てマージ済み）と判明。本ブランチは develop の HEAD を直接の祖先とする**クリーンな FF**（81コミット・304ファイル・+9092/−12858＝ダイスボタン customId 統合キャンペーン S-1〜S-5c ＋ P1-A/B/C/D・構造課題・events 統合・参照パス整理・docs 再編）。

### マージ前 Phase 6 検証で発見したブロッカー（重要）

全スイート実行で **controller spec 3本（auth/user/character）がコンパイルエラーで全件未実行のまま「緑」と誤記録**されていたことが判明。根因と修正の詳細は `AI.test.md` 2026-06-07 節。要点: P1-C(`98d5055`) の filter コンストラクタ `AppConfigService` 注入化に 3 spec が未追従（`auth` の TestingModule だけ正しく `appConfigServiceMock` 登録済・他2本は未提供＋手動 `new` の引数不足）。**コミット `4d41d94`** で修正し、build 0 / check:circular No circular / 全 188 suites 2625 tests 緑を司令塔裏取り。

### マージ実施

- **`--no-ff`**（develop の慣例＝"Merge X into develop" に整合）で `refactor/ref-path-deadcode-cleanup` を develop へマージ。マージコミット **`5b15db8`**（親＝旧 develop `639756d` ＋ branch tip `4d41d94`）。FF 可能だが慣例に合わせ merge commit を作成。コンフリクトなし。
- マージ後の develop で build 0 / check:circular **No circular(482)** を再確認。
- **origin への push は実施せず**（ユーザー選択＝ローカルのみ。develop は origin/develop より 108 コミット先行）。

### ブランチ整理（ユーザー選択＝マージ済み削除）

develop へマージ済みのローカルブランチ **24本を `git branch -d`（安全削除）**: `docs/circular-zero`, `test/events-flow-coverage`, `refactor/`{`auth-user-cycle-h6`, `character-spec-repair`, `config-aggregation`, `cross-cutting-conventions-h1`, `discord-character-ui`, `discord-enhanced-edit`, `discord-modal-handler`, `discord-service-split-dicebuttons`, `discord-service-split-embedmgr`, `discord-service-split-h3`, `discord-testability-backlog`, `discord-thread-creation`, `error-handling-h9`, `error-handling-h9-character`, `events-bus-unification`, `events-docs-t5`, `events-globalbus-removal`, `events-globalbus-removal-t2c`, `events-globalbus-t2b`, `events-layer-inversion-t3`, `events-typed-relocation-t4`, `security-phase-s`}。残ローカルブランチ＝`develop` / `main` / `refactor/ref-path-deadcode-cleanup`（現ブランチは残置）。

### 次にやること

- `develop` の origin push（必要時）。ローカルは 108 コミット先行。
- `refactor/ref-path-deadcode-cleanup` は develop に取り込み済みのため、不要になったら削除可。
- 残 follow-up（任意・別 issue）: `DiceOrchestratorService` の dead な preset メソッド（`createPresetButton`/`handlePresetDiceRoll`）除去。

---

## 2026-06-04 問題点の洗い出し（Codex 相談・司令塔裏取り）＋ roll\* customId 契約 案2 確定・実装計画

ユーザー依頼「Codex と相談しながら今の問題点を洗い出す」。trpg-refactor スキルで Phase 1（コード理解）に集中し、Codex 相談＋司令塔裏取りで診断。**コード変更なし（診断＋計画のみ）**。

### 健全性ゲート（裏取り済・良好）

- `pnpm run build` OK / `pnpm run check:circular` **No circular(507)** / 実コードの `forwardRef`・`process.env` 直接参照・`ModuleRef.get` は**すべてゼロ**（残はコメントのみ）＝P1-A/B/C の構造目標は達成済みと確認。

### 確定した正確性バグ（優先度1・司令塔が実コード裏取り済）

1. **`findByChannelId` projection 不足**（`domains/character/repositories/character.repository.ts:54`）: `.select(...)` に `skill`/`parameter`/`status`/`gameSystemId` が無い。→ P1-D で配線した **`skill_` ボタンは本番で常に「スキルが見つからない」**。preset 本格ルールの前提も崩れる。**1行修正**。
2. **`roll*1d100`（channelId 無し）が throw**: live 生成 `createDiceRollActionRow`（thread-creation.util.ts:220）が channelId 抜きで生成 → `CharacterDiceOrchestratorService.extractChannelId`(`split('*')[1]`) が null → `Channel ID could not be extracted` throw → fallback エラー。スレッドの基本ダイスボタンが壊れている。
3. **`roll*1d100*{characterId}` が characterId を channelId 誤用**（character-display.service.ts:394 / characterEdit character-embed.util.ts:447）→ キャラ未検出。
4. **modal field 名不一致**: `flexible-dice-select.handler.ts:106` が `dice-reason` で生成、`custom-dice-modal.service.ts:38` が `dice-comment` を読む（`getTextInputValue` は不在 field で throw）。Codex 追加発見で `dice-expression`/`roll-reason` 系統の不一致も存在＝想定より広い。
5. **技能/能力ロール `roll*_{name}-{value}` が孤児**: `DiceRollSkillHandler` pattern `/^roll\*[^_]+_/` は `roll*` 直後が `_` の生成形式にマッチせず未routing（handler は在るのに契約食い違い）。`skill_select_{name}_{value}` も孤児。

> 仮説修正の記録: 当初「`roll*` 全体が未routing」と見たが、Codex 相談＋裏取りで「`DiceRollGeneralHandler` pattern `/^roll\*\d+d\d+/` で routing はされるが channelId 抽出で落ちる」「`roll*custom` は startsWith で routing 済」と是正。

### 構造/設計負債（優先度2）

- **`roll*` ダイスUI 生成が5箇所以上に重複**（thread-creation.util / character-channel.service / character-display.service / dice-ui-builder.service / characterEdit character-embed.util）。suffix 有無で routing 挙動が変わる＝バグ2/3 の根本原因。
- **legacy `roll*` 系（スレッド内表示＋履歴）と新 `dice_generic_` 系（親投稿）が二重化**し、両者とも `DiceRollLogicService.handleDiceRoll` に収束。
- **`CharacterChannelService` は module 登録のみで live 呼び出し元が見当たらず＝dead 候補**（削除候補）。`DiceUIBuilderService`(character-channel-orchestrator 経由) は live 性要再確認。

### ドキュメント不整合（優先度3）/ テスト負債（優先度4）

- `AI.refactor.md`/`CLAUDE_HANDOFF.md` が `postActionButtons` を「dead」と記載するが、thread-creation.service 経由の `roll*` 生成は live＝記述ズレ。`interactions/README.md`/`MIGRATION_GUIDE.md` は「Phase 1 未着手」のまま陳腐化。
- handler integration spec は `registry.hasHandler()`（routing 有無）しか見ず、**executor 契約（channelId 抽出・projection 依存）が未テスト**＝バグ1〜3 が緑のまま見逃された。

### ★ユーザー確定の仕様決定（roll\* customId 契約）

1. **表示挙動 = 案2: `dice_generic_` に統一（親チャンネル投稿）**。roll\* のスレッド内 editReply 表示は廃止。**UX 変更を承認**。
2. **旧ボタン救済しない**（channelId 無しの既存貼り済みボタンは対象外・新規生成のみ修正）。
3. **技能/能力ロールは key ベース**（customId に skillKey/abilityKey を持たせ character から再解決。`roll*_{name}-{value}` の表示名+値形式は廃止）。

### 目標契約セット（案2）

- 基本ダイス = `dice_generic_{diceType}_{channelId}`（既存流用・親投稿）
- 技能 = `skill_{channelId}_{skillKey}`（既存流用・key ベース）
- 能力 = **新規 `ability_{channelId}_{abilityKey}`**＋新 handler（skill\_ 同型・`character.parameter` から再解決）
- custom = **channelId 付き契約に整理**＋modal field 名統一（CustomDiceModalService を characterId→channelId 解決へ）

### 実装計画（bounded slice・Codex 起案）

- **S-1**: `findByChannelId` projection 修正（前提・1行＋spec）
- **S-2**: modal field 名統一（`dice-command`+`dice-comment` 系へ。`dice-reason`/`dice-expression`/`roll-reason` の多重不一致を先に grep 棚卸し）
- **S-3**: 能力 handler 新設（`ability_` 契約＋handler＋registry 登録＋parameter 再解決）
- **S-4**: live 生成サイト移行（thread-creation / character-display / characterEdit character-embed /（要確認）dice-ui-builder を新契約へ。characterization の旧 roll\* 期待値を更新）
- **S-5**: legacy `roll*` handler/生成の撤去＋dead（CharacterChannelService 等）整理
- 各 slice 共通検証: tsc --noEmit / build / check:circular（No circular）/ 関連 jest / start:dev（registry 登録・pattern conflict なし）。

### 未確定（実装前にユーザー/司令塔が決める）

- **能力(ability)の対象範囲**: `parameter` のみか `status` も含めるか（characterEdit は status/parameter/skill すべてに roll button を生成）。S-4 着手前に決定。
- custom modal の channelId 統一に伴う `CustomDiceModalService.findOne`→`findByChannelId` 変更の影響範囲。
- `DiceUIBuilderService`/`CharacterChannelOrchestratorService` の最終 live/dead 判定（S-5 前）。

### S-1 完了（2026-06-04・projection 修正・挙動変更=バグ修正の前提整備）

- `character.repository.ts` の `findByChannelId` の `.select(...)` に `status skill parameter gameSystemId` を追加（既存 `attributes/primaryAttributes/createdAt/updatedAt` 等は維持＝additive）。
- characterization: 既存 `character.repository.spec.ts` の findByChannelId が select 文字列を exact 固定済みだったため、現挙動の緑（24）を確認 → 期待値を新 select に更新（24 緑）。
- 検証（司令塔）: `pnpm run build` exit 0 / `check:circular` **No circular(507)** / repository spec 24 緑 / 消費側 `character.service`＋`character-skill-roll.handler` spec 26 緑 / 差分は当該2ファイルのみ（CRLF churn 巻き込みなし）。
- 効果: これで `skill_` ボタン（および key 再解決系）が `character.skill`/`parameter` を取得できる前提が整った（projection 不足による「スキルが見つからない」を解消）。未コミット（ユーザー承認時にまとめてコミット）。

### S-2 完了（2026-06-04・modal field 名統一・挙動変更=バグ修正）

modal field 全棚卸しで canonical 契約を確定: **受け手 `custom-dice-modal.service`** は `param-dice-modal*`→`dice-formula`+`multiplier`+`modifier`+`dice-comment` / `custom-dice-modal*`→`dice-command`+`dice-comment` を読む。これに対する生成側の不一致は2つ:

- **(修正) `flexible-dice-select.handler.ts:106`**: custom modal の理由 field が `dice-reason`＝受け手の `getTextInputValue('dice-comment')` が不在 field で throw → カスタムダイス送信が失敗していた。`dice-comment` に統一。**flexible*dice* 経路は案2で残る durable path** のため S-2 で実施。
- **(S-2 では記録のみ) `dice-button-ui.service.ts:87,96`**: `dice-expression`/`roll-reason`（受け手は `dice-command`/`dice-comment`）。これは **`roll*custom` 経路＝案2で retire 予定**のため、S-4（生成移行）/S-5（dead 整理）で対応（今 fix すると churn）。`character-dice-buttons.service`/`character-thread-select.service` は既に canonical で fix 不要。

検証: characterization-first（実 discord.js を unmock し modal.toJSON() の field を検証＝`dice-button-ui.service.spec` と同方針）で **RED（dice-reason で fieldIds 不一致）→ 修正 → GREEN（6）**。build exit 0 / check:circular **No circular(507)** / 受け手 `custom-dice-modal.service.spec` 9 緑 / 差分は handler＋spec の2ファイルのみ。未コミット。

### S-3 完了（2026-06-04・能力 handler 新設・additive＝既存挙動不変／nestjs-best-practices へ委譲・司令塔裏取り済）

`skill_` の完全ミラーで能力(ability)ロールを新設。**新規5＋編集3（全 additive・削除なし）**:

- 新規 `custom-id/ability-roll.custom-id.ts`（`AbilityRollCustomId`: pattern `ability_`・`create(channelId, abilityKey)`=`ability_{channelId}_{abilityKey}`・`parse`。skill と同一分割意味論）＋ spec。
- 新規 `services/ability-roll.util.ts`（`resolveAbilityRoll`: `character.parameter?.[abilityKey]` を読み `extractSkillLevel`(skill-roll.util から再利用)で数値化・不在 null）。
- 新規 `handlers/ability-roll.handler.ts`（`AbilityRollHandler`: parse→findByChannelId→resolveAbilityRoll→**`DiceRollLogicService.handleSkillRoll` 再利用**（新メソッドなし）→親投稿。CharacterSkillRollHandler 同型）＋ spec。
- 編集 `custom-id/index.ts`（export 1行）／`character-thread-feature.module.ts`（import/providers/constructor/onModuleInit に各1行）／`handlers.integration.spec.ts`（登録 **27→28**・`ability_*` match assertion 追加）。
- 検証（司令塔再裏取り）: build exit 0 / check:circular **No circular(512)** / 3 spec **66 緑** / 新規は untracked・編集は additive のみ（CRLF churn・無関係 revert なし）。**handler 追加は additive で現 routing 不変**（生成側未配線のため実 routing 有効化は S-4 後）。未コミット。

### ★ユーザー確定（2026-06-04・S-4 前提）: status は表示専用

- **能力(ability)対象範囲 = `parameter` のみ**。**status セクションのロールボタンは S-4 で撤去**（status は表示専用＝機能削減を許容）。
- 新契約は **基本=`dice_generic_` / 技能=`skill_` / 能力=`ability_`** の3種＋custom（S-4 で channelId 付き契約に整理）。
- マッピング: skill 生成 → `skill_` / parameter 生成 → `ability_` / 基本ダイス → `dice_generic_` / status 生成 → **削除** / custom → 新 custom 契約。

### 次アクション（S-4 sub-slice 分割）

S-1/S-2/S-3 完了。S-4 は behavior-changing（スレッド内→親投稿・status ボタン撤去）かつ多サイトのため**生成サイト単位の sub-slice**で進める（各独立コミット・characterization は既存 spec が旧 customId 文字列を固定→新契約へ更新）:

- **S-4a**: `thread-creation.util` / `ThreadCreationService` の基本ダイス（`roll*1d100/1d6/2d6`→`dice_generic_`）＋技能（`roll*_…`→`skill_`）＋能力（→`ability_`）＋status ボタン撤去。channelId を生成に渡す signature 化が要る。

> ★ S-4 着手前の重要発見（2026-06-04・司令塔トレース）: **thread 生成に live 経路が2系統併存**している。
>
> - **select 経路**: `character-thread-select.service` → `CharacterThreadOrchestrator` → `ThreadCreationService`（`thread-creation.util` の `createDiceRollActionRow`=`roll*1d100`壊 / `createSkillRollActionRows`=`roll*_`孤児 / preset）。
> - **event 経路**: `discord.thread.create.requested`・`character.update.completed` → `ThreadOrchestratorService` → `ThreadInteractionService`（`SkillRollCustomId.create(discordChannelId, skillKey)`=`skill_`・`FlexibleDiceSelectCustomId`・dice*generic*・preset。基本 roll は `postActionButtons` コメントアウトで非生成・`character_edit_`等は未routing）。
> - 含意: **P1-D で配線した `skill_`/`dice_generic_` は event 経路にしか効いておらず、select 経路（ThreadCreationService）は依然 broken な `roll*`/孤児 `roll*_` を生成**。canonical channelId 源は両経路とも `character.discordChannelId`。
> - したがって S-4a は「ThreadCreationService の生成を ThreadInteractionService と同じ新契約へ揃える」作業。さらに ThreadCreationService(+util) と ThreadInteractionService は skill/flexible/preset 生成が**重複実装**（最終的には S-5 で1系統へ統合すべき）。S-4 は単純移行でなく**dual-path 解消を含む**ため、経路ごとに characterization を張って慎重に進める（Codex 相談も検討）。

- **S-4b**: `character-display.service`（tab 表示の `roll*…*{characterId}`）を新契約へ。
- **S-4c**: characterEdit `character-embed.util`（`roll*…*{characterId}`）を新契約へ。
- **S-4d**: `roll*custom`→新 custom 契約（channelId 付き）移行に合わせ `dice-button-ui.service` の field 不一致（`dice-expression`/`roll-reason`）解消。`dice-ui-builder.service` の live/dead 最終判定。
- **S-5**: legacy `roll*` handler（General/Skill/Custom）/ 残存生成と dead（CharacterChannelService 等）を撤去。

### dual-path 統合戦略（Codex 相談・2026-06-04）＋ live/dead 裏取り

ユーザー選択「dual-path 統合戦略を Codex に相談」に基づく。

**Codex 推奨 = Option 1**: `ThreadCreationService`（select 経路）がボタン UI 生成を **`ThreadInteractionService`（or 単一 UI helper）へ委譲**し生成を単一化。`roll*` 生成を Path A から消す。

- Option 2（util を新契約へ直書き）＝重複残存で却下。Option 3（domain 層 DiceUiPort）＝「domain service は Discord/UI 非依存」違反＋循環リスクで却下。

**司令塔の live/dead 裏取り（S-4 スコープを縮小）**:

- **live な broken `roll*` 生成は実質 Path A（`ThreadCreationService`→`thread-creation.util`）に集約**。
- **dead（production call-site ゼロ・S-5 撤去対象）**: `CharacterDisplayService.createSkillRollButtons/createBasicDiceButtons`（外部呼び出し元なし）／`CharacterChannelOrchestratorService`→`DiceUIBuilderService`（module 登録のみ・entry なし）／`CharacterChannelService`／`ThreadInteractionService.postActionButtons`（call-site コメントアウト）。
- **要確認（S-4c）**: characterEdit `character-embed.util` の `roll*` 生成（別 feature・live 表示に乗るか未確定）。

**Codex 改訂 S-4 sub-slice**: S-4.1 両 path の現挙動を characterization 固定 → S-4.2 custom/flexible の channelId 付き契約策定（`custom_dice_{channelId}` 新設 or 既存 `custom-dice-modal*{channelId}` 流用を確定）→ S-4.3 Path A のボタン生成を ThreadInteractionService へ委譲（主スライス）→ S-4.4 status 撤去・ability rendering → S-4.5 dead generator 隔離 → S-5 撤去。

**ユーザー判断が要る分岐点（次セッション着手前）**:

1. Path A（select 直叩き）を event 経路へ**完全収束**させてよいか（characterization 後に Path A 廃止 / 併存）。
2. Path A の投稿内容・投稿先を Path B に**完全合わせ**してよいか（UI 微差の許容）。
3. ability ボタンは常時表示か、skill と同グルーピングか。
4. custom の canonical customId = `custom_dice_{channelId}` 新設 / `custom-dice-modal*{channelId}` 流用（後者が「channelId-bearing」を満たすか確認）。
5. dead（DiceUIBuilder/CharacterChannel 等）は live 不在を最終確認のうえ S-5 で撤去、の順序でよいか。

### ★ユーザー確定（2026-06-04・推奨デフォルト採用）＋ S-4.1 完了

確定デフォルト（上記分岐点の回答）: **Option 1 で Path A を event 経路の契約へ完全収束** / custom は既存 **`custom-dice-modal*{channelId}` 流用**（S-2 で field 修正済・channelId-bearing） / ability は skill と同様に**常時表示** / dead は **S-5 で撤去**。

**S-4.1 完了（characterization・新規コード変更なし）**: Path A の全生成器の現挙動が `thread-creation.util.spec.ts` で **exact 固定済み**であることを確認（安全網が既存）:

- `createDiceRollActionRow` → `['roll*1d100','roll*1d6','roll*2d6','roll*custom']`（spec:138）
- `createSkillRollActionRows` → `roll*_回避-40*char-123`（spec:226・label `回避(40)`）
- `createParameterSelectMenu` → `flexible-dice-param*char-123`（spec:147）/ `createPresetButtons` → `preset-dice*char-123*parameter*str*60*3`（spec:179）
- baseline: thread-creation.util + thread-creation.service spec **36 緑**。S-4.3 でこれらの期待値を新契約（`dice_generic_`/`skill_`/`ability_`・status 除外）へ更新する（意図的な before→after）。

**次**: S-4.2（custom 契約は流用確定のため軽微）→ **S-4.3（Path A のボタン生成を ThreadInteractionService へ委譲＝主スライス・behavior-changing）**。S-4.3 以降は nestjs-best-practices へ委譲予定。

### S-1/S-2/S-3 コミット完了（2026-06-04・ユーザー承認・pathspec 限定）

事前 staged の無関係差分・CRLF churn を巻き込まず、自分の差分のみを独立コミット:

- **S-1** `92245cd`（character.repository.ts + spec・2 files）
- **S-2** `0959a35`（flexible-dice-select.handler.ts + spec・2 files）
- **S-3** `eadf8ee`（ability-roll 新規5＋編集3・8 files）

### S-4.3 精査で判明（2026-06-04・要レイアウト確定）

「委譲」は thin でなく converged レイアウト確定が前提:

- ThreadInteractionService(event 経路) は **基本ダイスの独立行を持たない**。`createGenericButtons`(`dice_generic_` 1d6/2d6/1d20/1d100) は **generic ゲームシステム時の preset fallback** としてのみ生成（`postPresetDiceButtons` の default ケース）。
- 2サービスの **preset 実装が別物**: Path A=`createPresetButtons`(`preset-dice*{id}*…`) / event=ゲームシステム別(`dice_coc7_`等)＋generic(`dice_generic_`)。
- **ability 生成はどちらの経路にも無い**（S-3 で handler/契約は新設済だが UI 生成は未）。
- channelId 源: event 側は `character.discordChannelId`（generic は `|| characterId` fallback）。
- → S-4.3 = ThreadCreationService.displayCharacterInfo を ThreadInteractionService の post 系（flexible/preset/skill＋新規 ability）へ委譲し、Path A 独自の roll* 基本行・util 生成を撤去。**ThreadInteractionService に postAbilityRollButtons(parameter 反復・`AbilityRollCustomId`) を新設**。レイアウトは event 経路に揃える（基本 roll* 独立行は廃止し flexible/preset でカバー）。

**要ユーザー確定**: 新規スレッドの converged レイアウト（推奨: フレキシブルダイス＋プリセット＋スキル＋能力。基本 `roll*1d100` 独立行は廃止）。

### S-4.3 完了（2026-06-04・dual-path 収束・behavior-changing／nestjs-best-practices 委譲・司令塔裏取り＋start:dev 実機確認）

ユーザー確定レイアウト=**基本ダイス(dice*generic*)＋フレキシブル＋プリセット＋スキル(skill*)＋能力(ability*)**（基本行は残し dice*generic* で修復・custom は flexible メニュー）。

- **ThreadInteractionService**（単一生成元）に public `postBasicDiceButtons`（`dice_generic_{1d100/1d6/2d6}_{discordChannelId}` の3ボタン行）と `postAbilityRollButtons`（`postSkillRollButtons` ミラー・`character.parameter`→`ability_{discordChannelId}_{key}`）を新設。
- **ThreadCreationService**（select 経路）: `ThreadInteractionService` を注入し `displayCharacterInfo` の try/fallback 両方で5 post メソッドへ委譲。roll* 生成依存の private 4メソッド（postActionButtons/postSkillRollButtons/postFlexibleDiceMenu/postPresetDiceButtons）と未使用化した util import を撤去。→ \*\*select 経路の broken `roll*`/孤児 `roll\*\_` 生成を解消\*\*。
- **ThreadOrchestratorService**（event 経路）: 既存 flexible/preset/skill に basic/ability を additive 追加し両経路を収束。
- 検証（司令塔再裏取り）: build exit 0 / check:circular **No circular**（ThreadCreationService→ThreadInteractionService は循環なし）/ 4 spec **105 緑**（thread-interaction/creation/orchestrator + handlers.integration）/ **start:dev で `AbilityRollHandler [button] → ability_` 含む全 handler 登録・bot 接続・Cannot resolve/DI/循環エラーなし**＝挙動（DI 解決）確認。diff は当該6ファイルのみ（CRLF churn 非混入）。**コミット済 `d6410a6`**（pathspec 限定）。
- 軽微: `postAbilityRollButtons` の docstring に「値0以下スキップ」とあるが実装は skill ミラーで個別スキップなし（doc 微差・挙動は skill と一貫）。

### S-4c 完了＝dead 確定（2026-06-04・司令塔トレース）＋ S-4 機能的完了

**characterEdit の roll\* は dead**: `buildCharacterDiceRollButtons`(character-embed.util.ts:383) は行分割ループが**コメントアウト**され**常に `[]` を返す**（buttons[] を組むが actionRows に積まない）。`buildSectionedEmbeds:496` の `components.push(...diceRollButtons)` は空 push。`sendSectionedEmbeds`(components 送信あり) は**呼び出し元ゼロ**、live な `createSectionedEmbeds` 利用（enhanced-character-edit:76,495）は `{ embeds }` のみ・message-updater も実質 roll* を含まない。→ characterEdit は roll* を Discord に出さない。

**結論: live な broken roll\* 生成は S-4.3 で解消済みの Path A のみ。S-4 は機能的に完了**（残りは純粋な dead-code 整理＝S-5）。

### S-5 dead-code インベントリ（司令塔が grep 検証・撤去対象）

全 src で **roll* / character-dice* を生成する live コードは皆無**（S-4.3 後）。よって以下は全て dead（登録されるが発火しない handler 含む）:

**A. 純粋関数/メソッド（DI 非関与・低リスク）**

- `thread-creation.util.ts`: `createDiceRollActionRow`/`createSkillRollActionRows`/`createParameterSelectMenu`/`createPresetButtons`/`chunkButtonsIntoRows`（非spec 呼び出し元ゼロ）＋ 対応 spec describe。
- `characterEdit/utils/character-embed.util.ts`: `buildCharacterDiceRollButtons`/`appendDiceRollButtonsFromData`/`buildBasicDiceButtons`/`extractDiceRollValue`（dead チェーン）＋ `buildSectionedEmbeds` の dead push（494-496）＋ 対応 spec。
- `character-display.service.ts`: `createSkillRollButtons`/`createBasicDiceButtons`（呼び出し元ゼロ・サービス自体は embed 用に live なのでメソッドのみ）。

**B. dead サービス（DI provider 撤去・中リスク）**

- `CharacterChannelService`（module 登録のみ・呼び出し元ゼロ）。
- `CharacterChannelOrchestratorService` ＋ `DiceUIBuilderService`（production entry なし）。
- characterEdit `CharacterEmbedManagerService.sendSectionedEmbeds`（呼び出し元ゼロ・メソッドのみ）。

**C. dead 登録 handler クラスタ（registry 登録あり・発火なし・高リスク＝start:dev で handler 数確認必須）**

- characterThread: `CharacterDiceHandler`（pattern `character-dice`・生成元なし）＋委譲先 `CharacterDiceButtonsService`＋`CharacterDiceHistoryService`。
- diceRoll: legacy `DiceRollGeneralHandler`(`^roll\*\d+d\d+`)/`DiceRollSkillHandler`(`^roll\*[^_]+_`)/`DiceRollCustomHandler`(`roll*custom`) ＋委譲先 `CharacterDiceOrchestratorService`＋`DiceButtonUIService`＋`DiceHistoryService`。
- **注意**: 撤去で registry 登録数が減る（現 runtime 総数から general/skill/custom/character-dice の4 handler 減）。module の providers/onModuleInit/registerHandlers 更新＋handlers.integration.spec の登録数・hasHandler 期待値更新が必要。`DiceRollModalHandler`/`DiceRollPresetHandler`/pagination 等は live のため残す。

**進め方**: A→B→C の順（リスク昇順）で独立スライス。各 build/check:circular/jest、C は start:dev で handler 登録数・無エラーを必ず確認。`DiceRollLogicService`・preset・flexible・skill*・ability*・dice*generic* は live のため絶対残す。

#### S-5a 完了（2026-06-04・group A 純粋関数 dead 撤去・コミット `9dfede7`・nestjs 委譲＋司令塔裏取り）

- 撤去: thread-creation.util の5関数／character-embed.util の buildCharacterDiceRollButtons・appendDiceRollButtonsFromData・buildBasicDiceButtons・extractDiceRollValue（+buildSectionedEmbeds の空 push）／character-display.service の createSkillRollButtons・createBasicDiceButtons。対応 spec describe＋未使用 import も削除。
- 検証（司令塔再裏取り）: 撤去シンボルの**残存参照ゼロ**（grep）／build exit 0／check:circular **No circular(512)**／3 spec **60 緑**／diff は6ファイル -744行（DI/handler/module 不変）。挙動不変（全 dead）。

#### S-5b 完了（2026-06-04・dead サービス3つ＋sendSectionedEmbeds 撤去・コミット `fafcbe2`・nestjs 委譲＋司令塔裏取り）

- 撤去: `CharacterChannelService`／`CharacterChannelOrchestratorService`／`DiceUIBuilderService`（各+spec）＋ `CharacterEmbedManagerService.sendSectionedEmbeds`。`character-thread-feature.module` の import/providers/exports から除去。
- 検証（司令塔再裏取り）: 残存参照ゼロ／build 0／check:circular **No circular(506)**／jest（characterThread+characterEdit）**674 緑**／**start:dev 正常起動・DI 解決エラーゼロ・handler 登録 0 failed**。-2408行。挙動不変（全 dead）。

#### S-5c 完了（2026-06-04・dead 登録 handler クラスタ撤去・コミット `ecc6d63`・nestjs 委譲＋司令塔裏取り）

撤去（27 files・-4296行）: diceRoll の `DiceRollGeneral/Custom/Preset/Skill` handler ＋ `CharacterDiceOrchestratorService`＋`DiceButtonUIService`＋`DiceHistoryService`、characterThread の `CharacterDiceHandler`＋`CharacterDiceButtonsService`＋`CharacterDiceHistoryService`(+character-dice-format.util/character-dice-history.pure)。両 module の providers/onModuleInit/registry 登録、dead 専用だった `DiceRollModule`/`DiceRollPaginationModule` import も除去（`DiceServicesModule` は DiceRollLogicService が live のため維持）。handlers.integration.spec 登録数 28→23・dead routing を未登録へ更新。

- 検証（司令塔再裏取り）: 残存参照ゼロ／build exit 0／check:circular **No circular**／jest **54 suites 538 緑**／**start:dev で registry 23 handler（batch 8+6+9・S-4.3 の 28 から −5）・dead handler 未登録・live handler（dice*generic*/skill*/ability*/preset-quick/flexible/modal/pagination）健在・DI エラー 0**。想定外 M（character-thread.orchestrator/thread-orchestrator/dice-roll-modal）は実変更0＝CRLF のみ＝スコープ外不接触。
- コミット手順: 事前 staged の無関係 junk と混在していたため `git reset`（作業ツリー保全）→ S-5c パスのみ stage → commit。**事前 staged 群は unstage されたが作業ツリーに完全保持**（AI.discord.md 削除等は未コミットのまま残存）。
- live 維持: `DiceOrchestratorService`(services/dice・custom-modal)／`DicePresetService`(dead メソッド createPresetButton/handlePresetDiceRoll は残置・別 issue)／`DiceRollModalHandler`／`PresetDiceQuickRollHandler`。

> **S-5 完了 ＝ ダイスボタン customId 統合キャンペーン（案2）完了**。S-1〜S-5c の7コミットで「主要バグ修正＋dead-code 約7000行撤去」を達成。残る軽微 follow-up: `DiceOrchestratorService` の dead な preset メソッド除去（任意・別 issue）。

#### （参考・S-5c 着手前の確定分析）司令塔が liveness 完全 disambiguate 済

**確定**: `DiceOrchestratorService.createPresetButton`（`preset-dice*` 生成）は**呼び出し元ゼロ**＝S-4.3 で Path A の preset 生成が `dice_coc7_`/`dice_generic_`(ThreadInteractionService) に切替わった結果 **preset-dice\* は dead**。よって:

- **diceRoll: legacy `DiceRollGeneralHandler`(`^roll\*\d+d\d+`)/`DiceRollSkillHandler`(`^roll\*[^_]+_`)/`DiceRollCustomHandler`(`roll*custom`)/`DiceRollPresetHandler`(`preset-dice*`) の4つすべて dead**（生成元が全て撤去/不在）。委譲先 `CharacterDiceOrchestratorService`＋`DiceButtonUIService`＋`DiceHistoryService` も dead（消費元が dead handler のみ）。
- **characterThread: `CharacterDiceHandler`(`character-dice` 生成元なし)＋`CharacterDiceButtonsService`＋`CharacterDiceHistoryService` も dead**。
- **残す（live）**: `DiceOrchestratorService`(services/dice・custom-dice-modal が使用)／`DicePresetService`(DiceOrchestratorService 経由・ただし createPresetButton/handlePresetDiceRoll は dead メソッド)／`DiceRollModalHandler`(custom/param-dice-modal)／pagination／`DiceGenericHandler`/`PresetDiceQuickRollHandler`/`CharacterSkillRollHandler`/`AbilityRollHandler`/`FlexibleDiceSelectHandler` 等。
- **手順**: dice-roll.module / character-thread-feature.module の providers/onModuleInit/registerHandlers から該当 handler を除去 → handler/orchestrator/service ファイル＋spec 削除 → `handlers.integration.spec.ts` の登録数（現 28→24想定）と roll\*/character-dice の hasHandler 期待値を更新 → **start:dev で registry 登録数の減少・無エラー・live handler 健在を必ず確認**。`DiceOrchestratorService` の dead な preset メソッド除去は任意（別途）。
- 注意: registry 登録数が runtime で減る（roll\* General/Skill/Custom/Preset の4 + character-dice の1 = 5減）。`character-dice-buttons.service` は `DicePresetService`/`DiceRollPaginationService` 等を inject しているため、module の不要 import 整理も伴う。

---

## 2026-06-04 P1-D 後続 ③ dice*(coc7|dnd5e|sw25)* preset ボタンを配線（方針A 最小機能化・挙動変更=バグ修正）

Codex 仕様設計＋ユーザー判断「方針A: 全 action 最小機能化」に基づく。skill\_ に続く未routing latent bug の修正。
**Codex 調査で確定した制約**: (a) 専用ゲームルール（SAN 値比較・武器ダメージ式等）は未実装、(b) `CharacterRepository.findByChannelId`
の select に `status/skill/parameter/gameSystemId` が含まれず stats 取得経路が破綻している。よって正規 semantic 判定は
不可能で、暫定 **system 既定 notation を振り action を reason ラベル化**して機能させる（完全ルールは次フェーズ）。

### 実装（コミット `fa1ff5b` 本体＋`3ca3470` spec 補強）

- 新規 `custom-id/preset-dice.custom-id.ts`: `PresetDiceCustomId`（pattern `/^dice_(coc7|dnd5e|sw25)_/`・create/parse）＋
  `resolvePresetDiceRoll(system, action)` → system 既定 notation（coc7=1d100 / dnd5e=1d20 / sw25=2d6）と reason ラベル
  （base はそのまま「技能判定」「d20攻撃」「2d6判定」、semantic は「SAN値判定（簡易）」「セーヴィング・スロー（簡易）」
  「魔法行使（簡易）」等で生成側ボタンラベルと整合）。
- 新規 `PresetDiceQuickRollHandler`（button・pattern 上記）: parse → resolve → deferUpdate →
  `DiceRollLogicService.handleDiceRoll`（feature 境界維持・skill\_ と同方針）→ 親チャンネル投稿。
  DiceGenericHandler / CharacterSkillRollHandler と同型の堅牢化（invalid customId→reply / success:false / throw→followUp /
  親投稿失敗→fallback followUp）。
- module 登録（DiceServicesModule 経由で DiceRollLogicService 解決）。
- handlers.integration.spec: dice*coc7*/dnd5e*/sw25* を未routing→routed へ（dice*generic* との区別・未対応 system は未routing 維持を固定）、登録総数 26→27。

### Codex 実装レビュー結果（指摘なし or P2 のみ・反映済）

- 実装本体（正しさ・routing・堅牢化）に致命傷なし。
- **委譲先**: skill\_ レビューで指摘された「event emit 欠落」は preset-dice では発生せず（`handleDiceRoll` 経路は completed/failed event を emit する）。embed/履歴UI なしは DiceGenericHandler 同型＝別 issue 扱い。
- P2 spec 不足3件（空 action / 空 channelId / 親投稿失敗 fallback）は `3ca3470` で追加（jest 2 suites 19 緑）。

### 挙動変更（意図的・バグ修正）

dice*(coc7|dnd5e|sw25)*\* クリックが「現在処理できません」→ system 既定 notation を振り親チャンネルへ結果投稿。
semantic 弱さ（SAN ボタンが SAN チェックせず単に 1d100）は (簡易) ラベルで明示。**全 13 個の preset ボタン**
（coc7×5 + dnd5e×4 + sw25×4）が機能化。

### 検証

- build / check:circular **No circular(507)** / jest 11 suites 99 緑（後に spec 補強で 21 緑追加）/
  start:dev で `PresetDiceQuickRollHandler [button] → ^dice_(coc7|dnd5e|sw25)_` 登録・**handler 総数 31→32**・無エラー。

### 残（仕様判断後の別タスク）

- **本格ルール実装**: SAN 値比較・武器ダメージ式・能力値ボーナス・命中-回避判定・魔法行使判定等。先に
  `CharacterRepository.findByChannelId` の select 拡張（status/skill/parameter/gameSystemId 取得）が必要。
- **dead path 整理**: `postActionButtons`（character*edit*/dice*roll*/character*info*）はコメントアウト中（撤去候補・別 issue）。

---

## 2026-06-04 Codex 優先度④ CharacterDiceButtonsService DI 整理（コミット `f4d8534`・挙動不変）

Codex 構造アセスメント優先度④。`CharacterDiceButtonsService` が constructor 内で `new CharacterDiceHistoryService(...)`
（provider 外生成）していたのを通常 DI 注入へ。テスト容易性向上。

- `CharacterDiceHistoryService`（@Injectable だが module 未登録だった）を `character-thread-feature.module.ts` の providers に登録。
- `character-dice-buttons.service.ts`: historyService を constructor 注入へ・new 撤去。専ら new 用だった `characterService` 注入を除去（import も撤去）。`diceRollService`/`paginationService` は他用途で継続使用のため保持。
- spec: TestingModule に実 `CharacterDiceHistoryService`（mock 依存で構築）を追加し、saveRollResult テストを維持。
- **公開 API 影響なし**: `new CharacterDiceButtonsService` は本番・spec とも皆無（Nest DI のみ）と確認。旧コメント「公開 API を変えないため new」の前提は不要だった。
- 検証: build / check:circular No circular(503) / jest 3 suites 36 緑 / start:dev 起動・総数31・DI エラーなし。

---

## 2026-06-04 P1-C 完了（非 DI 2件の process.env を Codex 設計案A で解消・挙動不変）

deferred だった非 DI 2件（`error-handler.ts` static / `api-response.dto.ts` DTO）を Codex 設計（案A: DI 境界で env 判定を
解決し下位へ引数で渡す）で解消。**本番コードの process.env 直接参照は P1-C で完全解消**（main.ts(`8222f72`) + 下記）。

### slice1 — ErrorHandler.handleHttpError（コミット `3a69b2e`・挙動不変）

- static utility は DI 不可のため `options?: { isProduction?: boolean }` を追加し `process.env.NODE_ENV==='production'` を撤去（既定 false）。
- **本番呼び出し元なし（spec のみ）**＝影響限定。spec を `{ isProduction }` 引数へ（process.env テスト間リークも解消）。

### slice2-3 — ErrorResponse.stack の dev 判定を filter 注入へ（コミット `98d5055`・挙動不変）

- **発見**: `ApiResponseUtil.error/.internalServerError` は実呼び出し元なし（dead・コメント参照のみ）。実 stack の ErrorResponse 生成は
  `HttpExceptionFilter` と `CharacterHttpExceptionFilter` の **2 filter のみ**＝当初懸念した controller 全体への波及は不要だった。
- `ErrorResponse`/`InternalServerErrorResponse` に `includeStack`（既定 false）を追加し constructor 内 `process.env.NODE_ENV==='development'` を撤去。
- 2 filter に `@Injectable()`＋AppConfigService 注入し `includeStack = get('app.environment')==='development'` を生成へ渡す（@UseFilters(Class)＋@Global で DI 解決）。
- byte-identical 根拠: app.environment は env.NODE_ENV と等価＝production→stack 無し / development→stack 有り を維持。dead な ApiResponseUtil は既定 false（test 環境では旧挙動も stack 無し＝filter spec の oracle 一致維持）。
- 検証: build / check:circular No circular(503) / jest 4 suites 37 緑（新 api-response.dto.spec の includeStack matrix・2 filter・error-handler）/ start:dev 起動・総数31・DI エラーなし。

### 到達点

- 本番コードの `process.env` 直接参照（main.ts / error-handler / api-response.dto）を**全て AppConfigService 経由または呼び出し側注入へ**。config module / env validation / test 内の process.env は規約上の許容例外。**P1-C 完了**。

---

## 2026-06-04 P1-D slice2（characterThread customId 契約化＋未routing skill\_ 修正・Codex 推奨の最優先）

> 注: foundation / Part1 / Part2 は挙動不変。Part3（skill\_ 配線）は **campaign 初の意図的な挙動変更（バグ修正）**。

Codex の構造アセスメント（§8 達成後の次の実害は「feature 内 customId 契約不一致」）に従い characterThread に着手。
characterEdit と同型に foundation → 安全な生成移行を実施。**未routing の latent gap を発見し、Codex レビューで方針確定**。

### foundation（コミット `ac0f479`・15ファイル）

- 新規 `features/characterThread/custom-id/`（7 family）: 各 handler の pattern 定数（thread-select=regex /
  thread-create / tab=`character-tab*` / flexible-dice-param=`flexible-dice-param*` / character-dice / dice-generic=`dice_generic_` /
  flexible-dice-select=`flexible_dice_`）。照合意味論（registry base handler の exact/startsWith・`*`/`-` はリテラル・regex test）を docstring 化。
- 7 handler の `getCustomIdPattern()` を pattern 定数参照へ（完全同一）。
- 検証: build / check:circular No circular(497) / jest 10 suites 106 緑 / start:dev で 7 handler が従来一致 pattern 登録・総数30・無エラー。

### 未routing gap の発見と Codex レビュー（重要）

`thread-interaction.service.ts`（live・thread-orchestrator が注入）が生成するボタンのうち、**registry のどの handler pattern にも
対応しない群**を発見（handler は全てハイフン系 prefix、生成はアンダースコア系のため startsWith 不一致）。Codex が実コードで裏取り:

- `skill_*`（postSkillRollButtons・**実送出**）/ `dice_coc7_*` `dice_dnd5e_*` `dice_sw25_*`（postPresetDiceButtons・**実送出**）＝**未routing の latent bug**（クリック時「現在処理できません」reply）。
- `character_edit_` / `dice_roll_` / `character_info_`（postActionButtons）＝呼び出し元が thread-orchestrator.service.ts:79 で**コメントアウト＝dead path**かつ未routing。
- `flexible_dice_` / `dice_generic_` ＝routing 済み（handler + integration spec 緑）。
- **方針（Codex レビュー）**: routing 化はクリック時挙動が変わる明確な挙動変更のため、本 refactor では行わない。**現状を characterization spec で事実固定し、routing 修正は仕様決定後の別タスク**。

### Part 1 — 未routing の characterization 固定（コミット `09d61c4`）

`handlers.integration.spec.ts` に「上記 latent group は現状 hasHandler===false」を固定（skill*/dice_coc7*/dnd5e*/sw25*/character*edit*/dice*roll*/character*info*）。jest 48 緑＝実際に未 routing であることを確認。

### Part 2 — routed 生成の Factory 化（コミット `785bc60`・slice2 本体）

- custom-id に `create()` 追加: `FlexibleDiceSelectCustomId.create(channelId)` / `DiceGenericCustomId.create(diceType, channelId)`（pattern と prefix 同一）。
- `thread-interaction.service.ts` の routed 生成5サイト（flexible*dice*×1・dice*generic* 1d6/2d6/1d20/1d100）を Factory へ。
- byte-identical 検証: 既存 `thread-interaction.service.spec` が生成文字列固定済（`flexible_dice_ch-flex` / `dice_generic_1d6_ch-g` 等）→ 緑＝完全同一。
- 検証: build / check:circular No circular(497) / jest 11 suites 137 緑 / start:dev 総数30・無エラー。

### Part 3 — 未routing `skill_` を配線して機能化（コミット `dd18624` prep + `6883156` fix・挙動変更=バグ修正）

ユーザー判断（方針A: 配線して機能化・skill\_ から段階的）＋Codex レビューに基づく。**性質: リファクタ regression ではなく
元からの未配線バグ**（司令塔が git 履歴で裏取り＝これら prefix を扱う handler は過去にも存在しない・`DiceRollLogicService.handleSkillRoll` は実在）。

- `dd18624`（prep・挙動不変）: `custom-id/skill-roll.custom-id.ts`（`SkillRollCustomId` pattern/create/parse。channelId は最初の `_`、残りを skillKey）と
  `services/skill-roll.util.ts`（`extractSkillLevel` を thread-interaction の private から純粋関数へ移管＋`resolveSkillRoll`）を新設し、
  postSkillRollButtons の生成を契約＋util へ（byte-identical・既存 spec `skill_ch-skill_dodge` で固定）。
- `6883156`（fix・挙動変更）: `CharacterSkillRollHandler`（button・pattern `skill_`）を新設し registry 登録。
  parse → `CharacterService.findByChannelId` → `resolveSkillRoll` → `DiceRollLogicService.handleSkillRoll` へ委譲し、
  結果を親チャンネルへ投稿（DiceGenericHandler と同型）。handlers.integration.spec で skill\_ を未routing→routed へ移動・登録数 25→26。
  新 handler spec で wiring（parse・skill 解決・引数・エラー経路）を固定。
- 挙動変更（意図的）: `skill_` クリックが「現在処理できません」→ 1d100 スキル判定実行＋親チャンネル投稿。
- 検証: build / check:circular No circular(501) / jest 5 suites 115 緑 / start:dev で `CharacterSkillRollHandler [button] → skill_` 登録・**handler 総数 30→31**・無エラー。

#### Part 3b — Codex 実装レビュー反映の堅牢化（コミット `f482e89`）

Codex に skill\_ 実装をレビューさせ、**委譲先は現状維持（`DiceRollLogicService` 直＝feature 境界を汚さない・ユーザー判断）**としつつ、
仕様判断不要の correctness 修正を適用:

- `SkillRollCustomId.parse`: 空 channelId（先頭 `_`）/ 空 skillKey（末尾 `_`）/ 区切りなしを null で弾く。
- `resolveSkillRoll`: skillKey が character.skill に**存在しない場合は null**（従来は skillValue=0 で「目標値0の誤ロール＋DB保存」が発生し得た）。handler は null→ephemeral error で中断。
- handler: 親チャンネル投稿失敗（スレッド外/親取得不可）時の成功経路に fallback の followUp 通知。
- spec 追加: `skill-roll.custom-id.spec`（parse edge）＋ handler spec に skill 不在 / success:false / throw / スレッド外投稿失敗。
- 検証: build / check:circular No circular(502) / jest 4 suites 92 緑 / start:dev で skill\_ 登録・総数31・無エラー。
- **deferred（記録）**: embed 表示＋履歴UI更新（orchestrator 経由なら付くが feature 結合を生むため不採用）、`handleSkillRoll` の event emit 欠落（既存 skill roll 全体の課題・新 handler 固有でない）。

### 残（別タスク・別 slice）

- **routing 修正の続き（要仕様決定）**: `dice_coc7_*` / `dice_dnd5e_*` / `dice_sw25_*` は依然未routing（characterization で固定済）。
  Codex 所見では semantic preset（sanity/save/magic 等）は専用ルール未実装＝「単純ダイス＋ラベル」までに限定するか完全ルールは次フェーズ、の判断が要る。skill\_ と同方式で段階的に配線可能。
- **dead path 整理**: `postActionButtons`（character*edit*/dice*roll*/character*info*）はコメントアウト中。生成メソッドごと撤去するかは別 issue。
- **follow-up**: routed handler 側 parse（`flexible_dice_` の replace / `dice_generic_` の split）の契約化。

---

## 2026-06-04 P1-D slice1 Slice A/B/C（Codex 設計に基づく生成・button 分岐・解析 regex の移行・挙動不変）

foundation（下記 `e1dcf9e`）に続き、**Codex に残作業のスコープ設計を委譲**（生成/解析サイトを A〜F の6 slice へ分割。
最大リスクは「strict parser へ直置換すると loose matcher の受理範囲が狭まる」点。message 探索系は parser 化しない方針）。
その設計に沿い、**Slice A（生成サイト）/ Slice B（button 分岐）/ Slice C（characterId 抽出 regex）を実装**（ユーザー判断で C まで実施し再判断）。

### Slice A — 生成サイトを Factory へ（コミット `a67df77`・3ファイル）

- `utils/character-embed.util.ts`(7) / `utils/character-ui.util.ts`(section-select 2 + field-edit 1 + 定数 dedup) /
  `services/character-section-editor.service.ts`(edit-section 1) の **customId 生成 literal を custom-id Factory 呼び出しへ**。
  Factory は同一 template 文字列を返すため **byte-identical**。`SECTION_SELECT_CUSTOM_ID_PREFIX` は契約モジュールを真実源に。
- byte-identical 検証: **既存 spec が全生成サイトの custom_id 文字列を固定済**（character-embed.util.spec の edit-section/refresh/
  compact-view/field-edit/field-add/create-basic/create-cancel、character-ui.util.spec の section-select/field-edit）。移行後も緑＝出力完全同一。

### Slice B — button 分岐を述語へ（コミット `4417346`・5ファイル）

- `enhanced-character-edit.service.ts` の `handleButtonInteraction` が `customId.startsWith(...)` で行う4分岐を
  **契約モジュールの述語**（`CharacterRefreshCustomId.is` / `CharacterCompactCustomId.is` / `CharacterCreateCustomId.isBasic` / `isCancel`）へ。
  いずれも prefix の startsWith（**空 id でも true・substring は false** ＝旧分岐と byte-identical な受理範囲）。
- `custom-id/custom-id-predicates.spec.ts` 新設で境界（空 id・前方一致でない substring・他 family 非該当）を固定。

### Slice C — characterId 抽出 regex を契約へ（コミット `99f7a88`・2ファイル）

- `character-section.custom-id.ts`: 非アンカー解析パターン `CHARACTER_EDIT_SECTION_PARSE_PATTERN` / `CHARACTER_SECTION_SELECT_PARSE_PATTERN` を追加（greedy・prefix が途中でも match する現挙動を保存）。
- `character-section-editor.util.ts`: `CHARACTER_ID_PATTERNS` の直書き4本を契約定数参照へ（field の2本は foundation で定義済だが未使用だった `CHARACTER_FIELD_EDIT/ADD_PARSE_PATTERN` を結線）。順序・正規表現とも従来と完全同一＝byte-identical。
- **据え置き（Codex 指針＝loose を strict 化しない）**: `extractSectionFromCustomId`（`-status-` 等 includes）/ `isFieldOperationCustomId` / `isSectionSelectionCustomId`（includes）は受理範囲が変わるため移行せず。

### 各 slice 検証（司令塔・独立検証）

- A: build / check:circular No circular(488) / jest 6 suites 152 緑 / start:dev 6 handler pattern 不変・総数30・無エラー。
- B: build / check:circular No circular(489) / jest 7 suites 99 緑（新述語 spec 含む）/ start:dev 総数30・無エラー。
- C: build / check:circular No circular(489) / jest 5 suites 142 緑（`extractCharacterIdFromCustomId` の greedy `a-b-c-123`・section-select `id-1`・null 境界）/ start:dev 総数30・無エラー。

### 残（Codex 設計の Slice D〜F・未着手）

- **D**: modal の生成/解析（`char-edit-{sectionType}-{fieldKey}-{id}` legacy ／ `char-edit-modal-{sessionId}` session の2系統。`character-section-editor.util.ts:181-191` ほか）。
- **E**: create modal parse（`character-modal-handler.util.ts:70-84` の `parseBasic` 相当）。
- **F**: message 探索の `includes` 群（`enhanced-character-edit.util.ts:106-121`、`character-modal-handler.service.ts:488-504,582-590`）→ **parser 化せず literal を helper へ集約のみ**（Codex 指針）。
- **要注意（移行しない / loose 維持）**: `extractCharacterIdFromCustomId`(非アンカー正規表現)、`extractCharacterIdFromSectionSelect`(prefix 不一致でも元文字列を返す `replace`)、modal legacy parser の dash 入り id 保持、`includes('character-create-basic')`(startsWith より広い)。C〜F は drift リスクが上がり literal 集約の価値は下がるため、慎重 or Codex スコープ前提。

---

## 2026-06-04 P1-D slice1（characterEdit customId 契約モジュール新設・foundation のみ・コミット `e1dcf9e`・挙動不変）

CLAUDE_HANDOFF.md の P1-D（customId contract 集約・diceRoll の `custom-id/` 先行例に倣う）。ユーザー方針「**characterEdit から
1 feature ずつ着手（bounded）**」に従い characterEdit から着手。今回は **契約モジュール導入 + handler の pattern 参照まで（foundation）**で、
生成/解析サイトの Factory/Parser 移行は **未実施＝literal のまま＝挙動同一**（下記 inventory 付き follow-up）。

### 実施（コミット `e1dcf9e`・14 ファイル）

- **新規 `features/characterEdit/custom-id/`**（refresh / create / compact / section / field / modal の6 family + index）:
  各 family の pattern 定数 + `create*` / `parse*` の純粋関数（discord.js / NestJS DI 非依存）。diceRoll `custom-id/` と同型。
- **6 handler の `getCustomIdPattern()`** を直書き文字列/正規表現 → pattern 定数参照へ置換（**pattern は完全同一**。例:
  `CharacterSectionCustomId.pattern = /^character-(edit-section|section-select)-/`）。
- `handlers.integration.spec.ts`: Factory 生成 customId が handler pattern に match するテストを追加。

### 検証（司令塔がサブエージェント報告を再裏取り＝報告が garbled だったため実状態を全確認）

- build(nest) OK / **check:circular No circular dependency found!(488)** / jest characterEdit + interactions/handlers 統合 + registry
  = **31 suites 411 tests 緑**（customId フォーマットを固定する spec 群も緑＝生成/解析の文字列等価） / **start:dev で characterEdit 6 handler が
  従来と完全一致の pattern で登録・handler 総数 30 不変・無エラー**＝挙動不変。
- `/code-review`(focused): section custom-id は純粋モジュールで文字列/regex 完全同一。handler は pattern 定数を参照（直書き消滅）。
  customId 無関係に `M` 表示の services（channel-name-sync 等）は **CRLF-only churn と確認しコミットから除外**（混入なし）。

### 残（P1-D slice1 follow-up＝生成/解析サイトの Factory/Parser 移行・**未着手 inventory**）

サブエージェントは契約モジュール + handler 参照までで停止（最終編集が途中で切れた）。生成/解析サイトは **literal 直書きのまま**で、
変種が多く byte-identical 保存リスクが高い大ぶり作業のため、**scoped follow-up（慎重 or Codex スコープ推奨）**として保留。対象（`git grep` 実測）:

- 生成: `utils/character-embed.util.ts`（edit-section / refresh / compact-view / field-add / field-edit / create-basic / create-cancel）、
  `services/character-section-editor.service.ts`(edit-section)、`utils/character-ui.util.ts`(field-edit / SECTION_SELECT_PREFIX)、
  `services/character-section-editor.util.ts`(buildDirectModalId=`char-edit-{sectionType}-{fieldKey}-{id}` / buildSessionModalId=`char-edit-modal-{sessionId}`)。
- 解析: `enhanced-character-edit.service.ts`(create-basic/cancel/refresh/compact-view の startsWith)、`services/character-modal-handler.service.ts`(多数 includes)、
  `services/character-modal-handler.util.ts`(`char-edit-modal-` / `char-edit-` prefix + create-basic 正規表現)、`services/character-section-editor.util.ts`(解析正規表現4本)、
  `utils/enhanced-character-edit.util.ts`(refresh/compact-view 正規表現)。
- **注意**: field family は生成側が `character-field-edit-{sectionType}-{id}` / `character-field-add-{sectionType}-{id}`（handler pattern `character-field-` が両者を prefix 包含）、
  modal family は session 形式(`char-edit-modal-`)と legacy 形式(`char-edit-`)の2系統、create family は `{channelId}-{userId}` の2引数。移行時は各変種の Factory/Parser を byte-identical に揃え spec で固定すること。

### slice2

- characterThread の customId 契約モジュール化（同方式）。

---

## 2026-06-04 P1-C process.env 整理（main.ts を AppConfigService 経由へ・非 DI 2件は設計要で deferred）

CLAUDE_HANDOFF.md の P1-C。本番コードの実 process.env 直接参照は3箇所のみ（crypto.util はコメント文）。

### 実施（コミット `8222f72`・挙動不変）

- **main.ts の bind-address** を AppConfigService 経由へ。`process.env.NODE_ENV === 'production'` → `configService.get('app.environment') === 'production'`（configuration.ts:44 で environment=env.NODE_ENV・production 判定は等価。無効値は development フォールバックだが production 判定に影響なし）。`process.env.DOCKER_ENV` → `configService.getRaw('DOCKER_ENV')`（typed key でないため getRaw で AppConfigService 経由に一元化）。bind-address ロジック不変。
- 検証: build / check:circular(481) / start:dev で dev bind-address「http://127.0.0.1:3000」「IPv4 (127.0.0.1)」＝旧挙動と一致・無エラー＝挙動不変。

### 残（P1-C・非 DI のため設計判断要・deferred）

- `core/http/error-handler.ts:98`（**static utility クラス**・`handleHttpError` 内 `process.env.NODE_ENV === 'production'`）と `core/dto/api-response.dto.ts:85`（**DTO**・`new` 生成・constructor 内 `process.env.NODE_ENV === 'development'` で stack 含有判定）。いずれも **DI 不可**のため AppConfigService を注入できない。
- 撤去には「呼び出し側（@Injectable な `http-exception.filter` 等）から env/isDev を渡す」or「環境を保持する仕組み」の**設計が必要**（ハンドオフ明記）。`ApiResponseUtil`（非 DI util）も ErrorResponse を生成するため、両経路の整合も要る。標準的な NODE_ENV モード判定であり撤去は invasive なため、**focused 設計タスク（Codex スコープ推奨）として deferred**。config module / env validation / test 内の process.env は規約上の許容例外。

---

## 2026-06-04 P1-B 残 forwardRef を全解消（全て vestigial・挙動不変）

CLAUDE_HANDOFF.md の P1-B。discord/feature 配下の module `forwardRef` を 1 件ずつ通常 import へ戻す。**調査の結果4件すべて
vestigial（実循環は prior リファクタで既に解消＝逆方向 import がコメントアウト済。madge も循環ゼロ）**で、port 切り出し等の
構造変更は不要だった。コミット `c4dabf1`（DiscordModule→InteractionsModule）＋`427c843`（残3件）。

### 解消した forwardRef（各々「逆方向 import が無い＝循環なし」を確認のうえ通常 import へ）

- `DiscordModule → InteractionsModule`（`c4dabf1`）: P1-A で InteractionsModule を slim 化（feature import 撤去）した結果、
  InteractionsModule は DiscordModule へ戻る経路を持たず（imports は InteractionRegistryModule[imports なし]+EventEmitterModule のみ・
  DiscordModule は誰からも import されない）→ 循環消滅。
- `DiscordIntegrationModule → CharacterModule`（`427c843`）: CharacterModule は DiscordIntegrationModule を import しない（コメントアウト済）。
- `CharacterEditModule → CharacterModule`（`427c843`）: CharacterModule は characterEdit を import しない。
- `CharacterThreadFeatureModule → DiscordIntegrationModule`（`427c843`）: DiscordIntegrationModule は characterThread を import しない（コメントアウト済）。

### 検証（司令塔・各段／最終まとめ）

- build 成功 / check:circular **No circular dependency found!（481）** / start:dev で「Nest application successfully started」・
  handler 総数 **30 不変**・ChannelCreate listener 登録・**循環/Cannot resolve/cannot-create エラーなし**＝DI グラフが forwardRef なしで
  解決＝挙動不変。

### 到達点

- discord/feature 配下の**実 `forwardRef()` は全消失**（残るは `domains/character/character.module.ts` のコメントアウト行のみ＝
  かつての DiscordIntegrationModule 循環の名残・実コードではない）。**P1-B 完了**。次は P1-C（process.env）。

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
- **軽微 follow-up 完了（コミット `e880269`）**: `discord-interaction-handler.service.ts` の冗長 `character-section-select-` if（特例撤去で fallthrough と dead-equivalent）を削除し未登録セレクトを単一 fallback に統一。spec の「3分岐」→「2分岐」更新（character-section-select- の routing 不変 regression guard は維持）。build/check:circular(481)/jest 20 tests 緑・挙動不変。**→ P1-A は follow-up 含め完了。次は P1-B/C/D（別パケット・Codex 判断）**。

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
- デッドコード3点（`character-id.service.ts`/`character.schema.ts`/`CharacterEventHandlerService`）の「削除可」誤判定に訂正注記（現役）。対象: `docs/refactor/refactoring-audit-2026-05-30.md` ほか。
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

- ~~`discord-facade.service.ts` は現役だが DESIGN の目標フローから除外＝**廃止計画が宙ぶらりん**（Phase 1 で要決着）。~~ → **決着（2026-06-03・ドキュメントのみ／コード不変）**: 実コード精査の結果、**facade は存続**で確定し DESIGN.md §4.5 に明記。旧メモ `docs/history/DISCORD_SERVICES_ANALYSIS.md` の「Phase1 廃止／TypedEventService 代替」は事実誤認（facade に `emitEvent` は無く、`initializeDiscord` 起動オーケストレーション＋REST `DiscordController` 裏付け＋ヘルス集約が実責務でイベント発行はしない）のため撤回。`§4.2 目標フロー` 図に無いのは図が interaction ルーティング専用だから。**実ランタイム経路は `main.ts`/`discord.controller` → `DiscordService`(@deprecated ラッパー) → `DiscordFacadeService` → 各専門サービス**で、`DiscordFacadeService` を直接注入するのはラッパーのみ（Grep 確認）。よって真の廃止対象は `DiscordService` ラッパーであり、DESIGN.md Phase 4 に「main.ts/discord.controller を facade 直注入へ置換 → ラッパー削除」を具体化。**挙動を変える置換は安全網テスト＋ユーザー承認後**（本記録時点では未着手＝コード不変）。
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

- 詳細レポート: `docs/refactor/refactoring-audit-2026-05-30.md`
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

ブランチ `refactor/security-phase-s`。計画書 `docs/refactor/refactor-phase-S-plan.md` の S1〜S4 を実施。
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
