# キャラクターシート基盤 設計台帳（ループエンジニアリング用）

作成: 2026-08-08（読み取り専用監査 7 本の統合: 設計文書コア / sheet-engine / front / サーバ実装 / Discord・projection / 未決事項 / 契約・不変条件）
監査: Codex adversarial レビュー **round1〜3 で収束（round3 = pass・findings 0）**（2026-08-08・reviewed at HEAD `ee013820`・証跡 = `review-results/design-ledger-review/`）
対象: schema v3・`packages/sheet-engine`・`packages/sheet-projection`・`packages/api-contract`・TRPG-SERVER の character 系・`trpg-next-app` front・Discord hub

> **本台帳の位置づけ**: ループ（反復的な AI 委譲作業）が「何をしてよいか・何に触ってはいけないか・何が未決か」を 1 箇所で引けるようにするスナップショット＋索引。
> **権威の分離（round1 H2 で改訂）**: **現挙動の事実**の正本は実コード。**意図契約**の正本は承認済み契約文書（design-v1 / design-v1-ui / phase2-goal-contract / phase2-operation-contracts）。両者が衝突したら**どちらかを自動的に「正」として追認しない** — 乖離として停止し人間の裁定へ回す（実例: L-3 = OP-1 fast-path 契約 vs 実装）。本台帳は最下位のスナップショット — 乖離を見つけたら本台帳を直す。

---

## 0. 現在地（2026-08-14 実測・基準 commit `cf616813`）

| 項目 | 状態 |
|---|---|
| **TR レーン（L-2 (c)＋track 昇格 TR-1〜TR-6）** | **実装完了（2026-08-14・大粒度 #20/#21 とも blocking 0）**。engine 契約 A・全経路 advisory（raw canonical）・server 有限性検査 1 本化・front 表示（15 / 10 超過明示）・エディタ track 作成/編集まで。正本 = track-roll-on-create-promotion-draft.md（冒頭に実装コミット 10 本）・証跡 = review-results/impl-u14/tr-lane-acceptance.md。残 = TR-D1（§5-2・凍結）＋残スライス（checkboxes 視覚・試しロール・CL-6・role 編集） |
| Phase 1（engine・template ドメイン・Web エディタ実 API 化） | **実装完了**（AI.character.md 追記6） |
| Phase 2（hub・palette・Discord ±・worker） | **実装完了・受入未了**。PH-7 実機受入（D-3・ユーザー実施）の全 16 チェック項目が `☐` のまま（`phase2-ph7-acceptance-checklist.md`） |
| Phase 3 | **未着工**。`phase3-goal-contract.md` は DRAFT v0.9。着工前提 = D-3 通過（I3-3）＋決定点 D-P3-1〜4 のユーザー決定 |
| 本番 DB（2026-07-30 read-only 実測・`review-results/task28-23-data-survey/`） | シートテンプレート **0 件**・materialized キャラ **0 件** ⇒ **2026-07-30 時点の観測では DB 上の移行対象なし**。ただし published 構造不変契約・front の `@trpg/api-contract`/`@trpg/sheet-engine` 依存・wire/契約 spec の互換制約は**残る**。破壊的変更の前には**再計測＋人間承認**（過去のスナップショットを現在値扱いしない — round1 H3） |
| git（**生成時刻つき診断 — 検収条件に使わない**） | 2026-08-12 時点: HEAD `6ee13e02`・**origin/develop から 76 コミット未 push**（push はタスク範囲外のユーザー判断）・作業ツリーは untracked `?? trpg-remix-app/`（旧 app 残渣・**ユーザー裁定で削除しない**・コミット対象外）を除きクリーン。**この行は同日中にも陳腐化する**。検収はスライス開始時と終了時の `git status --short` 比較で行う（round1 H9） |
| stale worktree | `.claude/worktrees/` に 3 本残存。**repo ルートで `grep -r` すると旧版 spec がヒットして誤読する**（実際に監査中も発生） |

---

## 1. 確定済み設計決定（ループは再議論しない）

### 1-1. モデル選定（A/B/C 案の帰結）

| 案 | 裁定 |
|---|---|
| A1 現行 5 セクション温存 | 汎用正本としては**棄却**。ただし「Discord 向け materialized view（互換投影）」として存続。廃止は実装ゲート判断（design-v1 §3） |
| **A2 スキーマ駆動 ＋ A4 型付きブロック** | **採用（融合形 = schema v3）**。A4 は field の `role` として吸収 |
| A3 スプレッドシート | **棄却**（セルに意味情報がない）。比較基準として意図的に記録保存 |
| B1〜B4（式エンジン / ドメイン境界 / 配布 / Discord 連携） | 全部品採用。B3 配布のみ **Phase 4 未着手** |
| C1 結果連動エフェクト | **ドラフト・ユーザー確定待ち**。SC コマンド不採用・暫定 GM 判定を置かない、は裁定済み |

### 1-2. design-v1 §8 の主要裁定（変更禁止）

- 参照は **canonical path `{sectionId.fieldId}` 保存＋publish 時に uid へ解決（resolvedRefs）**の二層。materializer は uid で評価
- **published テンプレートは構造完全不変**（name/tags の表示メタ patch のみ可）
- ロール実行の正本は **bcdice（サーバ adapter）**。engine は純 TS・`eval` 禁止・AST インタープリタ
- **dice 型は算術に混入不可**（型エラー）
- **GridBlock（シノビガミ特技表）は v3 スコープ外**（拡張点のみ予約）。SW 威力表の engine 内多入力 lookup も**先送り**（bcdice K 記法委譲で v1 成立）
- **`visibleTo != public`・secret role・`when`・`role.when` は publish 拒否**（inert 受理は漏洩事故のもと）
- list はネスト 1 段まで・index 参照禁止・rowId 必須。itemFields 内 RollField は publish 拒否
- **parts（内訳合算・Discord ± は `parts.other`）は mutable number のみ**（scalar number・track 現在値・list 行内 number）
- インスタンス化・materialize は **`src/features/character-sheet/` の所有**。domains/character は保存と不変条件に縮退

### 1-3. design-v1-ui の決着（U1〜U16・確定）

- **三面契約**: 1 スキーマから (1)エディタ (2)キャラ作成/編集フォーム (3)Discord 投影。同一評価器（sheet-engine）。Discord 投影の正本は `DiscordProjectionViewModel`
- キャラ編集は **`{baseRevision, dirty diff}` 提出**・field＋parts キー単位 auto-merge・真の競合のみ 409
- hub は 1 メッセージ集約・グループ操作は **ephemeral パネル**（共有メッセージをユーザー操作で編集しない）
- 権限は v1 2 値: ロール系＝全員可／変異系＝所有者のみ
- **U14（2026-08-09 追記・round3 監査後のユーザー裁定）**: レイアウトヒント＝面(1)(2)専用の optional 注釈。
  `section.layout {preset: stack|grid|table, columns 2〜4}`・`field.layout {span 1〜full}`。
  track/list/relation/tag は常に全幅・モバイルは固定折り畳み（作者指定なし）・レイアウト起因の publish ブロックなし（警告のみ）・
  Discord 投影は不参照・キャラデータに保存しない。仕様正本 = `design-v1-ui.md` §2 v1.1 追記
- **U15（2026-08-09 追記・round3 監査後のユーザー裁定）**: セクション内ブロック・上限・ポイントプール。
  `section.blocks {id,label,cap}`＋`field.blockId`（参照文法 `{section.field}` に現れない注釈）・
  `scalar(number).max: number|{formula}`（優先 field.max＞block.cap）・
  `scalar.partsKeys [{id,label}]`（**新規 optional プロパティ**。既存 `parts?: boolean` の型は
  不変更 = boolean→union 拡張は破壊的変更のため。base/other は暗黙予約キー。
  **formula 付きキーは v1 から延期＝v1.1 候補**）・
  `section.pools {total式, partsKey, scope}`（CoC 職業P/趣味P は partsKey 違いの 2 プール）。
  超過（cap/pool）は警告のみ（v1 固定・enforce 不採用）・作者起因の構造参照不整合は publish エラー・
  プール残りは表示専用（式参照不可）・Discord 不参照。
  仕様正本 = `design-v1-ui.md` §2 v1.2 追記＋追補 H-1〜H-18（**実装の入口は §3.6 v1 実装境界表**）。
  検証は `u14-u15-verification-matrix.md`（観点 V1〜V9 × 要素）。
  **Codex adversarial 監査 round1〜3 収束済み（round3 pass・2026-08-09・証跡 =
  `review-results/u14-u15-design-review/`）**
- **SM-1〜17（2026-08-09 追記）**: 画面×状態の裁定（`screen-state-matrix.md` = 画面 S0〜S8 × 状態 G1〜G9）。
  proof 原子性・非所有者 404 維持・hub 状態名正準化（再構築 CTA は L-4 裁定まで disabled）・
  評価失敗の二層退化（formula parts は制約側・status 伝播）・theirs/mine 状態機械（409 に currentRevision 追加）・
  deprecated の resolve 分離（`resolveForCreate`/`resolvePinnedRevision`）・deltas min1・canMutate capability・
  legacy キャラは S4 対象外。**SM-7 は 2026-08-09 ユーザー裁定で v1 非実装に確定（未決なし）**。
  仕様正本 = `design-v1-ui.md` **§3.5 画面×状態の共通契約**（実装の入口は §3.6 v1 実装境界表）。
  **Codex adversarial 監査 round1〜4 収束済み（round4 pass・証跡 = `review-results/screen-state-review/`）**

- **再レビュー（2026-08-09・cross-cut ＋ 認知負荷/YAGNI）**: 3 追記を最終状態で同時に見た初の監査で
  cross-cut high 3/medium 1、認知負荷・過剰実装 high 1/medium 6/low 1 を検出し**全件受諾**。
  結果として **v1 スコープを縮小**（下記「v1.1 候補」）し、§3.5 独立化・§3.6 実装境界表新設・
  マトリクス 2 本の裁定二重化を解消。**cross-cut round1〜4 で収束（round4 pass）**。
  証跡 = `review-results/{design-crosscut-review,design-cogload-review}/`。
  **実装・委譲の入口は `design-v1-ui.md` §3.6 v1 実装境界表**（v1 必須／延期／非実装の唯一の索引）

- **U16（2026-08-09 ユーザー裁定）**: シートの公開フラグ `character.sheet.visibility: private|public`（既定 private）。
  **v1 はフラグの保存と所有者トグルのみ**・公開読取経路なし（fail-closed。§8-11 の inert 禁止は fail-open
  方向の裁定なので併存）。**対象は Web のみ**（Discord hub はチャンネル権限が支配・visibility 非連動）。
  **非所有者の閲覧は v1 に入れないが今後必ず入る**ため拘束条件を先に固定 —
  公開読取は **allow-list の公開専用 wire（PublicCharacterSheetWire）**新設・既存 owner read／
  無所有者スコープの内部 read（`findOne`/`findById`）を流用しない・
  **v1 期間中の `public` は公開開始時に自動有効化せず再確認必須**・非公開と不存在は同一 404。
  コピー/フォークは **allow-list 構築**（values＋版 pin のみ継承・コピー専用 use case・
  `resolvePublished`/`resolvePinnedRevision` に相乗りしない）。
  **Codex adversarial 監査 round1〜3 収束済み（round3 pass・2026-08-09〜10・全 14 件受諾。
  証跡 = `review-results/u16-visibility-review/`）**。
  **閲覧したシートのコピー（フォーク）は今回スコープ外**（将来前提: 継承は values＋版 pin のみ。
  pin の実体は `sheet.templateId/templateVersion` — materialized では `templatePin` を生成しない
  （`templatePin?: never`）／コピー先は常に private 開始・hub/palette/計算キャッシュは再 materialize）。
  自分のページ（キャラ一覧）からの編集導線は v1 実装。仕様正本 = `design-v1-ui.md` §2 v1.4

### 1-4. 裁定反転・クローズ記録（同じ処方を再提案しない）

| 事項 | 帰結 |
|---|---|
| #35: 「ローカル Set＋コメント」→ **import 1 本化へ反転**（features→domains は許可辺だった） | projection-key-validation が正本 |
| #36: 「projection 側 canonical path 検査削除」→ **反転**。3 層一意性検査は境界責務の異なる多層防御 | 例外は #40 の**同一関数内死蔵**のみ削除（実測 514/514・復活禁止） |
| #37: 「inferCallType へ統合」→ **不成立を実証**。発行元は validateFunctionCalls 側 | fail-closed sentinel 維持 |
| U3 / 俯瞰#10: `—` の共有定数化・「未対応」message 統合・truncate の跨ぎ統合 → **不採用**（認知負荷優先） | 表示のみの重複はファイル内集約まで |
| #48: 「front の ID 規則を engine 正本へ寄せる」→ **撤回**（値 import は client chunk gzip 約+70KB・リテラル一致 assert は fail-open だった）→ **挙動等価テストで固定** | `v3Template.spec.ts:389-414` |
| field 直下 `secret` の単独拒絶 → **不採用**（passthrough 設計の一事例・場当たり） | 意図的放置 |
| D-R3 の却下案（2026-08-12 ユーザー裁定）: 注釈予算の**評価全体共有化**と**公開見積もりへの加算** → 不採用（実測 median 1.864ms で負荷面の便益なし・変更範囲だけ大きい）。**行内 computed の一律拒否** → 不採用（CoC 技能リストが典型ユースケース）。**参照連鎖の深さ制限（3 段等）** → 不要（評価はトポロジカル順に 1 フィールド 1 回 = 深さはコストを増幅しない。循環は publish 拒否＋評価時 throw の二重防御で既に固定・evaluator.spec:234-255） | 採用 = LIST_ROW_LIMIT 512 仮置き＋独立予算の明文化（正本 = design-v1-ui H-18） |

### 1-5. v1.1 候補（v1 から意図的に延期・失わないための保管）

| 項目 | 延期理由 | 復活の受入条件 |
|---|---|---|
| partsKeys の `formula`（H-3） | 11 概念・8 規範箇所へ波及。失うのは内訳の自動導出のみ | 導出値を別 computed でも入力値でも表現できず pool から除外が必要な実テンプレートが出現 |
| 資源上限の**個別**閾値（H-18） | 未実測の閾値 7 個（blocks/pools/keys/sections/fields/警告件数） | 実害・応答サイズ・描画時間の測定が閾値を要求したとき。※**集約コスト上限 1 個は v1 必須**（1,024 式×11 AST の実測反例が既に存在・cross-cut r2 #1） |
| SM-8 の自動 backoff・Retry-After・jitter | 13 概念。dirty 保持＋手動再試行でデータは失われない | 保存失敗の実測頻度・429 発生が確認されたとき |
| SM-1 の transaction 必須化 | 2 方式併存は 5 概念増。単一プロトコルで不変条件は満たせる | 「insert 失敗時に再ロールなしで復旧」が受入条件になったとき |
| SM-6 の hub 再構築 CTA | 未実装機能の disabled 表示は L-4 概念を常時見せる | L-4 の復旧状態機械が裁定・実装されたとき（有効な操作として追加） |
| 非所有者の公開閲覧 UI（SM-4・U16） | v1 は読取経路を作らない（フラグのみ） | **必ず入る**（ユーザー裁定）。allow-list の PublicCharacterSheetWire＋テンプレ表示スナップショット＋旧 public の再確認機構の設計が前提（U16 拘束条件） |
| シートのコピー / フォーク | 今回スコープ外（ユーザー明示） | 公開閲覧の後。allow-list 構築の前提（values＋版 pin のみ継承・コピー専用 use case）は U16 out-of-scope に記録済み |
| エディタのモバイル対応（SM-7） | v1 非実装（ユーザー裁定「後から入れても問題ない」） | いつでも可。1 ペインのタブ切替案が起点 |

---

## 2. 不変条件台帳（委譲プロンプトへ転記する）

### 2-1. 機械固定済み（破ると spec が赤くなる）

| 不変条件 | 固定箇所 |
|---|---|
| 封筒化は auth/user/character/character-sheet の 4 controller・**bare 3 controller（sheet-templates/discord/dice-preview）は負のアサーション**・skip は 2 handler 完全一致 | `TRPG-SERVER/src/core/http/response-interceptor-application.spec.ts` |
| CharacterPaletteEntry ⇄ ProjectionPaletteEntry ⇄ zod の**三方型一致**（IsExact＋OptionalKeys 双方向。IsExact 単独は pure optional 追加を素通りするので OptionalKeys 比較を削らない） | `TRPG-SERVER/src/domains/character/character-wire.contract.spec.ts` / `packages/api-contract/src/character/character.wire.spec.ts` |
| 必須キー導出は `requiredCharacterRuntimeKeys` 1 本＋**sentinel `toHaveLength(6)`**（消すと fail-open） | `TRPG-SERVER/test/utils/character-http-contract.ts:6-44` |
| publish 検証は **1 系統**（PORT→SheetEngineTemplateValidationService→publish.ts）。uid/label ≤128・id 32・table 行 512・一意性は**常に報告し表示のみ 131 で切詰**・issue は O(1) 非反響 | `packages/sheet-engine/src/publish.ts` ＋ `__tests__/publish.spec.ts` |
| 非有限エラー封筒は `buildBoundedNonFiniteErrorEnvelope` 唯一生成・**UTF-8 4,096 bytes**・filter とモデルの **byte 一致（678 が pin）**。予算検証は実 supertest（formatter 出力をテスト側で例外に詰める形は禁止） | `track-range.policy.ts` ＋ `non-finite-*.spec.ts` ＋ `character-sheet-http-exception.filter.spec.ts:218-221` |
| projection golden fixture（hub ViewModel 全体・pinned 20/5 行・select 24＋その他） | `packages/sheet-projection/fixtures/hub-basic.*.json` ＋ `src/__tests__/projection.spec.ts` |
| characterization（legacy-coc materialize 出力＝**旧挙動の凍結。期待値を書き換えない**） | `TRPG-SERVER/src/features/character-sheet/__characterization__/` |
| AttributeValue 正準形（許可キー 6・有限数のみ・未知形は例外）・legacy write の sheet 系 6 フィールド禁止・セクション更新は `$literal` 原子的置換 | `core/types/attribute.types.ts` / `character.repository.ts:49-108` |
| customId 生成⇄parse の regex source 共有（**契約に効く重複は 1 本化する側**） | `packages/sheet-projection/src/custom-id.ts` |
| hub 状態遷移は `assertCharacterHubTransition` の 6 本のみ | `character.entity.ts:63-94` |
| 保存境界（round1 M6 で追加）: `saveSheetMaterialized` の revision CAS・`hub.pendingRevision = expectedRevision+1` の型強制・`appliedInteractionIds` 末尾 20 件保持 | `TRPG-SERVER/src/domains/character/repositories/character.repository.spec.ts:160-200,243-259` |
| `$literal` セクション置換（`$` 始まり description/dice の集約式評価回避）— **3 経路で spec 固定**（round1 で §2-2 から昇格） | `character.repository.spec.ts:537,580,605` |
| `findByChannelId` の `.select()` **完全文字列 pin**（S-1 の罠: 1 語落とすと本番 skill_ ボタンが壊れた実バグ 2026-06-04。round1 で §2-2 から昇格） | `character.repository.spec.ts:465`（他の select pin: `:446,663`） |
| `resolvePublished` の owner/status/version 検査（未 publish・version 不一致・非所有者の拒否） | `TRPG-SERVER/src/domains/character-sheet-template/character-sheet-template.service.spec.ts:120-148` |
| materialized キャラへの旧 modal 経路 write 拒否 | `TRPG-SERVER/src/discord/features/characterEdit/services/character-modal-handler.service.spec.ts:531-545` |
| front から import 可能な api-contract 名は `allowImportNames` **16 名**（wire 14＋dice schema 2）の error rule で機械強制 — 集合外 import は lint 赤（round2 で §2-2 から分類移動） | `trpg-next-app/eslint.config.mjs:11-35` |

### 2-2. 規約・コメント頼み（**破っても全緑**。委譲プロンプトで名指しする）

| # | 結合 | 防波堤 |
|---|---|---|
| B-1 | palette 上限 512 の 2 宣言（api-contract `PALETTE_MAX_ENTRIES` ⇔ materializer `PALETTE_HARD_CAP`） | コメントのみ。値 drift は未固定 |
| B-2 | **解消（2026-08-12・10-S4a round3）**: `DEFAULT_AST_NODE_LIMIT` と `DEFAULT_STEP_LIMIT` は evaluator.ts の単一宣言を publish が import する形へ一本化。さらに publish の options（astNodeLimit/evaluationStepLimit）は**既定値で上方 cap**（上方指定は publish 通過⇔runtime 完走の対応を壊すため。回帰 spec 固定済み） | 宣言の複製を復活させない。cap を外す場合は「予算を publish 成果物へ固定し全 runtime 境界へ同値伝播」の設計裁定が必要（大粒度 #5 high の条件） |
| B-3 | `—`(U+2014) の 2 定義（palette-label ⇔ projection） | 結合コメント。片側変更で suffix 剥離が黙って壊れる |
| B-4 | front の ID_PATTERN/RESERVED_IDS 複製 | 挙動等価テストは **top-level id のみ**（itemFields/attrs のネスト id は非目標・Task #50） |
| B-5 | server DTO ⇄ api-contract interface の同形は「S5 で機械固定**予定**」のまま未実装。**同類の新顔（SM-D2a・2026-08-12）**: server MergeConflictPayload（operation.service.ts:114）⇔ 契約 sheetMergeConflictSchema の機械結合ゼロ＋内側 .strict() のため、server が conflicts 要素へフィールドを足すと**全緑のまま** front ダイアログが汎用文言へ退化（fail-back・データ破壊なし）。**inner 要素は B13-FIX（f188370）で型結合済み**: server の MergeConflictPayload = 契約 `SheetMergeConflictWire['conflicts'][number]` の再利用 — conflicts 要素への field 追加は契約更新なしに compile が止まる。**外側 envelope（characterId/currentRevision の生成 :652-657）は依然コード上の複製**で、実行 conformance は未固定のまま | コメントを「固定済み」と誤読しない |
| B-8 | **characterId / discordUserId の update 不変は `convertUpdateDtoToCharacter`（`character.service.ts:61-77`）の allow-list の副作用のみ**。負のアサーション spec ゼロ | **最優先明記**。スプレッドへ「簡略化」すると全緑のまま書換可能になる |
| B-9/B-10 | **欠番（round1 で REFUTED）**: `$literal` と `findByChannelId` の `.select()` はどちらも spec 固定済みと判明 → **§2-1 へ移動** | — |
| B-11 | front eslint zone は 5 feature の**列挙で fail-open**（新 feature には zone を 1 本足す） | `trpg-next-app/AI.md` |
| B-12 | **allow-list の更新漏れ側だけが未固定**: api-contract に新しい公開型を追加しても `allowImportNames` は自動追随しない（足し忘れは front から import 不可として現れる）。既存 16 名の機械強制は §2-1 へ移動（round2 で分類訂正） | 追加時に `trpg-next-app/eslint.config.mjs:17-34` へ 1 行足す規約のみ |
| B-13 | **所有者の存在は DB 非強制**: `discordUserId` は Mongoose 上 `required:false, default:''`（`character.model.ts:30-31`）。「全キャラに所有者がいる」は作成経路（JWT 注入）の規約頼みで、**空文字所有者の文書が型・永続化の両層で表現可能**（2026-08-11 台帳監査で追加） | #11/#12 の owner 判定・fixture はこの前提で書く。空文字にマッチする恒真クエリを作らない。安全方向は fail-closed（空文字 owner は誰の owner-scoped read にも一致しない） |
| B-14 | **`characterSheetStateSchema` は `.strict()` 4 項目**（`character.zod.ts:27-34`）で、repository が書込時に parse（`character.repository.ts:129,145`）。**Mongoose（`@Prop({type:Object})`）は通るが Zod 境界で実行時 throw するねじれ** | #12 の visibility も #10 で sheet にキーを足す場合も、api-contract・persistence・materializer を**同時に**更新する（§3.6 Schema 行が正本） |
| B-15 | **sheet-engine publish の template schema は全域 `.passthrough()`**（`publish.ts:58-99`・`sections[].layout` は `z.unknown()`）。未知キー・綴り違いは**黙って受理され全緑のまま素通り** — 検証は明示的にコード化した分のみ効く。これは**意図的設計**（§1-4: field 直下 secret の単独拒絶 不採用の裁定） | #9/#10 で「堅牢化」として `.strict()` 化するのは禁止。新フィールド（layout/blocks/partsKeys/pools）の検証は明示的に追加する |
| B-16 | **Character @Schema ⇔ CharacterEntity の同期はコメント頼み**（`character.model.ts:14-17`）で、zod parse 境界は materialized create/save/template pin の **3 経路のみ**（`character.repository.ts:129,145,177`） | #12 が新設する visibility 単項更新に parse/検証境界を必ず置く（`$set` 直書きの素通り経路を作らない） |
| B-18 | **editor の位置解決 resolver（describeIssuePath）の一意性判定は「候補が 1 件」**で、sections 語彙分岐は既知 locationKind（id/label/layout/fields/blocks/pools）以外を黙って捨てる。**分岐を足すと一意性判定の意味（候補集合）が変わる**。また property-walk fallback は値の実在を要求するため「必須キー欠落」系 issue は原理的に raw path 表示（大粒度 #11 Opus L-3・ROW1-7 実測） | resolver へ語彙・分岐を足すスライスは、既存の曖昧 fallback spec 2 本（数字 id・id 衝突）を緑のまま保ち、新分岐が候補集合へ与える影響を spec で固定する |
| B-19 | **template service の update/publish ガードは `status !== 'draft'` の補集合形**（character-sheet-template.service.ts:108,148）。現 3 status では {published, deprecated} と等価だが、**第 4 status を追加すると無言で更新可能集合へ入る**（fail-open。resolve 系の allow-list 2 本は fail-closed で対照的 — 大粒度 #12 Opus F3・書換は YAGNI で不採用） | status を追加するスライスは、この 2 箇所の補集合形が新 status を含んでよいかを裁定してから入れる |
| B-21 | **エディタの template state は immer produce 経由で更新され、auto-freeze により凍結オブジェクトが下流（プレビュー・TemplateFormRenderer・buildEditorPayload・spread 系ヘルパ）へ流れる**（ST-B2・2026-08-12 導入）。下流が template を in-place mutate すると実行時 throw する。既存下流は全て非破壊（normalizeTemplateReferences/normalizeTemplateLayout は入力非破壊を fixture で pin 済み）だが、**新しい下流処理が mutate を書くと dev で初めて落ちる** | ドラフト更新は produce（カリー形）で書く。template を受け取る新処理は入力非破壊で書く。凍結 pin spec（Object.isFrozen）が §2-1 側の機械ガード |
| B-20 | **「公開読取経路を作らない」（U16 v1 拘束）は機械ガードなし**: character の read route が owner スコープであることを強制する構造 spec・route 面 pin は存在しない（非 owner スコープの新 route を足しても全 suite 緑のまま — 大粒度 #16 Opus F2 実測）。route 面 pin spec の新設は**不採用裁定**（変更頻度が低く、正当な route 追加のたびに壊れる列挙 spec の確定コストが仮説便益を上回る） | character controller・character read 系へ route/endpoint を足す委譲プロンプトで本拘束を名指しする（公開読取は将来 PublicCharacterSheetWire の allow-list 新設でのみ入る — §1-3 U16 拘束） |
| B-17 | **editor の clear（spread）は own key＋`undefined` を残し、publish の max/partsKeys 検査は `hasOwnProperty` 判定**（publish.ts:456,463）。非 scalar field に own `max: undefined` が付くと誤 issue 2 件。現状は max/partsKeys 入力が scalar+number にゲートされ field type 変更 UI も無いため**到達不能**（大粒度 #10 Opus L2・own-undefined 8 形の publish 受理は実測済み） | field type 変更 UI を足すスライスは、clear を「key ごと削除」へ揃えるか publish 側を nullish 判定へ変える裁定を先に行う |

### 2-3. 統合禁止の二重実装（「重複だから」と 1 本化しない）

- `isPartsValue` engine 版（緩・非公開）⇔ server 版（厳格）— 真理値が割れる入力は仕様
- 一意性検査の 3 層（front v3Template / engine publish / server projection-key-validation）
- `TABLE_ROW_LIMIT=512`・palette cap 512・SOFT_CAP=128・**LIST_ROW_LIMIT=512（evaluator・D-R3）**・
  MAX_ISSUE_MESSAGE_LENGTH=512 の**値一致は偶然 — 統合禁止**（LIST_ROW_LIMIT は公開 options
  差し替え不可 = 撤去済み listRowLimit を再導入しない・大粒度 #10）
- characterThread の `skillName (skillLevel)` 書式は palette ラベルと別機能・対象外
- **editor の行編集 UI 3 実装**（blocks/pools/partsKeys の id+label+削除行・byte 一致行 ×3 含む）は
  generic 化しない — 共通化には reorder/disabled/追加フィールドの 3 変動軸を持つ新 component が必要で
  新抽象の追加になる（大粒度 #10 で Codex/Opus とも No-Go 一致・2026-08-12）。
  ただし remount 契約の分岐は禁止: ConstraintInput の mode は value から導出し useState を復活させない（E2-R2）
- `allowsParts` は engine 正本・server は re-export shim（複製を作らない）
- feature 側 `types/character-sheet.types.ts` は type-only re-export のみ（正本は character.entity.ts）
- `isRecord` の **6 定義**（layout-resolver / layout-normalizer / publish / constraint-evaluator /
  annotation-runtime / **TemplateFormRenderer〔front・初のパッケージ跨ぎ〕**）は**意図的局在** —
  本体 byte 一致の 1 行 unknown 境界述語で、共有すると consumer に file hop を足すだけ
  （大粒度 #3 裁定・#6 で 5 定義・#9 で 6 定義へ再確認・2026-08-11）
- **H-6 述語（セクション直下 number scalar）の 5 符号化** —
  annotation-runtime.isNumberScalar / constraint-evaluator.isRawNumberInputField（**track を含む
  superset = 意図差**: H-7 生入力欠落判定対象）/ publish インライン 3 箇所 / value-input /
  **TemplateFormRenderer〔front・初のパッケージ跨ぎ・大粒度 #9 M5〕**。統合不可（track 有無の
  フラグ引数が生えて分岐が戻る）。engine 側は field-predicates.spec が H-6/H-7 実集合を固定済み・
  front 側は意図コメント＋engine 定義との同値 spec を付す（BIG9-FIXB）。
  委譲時は片側だけの変更を禁止と名指しする（大粒度 #6・#9・2026-08-11）
- **raw 値の alias 読取は own＋非 nullish first-win（uid → `${sectionId}.${fieldId}` → id）で
  全経路統一 — 正本 = template-index.readAliasedValue / fieldCandidateKeys**（BIG6-S3・2026-08-11
  Fable 裁定）。旧 evaluator は `??` 連鎖でプロトタイプ鎖上の値も読め、H-7 の own 判定と内部矛盾
  していた。統一によりプロトタイプ鎖入力では evaluateConstraint の status・H-6/H-7 警告の発火が
  旧実装から変わるが**許容**（publish 境界の RESERVED_IDS『constructor』と ID_PATTERN が実 id を
  遮断済み・本番露出 0・characterization spec で新挙動を固定）。入力は plain/JSON object 前提・
  Proxy 非対応。**annotation-runtime の path は走査中 sectionId から構築**（fieldsByUid 逆引きは
  重複 UID draft で別 section の path を掴む — round2 で復元・回帰 spec あり）。
  大粒度 #7 で constraint-evaluator 内の twin（readRawValue = 非 own・hasOwnNonNullishEntry）を
  検出 → BIG7-FIXA で readAliasedValue へ完全集約。**uid は publish で prototype 汚染キー 3 種
  （__proto__/constructor/prototype）のみ拒否**（BIG7-FIXB。RESERVED_IDS 全体は uid へ適用しない
  — uid 名前空間は式識別子と無関係で過剰拒否になる。大粒度 #7 統合裁定 = big7-integration.md）
- **Discord ephemeral 面の日本語文言は 2 箇所配置が裁定**（SM-E・2026-08-12）:
  projection = **label/title 系**（前へ/次へ/その他のグループ・group label）／
  server builder = **message 系**（権限案内「この操作はキャラクター所有者のみ実行できます」）。
  「文言だから」と片側へ寄せない（Opus SM-E F-5 のドリフト防止記録）。
  **権限拒否文言の 2 種も表示チャネル差で意図的**（パネル描画「この操作はキャラクター
  所有者のみ実行できます」⇔ resource-delta 実行拒否「❌ …の所有者のみ…。」—
  大粒度 #13 F4 裁定・統一しない）。所有者判定の 1 行述語（=== ×4 サイト）も
  helper 化しない（隠れた意味なし・間接参照の純増 — #13 F9・両レビュア一致）
- **parts 合算の 2 実装は責務差で意図的**（evaluator:544 = 評価・非有限で throw ／
  value-input:106 = 入力境界検査・false 返し）— 統合しない（大粒度 #7 記録・2026-08-11）
- **AST 子走査の実数 = 完全 7 本＋部分 2 本**（countAstNodes / evalAst / collectRefs /
  validateFunctionCalls / inferExpressionType / walk / visitAst ＋ dice 系 binary 限定 2）。
  子ノード列挙のみの単一 owner は walk として既存（caller 1）。統合は context 搬送・戻り値の
  差で純減しない — **発火条件 = AstNode union に variant が増えたとき**に再評価
  （大粒度 #6 で本数訂正・2026-08-11。旧記録の「3 本」「5 箇所」は目減りした誤記）
- U14 の 4 テスト系統は**責務の異なる独立 oracle** — 共有 fixture=保存正規化・resolver spec=解決値・
  renderer spec=DOM 契約・publish spec=warning の code/path/順序。入力族が重なっても削減・
  共有期待値生成の対象にしない（大粒度 #3・2026-08-11 裁定）

### 2-4. 委譲で壊れやすい急所（プロンプト定型文）

委譲プロンプトの不変条件節に、該当作業に応じて以下を転記する:

```
- *.characterization.spec.ts と golden fixture（fixtures/hub-basic.expected.json）は旧挙動の凍結。
  期待値・fixture を書き換えてはならない。差分が出たら停止して差分内容を報告する。
- byte 数・件数の pin（678 bytes / 131 文字 / toHaveLength(6) / export 39+17 名）は仕様。
  実測に合わせて数値を更新するのは禁止。増減が必要なら停止して報告する。
- spec に lint --fix を当てない（no-duplicate-type-constituents の auto-fix が
  AssertBothNever を単方向化して契約を壊す）。
- SHEET_KNOWN_FUNCTION_VALUES / SHEET_RESERVED_ID_VALUES は runtime 参照 0 だが削除禁止
  （等価テストが唯一の consumer。static:deps の死蔵判定は裁定に使わない）。
- convertUpdateDtoToCharacter の allow-list を簡略化しない（characterId/discordUserId 不変の唯一の防御）。
- findByChannelId の .select() 列挙から語を落とさない（S-1 実バグ）。
- publish の issue/warning message へユーザー入力を反響させるときは必ず truncateIssueInput() で
  制限する（診断増幅ガード publish.ts:29-31 の適用対象は既存 path だけでなく**新設 message も**。
  10-S1 で 1 MiB id → 1 MB message の実害を検出済み）。
- レビュー・調査エージェントは読み取り専用（emit プローブ・lint --fix・stash 禁止）。
- 検収はスライス開始時に `git status --short` を記録し、終了時との差分が意図した変更のみで
  あることを確認する（恒久例外の文字列固定はしない。既知 untracked は都度列挙し所有を確認）。
- 通常 suite に「裁定待ちの意図的に赤い spec」を混ぜない（full-suite 緑ゲートが壊れ、
  後続の委譲が期待値改変で「修復」する危険）。裁定待ちの再現 spec は it.failing 化 or
  隔離 config で分離する。
- 【#9〜#12 新機能】sheet-engine publish の .passthrough() を .strict() 化しない（意図的設計・B-15）。
  新フィールドの検証は明示的に追加した分だけが効く。
- 【#9〜#12 新機能】character.sheet へキーを足すときは api-contract characterSheetStateSchema
  （.strict()）・persistence・materializer を同時更新する（片側だけだと repository parse で
  実行時 throw・B-14）。
- 【#9〜#12 新機能】所有者判定は「discordUserId は DB 非強制（default ''）」の前提で書く（B-13）。
  新設の書込経路には parse/検証境界を必ず置く（B-16）。
```

### 2-5. 検収コマンド（実在するもののみ）

| コマンド | 用途 |
|---|---|
| `pnpm run check:contract-stack` | 契約横断ゲートの正本（api-contract→server→front） |
| `pnpm run test:engine` / `test:projection` / `test:contract` | パッケージ単位 |
| TRPG-SERVER: `pnpm build` → `pnpm run check:circular`（"No circular dependency found!"）→ full jest | サーバ検収（マージ前は全 suite 必須） |
| `pnpm run static:deps` 等 | 実測用。**死蔵判定を削除の根拠にしない**（誤検出既知） |
| 環境: 間欠 V8 crash（exit 3221225477）は `NODE_OPTIONS=--max-old-space-size=4096` で回避・まず再試行 | SESSION_HANDOFF L1665-1666 |

**キュー行との対応**（2026-08-11 監査で追加）: #9 = `test:engine`（schema/publish）＋`check:contract-stack`（renderer 到達時）／#10 = `test:engine` 主・**H-18 ベンチ script は未作成 — 着手スライスで新設が検収手段の一部**／#11 = TRPG-SERVER 検収一式（build→check:circular→full jest）＋`check:contract-stack`（409 wire 変更時）／#12 = `check:contract-stack`（api-contract→server→front を跨ぐため）

---

## 3. 実装ギャップマトリクス（能力 × 面）

凡例: ✅ 実装済み / ⚠️ 部分・縮退 / ❌ なし / — 対象外

| 能力 | engine | server | front エディタ | front シート | Discord |
|---|---|---|---|---|---|
| scalar number/text/select/boolean | ✅ | ✅ | ✅（4 種） | ⚠️ number/text のみ | — |
| scalar `parts` | ✅ | ✅（± は parts.other） | ❌ | ⚠️ base のみ保存経路 | ✅（±） |
| computed（式・9 関数・lookup） | ✅ | ✅ computedCache | ✅ formula 編集 | ❌ **表示されない** | ⚠️ embed は resource のみ |
| roll / standalone roll（3d6*5） | ✅ | ✅ rollOnCreate 正式契約（TR-3・2026-08-14） | ✅ notation 編集 | ❌ | ✅ palette roll |
| lookup table（CoC DB） | ✅ 範囲表・resultType dice | ✅ | ⚠️ 生 JSON textarea | ❌ | ✅（notation 差し込み経由） |
| track（min/max/thresholds） | ✅ **全経路 advisory（raw canonical・TR-4b/4c）**・有限性のみ 422 | ✅ TrackRangePolicy（有限性診断＋bounds は ± atBound 専用） | ✅ 作成・編集 UI（TR-6・rollOnCreate 含む） | ✅ 15 / 10 超過明示＋gauge 塗り cap＋max error 警告（TR-5・checkboxes 視覚は残） | ✅ res_ ±（raw 適用・min>max 422 のみ TR-D1 凍結） |
| track reset（resetOn/resetTo） | ⚠️ 宣言・検証のみ | ❌ 実行系なし（C-1） | ❌ | ❌ | ❌ |
| thresholds 到達通知 | ⚠️ 検証のみ | ❌ | ❌ | ❌ | ❌ |
| list / relation / tag | ✅ 型・publish 検証 | ❌ 投影・palette 対象外 | ❌ 作成 UI なし | ❌ | ❌ 行 palette なし |
| role rollable / resource | ✅ | ✅ palette 生成 | ❌ 編集 UI なし | — | ✅ hub ボタン |
| role profile | ✅ 型のみ | ❌ palette 化されない | ❌ | ❌ | ❌ embed 未表示 |
| visibleTo / secret / when | 型あり・**publish 拒否（仕様）** | ❌ | ❌（public 固定） | ❌ | ❌ |
| palette（key 安定・cap） | — | ✅ uid 突合で安定・hard 512 | — | ❌ **front 参照ゼロ** | ✅ soft 128 は警告のみ |
| 作者ピン留めフラグ | ❌ schema 未定義 | — | — | — | ⚠️ 先頭 20 ロール縮退 |
| hub（投稿/更新/±） | — | ✅ 状態機械・worker | — | — | ✅（**error→復帰遷移なし**） |
| migrate（legacy→materialized） | — | ❌（backfill script のみ） | ❌ | ❌ | ❌ |
| テンプレ複数バージョン共存 | — | ❌ Phase 4 | — | — | — |
| 配布（gallery/fork/license） | — | ❌ Phase 4 | ❌ | — | — |

**フロントの構造的な蓋**: `V3EditorFieldType`（`trpg-next-app/app/features/characterTemplate/types/v3.ts:9`）は scalar 系＋computed＋roll＋**track（TR-6・2026-08-14 で蓋開放）**。list/relation/tag は「型は素通しするが作成・編集できない」のまま。track の role（palette resource 化）も編集不可のまま（大粒度 #21 記録: エディタ製 track は ± 経路に到達しない）。キャラシート画面（`CharacterSheetEditClient`）は `editableScalarFields` の filter（`sheet-edit.ts:10-17`）で number/text に退化。`evaluateTemplate` の front 使用は TemplatePreviewV3 の 1 箇所のみ。

---

## 4. 既知バグ候補・乖離（L-番号は本台帳の採番）

| ID | 内容 | 根拠 | 扱い |
|---|---|---|---|
| **L-1** | **dice 断片の `+` 連結が publish 通過→評価時 throw**。`'+1d4' + '+1d6'` は inferBinaryType が dice を返すが evalBinary は無条件 expectNumber。回避は notation 側連結（`1d8{a}{b}`）。回帰テストなし | `publish.ts:469-472,647-651` ⇔ `evaluator.ts:297-299,470-475` | **人間決定点（round1 H5 で昇格）**: publish 側の文言は連結を意図的に受理しており、拒絶は公開言語の縮退になる。回帰再現の固定と裁定資料まではループ可（§6-1） |
| **L-2** | **rollOnCreate が engine 契約外フィールド**。instantiation は `field.rollOnCreate` を参照するが RollField 型に存在せず（passthrough で素通り）、**legacy-coc seed の roll には無い＝作成時ロール不発を実証済み**（2026-08-08 再現 spec 3 red / seed 整合ガード 1 green・感度確認済み）。roll 値は提出不可・事後書込不可のため不発＝修復経路なしの永久欠落 | `character-instantiation.legacy-coc.reproduction.spec.ts`・`l2-roll-on-create-adjudication.md`（事実チェーン 10 項） | **解消済み（2026-08-14）**: (c) 常時ロール採用＋契約形 A で TR-1〜TR-6 実装完了（再現 spec 緑化済み・§0 参照） |
| **L-3** | **OP-1 fast-path 未実装（契約との乖離）**: `phase2-operation-contracts.md:55` は「baseRevision==現 revision なら比較省略で全適用」の fast-path を要求するが、実装は `baseRevision` を形式検査にしか使わず `sheet.revision` と比較しない。実防御は per-change `baseValue` 一致＋repository CAS | `character-sheet-operation.service.ts:654-658` ⇔ `phase2-operation-contracts.md:55` | 原則**契約どおり実装**（§6-1・round1 H4 で再分類）。契約側を廃止する場合のみ別の人間裁定 |
| **L-4** | **hub `error→*` の復帰遷移が存在せず rebuild 不可能**（GAP-B の受け皿は Phase 3 E-4 のまま） | `character.entity.ts:91-92` | Phase 3 |
| **L-5** | golden fixtures の「Web/サーバ両側 jest 共有」は**未達**（projection パッケージ内テスト専用。front は依存すらしていない） | `sheet-projection/jest.config.cjs` / `trpg-next-app/package.json` | design-v1-ui 契約 3 との乖離を記録 |
| **L-6** | `PINNED_BUTTON_LIMIT` を 21+ に上げると Discord の 5 行上限を超える（**21〜25 件で pinned 5 行＋select 1 行=6 行。26 件以上はさらに増える** — round2 で数量を精密化）。**builder に実行時ガードなし**。「テストなし」は round1 M1 で訂正 — 20/21 境界 spec は `projection.spec.ts:52-58` に**実在**（定数変更は赤くなる） | `hub-discord-view.builder.ts:35-52` | 実行時ガード追加の小型候補 |
| **L-7** | soft cap 128 の warnings は **projection（ViewModel）が生成済み**で、design-v1-ui 上も warnings の責務は ViewModel（round1 M2 で訂正 — materializer への重複実装はしない）。欠落は **front/editor が warnings を消費していない**こと（front は sheet-projection 非依存） | `projection.ts:463-478`・`trpg-next-app/package.json`（依存なし） | エディタ側の warnings 消費（Phase 3 UI） |
| **L-8** | embed のテンプレ名（`Template v{version}` 固定）・profile role 表示・時間 debounce（coalesce のみ）が design-v1-ui §3 未達 | `hub-projection.service.ts:15-22` ほか | Phase 3 UI 消化 |
| **L-9** | doc 陳腐化 — **4/5 修正済み（2026-08-08・未コミットの作業ツリー差分。round1 H6 で再同期）**: PH-7 §0-4（Next/3100 化）・proposals README・b3・SESSION_HANDOFF ヘッダ/日付は main tree で修正済み。**残 = `AI.character.md:3` ヘッダ日付のみ** | round1 レビューの再実測 | 残 1 件の修正のみ。修正済み 4 ファイルのコミット可否はユーザー判断 |
| **L-10** | `_eval_answer_tmp.md`（probe-write 残渣）が tracked のまま | `git ls-files` | 削除候補 |
| **L-11** | #29 の待ち条件（E1b）は `a03d8c6` で解消済みだが再開記録なし | `SESSION_HANDOFF.md:112-114,141`（E1b 完了記録は `:755-766`。round1 で行参照を更新） | ブロック解除済みとして再開可 |
| **L-12** | `findHubRefreshCandidates` が `findAll()` 全件取得後フィルタ（単一プロセス前提と宣言済み） | `character-sheet-operation.service.ts:143-154` | 宣言済み残置。**I3-2（429 回数のメモリ限定）とは別項目** — 「単一プロセス前提」一般と混同しない（round1 指摘） |
| **L-13** | legacy-coc テンプレートを DB へ投入する **seeder が存在しない**（定数の利用者は backfill script と spec のみ）。**PH-7 は legacy-coc が publish 済みであることを前提とするため、D-3 の明示前提**（round1 H7 で昇格） | `seeds/legacy-coc.template.ts`・`backfill-template-pin.ts:9,14-15` | 投入主体・所有者・version・publish 方法（手動投入 or seeder 新設）は**ユーザー決定**（§5-2） |

**未確認事項（round1 で 3 件解消）**: ①② は **REFUTED**（`$literal` は 3 経路・`.select()` は完全文字列で spec 固定済み → §2-1 へ収載）。③ 旧 `AI.types.md` は N6b で**移設されず削除**（参照は git 履歴 `e179640^` 以前。README「関連する既存資産」節に追記済み）。残: ④ #48 の完了状態（review-results に round11 まであるが HANDOFF に完了行なし）⑤ GAP-B（posted-but-untracked reconciliation）の縮退裁定の記録有無。

---

## 5. 未決事項・人間の決定点（**ループが勝手に決めない**）

### 5-1. 依存の最上流

```
L-9 残修正＋L-2 再現 spec の隔離（ループ可）
＋ L-2 裁定・L-13 テンプレ投入方法の決定（ユーザー）
→ D-3: PH-7 実機受入（ユーザー・16 項目）→ D-P3-1〜4 決定（ユーザー）→ Phase 3 着工
```

### 5-2. ユーザー決定待ち一覧

| ID | 決定事項 | ブロックしているもの |
|---|---|---|
| **D-3** | PH-7 実機受入の実施と判定（Docker ゲート §5 含む） | Phase 2 完了宣言・Phase 3 着工 |
| **L-2 裁定** | rollOnCreate 修正方針（a 型昇格／b seed 付与／c 常時ロール — 裁定資料は c 推奨）**【裁定 2026-08-13・ユーザー】(c) 常時ロールを採用**。**付帯裁定 = track の作成時ロールは廃止せず正式契約へ昇格する**（正本 = track-roll-on-create-promotion-draft.md）。**昇格の主要裁定済み（2026-08-13・ユーザー）= 契約形 A（TrackField.rollOnCreate 内包・出目 canonical・二形態廃止）＋範囲意味論は全経路 advisory 化（提出・± も超過許可・数値 15/10 明示・± raw 基準・gauge 塗りのみ cap。既存の提出検査・悪化拒否・raw/投影 clamp・422 の pin 群を反転）**。実装順序 = 未定・着手はユーザーの再開指示待ち。**〔進捗 2026-08-13〕TR-1（736e5305）・TR-2 engine 契約 A（16f91cc）・D-R4（d2d0759）・L-13（51d83bf）済み。大粒度 #18 = 二重レビュー一致でクリーン・統合フェーズ不要（突合 = review-results/impl-u14/big18-integration.md）。順序制約 = TR-4b 完了前に TR-5 を始めない（raw/capped 二語彙の front 流入防止）。追加の司令塔裁定 2 件（itemFields 内 track の publish 拒否・提出値衝突 422）は正本 draft §裁定 4/5。CL-6 裁定枠 = rollOnCreateResults の details は production 消費 0（#21 実測で wire 契約に非搭載 = 表示には controller/api-contract/front の 3 層スライスが必要・裁定は保留のまま）。**〔完了 2026-08-14〕TR-1〜TR-6 実装完了（§0 参照・大粒度 #20/#21 blocking 0・残 = TR-D1 凍結＋残スライス）** | 再現 spec の赤解消・D-3 の作成時ロール受入・**SM-F（SM-1 proof 原子性）の着手**（2026-08-12 実測: proof/nonce は契約・production とも完全未実装〔dice preview の wire は total/details のみ〕。proof の消費者 = ウィザードの roll step UI も未構築。作成時ロールの在り方が本裁定で決まる前に protocol を先行実装すると死んだ抽象になるため、キュー #11 の SM-F はブロック扱い） |
| **L-13** | legacy-coc テンプレートの DB 投入方法（手動 publish or seeder 新設・所有者/version）**【裁定 2026-08-13・ユーザー】seeder 新設を採用**。**〔実装 2026-08-13〕** seeder = src/scripts/seed-legacy-coc-template.ts（backfill 家風・dry-run 既定・冪等キー templateId＋version・seed 実体無改変・publish 3 検証再利用〔visibility=public 要求のみ規約例外として除外 — seed は private が正で書き換え禁止のため。code 内 NOTE あり〕）。**〔2-2 型不変条件・#18 CL-2〕** publish 検証セットは domain validateForPublish／seeder collectSeedPublishIssues／front エディタ runValidation の 3 通りに手組みされ、検証を増減しても機械検出されない — domain 側を触るスライスは他 2 面の追随を指示書に明記すること（front には投影キー検査が元々無い = 既知乖離） | D-3 §0 事前準備の実行可能性 |
| **L-13b** | **seeder を投入しても legacy 経路は開通しない（実測 2026-08-13）**: findOne / resolvePinnedRevision は `assertOwner`（authorDiscordUserId 等値）で遮断し visibility を読み取り述語に使わないため、owner 'system' の行は一般ユーザーへ **403**（seeder 投入で 404→403 に変わるだけ）。認可の変更なので AI は決めない。選択肢 = (a) 読み取り述語へ system テンプレートの許可を追加（visibility ベース or owner 'system' 特例） (b) seed の owner/visibility を変更（seed 実体の改変 — L-13 不変条件の変更を伴う） (c) legacy 経路は別解決（backfill pin の消費側で code 側 seed を直接参照し続ける現状維持） | seeder `--execute` の実走・D-3 §0（PH-7 前提 = legacy-coc が DB 解決可能であること）・D-R4 経路の legacy キャラクター到達性 |
| **L-1 裁定** | dice 断片 `+` 連結の言語仕様（publish 拒絶=公開言語の縮退 or evaluator 連結対応） | L-1 封鎖の実装方向 |
| **D-P3-1** | Phase 3 スコープ (a)コアのみ／(b)＋U5／(c)＋v1.x（declare/when） | M3-1〜M3-6 の範囲 |
| **D-P3-2** | 作者ピン留めフラグを schema v3.1 で追加するか | README 未決 15・先頭 20 縮退の解消 |
| **D-P3-3** | 投影廃止ゲートを Phase 3 exit に含めるか | 旧 skill_/ability_ 段階廃止 |
| **D-P3-4** | migrate は一括ウィザードかキャラ単位オンデマンドか | M3-3 の設計形 |
| I3-1 追認 | GM/権限・共有シート P14・リセット発火権限・SW lookup 拡張を Phase 3 に**入れない** | Phase 3 境界 |
| C1 確定 | 結果連動エフェクト（`chk_`）の v1.x 採用 | c1 実装着手 |
| README 未決 5 | 公開ギャラリー未認証閲覧（Phase 4） | 認可設計 |
| README 未決 10〜14 | selectedRow／Discord トグル／relation live 参照／FATE 型 resetTo／declare | v1.x 拡張 |
| **D-R1** | **TemplatePreviewV3 統合の裁定**（2026-08-11 大粒度レビュー #2）: (a) AI.md へ理由付き有向辺 characterTemplate→characterSheet を追加し eslint except 同期・preview を state/evaluator/dice の wrapper 化して入力描画を TemplateFormRenderer へ委譲（**レビュー推奨**。挙動差 7 点の characterization が前提・費用 = 4 非 test artifacts＋cross-feature hop 0→1・便益 = scalar widget 編集先 2→1・S8 で layout 再複製回避）／(b) 統合見送り・重複容認＋scalar 4 valueType の共有部分を両 component で固定し二者更新を受入条件化 **【裁定 2026-08-12・ユーザー】案(a) 統合を採用**。裁定は条件形「TemplateFormRenderer が今回実装なら統合・旧物なら今回実装で上書き」で与えられ、事実解決 = TFR はキュー #9 S4〜S7 の新規実装（ae9345a7）→ 統合が確定。前提の挙動差 7 点 = number 空値/onChange 正規化・select null/空文字・boolean 厳密値/真偽化・computed 説明/失敗表示・roll read-only/対話 dice・複雑 4 型 placeholder・全 section/active tab（出典 = review-results/impl-u14/run-bigreview-2）。スライス = D-R1a（characterization spec）→ D-R1b（wrapper 化＋AI.md 有向辺 characterTemplate→characterSheet＋eslint 同期）→ 9-S8 → タブ化 | ~~統合スライスと 9-S8 の着手~~ **解禁済み** |
| **D-R2** | **U14 renderer の作成・編集面への配線裁定**（2026-08-11 大粒度レビュー #4 high）: TemplateFormRenderer は production consumer **0 件**（spec のみ）で、実 runtime 経路 CharacterSheetEditClient（`app/features/character/`・sheet page 配下）は layout 非消費の独自描画。配線には **AI.md へ有向辺 character→characterSheet 追加＋eslint の character zone（eslint.config.mjs:84-89・target = import する側）の except へ './characterSheet' 追記**が必要（〔2026-08-13 訂正〕旧記載「characterSheet zone の except へ './character'」は target の向きが逆 — D-R1b の実物が正）。レビュー勧告 = TemplateFormRenderer を controlled renderer として接続し**第三の描画実装を作らない**・接続後に route/component regression 通過まで U14 完了扱い禁止。**接続時条件（U15-R1b レビュー Low・2026-08-11）**: values は immutable 更新・無関係な親 render では参照を安定させる（annotation useMemo の deps = [template, values] が参照同一性前提。毎 render 新 object だと D-R3 未計量経路が毎打鍵で再評価される）・接続時に annotation 評価時間を計量する・**宣言 partsKey 提示の UNSAFE 濾過を整理する**（大粒度 #12・表示 3 兄弟関数の濾過が 3 通りに非対称: table 列 = 無濾過／popover 宣言モード = base/other のみ／自由モード = UNSAFE 濾過。B12-FIX で publish 上流は閉鎖済みのため対象は既存公開データ防御のみ。書込は操作層 422＋materialize 再検証の二層で fail-noisy 済み） **【裁定 2026-08-12・ユーザー】接続を採用**（D-R1 と同一の条件形裁定・事実解決 = TFR は今回実装 → 配線が確定）。レビュー勧告どおり controlled renderer として接続・第三の描画実装を作らない・接続時条件 4 点と route/component regression 通過が完了宣言の前提のまま。**〔D-R1b レビュー起票・配線時に併せて裁定（2026-08-12）〕**: (e) characterSheet feature を app/components へ移設する代替（D-R1b 時点で feature 内 consumer 0・配線で 5 本目の辺 character→characterSheet が必要になる — 辺方式は D-R1 裁定の費用計上に含まれ採用済みだが、5 本目が要る時点で再評価） (f) renderField override は labelledBy を受けないため table layout のラベル契約を override 側で再現できない（JSDoc 記載済み・シグネチャ拡張の要否） (g) h2 二重表示の整理（TFR の section Title order={2} とエディタ/プレビューの見出し階層 — TFR 表示契約の変更を伴うためタブ化スライスから再繰越・2026-08-13）**【S0 司令塔裁定 2026-08-13・事前実測 = review-results/impl-u14/dr2-premeasure.md】** (e) **辺方式を維持**（app/components には eslint zone が無く fail-open — 移設は機械固定の放棄になる実測に基づく。5 本目の辺 character→characterSheet を理由付きで追加） (f) **labelledBy のシグネチャ拡張は不要**（EditClient は override 不使用・TFR 既定描画のみ。残差は preview roll 固有のまま JSDoc 記録維持） (g) **TFR へ headingLevel prop 新設**（既定 2・block は +1。route-states.spec :127-145 の pin は見出し「順序」で、レベル変更は非破壊 — 消費者側の指定は配線側スライスで行う）。F2 clear UX = v1 解（no-op）維持・F3 popover 幅 = 現状維持（#15b/#15c の記録どおり・問題顕在化時に再裁定）。annotation 計量の合格基準 = **式 1 本あたり step 実測 ≤ 10,000**（D-R3 独立予算・h18-bench と同じ step 基準）。**配線スライス分割**: S1（TFR 内部 = UNSAFE 濾過の共有述語化＋headingLevel prop・EditClient 不変）→ S2（annotation step bench・S1 と並行可）→ S3+S4（境界配線＋scalar 描画の TFR 差し替え。toSheetTemplate useMemo・既存 25 pin は assert 不変）→ S5（対話 widget の永続化完成 = 大粒度 #9 Opus H3 残債消化。**〔2026-08-13 S5 裁定・事前実測 = review-results/impl-u14/dr2-s5-premeasure.md〕2 平面は (B) raw 一本化を採用**〔overlay 平面を消し F1 系注入バグの失敗クラスを構造排除・deep-equal は path 駆動 diff（per-path 値は常にプリミティブ）で回避・31 pin は内部表現非依存で反転 2 本のみ〕。**blocker 裁定** = DTO baseValue optional 化〔省略 = 現在値不存在を期待する CAS・service 既存意味論に HTTP 境界を合わせる〕＋競合 echo `current ?? null`〔undefined は wire .nonoptional() が mergeConflict 全体を潰すため〕・select deselect は v1 非提供〔15b(d) 同族・記録〕。**分割 = S5a**〔server/契約〕→ **S5b1**〔front raw 一本化 refactor・挙動不変・31 pin 無改変緑が受入〕→ **S5b2**〔per-path 書込（宣言キー分 — base 分は S5b1 例外で前倒し済み）＋select/boolean 永続化＋conflictApply の (uid,partsKey) 化・pin 反転 :606/:625。**S5a レビュー起票の追加要求（2026-08-13）**: 競合 current: null は「path 不在」として undefined へ復号する規則を select/boolean 含む全対応 field で維持し、mine 選択→JSON 送信で baseValue キー欠落→再送成功を pin する（null をそのまま baseValue に返すと sheetValuesEqual(undefined,null)=false で再競合するため復号が保護線）。**S5b1 レビュー起票の開始条件（2026-08-13）**: front writeSheetPathValue へ server 同様の flat number→base 種付け＋{parts} 全置換 or 他プロパティ温存の差の裁定＋unit pin（非 base 書込解禁の前提）。到達可能化する非 base partsKey 競合の fixture 追加〕。**〔S5b1 裁定済み例外 2 件（2026-08-13・突合 = dr2-s5b1-integration.md）〕**: (1) 宣言 partsKeys の base 編集は per-path payload（旧 whole-field = H3 破壊経路の忠実再現は不整合の再構築で不合理・server 受理実測済み） (2) annotation は退化 raw を engine 意味論で表示（preview と同一・旧 overlay は退化を隠す作用。「壊れたデータが 0 に見える」残差は記録 — engine displayValue 方針は裁定枠）。記録 = readConflictCurrent と readSheetPathValue 非 parts 分岐の byte 重複（共有述語化は S5b2/S6 統合候補）。**記録** = path helper の engine 一本化〔server 移行込み・B12-FIX 同型〕は別スライス裁定枠・同一 uid 複数 partsKey 競合の後勝ちは S5b2 で解消。**〔S5b2 二重レビュー突合 2026-08-13 = dr2-s5b2-integration.md〕**: 相互矛盾 1 件を Fable 実測で裁定（toEqual は own undefined と欠落を同一視 — Codex 正・Opus 観点 3 反証）。FIX-S5B2 = pin 検出力 4 件（削除 pin の toStrictEqual 化・宣言モード未宣言安全キー遮断・種付けケース名不一致・同一 uid 複数 partsKey 競合の逐次合成 pin）＋server base:0 既定差のコメント 1 行。**裁定枠追記** = deriveSheetChanges は wire 表現不能な削除 change（newValue: undefined → JSON drop → DTO @IsDefined 400）を出しうる〔UI 到達経路なしを実測済み・S5b2 新規導入ではない。削除の wire 語彙裁定 or 自由モード列挙の baseline 側和集合除去 = S5b3/S6〕。**〔S5b3 開始条件裁定 2026-08-13〕**: (1) F9（readSheetPathValue 非 parts 分岐と readConflictCurrent の正規化 byte 重複）は **S5b3 へ前倒し統合**〔S5b3 が両箇所に boolean/select 分岐を足すため、S6 送りは重複を先に増やす手戻り — 正規化述語 1 本を sheet-edit.ts へ export し両者が使う。**実装数は 3→1 が正**（handleRendererChange の受理型判定が第 3 の実装だった — S5b3 Opus レビュー実測。「2→1」は起票時の数え漏れ）〕 (2) select 正規化は typeof string のみ〔**options 所属は検証しない** — 語彙検査は template/server 所掌・front は payload 型健全性のみ〕 (3) 競合パネルの boolean 表示 = 'チェックあり'/'チェックなし'〔日本語 UI 統一・String(true) 不採用〕 (4) usesPartsEditor 不変〔parts は number 専用〕・「編集対象の number/text scalar がありません」文言は「編集対象の scalar がありません」へ〕。**〔S5b3 二重レビュー突合 2026-08-13 = dr2-s5b3-integration.md〕**: blocking 0・FIX-S5B3 = select 検出力 pin（options 外通過・null 復号・select mine 再送）＋!field ガード pin 復元（'checkbox' は TFR TextInput fallback で emit する実経路あり）＋readConflictCurrent インライン化（両レビュー一致）＋死条件縮約＋server 非対称性コメント復帰＋**select 競合表示の label 解決**（生値 'journalist' と同画面 Select の label '記者' の不一致 — 裁定 (3) 日本語 UI 統一の select 適用。options 外は String フォールバック）。**記録** = boolean の未設定（キー不在）と false は UI 区別不能で、check→uncheck が見た目同一のまま dirty になる〔clear UX 15b(d) 同族・S6 判断材料・データ破壊なし〕→ S6（後片付け・h2 消費者指定・**isPresentablePartsKey の front 2 サイト 1 本化**〔S5b2 で TFR と sheet-edit に byte 重複が復活 — F9 readConflictCurrent 共有述語化と同枠で 2→1 純減〕・**table layout 宣言モードの base 編集可否**〔合計セル read-only Text の TFR 設計 — 宣言キー編集は S5b2 で復活済み・base のみ残差〕・U14 完了宣言＋大粒度 #17）。**記録** = sheet page の template fetch は templateVersion を無視して最新を素引き（SM-16 の front 側ギャップ・別裁定枠）・TFR に 'use client' なし（現 consumer 全 client で無害・S6 で付与検討）・**S2 ベンチ所見（2026-08-13・レビュー反証済み）**: publish は注釈式を静的見積もりへ加算しない設計（publish.ts:246）のため、静的予算満杯 template＋256 node 注釈式で実 step 10,255 > 独立予算 10,000 が構造的に成立する。超過時は evaluateConstraint が status='error' へ fail-safe 退化（hang/クラッシュなし・最悪 ~4.4ms/回で打鍵毎再評価も安全）。**error 退化を仕様として確定するか publish 側の上限設計を変えるかは裁定枠**（表示専用の退化のため完了宣言には非ブロック。再現 = pnpm run bench:annotation の case 3）・**S3+S4 二重レビュー記録（2026-08-13・突合 = dr2-s3s4-integration.md）**: (i) 暫定リスト追記 = **table layout の宣言 partsKeys field は S4 で編集不能**（S1 の reserved 列除外＋宣言モード合計セル read-only の合成。旧 UI は破壊的だが編集可能だった — S5 で解消必須） (ii) **2 平面構造（EditorValue×raw overlay）の裁定枠**: adapter は S5 で「partsKey 単位の再構築」へ成長する恒久構造（両レビュー独立指摘・同時保持 ~7）— **S5 着手前に raw 一本化 vs overlay 恒久化を裁定** (iii) hasInvalidNumber '' は到達不能な死条件化（TFR は finite number しか emit しない — 15e・clear UX 裁定とセット） (iv) 記録のみ = fieldsByUid 二重生成・受け口型ガードは TFR 契約 drift 防御として許容・宣言 partsKeys の whole-field 競合は current を EditorValue へ表せず「未入力」表示（H3/大粒度 #13 残債の既存面）。**〔S6a クローズ＋大粒度 #17 突合 2026-08-13 = big17-integration.md〕**: S6a = 共有述語 parts-key-visibility.ts 1 本化・table Σ セル popover 統一（base 編集復活 = F-6 解消）・preview headingLevel={3}・TFR 'use client'（a511191b）。#17 二重レビュー（Codex blocking 5 × Opus needs-fix 3＋info 4）を全件実読・実測で裁定。**FIX 3 スライス** = FIX-A〔TFR: 制約評価 error が cap/pool/limit の 3 経路とも非表示（design :287・SM-9(b) 違反・誤 pin 4 群 = spec :664/:733/:828/:846）＋readPartValue の flat number=base 意味論欠落（server readPathValue と非対称）＋table 宣言 popover が canonical 列と二重提示（アクセシブル名重複）〕・FIX-B〔server 競合 echo の base 無正規化 → JSON で own キー消失 → wire nonoptional 違反（safeParse 失敗を実測。S5a blocker 裁定は current のみ正規化していた）〕・FIX-C〔EditClient: 競合パネルが partsKey 無表示で per-path 競合を識別不能＋editable scalar 0 件で TFR 自体を不描画（design :117 違反・computed/roll-only 構成で U14/U15 接続が全迂回）〕。**反転裁定** = computed live 表示は §3.6 Renderer 行に無し（:102 は作成ウィザード節。編集面 computed の「—」表示は裁定枠として記録・非ブロック）・templateVersion badge/新版通知はキャラページ（SM-13）スコープで Renderer 実装項目ではない → 素引き gap は D-R4 へ昇格。**記録** = preview の parts popover は onPartsChange 未接続（読み取り専用・裁定枠）・headingLevel 既定 2 は消費者 0（S0 裁定の意図的既定・据え置き）。完了宣言の再判定条件 = U14 は FIX-C 後・U15 は FIX-A＋FIX-B 後。**〔big17 クローズ 2026-08-13 = dr2-fixbig17-acceptance.md〕**: FIX 全消化 — FIX-A＋AB2（c9c72acf・status 3 経路契約化＋constraint 語彙 rename＋flat base＋popover 除外・合同レビュー pass の nit 5 込み）・FIX-B（da908a48・base null sentinel＋JSON 往復 safeParse pin）・FIX-C＋C2（e4468ab6・partsKey 見出し識別＋TFR 常時描画・レビュー needs-fix 2 = radiogroup 独立解決 pin と fallback pin で消化）。全ラウンド小粒度レビュー＋独立変異検収（計 13 種・全指定検出器で赤・負の対照緑）通過。FIX-C の Opus レビューはユーザー停止 → Codex review へ切替（記録）。post-FIX ゲート実測 = front 536/536・server 3127/3130（赤 3 = L-2 allowlist のみ）・contract 27/27。**→ U14/U15 完了宣言（2026-08-13・§3.6 実装境界表基準）** | **クローズ**（U14/U15 完了宣言済み。残差は D-R4〔(a) 裁定済み 2026-08-13〕・computed live 裁定枠・preview parts 裁定枠として記録済み。**非ブロック裁定枠群はユーザー保留（2026-08-13）** — 急がず後でまとめて裁定） |
| ~~D-R3~~ | **決定済み（2026-08-12 ユーザー裁定）** — 正本 = design-v1-ui H-18（更新済み）・却下記録 = §1-4。前半 = (a) **LIST_ROW_LIMIT 新設（512 仮置き・表上限と同形の単一定数＋options 差し替え）**・後半 = **注釈式の独立予算（式 1 本ごと既定 10,000）を仕様として明文化**。消化スライス = §6-1 #16 | クローズ（実装完了で H-18 完全達成宣言可） |
| ~~D-ST1~~ | **決定済み（2026-08-12 ユーザー裁定）** — front 状態管理方針: **zustand 標準採用は見送り**（再評価トリガー = 離れたコンポーネント間の状態共有の実需要発生時・その際はコンポーネント所有 Provider 形が第一候補）・**produce を setState に入れるだけの immer 導入は不採用**（負荷純増を実測）・**テンプレートエディタ限定で連鎖畳み構造変更＋immer をセット採用**（将来スライス・同乗既定 = §6-1 #17）。正本 = `document/state-management-zustand-immer.md`（調査証跡 = review-results/state-mgmt-study/） | クローズ（#17 着手前に凍結不変条件を §2-2 へ登録） |
| **D-R4** | **sheet 編集面の template 取得が templateVersion を無視して最新を素引き**（SM-16 の front 側ギャップ。D-R2 行で記録 → 大粒度 #17 で影響面拡大を確認し昇格）: D-R2 配線後は layout/blocks/pools/annotation もすべて最新版由来になり、保存済み revision と異なるフォームで編集・保存しうる。選択肢 = (a) pinned revision 解決を front API へ公開・接続（＋取得不能/deprecated の注記） (b) v1 は最新素引きを仕様として容認し記録 **【裁定 2026-08-13・ユーザー】(a) 接続を採用**（実装スライス化して消化する） | U14/U15 の品質残差クローズ・SM-13/SM-16 キャラページ表示との整合 |
| **TR-D1** | **zero-delta 契約と bounds/atBound 一式の去就**（2026-08-14 大粒度 #20 で昇格・突合 = review-results/impl-u14/big20-integration.md）。TR-4b の全経路 advisory 化後、resolveBounds/calculateBounds/WeakMap cache/resolveAtBound/atBound/Discord の ℹ️ 上限・下限・変化なし文言は「宣言 delta が 0 のときだけ到達する経路」へ縮退（両レビュー probe 実測。palette deltas の 0 は publish が受理・押下毎に値不変のまま revision+1・interactionIds 1 枠消費・hub 編集が走る。production/seed に deltas:0 の宣言は 0 件・外部 DB は未確認）。選択肢 = (a) **0 を契約拒否**（publish schema を nonzero 化＋operation ガード。bounds 一式 ≈60 行と ℹ️ 文言が丸ごと削除でき、min>max 422 の ± 残存非対称〔裁定 3〕も自動消滅 — Codex 推奨） (b) 0 を許容し ℹ️ 文言と bounds 一式を維持（文言は「境界が止めた」から「変化なし」系へ要修正・±の zero 押下 noOp 短絡の追加要否も付随）。**裁定 3（min>max 422 撤去）は本件に従属・単独先行させない**（Opus 依存指摘） | ℹ️ 文言/atBound の恒久形・min>max 非対称の解消・TR-5 完了後の残務範囲 |
| 運用 | 未 push 59 コミット（2026-08-12 実測）の push／lint-server required 昇格／rest.http credential（chip task_dedfbb73）／U4 ベンチ | — |

### 5-3. タスク番号の注意

- `#nn` の発番元は**リポジトリ外（chip）**。repo 内の実質台帳は `document/SESSION_HANDOFF.md`（追記型・**L36「現在の feature」/L66「次にやること」は 2026-07-29 時点の古い節**。現況は L1668 以降が正）
- `M` 記号は 4 体系が混在（phase2 Means M-1〜M-7／phase3 Means M3-1〜M3-6／c1 の M1/M2／Next 移行レビュー所見 M1〜M8）。**必ず出典併記**

---

## 6. ループ用ワークキュー

### 6-1. 即時着手可能（人間の決定不要・依存順）

| 優先 | 作業 | 備考 |
|---|---|---|
| 1 | **L-9 残修正**: `AI.character.md:3` のヘッダ日付のみ（PH-7/README/b3/HANDOFF の 4 件は 2026-08-08 修正済み・未コミット） | 修正済み 4 ファイルのコミット可否はユーザー判断 |
| 2 | **L-2 再現 spec の隔離**（round1 H1）: 通常 suite で赤のまま＝full-suite 緑ゲートと矛盾。裁定までは `it.failing` 化 or 隔離 config へ分離する。**裁定そのものはユーザー（§5-2）** | 実測・裁定資料は完了済み（`l2-roll-on-create-adjudication.md`・c 案推奨） |
| 3 | **L-3: OP-1 fast-path の実装**（`phase2-operation-contracts.md:55` 準拠 — baseRevision==現 revision なら比較省略で全適用） | 契約との乖離解消。契約側を変えたい場合のみ人間裁定へ |
| 4 | **L-1 の回帰再現 spec の固定＋裁定資料**（publish 受理⇔評価 throw を挙動記録として固定。実装方向は §5-2 の人間決定 — 「publish 拒絶が保守的」の旧記載は round1 H5 で撤回） | 言語仕様の決定が先 |
| 5 | **#29 再開**（publish 検証の raw Error 500／notation 422 退化。E1b 解消済み） | ブロック解除済み |
| 6 | **裁定資料の作成**: #42（save が publish 規則を全適用する結合）→ #43（dice 判定二重走査）→ #44（参照エラー二重発行・first-error 裁定が先）→ #46（row-level resultType 削除） | 裁定→実装の 2 段 |
| 7 | **#33**（formula/notation/lookup rows の残存増幅・理論 50MB 級・validateId path echo） | DoS 面。優先度引き上げ余地 |
| 8 | 確認系: #48 完了確認／GAP-B 現況／L-10 削除／L-6 実行時ガード追加 | 小粒 |
| 9 | **U14 レイアウトヒント実装**（schema v3 optional 追加 → **publish 検証（preset キー有無の U14 判定・legacy 無視＋警告 = H-9）** → TemplateFormRenderer の 3 プリセット描画（**実装先 = trpg-next-app・新規作成**）→ エディタ UI → 検証タブ警告 → **保存時 canonical 正規化（columns→2・span→1 = H-15）＋ canonical fixture 3 系（Test）**。仕様正本 = `design-v1-ui.md` §2 v1.1 追記＋追補 H-9/H-15・**索引 = §3.6**（Publish/Save/Renderer/Test 行を必ず読む — 2026-08-11 監査で工程脱落を補正）。**〔2026-08-12 消化状況・Explore 実測（file:line 証跡 = 本行の実測メモ参照）〕工程 7 段中 6 段 = 実装済み**: schema（types.ts:28-51 の layout 語彙＋publish.ts:145）・publish 検証 H-9（publish.ts:593-661・warnings のみで非ブロック・spec :821-1020）・renderer 3 プリセット＋モバイル折り畳み（TemplateFormRenderer.tsx・**production consumer 0 = 島のまま**）・検証警告表示（TemplateEditorV3 runValidation → Alert。右ペインタブ化は未 = D-R1 待ち）・保存時 canonical 正規化 H-15（layout-normalizer.ts・適用 3 サイト・**server 側は layout grep 0 = front 保存経路のみが担保**）・canonical fixture（layout-normalization.json 7 ケース・engine/front 両側消費）。**〔2026-08-13 更新〕9-S8 = 済（47aacd4・preset/columns/span 入力 UI・columns 連動 span 選択肢）・右ペインタブ化 TAB-1 = 済（1b0ac9eb）**。D-R1 消化 = D-R1a characterization → D-R1b wrapper 化（5048257）。**D-R2 配線スライス S1〜S6a＋大粒度 #17 FIX 全消化 = 完了（e4468ab6）**。スライス履歴 = review-results/impl-u14/ | **完了宣言済み（2026-08-13・§3.6 基準・D-R2 行の big17 クローズ参照）**。残差 = D-R4（pinned 素引き）・computed live 裁定枠 |
| 10 | **U15 ブロック・上限・プール実装**（schema: blocks/blockId/max/partsKeys{id,label}/pools → engine: 制約評価 API（表示専用・synthetic node は v1 対象外）→ renderer: ブロック見出し・内訳入力・予算バー・警告 → エディタ UI → 検証タブ警告。**〔2026-08-12 消化状況〕エディタ UI = E1/E2 完了（commit 2ee02fe）・検証位置表示 = E3 完了（commit d4302e1）・右ペインタブ化 = TAB-1 で完了（1b0ac9eb・2026-08-13）。renderer 配線 = D-R2 S1〜S6a＋big17 FIX で完了（status 表示契約 = ok/indeterminate「—」/error インライン警告も FIX-A で着地）**。仕様正本 = `design-v1-ui.md` §2 v1.2 追記＋追補 H-1〜H-18） | **完了宣言済み（2026-08-13・§3.6 基準・D-R2 行の big17 クローズ参照）**。残差 = S2 ベンチ所見の error 退化裁定枠（D-R2 行記録） |
| 11 | **SM 画面×状態 共通契約の実装項目**（409 payload に `currentRevision` 追加／`resolveForCreate`・`resolvePinnedRevision` 分離／resource deltas min1＋既存データの防御的除外／ephemeral `canMutate`＋`no-authorized-actions`＋owner/non-owner fixture／SM-1 proof 原子性（4 不変条件・単一プロトコル）／SM-8 の 5 要素／SM-14 データ 4 状態。仕様正本 = `design-v1-ui.md` §3.5・索引 = §3.6） | #9/#10 と並行可。**SM-16 の resolve 分離は本行が所掌**（§3.5 の旧記載「#10 と同キュー」は 2026-08-11 監査で本行へ一本化・二重実装防止）。**SM-7（エディタのモバイル）は v1 非実装で確定**（2026-08-09 ユーザー裁定・追加裁定不要）。SM-6 の再構築 CTA 活性化は L-4 裁定（§5-2）に依存。**〔2026-08-12 消化状況〕deltas min1 = SM-A（8078b06）・防御的除外 = SM-B+R2+R3（872b861/ce7bd7d・実生成 0 件 group の一括被覆へ拡張）・resolve 分離 = SM-C（5d6f1d9）・409 currentRevision の server 側 = SM-D1（77168ff・front theirs/mine＋契約 schema は SM-D2 未着手）・#15d(e) partsKey 語彙 = SM-G（df77159）・追加消化 = 宣言 delta 突合 SM-OP（a063ae5・大粒度 #11 発）。**大粒度 #12（SM-C/D1/G 横断）= 済**: F1（publish が宣言 partsKey id 'prototype' を受理する層間 drift）を B12-FIX（fd4c8be）で消化 — publish へ UNSAFE 拒否＋UNSAFE_UID_KEYS を value-input の UNSAFE_PARTS_KEYS へ一本化＋層間境界 spec。low 4 件の起票と折込先 = big12-integration.md。**SM-D2a = 済（9c8dbb3）**: 409 mergeConflict の契約 schema（sheetMergeConflictSchema・外 .strip()×内 .strict() は裁定済み）＋action 層 parse。**SM-D2b = 済（4d864ed）**: theirs/mine 非モーダル競合パネル（baseline/baseRevision state 化・SM-15 逐条充足を Opus 変異実測で確認・R2 で中核条項 2 件の spec pin 追加）→ **SM-D2 クローズ**。**SM-E = 済（196e629）**: ephemeral canMutate（allow-list `action === 'roll'` = fail-closed・除外前≥1∧除外後0 のみ no-authorized-actions・owner 判定は素の === 1 行で B-13 充足・hub は U9 viewer 中立のまま不変）。**大粒度 #13（D2a/D2b/SM-E 横断）= 済**: 両者 pass・採用 8 項目を B13-FIX（f188370）で消化 — 競合パネル生存規則（非競合エラーで消さない = SM-15 趣旨・Opus medium）・builder status の fail-closed 化（独立収束）・ConflictPanelState 縮約・文言 1 本化・server conflicts 要素の契約型再利用（B-5 縮小）。突合 = big13-integration.md。起票残 = front の parts 付き競合 spec 0 件。**SM-F は L-2 裁定待ちでブロック**（proof/nonce 完全未実装＋消費者 = ウィザード roll step UI 未構築を 2026-08-12 実測 — §5-2 L-2 行）。**SM-8a = 済（06bc38e）**: 保存失敗 5 要素をシート保存経路（saveSheet＋編集クライアント）へ適用 — dirty 保持は reject 経路も try/catch で被覆・catch 先頭 unstable_rethrow で成功時 redirect（promise reject で届く = D2b 確定事実）を透過し regression spec で pin・分類 retryable（断/429/5xx）／恒久（422）・single-flight は form 直 submit も遮断・再試行は最新 dirty＋空 changes disabled・ネットワーク断は定型文 1 定義で生 ECONNREFUSED 非露出（Opus needs-fix 6 件を R2 で消化。自動 backoff/Retry-After は延期列のまま未実装）。**SM-14a = 済（813beb1＋FIX 8afae4e）**: データ 4 状態を character レーン 2 route へ — loading.tsx（skeleton・route 層のため進行系 CTA は構成で非 mount）＋error.tsx（共有セル CharacterDataLoadError 1 枚＋薄い再 export。定型文＋**retry() 手動再試行（Next 16 の reset() は再 fetch せず空振り = Opus F-1 実測・retry 1 回/reset 0 回を spec pin）**・生 error.message 非露出を spec 固定）・getCharacterListData の畳み込み解消（JWT なし/401/403 = 未認証 soft degrade セル維持・network 断/5xx = re-throw で取得失敗セルへ分離。旧 app loader 契約 pin spec は置き換え済み・dead field error は削除）・sheet page の 401/403 は /login redirect（requireJwt は cookie 存在チェックのみ = 期限切れの通常経路）・refreshCharacterList の生文字列も定型文化。**残 F-2 = backend 全断のハードロードは /user layout の getAuthState が全例外を握って /login redirect し取得失敗セルへ到達しない（soft nav では機能する）→ SM-14c**: getAuthState は throw せず degraded フラグ返却（react cache() が全消費者へ同一結果を配るため throw だと公開面の soft degrade まで壊れる）・/user layout のみフラグで throw・root app/error.tsx（共有セル再利用）で受ける。**SM-14c = 済（1f4d47d）**: 取得失敗セルのハードロード到達性 — getAuthState は throw せず degradedByInfraFailure フラグ（cache() が全消費者へ同一解決値を配るため throw は公開面 soft degrade を壊す）・/user layout のみフラグで throw・root app/error.tsx（共有セル DataLoadError・retry 配線）。**大粒度 #14（SM-8a/SM-14a+FIX/SM-14c 横断・二重レビュー）= 済**: 突合 = big14-integration.md。採用 8 項目を FIX-A（1013a7a: 競合 path の保存時除外で SM-15「他 path 保存継続可」を実効化・fail-back 両経路の旧パネル破棄統一・3 点同時成立 pin・per-path CAS コメント）と FIX-B（01cd3df: discord 露出 guard・一覧 401/403 redirect 化＋到達不能 soft degrade 分岐と英語ブロック削除・GENERIC_NETWORK_ERROR_MESSAGE へ rename し api-response.util へ co-locate・app/loading.tsx）で消化。**確定した現状維持 = 401/403 述語と join の 1 本化は両レビュー独立に No-Go**（3 サイトは outcome が全て異なる意図した差・変異で drift 検出可）。**server の競合判定は per-path baseValue CAS で baseRevision は情報値**（整数検査のみ・O-F4 実測）。却下 = 枠差（Next 構造制約）・GET への 422 分類（YAGNI）。**SM-14b = 済（556fa1f）→ SM-14 クローズ**: templates レーンへ確立パターン適用 — loading/error 4 ファイル（error は DataLoadError 薄い再 export）・getTemplateListData 分類化（401/403 redirect・error フィールド廃止・TemplateListV3 の server error prop 削除）・エディタ page 401/403・templates actions 5 sink の network guard（大粒度 #14 記録の露出閉鎖）。**SM-8b = 済（a6acf46）→ #11 の着手可能分クローズ（残 = SM-F の L-2 裁定待ちのみ）**: autosave へ 5 要素適用 — retryable 分類（messages 空配列の実在経路も定型文フォールバックで閉鎖）・**既存の無限自動再試行ループ（失敗→dirty→debounce 再送の循環 = 延期列違反）を停止**（同一内容は自動再送しない・編集で再開・spec は debounce 3 倍経過で送信 1 回を pin。〔B15-FIX-A `230a263` で機構を更新: failedSignatureRef 等 3 分割 → 単一 SaveFailure union＋正規化 payload 基底の署名一致導出。SM-8b 実装は非正規化 draft で停止が効かない F-2 があり FIX-A が解消〕）・手動再試行（元 intent 保持・422 には出さない）・失敗中バナーの正直化（「autosave 待機中」の嘘を分岐で解消）・conflict/publish/signature 突合は不変** |
| 12 | **U16 シート公開設定の実装**（schema: `sheet.visibility`＝api-contract `.strict()` への追加必須・persistence・materializer 素通し・repository read 境界の正規化 → save: 専用 enum DTO＋所有者条件付き単項更新 → summary read model（DTO/wire/projection select＋mapper）→ renderer: トグル＋Discord 非連動注記・一覧バッジ・編集導線。仕様正本 = `design-v1-ui.md` §2 v1.4・索引 = §3.6 の Schema/Save（U16）/Renderer（U16）/Test 行） | #9/#10/#11 と並行可・依存なし。**公開読取経路は作らない**（fail-closed・拘束条件は §2 v1.4）。監査 round1〜3 収束済み（pass）。**〔2026-08-12 消化状況〕スライス分割 = a 語彙導入／b summary read model／c 保存専用操作／d renderer。U16-a = 済（c51b1fa）**: 契約へ required 追加（optional は front へ undefined が漏れるため不採用）・read 境界 normalizer（normalizePersistedCharacterSheet を repository normalize 合成点 2 箇所へ・summaries 以外の全経路被覆・欠落/unlisted/不正値→private）・materializer 2 箇所の明示コピー・新規作成 private 固定・Discord 非連動の負 assert。**U16-b = 済（a5dc046）**: summary read model へ visibility（required・sheet 欠落 legacy も fail-closed で private）。値関数 normalizeSheetVisibilityValue を read mapper へ切り出し entity 正規化と summary inline mapper が 1 定義共有（述語複製 2→1）。select・DTO・Wire・summaryRuntimeKeys 同時更新・public/欠落/legacy の 3 ケースを repository/http 契約/実 DB 統合で pin（実 DB 統合 spec は Docker ゲート持ち）。**U16-c = 済（e4b0811）**: PUT :id/sheet/visibility（既存 CRUD controller・所有者のみ・404 統一〔非所有者/不存在/sheet 未保有〕・422 は service 層明示 throw〔pipe 422 化は app.module pin が禁止〕・単項 $set は revision 不変を spec pin）。F-8 折込 = characterSheetVisibilitySchema/CharacterSheetVisibility を contract へ新設し無名 union 3 箇所＋mapper 許可リスト＋service 422 判定を 1 定義から導出（第 3 値の黙示 private 降格 = 型ゲート欠如を閉鎖）。**U16-d = 済（3a70c84）→ #12 の実装スライスは全完了（残 = 大粒度 #16 の消化のみ）**: renderer — 公開トグルは新規独立 client component（非楽観更新・送信中 disable・FIX-B 形整形・成功時一覧 revalidate・固定注記は共有定数でトグル/バッジ Tooltip 共用）・シート編集クライアントは 1 行も不変（干渉回避の拘束充足を diff で検収）・一覧バッジ両状態表示・シート編集 Button を hub ガード外へ（仕様 :89 全行導線）。**fix1 で退行を差し戻し**: 指示書の「Discord ActionIcon は hub ガード内のまま」は Explore 要約未検証の誤前提（HEAD は無条件表示）で、実装が ActionIcon をガード内へ移動＋spec が退行を pin していた — メモリ verify-claims-before-prescribing 21 に記録（front 416→434）。**大粒度 #16（U16-b/c/d 横断・二重レビュー）= 済 → キュー #12 クローズ（2026-08-12）**: 両者 blocking なし・相互矛盾 0。採用 5 項目を FIX-BIG16（6ee13e0: front label/color の単一 Record 化＋options/色導出・server 422 文言の schema.options 生成・summaries/配列 read 経路の raw 未知値 spec 2 本〔変異検収を実装者と Fable が独立実測〕・Tooltip touch/focus・repository filter の why コメント）と FIX-LINT（b2b3514: SM-G 由来 lint error 3 件 = 層間境界 spec の受理/拒否分割・server lint error 0 復帰）で消化。不採用 = route 面 pin spec（B-20 として §2-2 へ規約登録）。記録 = updatedAt/並び順波及（既存規約と整合）・front runtime ガード欠如（到達不能）・「sheet 保有」述語 4 綴り 16 箇所（既存分散・裁定枠）。突合 = big16-integration.md |
| 13 | **大粒度 #7 残債（記録済み・低優先）**: (a) layout preset 判定 3 実装＋集合機構 3 方式＋`SECTION_LAYOUT_PRESETS` 二重定義・`GRID_COLUMNS` 名 drift・三者一致 spec なし（layout-resolver:17-22 / layout-normalizer:46-50 / publish:593+596） (b) validateField 位置引数 10 の ValidationContext 化 (c) F9/F10（[uid,id,id] 潰れ・2 キー版未命名）・F11（正規化テスト非対称） | 出典 = big7-integration.md。renderer キュー（#10 残り）より後段。(a) は U14 隣接なので renderer 配線時に再評価 |
| 14 | **publish は section id の重複を拒否しない**（U15-R1b レビューで検出・2026-08-11 Fable 経路裏取り: 一意性ゲートは canonical path と uid のみ〔publish.ts:176/:529〕— field id が異なれば同名 section 2 個が ok:true で通過し published データに到達しうる）。拒否を追加するか許容を仕様化するかの裁定が要る。renderer 側は R1b round2 で index 対応 join にして越境済み | 新規 publish 拒否 = 挙動変更（B-15 の passthrough 意図と別軸）。エディタが section id をどう生成するかの実測とセットで裁定 |
| 15b | **U15-R2c の v1 保守裁定（2026-08-11・大粒度 #9 で (b) を訂正）**: (a) parts:true の**新キー追加 UI なし**（H-11 に追加手段の言及なし。実運用で問題になれば裁定） (b) **〔訂正〕stack の parts 宣言 field も合計＋Popover へ**（BIG9-FIXB）— 旧記載「stack = base 昇格の現行維持」は前提誤り: sheet-edit :44 は `field.parts` のときのみ partsKey:'base' で、**宣言型は whole-field 書込 = parts オブジェクト全消失経路**（大粒度 #9 Opus H3 実測・spec:1280-1290 が固定していた） (c) popover の other 行は**表示のみ**（Discord 書込チャネル維持） (d) **emit は数値のみ・Select の null（deselect）も emit しない**（undefined・途中入力文字列・null を emit しない — clear/deselect は v1 no-op。H1〔@IsDefined 下流〕/H2〔負値逐次入力〕/F5〔allowDeselect 既定 true〕の v1 解。**実測済み残差**: clear 後は表示 ''×モデル旧値の無言乖離が blur でも復帰しない〔react-number-format が prop 不変時に内部 state を上書きしない・データ破壊なし・FIXB 実ブラウザ実測〕— D-R2 配線時に clear UX（blur resync vs 削除 op）とセットで再裁定）。**〔2026-08-12 追記〕D-R1b の preview wrapper 化（軸 2 = TFR 意味論採用）で preview も同挙動になった**（clear 後 表示 ''×state 旧値。表示 assertion を pin 復元し既知乖離として明示 = dr1b-fix） | 出典 = big9-integration.md・big9-fixb-integration.md |
| 15d | **FIXA 二重レビュー裁定（2026-08-11・big9-fixa-integration.md）**: (a) parts 検査は**生 value.parts の own entries** が対象（zod z.record は own __proto__ を黙って落とし、下流へは元参照が渡る — 検査対象と実データを分離させない） (b) **UNSAFE parts key（__proto__/constructor/prototype）は全モードで input 拒否**（旧 publish UNSAFE_UID_KEYS の parts キー面延長。B12-FIX で定数は value-input の UNSAFE_PARTS_KEYS へ一本化済み） (c) 方向規律 = **fail-open（input 受理×runtime 拒否）は全閉鎖・fail-closed（逆）は許容して記録** — evaluator/annotation-runtime が数値特殊キーを受理する残差は到達 producer なし（input 遮断後）で本体不変 (d) base/other 予約は package 内 1 定義（旧 = publish:41 と value-input:85 の二重リテラル） (e) server op 層の partsKey 語彙検査（partsKey:'__proto__' の無言 no-op × appliedChanges+=1 — Opus F5・既存機構）は SM キュー #11 の裁定枠へ | 消化 = FIXA-R2 |
| 15c | **大粒度 #9 の記録・裁定枠**: (a) table 宣言キー行は base/other 不可視のまま合計に算入（M2 — 合計が見えている列の和と一致しない UX。読み取り専用 Popover 案は次期） (b) parts 列のある表に**非 parts number scalar 行**が来ると colSpan 結合で合計列が消える（H-16「持たないキーは空欄」との整合未裁定） (c) .tableScroll の Popover クリップ懸念は**実測で否定**（M1・hideDetached 挙動は妥当）(d) sentinel fixture・多列 colSpan・実ブラウザ E2E の spec 拡充は保留 (e) **table 内 parts:true の合計トリガ × width="target" は 55px dropdown/38px 入力になる**（FIXB 実ブラウザ実測・溢れはなし = H4 閉鎖済み。min-width clamp は H4 再設計を伴うため D-R2 隣接の裁定枠） | 出典 = big9-integration.md・big9-fixb-integration.md |
| 15e | **sheet 編集画面の number 欠落値と保存ボタンの無言ブロック（SM-D2b レビュー F-1・2026-08-12）**: hasInvalidNumber は `values[uid] === ''` のみ検査で、undefined（退化データの初期ロード・theirs で型不一致 current 採用）は素通り → ボタン enabled のまま required 制約検証が送信を無言ブロック（押せるのに何も起きない）。機構は D2b 以前から存在・D2b は theirs という到達経路を 1 本追加しただけ。修正は undefined を検査へ含める＋required 行の扱いとセットで別スライス | 出典 = opus-review-sm-d2b.md。同 doc に F-4（到達不能防御 2 つ・onChange の handler 切り出し候補）・F-5（presentSaveResult の合流形）も起票済み |
| 16 | **〔消化済み 2026-08-12・commit 5ba01e6〕D-R3 実装**: LIST_ROW_LIMIT 512・評価/欠落検査とも先頭 512 行へ一様化・**保存境界は list 値全拒否のまま**（round1 の無検証受理新設は R2 差し戻し — 受理導入は将来スライスで行内容検証〔itemFields 準拠・UNSAFE キー封止〕とセット）・見積もり行項＋行項 0 pin・**listRowLimit 公開オプションは撤去**（二重レビュー Opus F3: 行上限を設定しない見積もり倍率・caller 0・YAGNI — 再導入しない）・独立予算 pin（9,043 step/回・余裕 957 が load-bearing）・h18-bench に list ケース。記録: nested list は見積もり二乗になるが独立拒否（list inside list）が先行するため無害・重複診断のみ | H-18 完全達成宣言可。残 = 台帳 #15d(e) の server op 層 partsKey 語彙検査（SM #11） |
| 17 | **ST-B2: テンプレートエディタの連鎖畳み構造変更＋immer 適用**（D-ST1 決定 2026-08-12・正本 = `document/state-management-zustand-immer.md` 推奨 3）。既定 = **次にエディタの更新ヘルパ群を触るスライスへ同乗**・単独先行はユーザー判断。着手前ゲート = (a)「エディタの template は凍結されて流れる」を §2-2 へ登録 (b) produce はカリー形か直接形の 1 形に統一 (c) 対象は TemplateEditorV3 のドラフト更新ヘルパ群のみ・**シート編集クライアントは対象外**（spec 固定の状態機械・ネスト更新は最深 2 段 1 箇所のみ） | 負荷実測 = 同時保持 7→5・再構築式 5→0・新規 API +2。immer 単独は逆効果（B1 実測）のためセット必須 |
| 15 | **大粒度 #8 の設計の穴（記録・裁定枠）**: (a) **H-13 は max/cap/total の符号を縛らない** — 負の有限 total/consumed で「バー 0%＋超過 5」「残り 14/10」の直感矛盾表示（実測・算術的には真値。publish で負 total を弾くのは挙動変更） (b) **scope 付き pool の予算バー配置が設計未規定**（v1 は section 冒頭固定 — どのブロックの予算か視覚帰属なし。エディタ/プレビュー系で再裁定） (c) F13/F15 保留（props object 化は両レビュア実測で便益不足・data 属性粒度不揃い） | 出典 = big8-integration.md。非有限 remaining は BIG8-FIXA で error 退化済み（こちらは消化済み） |

| 18 | **Discord プレビュータブ**（エディタ右ペイン 3 枚目・契約 4「両プレビュー常設」の完全充足。正本 = design-v1-ui.md :45-56・:61-62〔ViewModel の warnings も表示・「ここで見えるもの＝実機」〕） | TAB-1（右ペインタブ化・2 枚）の後続。**packages/sheet-projection は実装済みだが trpg-next-app に依存辺がない**（package.json deps に無し・front import 0 件 — 2026-08-13 実測）。追加は新規依存＋feature 境界整備（AI.md 有向辺＋eslint）を伴い D-R1b 同格の独立スライス |

### 6-2. 決定後に解禁される本流（D-P3-1〜4 の決定後）

依存は一本道ではなく **DAG**（`phase3-goal-contract.md:57-62`・round1 M5 で訂正）:
**M3-1**（engine 4 型完成）が先行し、その後 **M3-2**（Web ブロック UI＋Discord handler — 実装先は Next（Server Action/RSC）。phase3 契約は Remix 前提のまま書かれており更新が要る）／**M3-3**（migrate）／**M3-4**（/create-character・**I-1 で凍結してきた commands.list に初めて触る最大リスク点**）は**並行可**。**M3-5**（残置解消: G3-6 listener registry 化ほか）は**独立・いつでも可**。**M3-6**（legacy-coc v2: skill=list）のみ **M3-1＋M3-3 依存**。

front の消化区分（round1 H8 で「Phase 3 と独立」の過大判定を訂正）:
- **独立着手可（既契約の未消化・Phase 3 スコープ外）**: キャラシート画面への computed ライブ表示（三面契約「同一評価器」の未消化。TemplatePreviewV3 の実証済みパターン移植）
- **D-P3-1 決定後（Phase 3 の G3-1/M3-2 の対象 — 独立着手しない）**: list 編集 UI・lookup table グリッドエディタ等のブロック UI（track UI は L-2 (c) 付帯裁定の TR レーンで 2026-08-14 前倒し完了 — Phase 3 対象から除外）

### 6-3. ループ運転規則（fable-rules 準拠＋2026-08-04・2026-08-12 運用変更）

- Fable はコード・レビュー本文を書かず Opus/Codex へ委譲。委譲プロンプトには **§2-4 の不変条件定型文＋変更範囲＋触らない範囲＋検収コマンド＋stop 条件**を必ず含める
- **コード委譲には code-comment-rules 準拠のコメント記載を必須で指示する**（2026-08-12 ユーザー決定・正本 = fable-rules 実装フェーズの統制）。Why/Invariant/Boundary/Exception/External contract/Test intent を書き、what コメント禁止は維持
- 認知負荷レビューは全フェーズ必須。**大粒度俯瞰は feature 完了時のみ**（3 フェーズ毎は廃止）。low 所見は起票のみで処理義務なし
- レビュー・調査エージェントは読み取り専用。検収はスライス開始/終了の `git status --short` 差分比較（恒久例外の文字列固定はしない — round1 H9）
- feature 完了時は `document/SESSION_HANDOFF.md` 全面更新が必須ゲート
