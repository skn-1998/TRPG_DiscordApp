# キャラクターシート基盤 設計台帳（ループエンジニアリング用）

作成: 2026-08-08（読み取り専用監査 7 本の統合: 設計文書コア / sheet-engine / front / サーバ実装 / Discord・projection / 未決事項 / 契約・不変条件）
監査: Codex adversarial レビュー **round1〜3 で収束（round3 = pass・findings 0）**（2026-08-08・reviewed at HEAD `ee013820`・証跡 = `review-results/design-ledger-review/`）
対象: schema v3・`packages/sheet-engine`・`packages/sheet-projection`・`packages/api-contract`・TRPG-SERVER の character 系・`trpg-next-app` front・Discord hub

> **本台帳の位置づけ**: ループ（反復的な AI 委譲作業）が「何をしてよいか・何に触ってはいけないか・何が未決か」を 1 箇所で引けるようにするスナップショット＋索引。
> **権威の分離（round1 H2 で改訂）**: **現挙動の事実**の正本は実コード。**意図契約**の正本は承認済み契約文書（design-v1 / design-v1-ui / phase2-goal-contract / phase2-operation-contracts）。両者が衝突したら**どちらかを自動的に「正」として追認しない** — 乖離として停止し人間の裁定へ回す（実例: L-3 = OP-1 fast-path 契約 vs 実装）。本台帳は最下位のスナップショット — 乖離を見つけたら本台帳を直す。

---

## 0. 現在地（2026-08-11 実測・基準 commit `1b23430a`）

| 項目 | 状態 |
|---|---|
| Phase 1（engine・template ドメイン・Web エディタ実 API 化） | **実装完了**（AI.character.md 追記6） |
| Phase 2（hub・palette・Discord ±・worker） | **実装完了・受入未了**。PH-7 実機受入（D-3・ユーザー実施）の全 16 チェック項目が `☐` のまま（`phase2-ph7-acceptance-checklist.md`） |
| Phase 3 | **未着工**。`phase3-goal-contract.md` は DRAFT v0.9。着工前提 = D-3 通過（I3-3）＋決定点 D-P3-1〜4 のユーザー決定 |
| 本番 DB（2026-07-30 read-only 実測・`review-results/task28-23-data-survey/`） | シートテンプレート **0 件**・materialized キャラ **0 件** ⇒ **2026-07-30 時点の観測では DB 上の移行対象なし**。ただし published 構造不変契約・front の `@trpg/api-contract`/`@trpg/sheet-engine` 依存・wire/契約 spec の互換制約は**残る**。破壊的変更の前には**再計測＋人間承認**（過去のスナップショットを現在値扱いしない — round1 H3） |
| git（**生成時刻つき診断 — 検収条件に使わない**） | 2026-08-11 時点: HEAD `1b23430a`（U14〜U16/SM 設計確定 `7a79246d`＋doc 追随＋skills を push 済み・origin/develop と一致）・作業ツリーは untracked `?? trpg-remix-app/`（旧 app 残渣・**ユーザー裁定で削除しない**・コミット対象外）を除きクリーン。**この行は同日中にも陳腐化する**。検収はスライス開始時と終了時の `git status --short` 比較で行う（round1 H9） |
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
| B-5 | server DTO ⇄ api-contract interface の同形は「S5 で機械固定**予定**」のまま未実装 | コメントを「固定済み」と誤読しない |
| B-8 | **characterId / discordUserId の update 不変は `convertUpdateDtoToCharacter`（`character.service.ts:61-77`）の allow-list の副作用のみ**。負のアサーション spec ゼロ | **最優先明記**。スプレッドへ「簡略化」すると全緑のまま書換可能になる |
| B-9/B-10 | **欠番（round1 で REFUTED）**: `$literal` と `findByChannelId` の `.select()` はどちらも spec 固定済みと判明 → **§2-1 へ移動** | — |
| B-11 | front eslint zone は 5 feature の**列挙で fail-open**（新 feature には zone を 1 本足す） | `trpg-next-app/AI.md` |
| B-12 | **allow-list の更新漏れ側だけが未固定**: api-contract に新しい公開型を追加しても `allowImportNames` は自動追随しない（足し忘れは front から import 不可として現れる）。既存 16 名の機械強制は §2-1 へ移動（round2 で分類訂正） | 追加時に `trpg-next-app/eslint.config.mjs:17-34` へ 1 行足す規約のみ |
| B-13 | **所有者の存在は DB 非強制**: `discordUserId` は Mongoose 上 `required:false, default:''`（`character.model.ts:30-31`）。「全キャラに所有者がいる」は作成経路（JWT 注入）の規約頼みで、**空文字所有者の文書が型・永続化の両層で表現可能**（2026-08-11 台帳監査で追加） | #11/#12 の owner 判定・fixture はこの前提で書く。空文字にマッチする恒真クエリを作らない。安全方向は fail-closed（空文字 owner は誰の owner-scoped read にも一致しない） |
| B-14 | **`characterSheetStateSchema` は `.strict()` 4 項目**（`character.zod.ts:27-34`）で、repository が書込時に parse（`character.repository.ts:129,145`）。**Mongoose（`@Prop({type:Object})`）は通るが Zod 境界で実行時 throw するねじれ** | #12 の visibility も #10 で sheet にキーを足す場合も、api-contract・persistence・materializer を**同時に**更新する（§3.6 Schema 行が正本） |
| B-15 | **sheet-engine publish の template schema は全域 `.passthrough()`**（`publish.ts:58-99`・`sections[].layout` は `z.unknown()`）。未知キー・綴り違いは**黙って受理され全緑のまま素通り** — 検証は明示的にコード化した分のみ効く。これは**意図的設計**（§1-4: field 直下 secret の単独拒絶 不採用の裁定） | #9/#10 で「堅牢化」として `.strict()` 化するのは禁止。新フィールド（layout/blocks/partsKeys/pools）の検証は明示的に追加する |
| B-16 | **Character @Schema ⇔ CharacterEntity の同期はコメント頼み**（`character.model.ts:14-17`）で、zod parse 境界は materialized create/save/template pin の **3 経路のみ**（`character.repository.ts:129,145,177`） | #12 が新設する visibility 単項更新に parse/検証境界を必ず置く（`$set` 直書きの素通り経路を作らない） |

### 2-3. 統合禁止の二重実装（「重複だから」と 1 本化しない）

- `isPartsValue` engine 版（緩・非公開）⇔ server 版（厳格）— 真理値が割れる入力は仕様
- 一意性検査の 3 層（front v3Template / engine publish / server projection-key-validation）
- `TABLE_ROW_LIMIT=512`・palette cap 512・SOFT_CAP=128 の**値一致は偶然 — 統合禁止**
- characterThread の `skillName (skillLevel)` 書式は palette ラベルと別機能・対象外
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
| roll / standalone roll（3d6*5） | ✅ | ⚠️ rollOnCreate 契約外（L-2） | ✅ notation 編集 | ❌ | ✅ palette roll |
| lookup table（CoC DB） | ✅ 範囲表・resultType dice | ✅ | ⚠️ 生 JSON textarea | ❌ | ✅（notation 差し込み経由） |
| track（min/max/thresholds） | ✅ clamp（formula max は server 責務） | ✅ TrackRangePolicy | ❌ 作成 UI なし | ❌ | ✅ res_ ± |
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

**フロントの構造的な蓋**: `V3EditorFieldType`（`trpg-next-app/app/features/characterTemplate/types/v3.ts:9`）が scalar 系＋computed＋roll に限定。track/list/relation/tag は「型は素通しするが作成・編集できない」。キャラシート画面（`CharacterSheetEditClient`）は `editableScalarFields` の filter（`sheet-edit.ts:10-17`）で number/text に退化。`evaluateTemplate` の front 使用は TemplatePreviewV3 の 1 箇所のみ。

---

## 4. 既知バグ候補・乖離（L-番号は本台帳の採番）

| ID | 内容 | 根拠 | 扱い |
|---|---|---|---|
| **L-1** | **dice 断片の `+` 連結が publish 通過→評価時 throw**。`'+1d4' + '+1d6'` は inferBinaryType が dice を返すが evalBinary は無条件 expectNumber。回避は notation 側連結（`1d8{a}{b}`）。回帰テストなし | `publish.ts:469-472,647-651` ⇔ `evaluator.ts:297-299,470-475` | **人間決定点（round1 H5 で昇格）**: publish 側の文言は連結を意図的に受理しており、拒絶は公開言語の縮退になる。回帰再現の固定と裁定資料まではループ可（§6-1） |
| **L-2** | **rollOnCreate が engine 契約外フィールド**。instantiation は `field.rollOnCreate` を参照するが RollField 型に存在せず（passthrough で素通り）、**legacy-coc seed の roll には無い＝作成時ロール不発を実証済み**（2026-08-08 再現 spec 3 red / seed 整合ガード 1 green・感度確認済み）。roll 値は提出不可・事後書込不可のため不発＝修復経路なしの永久欠落 | `character-instantiation.legacy-coc.reproduction.spec.ts`・`l2-roll-on-create-adjudication.md`（事実チェーン 10 項） | **裁定待ち**（a 型昇格 / b seed 付与 / c 常時ロール。資料は c 推奨）。実装は裁定後 |
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
| **L-2 裁定** | rollOnCreate 修正方針（a 型昇格／b seed 付与／c 常時ロール — 裁定資料は c 推奨） | 再現 spec の赤解消・D-3 の作成時ロール受入 |
| **L-13** | legacy-coc テンプレートの DB 投入方法（手動 publish or seeder 新設・所有者/version） | D-3 §0 事前準備の実行可能性 |
| **L-1 裁定** | dice 断片 `+` 連結の言語仕様（publish 拒絶=公開言語の縮退 or evaluator 連結対応） | L-1 封鎖の実装方向 |
| **D-P3-1** | Phase 3 スコープ (a)コアのみ／(b)＋U5／(c)＋v1.x（declare/when） | M3-1〜M3-6 の範囲 |
| **D-P3-2** | 作者ピン留めフラグを schema v3.1 で追加するか | README 未決 15・先頭 20 縮退の解消 |
| **D-P3-3** | 投影廃止ゲートを Phase 3 exit に含めるか | 旧 skill_/ability_ 段階廃止 |
| **D-P3-4** | migrate は一括ウィザードかキャラ単位オンデマンドか | M3-3 の設計形 |
| I3-1 追認 | GM/権限・共有シート P14・リセット発火権限・SW lookup 拡張を Phase 3 に**入れない** | Phase 3 境界 |
| C1 確定 | 結果連動エフェクト（`chk_`）の v1.x 採用 | c1 実装着手 |
| README 未決 5 | 公開ギャラリー未認証閲覧（Phase 4） | 認可設計 |
| README 未決 10〜14 | selectedRow／Discord トグル／relation live 参照／FATE 型 resetTo／declare | v1.x 拡張 |
| **D-R1** | **TemplatePreviewV3 統合の裁定**（2026-08-11 大粒度レビュー #2）: (a) AI.md へ理由付き有向辺 characterTemplate→characterSheet を追加し eslint except 同期・preview を state/evaluator/dice の wrapper 化して入力描画を TemplateFormRenderer へ委譲（**レビュー推奨**。挙動差 7 点の characterization が前提・費用 = 4 非 test artifacts＋cross-feature hop 0→1・便益 = scalar widget 編集先 2→1・S8 で layout 再複製回避）／(b) 統合見送り・重複容認＋scalar 4 valueType の共有部分を両 component で固定し二者更新を受入条件化 | **統合スライスと 9-S8（エディタ UI）の着手**（9-S7 モバイル折り畳みは独立・先行可） |
| **D-R2** | **U14 renderer の作成・編集面への配線裁定**（2026-08-11 大粒度レビュー #4 high）: TemplateFormRenderer は production consumer **0 件**（spec のみ）で、実 runtime 経路 CharacterSheetEditClient（`app/features/character/`・sheet page 配下）は layout 非消費の独自描画。配線には **AI.md へ有向辺 character→characterSheet 追加＋eslint characterSheet zone の except へ './character' 追記**が必要（現 zone は characterSheet 自身のみ許可 — D-R1 と同類のモジュール境界裁定）。レビュー勧告 = TemplateFormRenderer を controlled renderer として接続し**第三の描画実装を作らない**・接続後に route/component regression 通過まで U14 完了扱い禁止。**接続時条件（U15-R1b レビュー Low・2026-08-11）**: values は immutable 更新・無関係な親 render では参照を安定させる（annotation useMemo の deps = [template, values] が参照同一性前提。毎 render 新 object だと D-R3 未計量経路が毎打鍵で再評価される）・接続時に annotation 評価時間を計量する | **U14 の feature 完了宣言**（#10 U15 の engine 系スライスは非依存・続行可。preview 面は D-R1 が所掌） |
| **D-R3** | **H-18 不変条件と list 行数の設計ギャップ**（2026-08-12・10-S4 委譲先が停止条件で正しく検出）: H-18（design-v1-ui :328-338）は「publish 通過物は step 予算 10,000 内で必ず評価完走」＋「最悪コストに list 行の反復評価を含める」を要求するが、**行数は runtime データで無制限**（evaluator.ts:61 は全行取込・実測 = AST 1 でも 10,001 行で step 超過）。行 computed が 1 個でもあれば静的上界は無限になり不変条件は現状定義のまま**達成不能**。選択肢: (a) **list 行数上限を新設**（TABLE_ROW_LIMIT=512 の list 版・保存/評価境界で cap → publish 指標に rowCap×行 AST 項を追加できる）／(b) **不変条件のスコープを静的部分へ縮める**（行反復分は評価時 step 超過の既存退化に委ね、H-18 の文言を修正）／(c) 行 computed の一律拒否（CoC 技能リストが典型ユースケースのため実質不可）。**静的部分の集約上界＋1,024×11 回帰は (a)(b) 共通部分として先行実装**（10-S4a）。**第二のギャップ（2026-08-11 大粒度 #6・Opus 実測）: 注釈経路が計量チャネル外** — estimate は注釈式を静的加算するが、H-7 表示評価は evaluateConstraint ごとに**既定 10,000 の新規予算**を取得し（constraint-evaluator の evaluateExpression 呼び出しが limit 未指定）、共有されない。publish 通過反例 = computed 20×201 node＋全参照 max 注釈 150＋pool total 1 → estimate 9,909・ok=true・evaluateAnnotationRuntime 1 回で**含意 612,909 step / 287ms**（5 連続 evaluateConstraint 5/5 ok = 非共有の直接証明）。さらに track.max は server TrackRangePolicy が別呼出しで評価・track.resetTo は評価系なし（C-1）。**裁定には「注釈経路へ予算を伝播するか・注釈数×閉包サイズを静的指標へ加算するか・現状（呼出し毎予算）を仕様として明文化するか」を含める**こと。裁定前のコード変更禁止（現時点の本番露出 = 0・renderer 配線で顕在化）。**追加決定材料（2026-08-11 大粒度 #8・Codex 実測）**: 現実規模 template（6 sections・120 fields・156 constraints）の evaluateAnnotationRuntime 1 回 = **median 1.864ms / p95 2.135ms**（500 回試行）— renderer は useMemo 配線済みで毎 values 変更ごとに 1 回。実測上「現状を仕様として明文化」案の負荷面の障害は無い。接続時条件（values 参照安定）は D-R2 行に記録済み | **H-18 不変条件の完全達成宣言と 10-S4 のクローズ**（10-S4a 静的上界・10-S5+ 評価 API・renderer 系は非依存で続行可） |
| 運用 | 未 push 8 コミットの push／lint-server required 昇格／rest.http credential（chip task_dedfbb73）／U4 ベンチ | — |

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
| 9 | **U14 レイアウトヒント実装**（schema v3 optional 追加 → **publish 検証（preset キー有無の U14 判定・legacy 無視＋警告 = H-9）** → TemplateFormRenderer の 3 プリセット描画（**実装先 = trpg-next-app・新規作成**）→ エディタ UI → 検証タブ警告 → **保存時 canonical 正規化（columns→2・span→1 = H-15）＋ canonical fixture 3 系（Test）**。仕様正本 = `design-v1-ui.md` §2 v1.1 追記＋追補 H-9/H-15・**索引 = §3.6**（Publish/Save/Renderer/Test 行を必ず読む — 2026-08-11 監査で工程脱落を補正） | 新機能（バグ修正でない）。L 系より後段で可・設計裁定は完了済みで人間決定は不要 |
| 10 | **U15 ブロック・上限・プール実装**（schema: blocks/blockId/max/partsKeys{id,label}/pools → engine: 制約評価 API（表示専用・synthetic node は v1 対象外）→ renderer: ブロック見出し・内訳入力・予算バー・警告 → エディタ UI → 検証タブ警告。仕様正本 = `design-v1-ui.md` §2 v1.2 追記＋追補 H-1〜H-18） | 新機能。parts 列展開のみ U14 table に依存・他は独立。監査は round1〜3 収束済み（pass）。**着手前に §3.6 v1 実装境界表を読む**（v1 必須／延期／非実装の唯一の索引）。実測確定事項 = H-7 制約評価 API 設計・H-18 の不変条件検証（publish 通過物が step 予算内で完走するかのベンチ） |
| 11 | **SM 画面×状態 共通契約の実装項目**（409 payload に `currentRevision` 追加／`resolveForCreate`・`resolvePinnedRevision` 分離／resource deltas min1＋既存データの防御的除外／ephemeral `canMutate`＋`no-authorized-actions`＋owner/non-owner fixture／SM-1 proof 原子性（4 不変条件・単一プロトコル）／SM-8 の 5 要素／SM-14 データ 4 状態。仕様正本 = `design-v1-ui.md` §3.5・索引 = §3.6） | #9/#10 と並行可。**SM-16 の resolve 分離は本行が所掌**（§3.5 の旧記載「#10 と同キュー」は 2026-08-11 監査で本行へ一本化・二重実装防止）。**SM-7（エディタのモバイル）は v1 非実装で確定**（2026-08-09 ユーザー裁定・追加裁定不要）。SM-6 の再構築 CTA 活性化は L-4 裁定（§5-2）に依存 |
| 12 | **U16 シート公開設定の実装**（schema: `sheet.visibility`＝api-contract `.strict()` への追加必須・persistence・materializer 素通し・repository read 境界の正規化 → save: 専用 enum DTO＋所有者条件付き単項更新 → summary read model（DTO/wire/projection select＋mapper）→ renderer: トグル＋Discord 非連動注記・一覧バッジ・編集導線。仕様正本 = `design-v1-ui.md` §2 v1.4・索引 = §3.6 の Schema/Save（U16）/Renderer（U16）/Test 行） | #9/#10/#11 と並行可・依存なし。**公開読取経路は作らない**（fail-closed・拘束条件は §2 v1.4）。監査 round1〜3 収束済み（pass） |
| 13 | **大粒度 #7 残債（記録済み・低優先）**: (a) layout preset 判定 3 実装＋集合機構 3 方式＋`SECTION_LAYOUT_PRESETS` 二重定義・`GRID_COLUMNS` 名 drift・三者一致 spec なし（layout-resolver:17-22 / layout-normalizer:46-50 / publish:593+596） (b) validateField 位置引数 10 の ValidationContext 化 (c) F9/F10（[uid,id,id] 潰れ・2 キー版未命名）・F11（正規化テスト非対称） | 出典 = big7-integration.md。renderer キュー（#10 残り）より後段。(a) は U14 隣接なので renderer 配線時に再評価 |
| 14 | **publish は section id の重複を拒否しない**（U15-R1b レビューで検出・2026-08-11 Fable 経路裏取り: 一意性ゲートは canonical path と uid のみ〔publish.ts:176/:529〕— field id が異なれば同名 section 2 個が ok:true で通過し published データに到達しうる）。拒否を追加するか許容を仕様化するかの裁定が要る。renderer 側は R1b round2 で index 対応 join にして越境済み | 新規 publish 拒否 = 挙動変更（B-15 の passthrough 意図と別軸）。エディタが section id をどう生成するかの実測とセットで裁定 |
| 15b | **U15-R2c の v1 保守裁定（2026-08-11・大粒度 #9 で (b) を訂正）**: (a) parts:true の**新キー追加 UI なし**（H-11 に追加手段の言及なし。実運用で問題になれば裁定） (b) **〔訂正〕stack の parts 宣言 field も合計＋Popover へ**（BIG9-FIXB）— 旧記載「stack = base 昇格の現行維持」は前提誤り: sheet-edit :44 は `field.parts` のときのみ partsKey:'base' で、**宣言型は whole-field 書込 = parts オブジェクト全消失経路**（大粒度 #9 Opus H3 実測・spec:1280-1290 が固定していた） (c) popover の other 行は**表示のみ**（Discord 書込チャネル維持） (d) **emit は数値のみ・Select の null（deselect）も emit しない**（undefined・途中入力文字列・null を emit しない — clear/deselect は v1 no-op。H1〔@IsDefined 下流〕/H2〔負値逐次入力〕/F5〔allowDeselect 既定 true〕の v1 解。**実測済み残差**: clear 後は表示 ''×モデル旧値の無言乖離が blur でも復帰しない〔react-number-format が prop 不変時に内部 state を上書きしない・データ破壊なし・FIXB 実ブラウザ実測〕— D-R2 配線時に clear UX（blur resync vs 削除 op）とセットで再裁定） | 出典 = big9-integration.md・big9-fixb-integration.md |
| 15d | **FIXA 二重レビュー裁定（2026-08-11・big9-fixa-integration.md）**: (a) parts 検査は**生 value.parts の own entries** が対象（zod z.record は own __proto__ を黙って落とし、下流へは元参照が渡る — 検査対象と実データを分離させない） (b) **UNSAFE parts key（__proto__/constructor/prototype）は全モードで input 拒否**（publish UNSAFE_UID_KEYS の parts キー面延長） (c) 方向規律 = **fail-open（input 受理×runtime 拒否）は全閉鎖・fail-closed（逆）は許容して記録** — evaluator/annotation-runtime が数値特殊キーを受理する残差は到達 producer なし（input 遮断後）で本体不変 (d) base/other 予約は package 内 1 定義（旧 = publish:41 と value-input:85 の二重リテラル） (e) server op 層の partsKey 語彙検査（partsKey:'__proto__' の無言 no-op × appliedChanges+=1 — Opus F5・既存機構）は SM キュー #11 の裁定枠へ | 消化 = FIXA-R2 |
| 15c | **大粒度 #9 の記録・裁定枠**: (a) table 宣言キー行は base/other 不可視のまま合計に算入（M2 — 合計が見えている列の和と一致しない UX。読み取り専用 Popover 案は次期） (b) parts 列のある表に**非 parts number scalar 行**が来ると colSpan 結合で合計列が消える（H-16「持たないキーは空欄」との整合未裁定） (c) .tableScroll の Popover クリップ懸念は**実測で否定**（M1・hideDetached 挙動は妥当）(d) sentinel fixture・多列 colSpan・実ブラウザ E2E の spec 拡充は保留 (e) **table 内 parts:true の合計トリガ × width="target" は 55px dropdown/38px 入力になる**（FIXB 実ブラウザ実測・溢れはなし = H4 閉鎖済み。min-width clamp は H4 再設計を伴うため D-R2 隣接の裁定枠） | 出典 = big9-integration.md・big9-fixb-integration.md |
| 15 | **大粒度 #8 の設計の穴（記録・裁定枠）**: (a) **H-13 は max/cap/total の符号を縛らない** — 負の有限 total/consumed で「バー 0%＋超過 5」「残り 14/10」の直感矛盾表示（実測・算術的には真値。publish で負 total を弾くのは挙動変更） (b) **scope 付き pool の予算バー配置が設計未規定**（v1 は section 冒頭固定 — どのブロックの予算か視覚帰属なし。エディタ/プレビュー系で再裁定） (c) F13/F15 保留（props object 化は両レビュア実測で便益不足・data 属性粒度不揃い） | 出典 = big8-integration.md。非有限 remaining は BIG8-FIXA で error 退化済み（こちらは消化済み） |

### 6-2. 決定後に解禁される本流（D-P3-1〜4 の決定後）

依存は一本道ではなく **DAG**（`phase3-goal-contract.md:57-62`・round1 M5 で訂正）:
**M3-1**（engine 4 型完成）が先行し、その後 **M3-2**（Web ブロック UI＋Discord handler — 実装先は Next（Server Action/RSC）。phase3 契約は Remix 前提のまま書かれており更新が要る）／**M3-3**（migrate）／**M3-4**（/create-character・**I-1 で凍結してきた commands.list に初めて触る最大リスク点**）は**並行可**。**M3-5**（残置解消: G3-6 listener registry 化ほか）は**独立・いつでも可**。**M3-6**（legacy-coc v2: skill=list）のみ **M3-1＋M3-3 依存**。

front の消化区分（round1 H8 で「Phase 3 と独立」の過大判定を訂正）:
- **独立着手可（既契約の未消化・Phase 3 スコープ外）**: キャラシート画面への computed ライブ表示（三面契約「同一評価器」の未消化。TemplatePreviewV3 の実証済みパターン移植）
- **D-P3-1 決定後（Phase 3 の G3-1/M3-2 の対象 — 独立着手しない）**: track UI・list 編集 UI・lookup table グリッドエディタ等のブロック UI（`V3EditorFieldType` の蓋を開ける変更は Phase 3 契約の範囲内）

### 6-3. ループ運転規則（fable-rules 準拠＋2026-08-04 運用変更）

- Fable はコード・レビュー本文を書かず Opus/Codex へ委譲。委譲プロンプトには **§2-4 の不変条件定型文＋変更範囲＋触らない範囲＋検収コマンド＋stop 条件**を必ず含める
- 認知負荷レビューは全フェーズ必須。**大粒度俯瞰は feature 完了時のみ**（3 フェーズ毎は廃止）。low 所見は起票のみで処理義務なし
- レビュー・調査エージェントは読み取り専用。検収はスライス開始/終了の `git status --short` 差分比較（恒久例外の文字列固定はしない — round1 H9）
- feature 完了時は `document/SESSION_HANDOFF.md` 全面更新が必須ゲート
