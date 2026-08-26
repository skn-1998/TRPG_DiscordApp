# Web での HP・技能の自由追加: 設計ルートと上流整理

2026-08-24。ユーザー要望「キャラクター編集について、Web でも HP や skill を自由に追加できるようにしたい」
への設計ルーティング（route-design-work・上流 2 段実行）。**方式は未決定**。実装前のレビュー用。

## Design Route

Result: Partial（上流 2 段まで実行・方式決定はユーザー判断待ち）
Mode: Route and orchestrate（上流 2 段。2026-08-24 ユーザー選択）

### Request Coverage

| Request | 成果物 | Skill | 状態 |
|---|---|---|---|
| R-1 「自由に追加」の意味確定 | A-1 候補解釈と衝突（本文書 §1） | interpret-design-context | 実行済み（Partial: 方式選択が人間判断） |
| R-2 目的-目標-手段の追跡 | A-2 追跡表（本文書 §2） | frame-purpose-goal-means | 実行済み（Partial: 手段の採否が人間判断） |
| R-3 選ばれた方式の整合設計 | A-3 不変条件表 | model-domain-invariants | **未実行**（R-1/R-2 の決定待ち） |
| R-4 破壊操作の洗い出し | A-4 制約候補 | analyze-data-destruction | **未実行**（R-3 の後） |
| R-5 実装スライス分割 | A-5 委譲指示書群 | （設計 Skill 外・fable-rules） | 未実行 |

### Excluded Skills

| Skill | 選ばない理由 |
|---|---|
| discover-bounded-contexts | 境界は既存（character / character-sheet-template / engine）で確定済み。新しい境界問題ではない |
| prioritize-quality-attributes | 支配的な品質は整合性 1 つで、不変条件表（R-3）が担う。競合する品質シナリオの要求が無い |
| prioritize-design-debt / split-legacy-by-purpose | 負債整理の依頼ではない |
| develop-ubiquitous-language | 用語は既存（parts / pool / pin / materialized）。新語の合意が主題ではない |

---

## §1. Context Interpretation（interpret-design-context）

Result: Partial（候補は確定的だが、どれを採るかは製品判断＝人間の決定）

### Evidence Ledger（すべて実測・実発言）

| ID | 種別 | 出所 | 内容 |
|---|---|---|---|
| E-1 | statement | 本依頼（2026-08-24） | 「キャラクター編集について、**Web でも** HP や skill を自由に追加できるようにしたい」 |
| E-2 | code | `character-section-editor.service.ts:227-237` | Discord の編集モーダルに新規項目追加（`isNew`）があり、項目名の placeholder が**「例: HP, MP, 攻撃力」** |
| E-3 | code | `character-embed.util.ts:386,402` / `character-modal-handler.service.ts:302` | セレクトに `add_new` の選択肢。自由な名前で field を追加できる |
| E-4 | code | `character-modal-handler.service.ts:151-153` | materialized（テンプレート pin）キャラは Discord 編集を拒否し**「このキャラクターは新しいキャラクターシート側から編集してください」**と Web へ誘導する |
| E-5 | code | `attribute.types.ts:37` | `AttributeSection = Record<string, AttributeValue>`（投影は自由キー） |
| E-6 | code | `TemplateFormRenderer.tsx:756-781` | Web のシート画面はテンプレート宣言 field のみ描画。追加 UI なし。`list` 型はプレースホルダ |
| E-7 | code | `annotation-runtime.ts:134-135` | プール集計は section 直下の field のみ走査（list の行は予算に参加できない） |
| E-8 | code | `resolveReadableRevision` / `update` | published テンプレートは構造不変・キャラは templateId+version へ pin |
| E-9 | statement | 2026-08-22 の発言 | 「他の言語は、ユーザーが後から好きな欄を増やせるようにしようかな」（同根の要望が既出） |
| E-10 | code | `legacy-coc.template.ts`（v1 時代の末尾コメント・4f0d3a0 で書き換え済み） | 「Skills use arbitrary legacy keys … **until Phase 3 introduces list fields**」= 自由キー技能を list 欄へ移す構想が元設計に存在した |
| E-11 | decision | 2026-08-22 ユーザー裁定 | list 対応は v3 出荷を優先して後回しにした（廃案ではない） |

### Interpretations（「自由に追加」の候補）

| ID | 候補意味 | 根拠 | 状態 |
|---|---|---|---|
| I-1 | **legacy パリティ**: Discord の legacy キャラで既にできる「名前を入れて項目を足す」を、Web の materialized キャラでもできるようにする | E-1「Web **でも**」＋E-2/E-3（既存の自由追加）＋E-4（Web へ誘導するのに Web に無い） | **Confirmed**（発言の直訳。E-4 の誘導メッセージが現状の欠落を作っている） |
| I-2 | 実現手段としての「テンプレートの list 欄＋行追加 UI」 | E-10（Phase 3 の元設計）＋E-11 | Inferred（手段候補。§2 M-A） |
| I-3 | 実現手段としての「キャラ単位カスタム field（テンプレート外）」 | E-5（投影は自由キーを許す型） | Inferred（手段候補。§2 M-B） |
| I-4 | 「HP を追加」= 既存 HP の変更ではなく、**HP のような任意ステータス枠**を足すこと（v3 の HP は computed で不変） | E-2 の placeholder が HP を例示 | Inferred（Q-1 で確認） |

### Competing Meanings

| 衝突 | 内容 | 解消に要る判断 |
|---|---|---|
| I-2 vs I-3 | 追加の**所属**が違う。I-2 はテンプレートが枠（list 欄）を宣言しキャラは行を足す。I-3 はテンプレート外の値をキャラが持つ | 方式決定（人間）。§2 の手段比較へ |
| I-1 と E-8 | 「自由に」と「pin されたテンプレートは構造不変」は、field 追加の意味では正面衝突する。行追加（I-2）なら衝突しない | 同上 |

### Questions（設計判断への影響が大きい順）

| ID | 質問 | 影響 |
|---|---|---|
| Q-1 | 追加した技能に**職業・興味ポイントを振れる必要があるか** | 要るなら engine のプール集計拡張（E-7）が必須になり工数が跳ねる |
| Q-2 | 「HP を追加」= 任意の**ゲージ（track 相当）**も追加対象か、数値だけでよいか | list の行に track 相当を持てるかは未実測（🔎）。数値だけなら既存 itemFields で足りる可能性 |
| Q-3 | 既存の v3 キャラ（配布済み）にも追加できる必要があるか | 要るなら v4 移行設計（pin の張り替え or 併存）が同時に要る |

---

## §2. Framing（frame-purpose-goal-means）

Result: Partial（手段の採否は人間判断。未確認目的に基づく最終推奨は行わない）

### Purpose Map

| ID | アクター | 目的 | 根拠 |
|---|---|---|---|
| P-1 | プレイヤー | 遊んでいるシナリオ・ハウスルール固有の技能やステータスを、配布テンプレートに無くてもシートに持ちたい | E-1, E-2（Discord では実際に使われている形）, E-9 |
| P-2 | プレイヤー（Discord からの移行者） | legacy でできたことが Web でできない、という後退を感じずに移行したい | E-4（誘導メッセージ）＋E-1「Web でも」 |
| P-3 | 開発者（ユーザー） | テンプレート pin・評価・投影の整合性（v3 で固めた検証群）を壊さずに P-1/P-2 を満たしたい | E-8、本セッションの検収群 |

### Goal Contract（観測可能な達成条件）

| ID | Purpose | 条件 |
|---|---|---|
| G-1 | P-1 | Web のシート編集画面で、テンプレートに無い名前の技能・ステータス枠を追加でき、保存後も表示・編集できる |
| G-2 | P-1 | 追加した項目がロールパレット／Discord 投影にも現れる（既存の自由キー項目と同格に扱われる） |
| G-3 | P-2 | E-4 の誘導メッセージの先（Web）で、Discord の add_new と同等の操作が完結する |
| G-4 | P-3 | 既存の全ゲート（publish 検証・materializer・変異 pin 群）が緑のまま。プール予算・焼き込みの安全条件（職業/興味 default 禁止等）が破られない |

### Means（候補手段。役割は 1 目的 1 手段に限定）

| ID | 候補 | 期待貢献 | 実測済みのコスト・制約 | リスク |
|---|---|---|---|---|
| M-A | **テンプレートの list 欄＋Web の行追加 UI**（Phase 3 の元設計） | G-1/G-3。行の追加はキャラのデータなので pin と両立（E-8 と衝突しない） | engine は型・publish・評価・materialize 済み（実測）。**front の list 描画＋行追加 UI が新規**。プール参加は E-7 により**不可**（要 engine 拡張）。v3 に list 欄を足すには **v4 が要る** | Q-1 が Yes なら engine 拡張が乗る。track 相当の行は未実測（Q-2 🔎） |
| M-B | **キャラ単位カスタム field**（テンプレート外の値をキャラが持つ） | G-1/G-2/G-3 を最短で満たす（legacy の形そのもの） | materializer・評価・投影・palette・Web 描画の**全層に「テンプレート外の値」概念を追加**。v3 の「テンプレートが構造の正本」という前提を崩す | 検証面が最大。v3 で固めた「宣言 field のみ集計・焼き込み」の安全条件群と正面から干渉 |
| M-C | **テンプレート複製＋エディタで欄を足す導線の強化**（既存機能の組み合わせ） | 新規キャラに限り G-1 相当。実装最小 | 複製（J1）・エディタ・生成プロンプト（J2）は既存。ただし**既存キャラには効かない**（pin は張り替え不可）。「行を足す」でなく「別テンプレートで作り直す」体験 | G-3 を満たさない（追加のたびに作り直し）。P-2 の後退感が残る |
| M-D | M-A ＋ v4 に「カスタム技能」「カスタムステータス」list 欄を標準搭載 | M-A の機構を配布テンプレートで即使える形にする | M-A に v4 の seed 改版（62 技能検証群の移植）が乗る | M-A と同じ＋v4 リリース作業 |

### Issue Ledger

| ID | 種別 | 内容 | 状態 |
|---|---|---|---|
| IS-1 | gap | list の行に track（ゲージ）を持てるか | **実測済み・可**（`probe_list_capabilities.mjs`: publish ok=true。「HP のような任意ゲージ」は M-A で表現できる） |
| IS-2 | gap | 追加行のロールパレット参加（G-2） | **実測済み・要 server 拡張**。engine には `rowRole`（`1d100<={row.id}` 形式・publish 検証あり）が存在するが、materializer の `buildPalette` は list を丸ごとスキップする（`sheet-materializer.service.ts:212-214`） |
| IS-5 | fact | 行は `partsKeys` を持てない（**2026-08-26 S2 で解消**: default なし宣言を受理・集計も行対応。本行は決定当時の記録） | **実測済み（当時）**。publish が `only supported on section-level` で拒否していた。プール参加（Q-1）は集計（E-7）と宣言（本件）の二重に塞がっており、S2 が両方を同時に開いた |
| IS-3 | contradiction | 「自由に追加」（P-1）と「published 構造不変」（E-8）は field 追加の解釈では矛盾。行追加なら矛盾しない | M-A/M-D なら解消 |
| IS-4 | assumption | 「HP を追加」を任意ステータス枠と読んだ（I-4）。既存 HP の式変更の意味なら別問題（テンプレート編集の話になる） | Q-2 で確認 |

### Contract Checks（要点）

- 手段の目的化なし: M-A〜M-D はどれも P-1/P-2 から導出。list 採用自体を目的にしていない（E-10 は補強根拠であって理由ではない）
- 未確認目的に基づく最終推奨はしない: 方式決定は Q-1〜Q-3 の回答とセットでユーザーが行う

---

## 決定（2026-08-24・ユーザー裁定）

| 論点 | 決定 |
|---|---|
| 方式 | **M-D**: list 行追加の機構＋v4 に「カスタム技能」「カスタムステータス」欄を標準搭載 |
| プール参加（Q-1） | **要る**。追加した技能にも職業・興味ポイントを振れること |
| 既存キャラ（Q-3） | **新規キャラからでよい**。pin 移行は設計しない |
| HP の意味（Q-2/IS-4） | 任意ゲージの追加。list 行に track を置けることは実測済み（IS-1） |

## 決定（2026-08-26・R-3/R-4 後のユーザー裁定）

| 論点 | 決定 |
|---|---|
| 保存 path の粒度（Q-B） | **list 全体 1 path**（契約変更ゼロ）。競合封筒のサイズ上限（C-10）だけ足す。行単位 path は必要になってから |
| 行 resource / Discord ±（Q-D） | **v1 は Web 専用**。行内 resource role は publish で拒否し、既存のズレ（受理するのに恒久 422）を「宣言できるが発火しない面を残さない」方針で閉じる |
| pool 宣言の充足条件（Q-C） | **section 直下宣言必須のまま**。publish 検査 3 本は触らない。「カスタム欄だけのテンプレート」がプールを publish できない制約は受容 |
| 行 name の重複（Q-G） | **許す**。palette key・投影キーは rowId 導出（C-01/C-06）なのでデータは壊れない。表示上の同名は命名に任せる |

**Fable 推奨で確定した既定（ユーザー異議なし・2026-08-26 提示済み）**:

- Q-A: rowId は front が行追加時に nanoid 採番。保存境界が形式・list 内一意・欠落を検査（422）
- Q-E: palette label の出所は rowRole に明示宣言（どの text itemField か）し publish が検証。暗黙の `name` 規約は採らない
- Q-F: 行内 track の max は v1 では**固定値のみ** publish 受理（式は拒否）。TrackRangePolicy 統合は followup
- Q-H: 行数 cap 512 は維持しつつ、materialize 前に「512 − 宣言 rollable 本数」を実効上限として先に判定し、原因を指す 422 を返す
- Q-02: pool 予算超過の server 拒否は**しない**（advisory の現行設計を維持。v3 キャラの移行問題を作らない）
- 行 parts の予約キー `base`/`other`: **v1 は拒否**。Discord ± が行に到達しない（Q-D 裁定）ため行での `other` は死んだ語彙になる。開けるのは行 resource 対応時

## M-D 機構案（R-3 / R-4 への入力。実装前のドラフト）

### v4 テンプレートに足すもの

```
section skill に:
  { type: 'list', id: 'custom_skills', label: 'カスタム技能',
    itemFields: [
      { scalar text  id: 'name',  label: '名前' },
      { scalar number id: 'value', label: '値',
        partsKeys: [initial / occupation / interest]  ← ★エンジン拡張(1)が要る }
    ],
    rowRole: { kind: 'rollable', notation: '1d100<={row.value}', group: 'skill' } }

section status に:
  { type: 'list', id: 'custom_status', label: 'カスタムステータス',
    itemFields: [
      { scalar text id: 'name', label: '名前' },
      { track id: 'gauge', label: '値', max: <行内 number か固定値>, style: 'gauge' }  ← publish 受理済み（IS-1）
    ] }
```

行の保存形（実測）: `sheet.values[list.uid]` = 行オブジェクトの配列。行は itemField の
uid（または id 別名）をキーに持つ。上限 `LIST_ROW_LIMIT = 512`（evaluator.ts:29,135）。

**訂正（R-3/R-4 が独立に指摘）**: 各行は上記に加えて**安定 `rowId`（短縮 nanoid）を必ず持つ**。
これは design-v1.md:113（決着 §8-7「式・palette からの index 参照は禁止・rowId 必須」）の
既決事項で、当初ドラフトから脱落していた。palette の `fieldRef` は契約側に `rowId?` の受け皿が
既にあり（character.zod.ts:48-53）、palette key・投影キー・行編集の同定はすべて rowId から導出する。
現行 `allocatePaletteKey` は uid だけで再利用判定するため（実測: 同一 list の行は先頭 1 行しか
key を引き継げず、行削除で以降の key がずれる）、行対応時に `uid + rowId` へ拡張する。

### 必要な拡張（層別・すべて実測根拠つき）

| # | 層 | 拡張 | 現状の根拠 |
|---|---|---|---|
| 1 | engine publish | list の number scalar 行に `partsKeys` を許す（**default は許さない**。行は作成時に存在しないので焼き込み対象外＝applyPartsDefaults は不変のまま） | IS-5: 現在は `only supported on section-level number scalar` で拒否 |
| 2 | engine annotation-runtime | プール集計が同 section の list の行も走査し、行の `parts[pool.partsKey]` を consumed へ数える | E-7: 現在は section 直下のみ（134-135） |
| 3 | **engine 保存境界**（R-3 実測で server から訂正） | list 値（行配列）の保存を受理し、行の値ポリシー（有限数値・parts 形・キーは itemField の uid/id に限定・行数 cap・rowId）を定める | 全拒否の正体は engine `value-input.ts:137-156`（`inputSchemaFor` が list に schema を返さない。空配列も拒否）。server は提出／保存済みの 2 経路からこの 1 本を呼ぶだけで独自検査を持たない。同 138 行のコメントが本スライスを「D-R3-IMPL-R2 差し戻し」として予約済み |
| 4 | server materializer（palette） | `buildPalette` が rowRole を持つ list の行を palette へ載せる（行ごとの key 割当・上限 512 共有）。**`{row.x}` の展開は engine `notation.ts:72-84` に実装済み**で、未実装なのは materializer が `row`＋`parentListUid` を渡す経路だけ | IS-2: 現在は list を丸ごとスキップ（212-214）。`parentListUid` を省くと throw（R-3 E-15） |
| 5 | server materializer（投影）**（R-3 で追加）** | 行を `projection.skill` 等の AttributeSection へ投影する経路の**新規設計**。投影対象型は `['scalar','computed','track','roll']` で list 分岐が存在しない（projection-key-validation.ts:9）ため、既存分岐の拡張では書けない。行の投影キーは publish の衝突検査から観測できないので一意化は materialize 時に守る | R-3 E-17/E-18。これが無いと Discord に行が 1 件も表示されない |
| 6 | front | list の描画＋行の追加/削除 UI＋行の内訳エディタ。プール残りは engine 拡張(2)が済めば既存表示がそのまま使う | E-6: 現在はプレースホルダ |
| 7 | seed | v4（62 技能・プール・role の検証群を移植＋カスタム欄 2 つ） | v3 の spec 群が移植元 |

### 意図的にしないこと

- 行の partsKeys に `default` を許さない（予算の先食い防止は v3 の spec 思想と同じ）
- 既存 v3 キャラの pin 移行（Q-3 裁定）
- テンプレート外の自由 field（M-B は棄却。理由は §2 Means 表）
## 次の段（決定後）

1. **model-domain-invariants**: M-D 機構案の一貫性ルール表（行 id の一意性・予約キー・投影キー衝突・プール参加条件・palette 上限 512 など）
2. **analyze-data-destruction**: 追加操作の破壊面（`lgc_*` uid との衝突・`base`/`other` 予約キー・巨大入力・重複名）
3. fable-rules でスライス分割 → 委譲（設計 Skill の範囲外）

---

## R-3 結果（2026-08-26・model-domain-invariants・Partial）

正本: `review-results/web-free-add/invariants.md`（gitignore 領域。条件 C-1〜C-35・操作 OP-1〜OP-11・
テスト T-1〜T-35・根拠 E-1〜E-42。全件 probe / file:line 実測）。

Fable 検収: 訂正 3 件（保存境界の正体・`{row.x}` 実装済み・投影分岐の不在）を実物で裏取りし一致。
上の 6 層表は 7 層表へ訂正済み。

**Partial の理由 = 人間の決定が要る未決 8 件**（各条件文がこれ無しに確定できない）:

| ID | 論点 | 影響 |
|---|---|---|
| Q-A | rowId の採番責任（クライアント nanoid か サーバー採番か） | 行の同一性テスト全部の前提 |
| Q-B | 保存 path の粒度（list 全体 1 path か、行を指す path へ契約拡張か） | 前者は他人が別の行を触るだけで merge conflict。後者は api-contract の破壊的変更 |
| Q-C | pool 宣言の充足条件を行まで広げるか | 広げないと「カスタム技能欄だけのテンプレート」が publish 不能。広げると publish 検査 3 本の同時拡張 |
| Q-D | 行 resource（Discord ±）を許すか | 現状 publish は受理するのに実行経路が無く恒久 422（「宣言できるが発火しない面を残さない」方針と衝突） |
| Q-E | 行の palette label の出所（`name` 規約か型拡張か） | 決めないと全行が同一 label になり G-2 未達 |
| Q-F | 行内 track を `TrackRangePolicy` の対象にするか | 対象外だとカスタムゲージが既存ゲージと別挙動 |
| Q-G | 行 name の重複を拒否するか許すか | 許すと Discord 表示・palette label が同文字列に |
| Q-H | 行数 512 × rowRole と palette 上限 512 の関係 | 両方 512 のままだと上限まで足したキャラが materialize 不能（62 技能分あふれる） |

---

## R-4 結果（2026-08-26・analyze-data-destruction・Partial）

正本: `review-results/web-free-add/destruction.md`（破壊シナリオ DS-01〜DS-22・制約 C-01〜C-12・
不足テスト 22 件・根拠 E-D01〜E-D38。probe 6 本はすべて実 engine／実 server dist／実 discord.js で再現）。

Fable 検収: R-3 が予告した破壊面 6 件が R-4 の実測で全件確認され、相互検証が収束。
「consumed -9999」は section 直下 field での実測（E-D31）で、R-3 の「行は consumed に入らない」
（E-24）と両立する。`LIST_ROW_LIMIT` の barrel 未 export（E-D38）は Fable が実物で裏取り済み。

**設計へ昇格する制約（実装スライスの拘束条件）**:

| ID | 制約 | 根拠となる実測 |
|---|---|---|
| C-01 | 行の同定は palette・投影・CAS のすべてで **rowId**（index も行名も使わない） | 行削除・並べ替えで palette key がずれ Discord のボタンが別の行を指す |
| C-02 | 行キーは itemField の uid＋rowId に限定し、未知キー・UNSAFE キー・id 別名の併記を保存境界で拒否 | 未知キーは Mongo へ verbatim 蓄積。uid キーが null だと id 別名へフォールスルーし「クリアした値」が復活 |
| C-03 | 行の number は有限数値か parts 形のみ。**0 への畳み込みで受理しない**。list 値は配列のみ | `"abc"`/`null`/`true`/`1e400` が全部静かに 0（seed HP=0 事故と同型） |
| C-04 | **拡張 1（行 partsKeys の publish 許可）と拡張 2（行の pool 集計）は同一スライスでしか開けない**。行 parts の未宣言キー・負数を保存境界で拒否 | 行の parts は現在無検査で合算され（未宣言 `{occupation:40}` が 45 と評価）、負数は remaining を total 超に膨張させ over:false のまま |
| C-05 | 保存が受理する行数 = 評価が読む行数 = palette 予算内。`LIST_ROW_LIMIT` を barrel から export して保存側 cap が import する | 513 行目以降が例外なく集計から消える。palette は「512 − 宣言 rollable 62」で先に溢れる |
| C-06 | 行の投影キーは行名から作らず、宣言 field と別名前空間（rowId 由来）にする | 行名 `dodge` が宣言済み回避を後勝ちで消す。行名 `__proto__` は投影全体を 422 に落とし原因行を指せない |
| C-07 | 行 text に保存時文字数上限（Discord button label 80 字から逆算） | 76 字超の行名で hub のビュー構築が throw し、保存済みのまま hub が error に固定される |
| C-08〜C-12 | notation 生成結果の検査・行 path の index 禁止・競合封筒のサイズ上限・行内 track max の「評価するか禁じるか」・seed も同一スキーマを通す | 正本参照 |

**不成立だった攻撃**: 行 name への `{row.value}`／BCDice 記法の注入（DS-17）は publish と
`interpolateNotation` の二重防御で不成立。この防御を外さないこと自体を退行 pin（T-21）にする。

**R-4 由来の追加未決**: pool 予算超過を server で拒否するか advisory のままにするか（Q-02。
現在 `evaluateAnnotationRuntime` は front からしか呼ばれず server は pool を一切検査しない。
拒否へ倒すなら既存 v3 キャラの超過データが保存不能になる移行問題が同時に発生する）。
→ **2026-08-26 裁定: advisory のまま**（上の決定表参照）。

---

## スライス計画（2026-08-26・fable-rules 準拠）

運転規則は fable-rules に従う（1 スライス = 1 責務・受入コマンド独立緑・diff 目安 300 行・
3 スライス毎に大粒度認知負荷レビュー）。engine 変更後は engine jest → build →
server 全 suite の順で検収する（dist 経由解決のため。メモリ `engine-dist-rebuild-before-server-tests`）。

### フェーズ A（engine）

| # | 責務 | 主対象 | 拘束条件 | 受入の骨子 |
|---|---|---|---|---|
| S1 | 保存境界の list 受理（行の形） | `value-input.ts`＋barrel | C-02/C-03/C-05/C-07: 配列のみ・行は strictObject（rowId 必須・list 内一意＋itemField uid のみ・id 別名や併記は拒否）・number は有限 raw のみ（parts はこの段では従来どおり全拒否）・text に文字数上限（Discord button label 80 字から逆算して定数化）・`LIST_ROW_LIMIT` を barrel から export し保存 cap が import | T-03/04/05/09/18 相当の engine unit。`[]`〜512 行受理・513 行 422・未知キー/`__proto__`/id 併記 422 |
| S2 | 行のプール参加（宣言・集計・検査を**不可分に**） | `publish.ts`＋`annotation-runtime.ts`＋`value-input.ts` | C-04: 行 number scalar の `partsKeys` を publish 受理（**default は拒否** = C-20）。集計は「宣言した行だけ」consumed へ（C-21〜C-24: 警告の意味論・draft-safe 維持）。保存境界は行 parts を宣言キーのみ・`base`/`other`/UNSAFE 拒否・負数拒否 | T-07/08/21〜25 相当。未宣言 parts 422・負数 422・直下 10＋行 5 → consumed 15・行 0 本で警告なし |
| S3 | publish の行宣言の閉じ込め | `publish.ts`（＋types） | Q-D/Q-E/Q-F: 行内 itemField の `role` を**全種**拒否（resource は Q-D 裁定・rollable も S5 が実装するのは rowRole だけで発火しないため。design-v1 の「行内 role の行ごと palette 化」は将来スライスへ保留）・行 track の max は固定値のみ・rowRole の label 出所 `labelSubFieldId`（同 list の text itemField の id）を宣言必須＋検証・`{row.<text>}` 拒否の退行 pin（HD-14/T-21）・**itemField の id/uid に `rowId` を禁止**（S1 で `rowId` を行の予約キーにしたため。宣言できると保存境界の予約と衝突する）・**itemField の `blockId` を禁止**（S2 で行の scope 所属は親 list の blockId に決めたため、itemField 側の blockId は「publish 受理・runtime 無視」の死んだ宣言 = S2 レビュー C-2） | publish unit。受理/拒否の対で固定 |

→ **大粒度認知負荷レビュー①**（engine 3 スライス横断）

### フェーズ B（server）

| # | 責務 | 主対象 | 拘束条件 | 受入の骨子 |
|---|---|---|---|---|
| S4 | 保存経路の開通（list 全体 1 path） | `character-sheet-operation.service.ts`＋DTO | Q-B: `assertWritablePath` が list uid を許可・丸ごと差し替えのみ（C-09: in-place 変更禁止）・競合封筒のサイズ上限＋切詰め明示（C-10）。**追記（大粒度①）**: `sheet-values.util.ts` の parts 厳格形判定を A-FIX で engine `parts-value.ts` へ 1 本化した述語の import に畳む（followups の「parts-判定 3 定義統合」の server 分） | server integration。行追加保存 → revision 前進・512 行競合の封筒サイズ |
| S5 | palette の行対応 | `sheet-materializer.service.ts` | C-01/C-05/C-08: `fieldRef{uid,rowId}`・`allocatePaletteKey` の再利用判定を uid+rowId へ・label は S3 の宣言から・`interpolateNotation` に `row`＋`parentListUid`（C-16）・実効行数上限「512−宣言 rollable 本数」の事前 422（原因を指す文言）・生成 notation の妥当性検査。**必読（大粒度① CL-L4）**: `rowId` はリテラル散在（定数なし）かつ wire の `fieldRef.rowId` は `z.string().min(1)` で engine の `LIST_ROW_ID_PATTERN` より弱い。行が palette に出た瞬間に読取側の契約になるので、S5 で wire 側を pattern へ強化するか意図的に弱いままにするかを決めて記録する。**裁定（S5・2026-08-26）**: wire は**意図的に `min(1)` のまま**（rowId は server 発行 palette の echo・保存側は engine `LIST_ROW_ID_PATTERN` が正本・読取不一致は lookup 失敗で無害・強化は Q-B「契約変更ゼロ」に反する契約変更）。api-contract 側に Why コメントで固定。C-08 は S5-FIX で**原文どおり**（指数・小数・負数の拒否）行経路に実装 — `-` は減算つき dice fragment（`2d6-1`）も保守的に拒否する（新設経路で既存データ皆無・先頭 `-` 限定への緩和は widening で互換。followups 記録）。section 既存経路への遡及も followups | T-01/02/06/11/17 相当。並べ替え/削除で key 不変・cap 超の診断＋実効上限ちょうどの成功 pin・指数/小数/負数の拒否（C-08 原文） |
| S6 | 投影の新規経路 | `sheet-materializer.service.ts`＋hub view builder | C-06/C-07: 投影キーは rowId 由来の別名前空間（宣言 field と衝突不能）・`AttributeValue` の label/index 採番規則を実測して決定（R-3 U-3）・hub 側 label 80 字切詰め backstop | T-12/13/14/15 相当。行名 `dodge` で既存回避が生存・同名 3 行が 3 件残る |

→ **大粒度認知負荷レビュー②**（server 3 スライス横断）

### フェーズ C（front・seed）

| # | 責務 | 主対象 | 拘束条件 | 受入の骨子 |
|---|---|---|---|---|
| S7 | front の行 UI | `TemplateFormRenderer` ほか | Q-A: 行追加時に nanoid で rowId 採番・行削除/編集・内訳エディタ・pool 残り表示が行込みで動くことの実ブラウザ受入（メモリ `css-responsive-blind-to-all-green-gates`）。**必読（大粒度②）**: ①CL-B5 = `$truncated`/list 競合の front 消費者ゼロ（`createConflictPanel` が scalar 以外を捨て list 競合は汎用メッセージへ落ちる）— S7 で list 競合 UI の扱いを決める ②`LIST_ROW_ID_PATTERN` の front 参照は現状 0 件 — nanoid 採番が pattern（`[A-Za-z0-9_-]{1,32}`）適合かを front spec で pin する ③実効行数上限（512−宣言分）の再計算を front に複製しない（server 422 の文言表示に留める） | front jest＋scratchpad 実ブラウザ実測 |
| S8 | v4 seed | `legacy-coc.template.ts` v4＋seeder＋spec | C-34/C-35/C-12: 62 技能＋カスタム欄 2 本・v3 の全数 pin（roster/default 禁止/role/annotation runtime）を v4 へ移植＋行系 pin 追加・seeder は v3 を deprecate・**実データ生成までの受入**（メモリ `seed-template-needs-runtime-acceptance`） | seed spec 全数＋dry-run → execute → 冪等確認 |

→ feature 完了ゲート: 大粒度レビュー③＋`document/SESSION_HANDOFF.md` 全面更新

### スコープ外（followups へ）

- section 直下 field の負数 parts による pool 膨張（E-D31。既存の穴・行対応とは独立）
- `section[key]` 無防備参照の棚卸し（Q-04。legacy 既存面）
- hub のビュー構築例外の写像経路の全数追跡（Q-03。S6 の backstop で実害は塞ぐ）
- `sheet.values` を書く保存経路以外の口の全数列挙（Q-05。v4 seed は C-12 で個別に守る）
- 行 resource の Discord ± 対応（Q-D 裁定で将来スライス）・TrackRangePolicy の行内 track 統合（Q-F）
- pool 予算の server 検査（Q-02 裁定で advisory 維持）
