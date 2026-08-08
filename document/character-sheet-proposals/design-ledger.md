# キャラクターシート基盤 設計台帳（ループエンジニアリング用）

作成: 2026-08-08（読み取り専用監査 7 本の統合: 設計文書コア / sheet-engine / front / サーバ実装 / Discord・projection / 未決事項 / 契約・不変条件）
対象: schema v3・`packages/sheet-engine`・`packages/sheet-projection`・`packages/api-contract`・TRPG-SERVER の character 系・`trpg-next-app` front・Discord hub

> **本台帳の位置づけ**: ループ（反復的な AI 委譲作業）が「何をしてよいか・何に触ってはいけないか・何が未決か」を 1 箇所で引けるようにするスナップショット＋索引。
> **正本の優先順位は 実コード > AI.character.md > design-v1 / design-v1-ui > 本台帳**。乖離を見つけたら本台帳を直す（実コードを台帳に合わせない）。

---

## 0. 現在地（2026-08-08 実測）

| 項目 | 状態 |
|---|---|
| Phase 1（engine・template ドメイン・Web エディタ実 API 化） | **実装完了**（AI.character.md 追記6） |
| Phase 2（hub・palette・Discord ±・worker） | **実装完了・受入未了**。PH-7 実機受入（D-3・ユーザー実施）の全 16 チェック項目が `☐` のまま（`phase2-ph7-acceptance-checklist.md`） |
| Phase 3 | **未着工**。`phase3-goal-contract.md` は DRAFT v0.9。着工前提 = D-3 通過（I3-3）＋決定点 D-P3-1〜4 のユーザー決定 |
| 本番 DB（2026-07-30 read-only 実測・`review-results/task28-23-data-survey/`） | シートテンプレート **0 件**・materialized キャラ **0 件** ⇒ **後方互換制約ゼロ。破壊的変更の自由度が最大の時期** |
| git | HEAD `b8f32162`。**未 push 8 コミット（push はユーザー指示待ち）**。untracked は `?? trpg-remix-app/`（削除済み旧 app のディスク残渣）のみ |
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

### 1-3. design-v1-ui の決着（U1〜U13・確定）

- **三面契約**: 1 スキーマから (1)エディタ (2)キャラ作成/編集フォーム (3)Discord 投影。同一評価器（sheet-engine）。Discord 投影の正本は `DiscordProjectionViewModel`
- キャラ編集は **`{baseRevision, dirty diff}` 提出**・field＋parts キー単位 auto-merge・真の競合のみ 409
- hub は 1 メッセージ集約・グループ操作は **ephemeral パネル**（共有メッセージをユーザー操作で編集しない）
- 権限は v1 2 値: ロール系＝全員可／変異系＝所有者のみ

### 1-4. 裁定反転・クローズ記録（同じ処方を再提案しない）

| 事項 | 帰結 |
|---|---|
| #35: 「ローカル Set＋コメント」→ **import 1 本化へ反転**（features→domains は許可辺だった） | projection-key-validation が正本 |
| #36: 「projection 側 canonical path 検査削除」→ **反転**。3 層一意性検査は境界責務の異なる多層防御 | 例外は #40 の**同一関数内死蔵**のみ削除（実測 514/514・復活禁止） |
| #37: 「inferCallType へ統合」→ **不成立を実証**。発行元は validateFunctionCalls 側 | fail-closed sentinel 維持 |
| U3 / 俯瞰#10: `—` の共有定数化・「未対応」message 統合・truncate の跨ぎ統合 → **不採用**（認知負荷優先） | 表示のみの重複はファイル内集約まで |
| #48: 「front の ID 規則を engine 正本へ寄せる」→ **撤回**（値 import は client chunk gzip 約+70KB・リテラル一致 assert は fail-open だった）→ **挙動等価テストで固定** | `v3Template.spec.ts:389-414` |
| field 直下 `secret` の単独拒絶 → **不採用**（passthrough 設計の一事例・場当たり） | 意図的放置 |

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

### 2-2. 規約・コメント頼み（**破っても全緑**。委譲プロンプトで名指しする）

| # | 結合 | 防波堤 |
|---|---|---|
| B-1 | palette 上限 512 の 2 宣言（api-contract `PALETTE_MAX_ENTRIES` ⇔ materializer `PALETTE_HARD_CAP`） | コメントのみ。値 drift は未固定 |
| B-2 | `DEFAULT_AST_NODE_LIMIT=256` の 2 宣言（publish.ts ⇔ evaluator.ts） | 相互参照コメント。**変えるときは必ず両方** |
| B-3 | `—`(U+2014) の 2 定義（palette-label ⇔ projection） | 結合コメント。片側変更で suffix 剥離が黙って壊れる |
| B-4 | front の ID_PATTERN/RESERVED_IDS 複製 | 挙動等価テストは **top-level id のみ**（itemFields/attrs のネスト id は非目標・Task #50） |
| B-5 | server DTO ⇄ api-contract interface の同形は「S5 で機械固定**予定**」のまま未実装 | コメントを「固定済み」と誤読しない |
| B-8 | **characterId / discordUserId の update 不変は `convertUpdateDtoToCharacter`（`character.service.ts:61-77`）の allow-list の副作用のみ**。負のアサーション spec ゼロ | **最優先明記**。スプレッドへ「簡略化」すると全緑のまま書換可能になる |
| B-9 | `$literal` セクション置換（`$` 始まり description/dice の集約式評価回避） | Why コメントのみ |
| B-10 | `findByChannelId` の `.select(...)` 列挙（S-1 の罠: 1 語落とすと本番 skill_ ボタンが壊れた実バグ 2026-06-04） | コメントのみ。pin spec 未確認 |
| B-11 | front eslint zone は 5 feature の**列挙で fail-open**（新 feature には zone を 1 本足す） | `trpg-next-app/AI.md` |
| B-12 | api-contract の allowImportNames 14 名（新 wire 型は追加しないと front から import 不可） | eslint（逆向きの罠） |

### 2-3. 統合禁止の二重実装（「重複だから」と 1 本化しない）

- `isPartsValue` engine 版（緩・非公開）⇔ server 版（厳格）— 真理値が割れる入力は仕様
- 一意性検査の 3 層（front v3Template / engine publish / server projection-key-validation）
- `TABLE_ROW_LIMIT=512`・palette cap 512・SOFT_CAP=128 の**値一致は偶然 — 統合禁止**
- characterThread の `skillName (skillLevel)` 書式は palette ラベルと別機能・対象外
- `allowsParts` は engine 正本・server は re-export shim（複製を作らない）
- feature 側 `types/character-sheet.types.ts` は type-only re-export のみ（正本は character.entity.ts）

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
- レビュー・調査エージェントは読み取り専用（emit プローブ・lint --fix・stash 禁止）。
- 検収の untracked 条件は「`?? trpg-remix-app/` 以外の untracked がゼロ」とする。
```

### 2-5. 検収コマンド（実在するもののみ）

| コマンド | 用途 |
|---|---|
| `pnpm run check:contract-stack` | 契約横断ゲートの正本（api-contract→server→front） |
| `pnpm run test:engine` / `test:projection` / `test:contract` | パッケージ単位 |
| TRPG-SERVER: `pnpm build` → `pnpm run check:circular`（"No circular dependency found!"）→ full jest | サーバ検収（マージ前は全 suite 必須） |
| `pnpm run static:deps` 等 | 実測用。**死蔵判定を削除の根拠にしない**（誤検出既知） |
| 環境: 間欠 V8 crash（exit 3221225477）は `NODE_OPTIONS=--max-old-space-size=4096` で回避・まず再試行 | SESSION_HANDOFF L1665-1666 |

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
| **L-1** | **dice 断片の `+` 連結が publish 通過→評価時 throw**。`'+1d4' + '+1d6'` は inferBinaryType が dice を返すが evalBinary は無条件 expectNumber。回避は notation 側連結（`1d8{a}{b}`）。回帰テストなし | `publish.ts:469-472,647-651` ⇔ `evaluator.ts:297-299,470-475` | 裁定→封鎖（publish 側拒絶 or evaluator 対応） |
| **L-2** | **rollOnCreate が engine 契約外フィールド**。instantiation は `field.rollOnCreate` を参照するが RollField 型に存在せず（passthrough で素通り）、**legacy-coc seed の roll には無い＝作成時ロール不発を実証済み**（2026-08-08 再現 spec 3 red / seed 整合ガード 1 green・感度確認済み）。roll 値は提出不可・事後書込不可のため不発＝修復経路なしの永久欠落 | `character-instantiation.legacy-coc.reproduction.spec.ts`・`l2-roll-on-create-adjudication.md`（事実チェーン 10 項） | **裁定待ち**（a 型昇格 / b seed 付与 / c 常時ロール。資料は c 推奨）。実装は裁定後 |
| **L-3** | **`baseRevision` は形式検査のみのデッドパラメータ**（`sheet.revision` との比較なし）。実防御は per-change `baseValue` 一致＋repository CAS | `character-sheet-operation.service.ts:654-658` | 裁定（削除 or 実装） |
| **L-4** | **hub `error→*` の復帰遷移が存在せず rebuild 不可能**（GAP-B の受け皿は Phase 3 E-4 のまま） | `character.entity.ts:91-92` | Phase 3 |
| **L-5** | golden fixtures の「Web/サーバ両側 jest 共有」は**未達**（projection パッケージ内テスト専用。front は依存すらしていない） | `sheet-projection/jest.config.cjs` / `trpg-next-app/package.json` | design-v1-ui 契約 3 との乖離を記録 |
| **L-6** | `PINNED_BUTTON_LIMIT` を 21+ に上げると pinned 4 行＋select 1 行= Discord 5 行上限を超えるが**ガード・テストなし** | `hub-discord-view.builder.ts:35-52` | 小型封鎖候補 |
| **L-7** | palette soft cap 128 の**作者向け警告は materializer 未実装**（projection 警告のみ） | `sheet-materializer.service.ts` | 小 |
| **L-8** | embed のテンプレ名（`Template v{version}` 固定）・profile role 表示・時間 debounce（coalesce のみ）が design-v1-ui §3 未達 | `hub-projection.service.ts:15-22` ほか | Phase 3 UI 消化 |
| **L-9** | **doc 陳腐化（D-3 を直接ブロック）**: PH-7 チェックリスト §0-4 が `trpg-remix-app` 前提で実行不能／proposals README L59-60・L119-120／b3 L10 のパス消滅／SESSION_HANDOFF ヘッダ 2026-08-03 と開始 08-08 > 完了 08-07 の日付矛盾／AI.character.md ヘッダ 07-12 陳腐化 | 未決台帳監査 H 節 | **最優先の即時修正** |
| **L-10** | `_eval_answer_tmp.md`（probe-write 残渣）が tracked のまま | `git ls-files` | 削除候補 |
| **L-11** | #29 の待ち条件（E1b）は `a03d8c6` で解消済みだが再開記録なし | SESSION_HANDOFF L113-116, L140 | ブロック解除済みとして再開可 |
| **L-12** | `findHubRefreshCandidates` が `findAll()` 全件取得後フィルタ（単一プロセス前提と宣言済み） | `character-sheet-operation.service.ts:143-154` | 宣言済み残置（I3-2 系） |
| **L-13** | legacy-coc テンプレートを DB へ投入する **seeder が存在しない**（定数の利用者は backfill script と spec のみ） | `seeds/legacy-coc.template.ts` | D-3 手順との整合確認 |

**未確認事項（次回検証）**: ①`buildLegacyUpdate` の `$literal` 挙動を固定する spec の有無 ②`findByChannelId` `.select()` を pin する spec の有無 ③旧 `AI.types.md`（front V3 設計正本）の移設先 ④#48 の完了状態（review-results に round11 まであるが HANDOFF に完了行なし）⑤GAP-B（posted-but-untracked reconciliation）の縮退裁定の記録有無。

---

## 5. 未決事項・人間の決定点（**ループが勝手に決めない**）

### 5-1. 依存の最上流

```
L-9 doc 修正（ループ可）→ D-3: PH-7 実機受入（ユーザー・16 項目）→ D-P3-1〜4 決定（ユーザー）→ Phase 3 着工
```

### 5-2. ユーザー決定待ち一覧

| ID | 決定事項 | ブロックしているもの |
|---|---|---|
| **D-3** | PH-7 実機受入の実施と判定（Docker ゲート §5 含む） | Phase 2 完了宣言・Phase 3 着工 |
| **D-P3-1** | Phase 3 スコープ (a)コアのみ／(b)＋U5／(c)＋v1.x（declare/when） | M3-1〜M3-6 の範囲 |
| **D-P3-2** | 作者ピン留めフラグを schema v3.1 で追加するか | README 未決 15・先頭 20 縮退の解消 |
| **D-P3-3** | 投影廃止ゲートを Phase 3 exit に含めるか | 旧 skill_/ability_ 段階廃止 |
| **D-P3-4** | migrate は一括ウィザードかキャラ単位オンデマンドか | M3-3 の設計形 |
| I3-1 追認 | GM/権限・共有シート P14・リセット発火権限・SW lookup 拡張を Phase 3 に**入れない** | Phase 3 境界 |
| C1 確定 | 結果連動エフェクト（`chk_`）の v1.x 採用 | c1 実装着手 |
| README 未決 5 | 公開ギャラリー未認証閲覧（Phase 4） | 認可設計 |
| README 未決 10〜14 | selectedRow／Discord トグル／relation live 参照／FATE 型 resetTo／declare | v1.x 拡張 |
| 運用 | 未 push 8 コミットの push／lint-server required 昇格／rest.http credential（chip task_dedfbb73）／U4 ベンチ | — |

### 5-3. タスク番号の注意

- `#nn` の発番元は**リポジトリ外（chip）**。repo 内の実質台帳は `document/SESSION_HANDOFF.md`（追記型・**L36「現在の feature」/L66「次にやること」は 2026-07-29 時点の古い節**。現況は L1668 以降が正）
- `M` 記号は 4 体系が混在（phase2 Means M-1〜M-7／phase3 Means M3-1〜M3-6／c1 の M1/M2／Next 移行レビュー所見 M1〜M8）。**必ず出典併記**

---

## 6. ループ用ワークキュー

### 6-1. 即時着手可能（人間の決定不要・依存順）

| 優先 | 作業 | 備考 |
|---|---|---|
| 1 | **L-9 doc 陳腐化修正**（PH-7 §0-4 の Next 追随・README/b3 パス・HANDOFF ヘッダ） | D-3 の実行可能性を回復。**手順修正のみ・受入判定はしない** |
| 2 | ~~L-2 rollOnCreate の実測と封鎖~~ **実測完了（2026-08-08）**: 不発を再現 spec で実証・裁定資料作成済み（`l2-roll-on-create-adjudication.md`・c 案推奨）。**ユーザー裁定待ち → 裁定後に実装**（再現 spec は裁定まで意図的に赤） | Phase 2 の受入前に潰すべきバグ候補 |
| 3 | **L-1 dice 連結乖離の封鎖**（publish 側拒絶が保守的。裁定資料→実装） | 回帰テスト追加込み |
| 4 | **#29 再開**（publish 検証の raw Error 500／notation 422 退化。E1b 解消済み） | ブロック解除済み |
| 5 | **裁定資料の作成**: #42（save が publish 規則を全適用する結合）→ #43（dice 判定二重走査）→ #44（参照エラー二重発行・first-error 裁定が先）→ #46（row-level resultType 削除） | 裁定→実装の 2 段 |
| 6 | **#33**（formula/notation/lookup rows の残存増幅・理論 50MB 級・validateId path echo） | DoS 面。優先度引き上げ余地 |
| 7 | 確認系: #48 完了確認／GAP-B 現況／L-10 削除／L-6 ガード追加 | 小粒 |

### 6-2. 決定後に解禁される本流（D-P3-1〜4 の決定後）

M3-1（engine 4 型完成・依存なし先行可）→ M3-2（Web ブロック UI＋Discord handler。**実装先は Next（Server Action/RSC）— phase3 契約は Remix 前提のまま書かれており更新が要る**）→ M3-3（migrate）→ M3-4（/create-character・**I-1 で凍結してきた commands.list に初めて触る最大リスク点**）→ M3-5（残置解消: G3-6 listener registry 化ほか）→ M3-6（legacy-coc v2: skill=list）

front の当面の消化順（Phase 3 と独立に価値が出る・§3 マトリクス参照）:
1. キャラシート画面へ computed ライブ表示（TemplatePreviewV3 の実証済みパターン移植）
2. track UI（ゲージ/チェック・±）
3. lookup table グリッドエディタ（design-v1-ui §1 確定済み）
4. list 編集 UI（SW 武器行・シノビガミ特技行の実用化）

### 6-3. ループ運転規則（fable-rules 準拠＋2026-08-04 運用変更）

- Fable はコード・レビュー本文を書かず Opus/Codex へ委譲。委譲プロンプトには **§2-4 の不変条件定型文＋変更範囲＋触らない範囲＋検収コマンド＋stop 条件**を必ず含める
- 認知負荷レビューは全フェーズ必須。**大粒度俯瞰は feature 完了時のみ**（3 フェーズ毎は廃止）。low 所見は起票のみで処理義務なし
- レビュー・調査エージェントは読み取り専用。検収の untracked 条件は「`?? trpg-remix-app/` 以外ゼロ」
- feature 完了時は `document/SESSION_HANDOFF.md` 全面更新が必須ゲート
