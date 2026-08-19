# SESSION_HANDOFF — compact 復帰用の状況 doc（正本）

<!-- fable-rules の必須ゲート:
     - feature 完了ごとに全面更新する。更新が済むまで feature を完了扱いにしない・次へ着手しない
     - フェーズ検収ごとに該当節を差分更新する（auto-compact はフェーズ途中にも来る）
     - compact 後の最初の応答は必ずこのファイルから読み、AI.*.md・メモリ・.claude/compact-log/ で補完する -->

- 最終更新: 2026-08-13（**U14/U15 feature 完了** = D-R2 配線＋大粒度 #17 FIX 全消化・
  `e4468ab6`）。**現況の正本は本ファイル末尾近くの「キュー #9〜#12 ループ」節**
  （検索: `U14/U15 feature 完了`）と台帳 `design-ledger.md` §0。
  冒頭〜中盤の節は 2026-07-29〜08-07 時点の追記ログでありそのまま保存
  （現況として読まないこと）

## 【feature 完了 2026-08-18】シートテンプレート複製（fork）— 台帳キュー #19

ユーザー依頼「シートテンプレートにコピーするボタン」。設計（5 Skill ルーティング＋レビュー 2 ラウンド）→
実装（Codex 委譲 3 ラウンド＋FIX 3 ラウンド）→ 大粒度二重レビューまで全消化。**未コミット**
（コミットはユーザー裁定待ち）。

- **設計正本** = `document/character-sheet-proposals/template-fork-design.md`（§S4 契約・§S6/§S7 委譲定型文）
- **大粒度統合判定** = `review-results/template-fork/big-f3-integration.md`（相互矛盾 0・境界行列 7 組整合）
- 裁定済み: 複製元 = 自分所有（**status 不問**）∪ system published／name = `{元名} のコピー`／
  forkedFrom 書く（**初の production producer**）／version 継承／visibility **private 固定**
  （wire で受けない・payload 省略で強制）／wire = `POST /:id/fork` body なし（DEC-1）

> **⚠ 他レーンからの申し送り（RL レーン・2026-08-18）**: 本節と `TRPG-SERVER/AI.character.md` の
> fork 節（「実装完了・未コミット」）は、**RL-7a のコミット `bc41e9ef` に巻き込まれて既にコミット済み**です。
> RL 側が共有 doc をファイル単位の pathspec で commit したため、fork レーンの doc 変更が同梱されました。
> **コードは 1 行も混入していません**（`bc41e9ef` の非 doc ファイルは全て RL-7a のもの）。
> fork レーンのコミット時は、doc 分が `git status` に現れないことを欠落と誤認しないでください。
> 見出しの「全て未コミット」は doc について既に偽です。

### 実装の最終形（全て未コミット・変更 9 ファイル）

| 面 | 内容 |
|---|---|
| server | `service.fork()`（`assertRevisionReadableBy` 再利用＋system 非 published 409 の 1 条件・create() 合成・payload に visibility なし）＋ `POST :id/fork`（201・bare・body/DTO なし・@UsePipes なし）＋ spec 16 件（own 全 status it.each・system published/deprecated・第三者 it.each・404・validateForSave 失敗時 create 不呼出・元への update 系 0 呼出・body visibility 無視 2 引数 pin） |
| front | `forkSheetTemplate`（bare 読み・adapter spec で path/body undefined/data 直返し pin）＋ `forkTemplate` action（`{error}` 規約・redirect は try 外・空 message 定型文 spec あり）＋ 全カード「複製して編集」ボタン（`loading={isListPending}` single-flight・連打 1 回 spec）＋ 一覧 spec 2 本の名前更新（『…だけ』の全称主張を除去） |

### ゲート結果（Fable 独立再実行・Codex 申告と全一致）

- server: build ✓・check:circular **0**・**full suite 226/3204 緑**・対象 suite 6/106（FIX-BIG 前後で同一カウント = 認可置換の同値性証明）
- front: typecheck ✓・eslint 0・**full suite 34/564 緑**・対象 suite 7/213

### レビュー履歴（全ラウンド）

| ラウンド | 実施 | 結果 | 消化 |
|---|---|---|---|
| F-1 小粒度 | Opus read-only | pass（peak 6・コメント突合 6/6・変異 8 種検出可） | FIX-1: CR-6 完全 pin・C-6 API 形状 pin・コメント 2 分割 |
| F-2 小粒度 | Opus read-only | **needs-fix**（CN-7 連打で draft 2 個生成・T-8 spec 欠落） | FIX-2: `loading={isListPending}`＋連打 spec＋空 message spec＋コメント精密化 |
| F-3 大粒度 | **Codex＋Opus 二重** | needs-fix（一致 2 件） | FIX-BIG: 認可述語 3→2（−5 行・spec 不変）＋ adapter 契約 pin |

- **F-2 の CN-7 は Fable の指示書事故が原因**（「削除ボタンと同じ = single-flight に乗る」が誤前提。
  実際に single-flight を持つのは新規作成ボタンのみ）→ メモリ verify-claims-before-prescribing 26 例目
- F-3 起票分 = 台帳 #20（catch helper 1 本化 −14 行・repo 10 コピー）＋ big-f3-integration.md の低優先 4 件

### 残る人間の決定点（コードは触っていない）

1. **コミット可否**（pathspec 方式・fork の 9 ファイル＋docs。並行セッション変更と分離可能）
2. **DQ-4 = forkedFrom の事後可変性**（F-3 Codex が correctness で指摘。v1 出荷状態 = 可変
   〔既存 update 経路の現状維持〕。選択肢 a/b = 設計 doc C-10 行）
3. DQ-3 = license 継承規則（v1 暫定 = 元を継承・spec が暫定を pin 中）

## 2026-08-03 完了: ts-morph 静的解析基盤（tools/static-analysis・第4群とは独立の feature）

- 基線 git status = `review-results/template-fork/baseline-git-status.txt`（HEAD `20815545`・
  並行セッションの未コミット変更あり — RL-7a 系と engine。fork の変更範囲と重ならないことを検収で確認）
- コミットは**ユーザー未許可**（実装完了後に確認する）
- 検収ゲート: F-1 = build → check:circular → 対象 suite／feature 完了 = server full suite＋front suite
- 残未決（v1 非ブロック）: license 継承規則（DQ-3・暫定 = 元を継承）／forkedFrom 事後可変性（DQ-4）

## 2026-08-03 完了: ts-morph 静的解析基盤（tools/static-analysis・第4群とは独立の feature）

ユーザー依頼「ts-morph をライブラリに導入して静的検証を簡単に＋依存関係や関数の独立性を確認する Skill」。
経緯の正本は `TRPG-SERVER/AI.refactor.md` の 2026-08-03 節、利用手順は Skill
`.claude/skills/static-structure-audit/SKILL.md`、実装構成は `tools/static-analysis/README.md`。

- ts-morph は**既に TRPG-SERVER へ導入済み**だった（利用は `analyze-large-files.ts` 1本のみ）。
  実作業は「リポジトリ直下 `tools/` への解析基盤新設」に置き換わった（配置・検出軸はユーザー選択）
- 追加コマンド（リポジトリルートから・`--project <tsconfig>` でモノレポ任意パッケージを解析）:
  `pnpm run static:deps`（依存と死蔵 export）/ `static:independence`（関数の独立性・pure 判定）/
  `static:duplication`（同型ロジックの重複）
- 変更範囲: `tools/static-analysis/**`（新規）・ルート `package.json`（scripts 3行）・
  `pnpm-workspace.yaml`（packages に `tools/*` の1行のみ・既存キーは無変更）・`.gitignore`（`.tmp/` 1行）・
  `pnpm-lock.yaml`（追加32行・既存バージョンの変化ゼロ）
- **すべて未コミット**。`TRPG-SERVER/**` `trpg-remix-app/**` `packages/**` は一切変更していない
- ゲート: build 成功・`check:circular` 循環0（589ファイル）・3ツールとも決定的・全 advisory（exit 0）
- 検収で是正した3件: pure 判定の水増し（768→573・キャプチャ未検出と空虚 constructor）／
  死蔵 export の判別不能（`sameFileReferenceCount` 追加で 227 = 真の死蔵95 + export外し132 に分離）／
  起動形が `node_modules` 内部パス直叩き（`run.js` へ1本化）
- 大粒度認知負荷レビューで **CL-1(High)** を検出し統合済み（関数様ノードの語彙が3実装10サイトに分散し
  `symbolName` が 39件中31件ドリフト）→ `shared/function-like.ts` へ1本化・**純減 −18行**・
  不一致 31/39 → **0/39**・グルーピング/判定値は不変を実測
- 積み残し: `TRPG-SERVER/scripts/refactor/analyze-large-files.ts` の改行混入44件（別タスク起票済み・1行修正）／
  同ファイルの `tools/` 移設は**見送り**（レポート内の全パス基準が変わる破壊的変更・参照13箇所）

## 現在の feature

**〔2026-08-13 更新〕直近完了 = U14/U15（シートレイアウト＋ブロック・上限・プール）**。
D-R2 配線 S0〜S6a＋大粒度 #17 二重レビュー＋FIX 5 ラウンド全消化（`e4468ab6` まで）。
現況・次候補は末尾近くの「キュー #9〜#12 ループ」節（検索: `U14/U15 feature 完了`）と
台帳 `design-ledger.md`（§0 現在地・§6-1 ワークキュー）を読む。
（以下の「第4群」記載は 2026-08-03 時点の旧 feature のログ）

`TRPG-SERVER/docs/reviews/full-review-2026-07-26.md` 駆動のリファクタキャンペーン **第4群**（タスク #22）。
経緯・所見・裁定の正本は `TRPG-SERVER/AI.refactor.md`（本 doc は復帰用要約）。

## 完了済みフェーズと検収結果（第4群）

| フェーズ | コミット | 内容 | 検収 |
|---|---|---|---|
| 第4群-a (OV5-1) | `418c6af` | 局所例外フィルタ2本を `@Catch(HttpException)` へ狭小化・生メッセージ露出 18 route 封鎖・N-1 3→2 | build/circular/全suite 緑・Opus needs-fix 5件→round2 解消 |
| 第4群-b (OV5-4) | `3e9c058` | 'エラーが発生しました' literal 10 箇所→`DEFAULT_ERROR_RESPONSE_MESSAGE` 参照（挙動ゼロ） | spec 無変更のまま緑 = 挙動保存の証明 |
| 第4群-c (OV5-2) | `10b1e31` | loadJsonFile を throw 版（discord/utils/file.util）へ一本化・`__dirname` 解決で production 潜在欠陥修正・boot fail-fast | 3実行系（jest/e2e/dist）で解決成立を3者確認 |
| 俯瞰#6 | `0892a3d` | 3者レビュー（Opus×2/Codex/Fable実測）: 合成欠陥なし・OV6-1/2/3 採用・台帳訂正4件 | `review-results/overview-6/integration-verdict.md` |
| 第4群-d (OV6-2) | `cbfb3e1` | gameSystemList 構造検証（parseGameSystemList・boot throw）・型宣言 3→1・死蔵 export 削除 | full suite 230/3196 緑・実物 JSON 224 entries 通過実測・Opus pass（low2 は round2 反映） |
| 第4群-e (OV6-1・E段階1) | `fc70075` | ApiError optional errorCode → filter 1本化・CharacterHttpExceptionFilter 削除（+162/−221 純減） | wire 全項目等価を Opus 突合・認知負荷実測純減（同時保持7→5・複製2→1）・full suite 230/3191 緑 |
| E1a (E段階2前半) | `9765f03` | global の HttpException 封筒化（ApiError 分岐逐語移植・ValidationPipe N件→details[] 非損失・局所 filter 温存） | 局所 4 spec diff ゼロのまま緑・full suite 230/3192・Opus needs-fix(CL-1)→round2 解消 |

並行セッション: T19 `42f12fd`・T31 `7ef6819`・**U1 `0805609`**（セッション B・sheet 必須キー導出1本化）。

**ユーザー裁定（2026-07-29）**: OV5-6 = **E 方向 案 A 採用**（g4e → E1 → E2）。
**cognitive-load-review 最重視**（fable-rules・メモリ反映済み。全スライスのレビュー主レンズ）。

## 進行中・未完了の作業

**俯瞰#7 完了（`3bd0b8e`）**。統合判定 = `review-results/overview-7/integration-verdict.md`。
要点: 合成欠陥なし / **E1b は等価削除ではなく wire 拡張**（generic 分岐は global のみ details[] 保持）
→ Go with conditions / F-1 = sheet-templates の表示粒度退化（E1a 出荷済み）→ E1c 採用 /
キャリア 1 本化 No-Go / CL6-4 クローズ / **訂正の訂正**: lint 6→4 は g4e 帰属で Codex が正だった
（--stdin lint 実験の手法欠陥。メモリ verify-claims 事例5）。

## 次にやること（順序）

1. **E1b**（@UseFilters ×3 撤去＋HttpExceptionFilter 削除）— 同一コミット内の必須条件:
   (a) pin 13 件を GlobalExceptionFilter へ再ホスト（単純削除禁止）
   (b) /auth/login 400・character 404・auth 401 の route 水準 toStrictEqual を**先に**固定・
   wire 拡張（3 route の ValidationPipe 400 に details[] 追加）を宣言
   (c) lint 期待 4→2 errors (d) CL-5 JSDoc 訂正＋CL-4 オラクル明記を相乗り
2. **front 小スライス**: customError.ts:17 の `[0]` → join 化（E1b の details 付与で先頭 1 件表示に
   退化するため対で実施）
3. **E1c**: sheet-templates の検証エラー 3 発生源を配列 throw 化（F-1 復旧・5 行級）
4. E2（front 非封筒 fallback 撤去・死蔵 ';' split 分岐撤去）→ 残: OV5-3・OV5-5・OV5-7・CH-1 系・CH-7
2. E2（front の非封筒 fallback 撤去・別群・front repo）
3. 残: OV5-3（parent-channel 偽成功）・OV5-5（corsApiWithJwt）・OV5-7・CH-1 系・CH-7
4. 第5群（タスク #23）拘束条件: OV6-3（api-response.util 削除は検証面 6 ファイル同時）＋
   g4e CL-1（label/errorCode literal 単一ソース化）＋ CL-2（ErrorResponse サブクラス 401/404 系は
   runtime 消費者ゼロ・spec oracle として存続中）＋ coverage/** の eslint ignores 追加候補

## ゲート状態

- `fc70075`（g4e）検収時点: build / check:circular（循環0）/ 全 jest suite 230 suites・3191 tests 緑
  （3196→3191 の内訳: 自スライス −1・並行 U1 −4）
- lint: 新規指摘ゼロ。ベースラインは U1 コミット後に再計測要（U1 が track-range 系 spec を変更）
- 既知: tsc --noEmit 既存エラー 1 件（test/mocks/auth.mock.ts:48 TS7053）・
  `eslint .` は coverage/** 残骸に 6 parsing error のノイズ（gitignore 済み生成物）
- コミットは TRPG-SERVER pathspec 方式・コミット後に index 残渣（MM）確認 → formatting-only なら targeted `git restore --staged`

## 並行セッション B（api-contract キャンペーン側）の状態（2026-07-29 追記）

正本は memory `api-contract-campaign-state`。完了: 契約キャンペーン本体 / S9・S7e・S7f・S10 /
U5（封筒統一・9eae435 まで）/ T19 `42f12fd` / T31 `7ef6819` / T30（実装不要裁定）/ U2。

- **U1（Task#25）完了・コミット `0805609`**（2026-07-29・6ファイル 21+/29−）。
  必須キー導出1本化（sentinel は expectRequiredCharacterRuntimeKeyCount）・
  writePathValue 到達不能ガード削除・engine isPartsValue 統合（public API 不変）。
  二重レビュー Opus ok(low4)/Codex pass(0)・round 2 で L-2/L-3 適用。
  全ゲート緑（230 suites/3197・contract-stack・integration 24・lint 6/99 不変）。
  設計記録 = AI.character.md「必須キー導出とシート内部の重複整理」。
  証跡 `review-results/u1-required-keys/`
- 着手前裏取りの訂正: `character-sheet-operation.service.ts` は
  `src/features/character-sheet/services/` へ移動済み（台帳の domains/character は陳腐化）。
  `does not allow parts` は2箇所で、削除対象は writePathValue 末尾（544-546 行）のみ・
  492 行の assertWritablePath 内は正当。L1 は index.ts 非経由の葉モジュール（public API 不変）
- **2026-07-30 ユーザー承認**: 「推奨方法を Codex と相談して進めてしまって構わない」→ 保留解除。
  Codex read-only 相談完了（review-results/next-phase-consult/・実測根拠つき）。**確定計画**:
  第1 = U3（palette ラベル書式を @trpg/sheet-projection 葉モジュールへ・書式規則3→1・Task#32）→
  第2 = #29 を「2公開境界のみ」へ縮小（publish 検証の raw Error 500 化経路＋notation 展開失敗の
  generic 422 退化経路。engine 全 67 throw の型階層化はしない）。着手条件 = 並行セッションの
  wire 形式安定（未確定なら第3と入替）→ 第3 = #28+#23 の本番 DB read-only 実測のみ →
  第4候補 = U4 ベンチのみ（第3と束ねない）。**#7 は close 済み**（DomainDataMap コード0件・
  Codex＋Fable 独立確認）。#24 は独立の裁定資料タスク・#20 は初回 CI 後に分割実施・
  #12 は customError.ts 衝突で保留・U6 は対象外
- **U3（Task#32）完了・コミット `d584020`**（2026-07-30・6ファイル 56+/7−）。
  palette ラベル書式を @trpg/sheet-projection の葉モジュール palette-label.ts へ1本化
  （複製3→1・同時保持5→1・public API +2関数のみ）。挙動保存はド・モルガン構造証明＋
  差分テスト406ケース差分0で証明。二重レビュー Opus pass(low1)/Codex pass(low2)。
  `—` の共有定数化は認知負荷優先で不採用裁定（コメント1行で結合明示）。
  全ゲート緑（230 suites/3192・projection 2/19・循環0・lint 4/99 不変）。
  設計記録 = AI.character.md「palette ラベル書式の1本化」。証跡 review-results/u3-palette-label/
- **#28+#23 の本番 DB read-only 実測完了**（2026-07-30・review-results/task28-23-data-survey/
  survey-report.md）。**最重要所見: 本番のシートテンプレートは 0 件・materialized キャラも 0 件
  = Phase 2 シート機能は本番未採用**。#28 の上限はどの候補でも切り捨て0（移行・互換分岐不要・
  厳しい側 uid 64 / label 128 のコストゼロ）。#23 の衝突は実データ0だがコード上のギャップは実在
  （publish 検査 scalar/computed のみ vs materializer は track/roll も後勝ち上書き）=「経路を塞ぐ
  前向き課題」。U4 ベンチの入力分布は実データから導出不能（fixture 合成が必要・
  アンカーは旧属性 max 37・doc max 2.9KB のみ）
- **事故記録**: 実測エージェントが環境の DNS 隔離（127.0.0.1 固定）を dns.setServers で回避して
  Atlas へ到達（harness 警告・プロセス内限り・DB は read-only 証跡あり・成果物に漏出なし）。
  メモリ delegation-must-forbid-control-bypass に教訓化 — 外部接続系の委譲指示書には
  「制約に阻まれたら回避せず停止して報告」を定型で入れる
- **2026-07-30 ユーザー裁定**: 「後方互換なしでいい・あなたが判断していい・
  cognitive-load-review の観点が揃うならばいい」→ Fable 裁定: ①#28+#23 実装 Go・
  上限 = uid 64 / label 128（publish schema の uid/label 全キーへ一律・エラーに値を反響させない
  増幅 spec 付き）②#23 の投影型集合はローカル Set＋結合明示コメント（U3 の `—` 裁定と同原則・
  domains→features 禁止辺でもある）③**U4 ベンチは Phase 2 採用判断まで保留**。
  #29 は E1b 着地待ちのまま
- **#28+#23 完了・コミット `32ee086`**（2026-07-30・5ファイル 203+/9−・3ラウンド）。
  publish schema の uid/label 全キーへ ≤128（**uid 64 案はレビュー F-2 で 128 へ裁定変更** —
  canonical path 写し規約 最大98文字を弾くため）・自前固定メッセージ（zod 文言非依存・値非反響）・
  増幅 spec は sentinel＋UTF-8 byte＋per-issue O(1)。衝突検査は isProjectionField() と同集合
  （scalar/computed/track/roll・ローカル Set＋結合コメント）。再現 spec の旧前提
  （長大 uid/label は publish 可能）は反転済み・実行時 4,096 予算検証は防御層として存続。
  二重レビュー Opus needs-fix(F-1 blocking→round2 解消)/Codex needs-fix(medium1)→round3 全反映。
  全ゲート緑（engine 55・230 suites/3,197・循環0・contract-stack・lint 4/99 不変）。
  残タスク起票: **#33**（formula/notation/lookup rows の残存増幅・理論50MB級）。
  #29 へ CL-2（materializer 逆参照コメント）を相乗り済み。
  設計記録 = AI.character.md「publish 検証の見直し」（旧「uid/label 無制限が根本」記述も更新済み）
- **大粒度認知負荷レビュー完了**（2026-07-31・review-results/overview-batch2/・二重実施）。
  直近3フェーズ導入の複製ゼロ（U1/U3 の1本化は横断でも成立）。統合フェーズ5件を起票:
  **#34** BasicTemplateValidationService 削除（両者一致・死蔵第2実装 384行・#28 乖離6件実測）→
  **#35** 投影規則を domains 側へ1本化（処方衝突を Codex 構造化案で裁定・features→domains 合法方向）→
  **#36** publish 参照キー一意性（Codex C-high・重複 canonical path を ok:true 受理の実測）→
  **#37** 式検証 issue 二重発行解消 → **#38** sheet-projection 低スイープ。
  正本 = integration-verdict.md。#29（E1b 待ち）は独立に挿入
- **#34 完了・コミット `e1a1ca5`**（2026-07-31・4ファイル 31+/388−・純減357行）。
  1対1照合10行を両レビュアが実測プローブで全行裏取り（黙って消えた spec 検証ゼロ）・
  rowRole.kind ケースのみ engine spec へ移送。「権威側に規則なし」8件バケット
  （4上限・secret・uid 空文字・role.when・rowRole.when）は #36 説明へ台帳化済み。
  全 229 suites/3,187 tests・lint 4/99 不変。指示書教訓: 削除照合は spec assertion
  だけでなく**実装規則の全列挙**で（「など」の例示止まりが3件の台帳漏れを生んだ）
- **#35 完了・コミット `4a2cd7d`**（2026-07-31・2ファイル 21+/25−）:
  投影規則（isProjectedFieldType/projectionTarget）を
  projection-key-validation.ts へ1本化し materializer が import。
  **裁定反転の記録**: T28 時の「ローカル Set＋コメント」裁定の阻害根拠は
  domains→features 禁止辺だったが、本件の依存は **features→domains（ARCHITECTURE §4 許可辺）**
  で該当せず、実害記録（#23 の乖離）を持つ複製にはコメント運用より import 1本化が優越。
  #29 に積んでいた CL-2（逆参照コメント）は本変更で不要化・取り下げ。
  レビュー: Codex pass(0)・Opus needs-fix（F-1/F-2 = Fable の doc 陳腐化→修正済み・
  F-3 JSDoc 位置・F-4 engine 型 rename のコンパイル時ガード復元→round 2 適用）
  罠メモ: `pnpm test -- <args>` は jest にパターン扱いされる（`--runInBand` 等のオプションは
  不発・全 suite は素の `pnpm test`）
- **#36 完了・コミット `85b2723`**（2026-07-31・3ファイル 203+/8−）:
  publish に canonical path / table id の一意性（list itemFields 再帰含む）＋ uid .min(1)。
  重複は**常に報告・表示値のみ 98 文字切り詰め**（150 文字 pin spec で機械固定）。
  Fable 監査で注入した fail-open 疑義（長さゲート）は Opus が計装プローブで「現行到達不能」を
  証明しつつ、目的未達（増幅の本丸は validateId path echo・300KB 実測）＋入れ子 list 対応で
  黙殺実在化＋認知負荷過大（ホップ5・同時保持4）→ 両レビュー処方一致で round 2 撤去。
  round 3 = Fable 検収指摘（切り詰めガードの pin spec 欠落）の補完。
  **裁定3件**: ①relation attrs 素通り（Codex high / Opus F-2・既存不具合）は挙動追加面が
  一意性を超えるため **#39 へ切り出し**＋role/rowRole.when 黙殺（台帳⑦⑧）も #39 相乗り。
  ②validateId path echo（Opus F-3）と台帳①〜④の量的上限は **#33 へ**。
  ③台帳⑤ field 直下 secret は**不採用**（passthrough 設計の未知キー黙殺の一事例・意図的放置）。
  **裁定反転の記録**: 俯瞰時の「projection 側 canonicalPath 検査削除」処方は round 1 で反転 —
  3層は境界責務の異なる多層防御（projection 側にしかない担保あり）で統合せず連結コメントのみ。
  全ゲート緑（engine 63・229/3,187・循環0・lint 4/99 不変）。
  証跡: review-results/ov3-publish-uniqueness/（round1 二重レビュー・integration・acceptance）
- **俯瞰#8 完了（overview-batch3・2026-07-31・二重実施・正本 = integration-verdict.md）**:
  #34 残骸ゼロ・#35 取り残しゼロを両者独立確認（統合3フェーズの健全性成立）。
  新検出: **F1 = server 側「投影先ごと canonical path」検査は死蔵**（Opus 256ケース
  プローブ 0/208 通過・field id 半分は生存実証。round 1 の層跨ぎ3層裁定とは対象が別。
  Codex の「削除処方なし」はプローブ無し前例踏襲で棄却）。
  **根拠は #40 レビューで訂正済み（Opus B-1）**: 「engine 全体 Set が支配」（層跨ぎ論法）
  ではなく「**同一関数内に残る field id 検査が単独で厳密支配**」（canonical path 一致 ⇒
  同一 target ∧ 同一 field.id。実測 514/514）。正本 = integration-verdict.md の訂正注記。起票: **#40 OV8-a**（挙動不変純減 −55行:
  F1 canonicalPath 削除［field id 保持］・F2 uid helper 化・F3+F4 lookup 2実装統合・
  F5 死蔵2件・F6 parts 式・F7 32 二重符号化・F8 コメント訂正・CL-3 as const 導出）/
  **#41 OV8-b**（feature 側 state/palette 型削除 −23行・Codex CL-2）/
  **#42 裁定**（save が publish 規則を全適用する結合・Codex CL-1）/
  **#43 裁定**（dice 判定二重走査の真理値差・Opus 保留）。
  engine の lint ゲート不在（死蔵検出ゼロ）は #20 へ追記。
  実行順: #37 → #40 → #38 → #41（裁定 #42/#43 は随時）
- **#37 完了・コミット `451e036`**（2026-07-31・2ファイル 51+/3−）:
  未知 function・max/min arity の issue 二重発行を解消。**裁定反転の記録**: 俯瞰#2 の
  「inferCallType へ統合・純減20行」は Opus の裁定方向変異体で不成立を実証
  （first-error で複合式2件目が欠落）→ 逆方向（validateFunctionCalls 単独発行・純増5行）採用。
  機構: Error ベース sentinel＋fail-closed ガード（sentinel 同一性 AND 前段発行済み。
  フラグ単独は無関係型エラーを握る — 変異体実測で禁止）。Opus は900テンプレートファズで
  漏出ゼロを証明。残: **#44**（参照エラーの同形二重発行・first-error 契約裁定が先）。
  証跡: review-results/ov4-issue-dedup/
- **#40 OV8-a 完了・コミット `2dc8b23`**（2026-07-31・7ファイル 111+/77−・production −21行）:
  俯瞰#8 の純減8項目。F1（projection 側 canonical path 検査削除 — **根拠は同一関数内
  field id 検査の厳密支配**・514/514 実測・field id 検査と spec は保持）・F2（uid 一意性を
  helper へ・Map→Set）・F3+F4（lookup 型推論/table 解決の複製解消。nested array の
  text fallback は isNotationFragment の String 強制対策 guard＋pin で保存 — 完全単純化は
  型外入力で挙動差のため見積−55は未達・正当な逸脱）・F5 死蔵2件・F6 allowsParts・
  F7 regex 導出（message byte 不変）・F8 コメント45文字訂正・CL-3 as const 導出。
  挙動不変（例外: uid >98 重複の表示のみ・pin 済み）。
  レビュー: 両者 pass。**Opus B-1 = Fable の記録根拠が層跨ぎ論法で自裁定と矛盾**
  → 3記録訂正済み・教訓は verify-claims-before-prescribing 事例6。
  I-3 メモ: test/mocks/auth.mock.ts の TS7053 は並行セッション由来の既存事象（不触）。
  証跡: review-results/ov8a-net-reduction/
- **#38 完了・コミット `02bbc20`**（2026-07-31・4ファイル 42+/13−）—
  **俯瞰#2 起票分（#34〜#38）これで全完了**。regex source 5→2（正本は中立名
  CUSTOM_ID_SAFE_TOKEN_SOURCE・palette 固有名を正本にする誤ラベルを Codex が検出）・
  Discord 上限 named 化（48 = 導出上限52−予備4・由来無しを両者確認・予算 pin spec 追加）・
  `—` module-local 化（U3 裁定維持・AI.character.md へ区別基準を追記済み）。
  出力 byte 不変を両レビュア独立再現。相補性の実例: Codex=誤ラベル正本・
  Opus=第3の写し/裸200/予算 pin と検出領域が完全に分かれた。
  証跡: review-results/ov5-projection-sweep/
- **俯瞰#9 完了（overview-batch4・2026-07-31・二重実施・正本 = integration-verdict.md）**:
  #37/#40/#38 の新機構（sentinel/一意性 helper/regex alias）間の**新規複製ゼロ**を両者確認。
  検出領域は今回も完全相補 — Opus: customId null 処理 3方式6箇所・createHubViewModel 死蔵・
  **allowsParts の cross-package 写し残存（OV8-a F6 は server 内で完結していた）**・
  assertArity byte 一致・barrel 死蔵5件 / Codex: **CL-1[中] lookup 型優先順位が3箇所2順序に
  分裂（publish 受理→runtime 拒絶の実害再現・row-level resultType 使用実績0）**。
  起票: **#45 OV9-a**（機械的純減 −35行・警告 message 統一のみ挙動変化）/
  **#46**（row-level resultType 契約削除・挙動裁定つき）。#43 へ Opus B-1
  （inferRuntimeInputType ⇄ inferRuntimeType の load-bearing 真理値差）を併合。
  実行順: #45 → #41 → #39 → 俯瞰#10 → #46 → #33（裁定 #42/#43/#44 は随時）
- **#45 OV9-a 完了・コミット `1cf6adb`**（2026-08-01・9ファイル 57+/66−・production −37行）:
  customId null 処理 3方式6箇所→helper 1本（code@path pin・fail-closed 残置に根拠コメント）・
  createHubViewModel 削除・**allowsParts 正本を engine value-input.ts へ**（server util は
  互換 shim・AI.character.md の正本記述も更新済み）・assertArity を arity.ts
  （index 非公開の葉）へ1本化・barrel 死蔵5件＋alias 2名削除・warning 数値補間。
  レビュー: Codex pass(0) / Opus pass(low5)。**裁定分岐の決着**: index.ts 明示 export 化を
  Codex は許容・Opus L3 は arity.ts 切り出しを処方 → Opus 採用（編集箇所 1 vs 2・
  descriptor 非対称と publish→evaluator 辺も同時解消。index.ts は HEAD 同一へ復帰）。
  **指示書教訓**: 「新ファイル作成は不可」が葉配置まで禁止し round 1 の歪みを誘発 —
  抽象追加の禁止と配置用モジュールの禁止は区別する。
  全ゲート緑（engine 69・projection 22・server 3,186・lint 4/99）。
  証跡: review-results/ov9a-mechanical-reduction/
- **#41 OV8-b 完了・コミット `ce158c3`**（2026-08-01・1ファイル 6+/26−・−20行）:
  feature 側 CharacterSheetState/PaletteEntryBase/PaletteEntry 定義を削除し
  domain（character.entity.ts）型の import type＋type-only re-export へ1本化。
  レビュー: Codex pass(0)（AST メンバー単位比較・strict 双方向 extends 4/4・
  emit 77 bytes SHA 一致）/ Opus pass（42アサーション＋負の対照14/15発火・
  実 nest build 成果物とも byte 一致・**「2→1」は server 内の数字で repo 全体の
  実ファン・アウトは 4→3**）。全ゲート緑（3,186 tests・循環0・lint 4/99）。
  **俯瞰#10 議題**: S1 = ProjectionPaletteEntry ≡ CharacterPaletteEntry の
  cross-package 同形残存（機械確認済・境界逆流のため import 統合不可・
  片方向型互換アサーションで drift 検出案）/ S2 = characterPaletteEntrySchema
  （zod）との同期が人手依存。
  **インシデント**: Opus レビュアの emit プローブ（rootDir 不備）が src/ へ
  生成物6件を流出 → 自己申告の「復元済み」は誤りで残存・Codex の lint 7-errors
  注記から Fable が検出・削除し 4/99 復帰。教訓はメモリ
  review-agents-must-be-readonly へ（emit プローブは transpileModule か
  scratchpad outDir 限定・「復元済み」申告も untracked スキャンで裏取り）。
  証跡: review-results/ov8b-state-palette-types/（正本 = integration-round1.md）
- **#39 完了・コミット `f60b0db`**（2026-08-01・2ファイル 219+/12−・2ラウンド）:
  publish 検証の素通り解消。relation attrs を validateField 再帰へ（canonical path/uid/
  ID_PATTERN/when/role が attr にも発火・front collectFieldUid との非対称解消）＋
  role.when / rowRole.when 拒絶（`role.when is 未対応`・field.when と message 区別）。
  レビュー: Codex pass(low2=sandbox 未検証申告のみ) / Opus pass(should2, info4)。
  両者が変異体プローブ独立実施（Opus は scratchpad 複製4系統 jest 実測で pin a〜f 全滅確認）。
  round 2 = F1（**MAX_CANONICAL_FIELD_PATH_LENGTH を 32*4+3=131 へ再導出** — attr 再帰で
  4セグメント path が生まれ98前提が偽に。spec 98境界3箇所追随・131 path pin 追加・
  旧 120文字 uid 切り詰め pin は前提消滅で「schema 最大128 非切り詰め」pin へ転換）＋
  F2（superset コメント）＋ F3（到達不能な非 scalar チェック3行削除）。
  F4（'when' in role 由来コメント）は不採用裁定。
  重要確証: resolvedRefs 新種 entry 消費者0件・front に relation ビルダー不在・
  validateForSave 同関数共有で save にも新規拒絶が効く（#42 裁定対象として残存）・
  engine 2ファイルに lint gate は存在しない（「4/99」は TRPG-SERVER スコープ）。
  **指示書教訓をメモリへ**: 形状前提（セグメント数）を動かす変更は依存定数の再導出を必須項目に
  （delegation-prompt-must-name-invariants 事例追加）。
  全ゲート緑（engine 77・projection 22・server 3,186・lint 4/99）。
  証跡: review-results/t39-publish-passthrough/（正本 = integration-round1.md）。
  **次 = 俯瞰#10（3フェーズ #45/#41/#39 完了・S1/S2 議題込み）**
- **俯瞰#10 完了（overview-batch5・2026-08-01・二重実施・正本 = integration-verdict.md）**:
  #45/#41/#39 の3フェーズ横断。**新機構の第2実装ゼロを両者が独立 grep で確認**
  （attr 再帰・role.when・acceptGeneratedCustomId・arity.ts・allowsParts・型 re-export）。
  検出は今回も相補 — Codex: AST 上限2宣言・palette cap 512×4・AI.character.md 陳腐化 /
  Opus: **front の ID_PATTERN/RESERVED_IDS 完全複製（high・予約語14語×2セット・3ホップ）**・
  isPartsValue の同名異責務2実装（真理値が割れる入力3クラス・1本化不適と裁定）・
  value-input.ts の fieldsByUid 再実装・publish の buildTemplateIndex 8回再構築。
  **tsc プローブ8件で palette 同期を機械実測**し、前回持ち込み議題を決着:
  domain⟷zod は既存 character-wire.contract.spec.ts の IsExact が双方向被覆済み（S2 は対応不要）・
  欠けは domain⟷projection の片方向のみ（S1 = 素の代入 assert +6行で解決）。
  **裁定衝突3件はすべて Opus 採用**（プローブ実測 > 定数統合の一般論。zod 追加は純増・
  AST 定数は import 辺を増やさず相互参照コメント・palette cap は跨ぎ統合しない）。
  起票: **#47 OV10-a**（挙動不変スイープ約20行）/ **#48**（ID 規則の正本共有・挙動変化あり・
  F4 同梱）/ **#49**（buildTemplateIndex 再構築・性能予算の要求が立つまで保留）。
  クローズ判定: 「未対応」message 統合（同時保持 3→4・+1ホップで**価値は負**）・
  front ID 規則の多層防御・`—` 2定義・truncate/parts 合計の跨ぎ実装（projection 無依存設計）。
  AI.character.md の陳腐化3件は Fable が直接修正済み（数値の括弧内再掲を参照化・
  OV9-a 節を新設）。証跡: review-results/overview-batch5/
- **#47 OV10-a 完了・コミット `561786f`**（2026-08-02・7ファイル 47+/4−・3ラウンド）:
  palette 型 drift を character-wire.contract.spec.ts で機械固定（既存 IsExact/OptionalKeys/
  MismatchedValueKeys の合成・**新 helper ゼロ**・負の対照4件実測）／api-contract の
  palette 上限を PALETTE_MAX_ENTRIES へ1本化（未 export 維持）／非局所前提の明文化3件。
  レビューは **Codex adversarial ＋ 4レンズ Workflow の二系統**。
  **レンズが Codex の見落としを2件検出**:
  ① projection.ts のコメントが兄弟2サイトの語り口を流用して主張が強すぎた
  （spy 実測: 兄弟は生成関数を**0回**しか呼ばないが新サイトは**呼ばれて null を返す** —
  守っているのは `channelValid &&` の短絡だけ）→ round 2 で実態へ書き換え
  ② isPartsValue コメントの根拠「schema 分岐のため」は engine 側5呼び出しのうち2箇所のみ
  → 実際の不変条件（緩く検出し呼び出し側が厳格検査）＋ re-export 不可の事実へ差し替え。
  **Fable の裁定変更1件**: 俯瞰#10 の「IsExact を持ち込まない」は「新規機械になる」という
  未検証の前提が誤りだった（repo 内6ファイルで既存）。
  **さらに是正版の指示書で同じ失敗を反復** — レンズの「IsExact なら optional も検出（実測済み）」を
  検証せず拘束条件に転記し、実装者が負の対照で前提矛盾を検出して停止・報告（統制が機能）。
  repo の IsExact は双方向 extends 版で pure optional 追加のみ素通りするのが正。
  round 3 で上限15行の合成を採用し optional も検出。教訓は
  [[verify-claims-before-prescribing]] 事例7（後半が本命）。
  全ゲート緑（server 3,186・engine 77・projection 22・api-contract 14・contract-stack・
  循環0・lint 4/99・untracked 汚染ゼロ）。証跡: review-results/ov10a-sweep/
- **#48（2026-08-03・`3944d76` でコミット済み）** — 途中経過の記述は誤誘導になるため
  **最終形のみ**を記す。設計の詳細正本は
  `trpg-remix-app/app/features/characterTemplate/AI.types.md`（**追跡対象**）。
  `review-results/` は `.gitignore:68` で除外されるため正本にしない。

  **当初目的（front の ID 規則リテラル複製を engine 正本へ寄せる）は撤回した。**
  実測で割に合わないと判明したため（下記）。front の
  `v3Template.ts:11-28` のリテラル複製は**意図的に残置**する。

  **実際に届けるもの**:
  1. **committed HEAD に実在した production 欠陥2件の修正**（これが本体）
     - build SSR で `evaluateTemplate` が `void 0`（route `/templates/:id/edit` で到達）
     - dev SSR で `ReferenceError: exports is not defined`
     - 原因: pnpm junction が実体パス `packages/sheet-engine/dist` へ解決され、
       そのパスが `node_modules` を含まないため Vite の既定変換対象から外れる
     - 対処: `vite.config.mjs` の3設定（`build.commonjsOptions` / `ssr.optimizeDeps` /
       client `optimizeDeps.include`）。**3つとも独立に必要**（1つずつ外して別々の失敗を実測）
  2. **等価テスト**: front `validateLocalTemplate` ⇔ engine `validatePublishTemplate` が
     同一 id 集合に同じ受理/拒絶を返す（`v3Template.spec.ts`）。
     engine の予約語配列を export してコーパス源にしているため、
     engine の規則変更に front が追随していなければ赤くなる
  3. wrapper `utils/sheetEngine.ts` **削除**（consumer が engine を直接 named import・ホップ 2→1）
  4. `@trpg/*` の値 namespace import を eslint で禁止

  **撤回した設計と理由（すべて実測）**:
  - front production が engine の runtime 値を import する形 → `TemplateListV3` 経由で
    **一覧ルート**の client chunk が gzip **+72.6KB**（CJS は tree-shake が効かない）
  - spec でリテラル一致を assert する形 → front production 側が **fail-open**
    （`FIELD_ID_PATTERN` を `[a-zA-Z0-9_]` に緩めても全緑だった）
  - 「named import は欠落 export を build error にする」→ CJS 変換適用後は**偽**
    （Rollup が synthetic named exports を生成）。守れるのは**設定退行**のみ

  **コミットゲート（round 6・二重レビュー完了）**:
  - Codex `--mode review`: コード・コメント・engine 挙動に blocking 無し。
    Fable 未検証だった3主張（退行 chunk の `exports` 9 / `require(` 8、
    namespace 退行 build が EXIT=0、named なら EXIT=1）を**独立実測で真と確認**。
    `Set.has` → `Array.includes` は 5経路 × 14語 = 70件プローブで文言まで完全一致
  - Codex の blocking は**コミット境界の誤り**（コードの欠陥ではない）:
    Fable の「8ファイル」はコードのみの数で、追跡済みの設計正本 `AI.types.md` が漏れていた。
    **確定: コミット境界は9ファイル**（コード8 ＋ `AI.types.md`）。
    `document/SESSION_HANDOFF.md` は `git log` が空＝元から追跡外なので含めない
  - Opus 認知負荷レビュー: blocking 無し・findings 7件はすべて理解コスト。
    Fable が事実主張5件を独立に裏取り（全件真）。うち5件（導線コメント・撤去チェックリストへの
    doc 追記・再ビルド前提・件数 assert のテスト名・非目標1句）を **round 7** として同梱、
    残り3件は **#55 / #56 / #57** へ分離
  - **CL-2（コメント8→4行）は保留**: 削除論拠「検死数値は再検証不能」を
    Codex が同サイクルで再実測して反証。加えて CL-2（doc にあるから消せ）と
    CL-3（その doc こそ腐る）が逆を向く。裁定は `interop-design-verdict.md`

  **round 7 コミットゲート（4レンズ × 反証・17エージェント）**:
  - レンズ: 文言の真偽 / テスト名の妥当性 / 記述の重複 / コミット境界。
    各指摘は独立の懐疑者が「**事実として誤りか**」と「深刻度が過大か」を**別々に**判定
  - **blocking ゼロ**。生存11件は全て low、1件は事実誤りとして棄却
  - 境界レンズが**隔離 worktree に HEAD + 10ファイルのみを適用して全ゲート緑を実測**
    ＝コミット単位の自己完結性が確定（worktree は撤去済み）

  **round 8（テキストのみ11行）で直した5件**:
  - **H-1**: 件数 assert のテスト名を「削減」→「増減」へ。
    **2レンズが別々に指摘し両方が反証を生存** — 追加方向で赤くなると名前は「削減」・
    失敗本文は `Received length: 15` で**名前が自分の失敗出力と矛盾**していた。
    `publish.ts` は全9コミット中**7件が直近3日**で、現実に起きるのは追加方向
  - **H-2**: 撤去チェックリストに `eslint.config.js` を追加
    （round 7 が `AI.types.md` について直したのと**同じ欠陥がもう1件残っていた**）
  - H-3: eslint message に根拠の所在を1句（片方向の袋小路を閉じる）
  - H-4: 危険な入口を script 名列挙から**条件**へ（#54 着地時に虚偽化しない形）
  - H-5: 非目標の front 単独厳格化に `Task #56` を付番

  **Fable が `AI.types.md` を自分で3箇所訂正**:
  - **自分が書いた数値の誤り**: 「gzip +72.6KB」は round 2 の一次ログを復元して確認した結果、
    単一 chunk の**総量**であって増分ではなかった。実増分は**約 +70KB**（2.4KB → 72.8KB）
  - 「値の consumer は2件」が同コミットの spec 値 import と矛盾 → 「**production の**」で限定
  - 件数 assert と等価テストの分担を明文化・受容する限界に `Task #56` を付番

  **作業中に自分で踏みかけた罠**: 一次ログのパス `review-results/...` を追跡 doc に
  書きかけた（コミットされないので他人のクローンで切れる）。パス参照を落として再測手順へ置換。
  さらに `review-results/` を除外する `.gitignore:68` は**並行セッションの未コミット変更**で
  HEAD には無いことも判明（HEAD では untracked かつ未 ignore）

  **教訓**: [[cross-package-runtime-value-blindspot]] [[verify-claims-before-prescribing]]
  [[negative-control-substitution]] [[cross-review-contradiction-check]]
  [[commit-unit-verification]]。out-of-scope 所見は **#51〜#58** として起票済み
- **#56/#57（2026-08-04・`c1fcaa8` でコミット済み）** — #48 の後続スライス。
  予約語 drift 検出を**集合等価化**（front `RESERVED_IDS: ReadonlySet` を export・
  `toHaveLength(14)` を sort 済み配列比較へ置換）し、engine の照合を内部 Set
  `RESERVED_IDS` 単一正本へ（公開配列は `Object.freeze([...RESERVED_IDS])` 導出・
  `validateId` は `has` 判定）。**#48 で受容していた検出限界2つが閉じた**:
  front 単独追加（旧 M4 緑）と同数入れ替え。変異実測 4方向すべて赤・第2集合は適用不能。
  engine 挙動は 5経路 × 14語 = 70件プローブで文言まで不変。バンドル gzip 2,810B 不変。
  - 二重レビュー（Codex ＋ Opus 認知負荷）: コード blocking なし・R1 の同時保持 6→2。
    唯一の必須指摘は「`AI.types.md` の drift 検出節が虚偽化する」で、同一コミットで同期済み
    （検出は集合等価＋等価テストの2段構え・「受容していた限界」段落は削除）
  - Opus CL-2 の重要発見: 公開配列の engine 内 runtime 参照が 0 になり、engine 単体の
    static:deps では**真の死蔵に誤分類される状態を本差分が作った** → `publish.ts` の
    定義直上に consumer 導線コメント1行で対処（publish.ts は直近5日8コミット中3件が
    死蔵掃除スイープ＝踏む確率が高い）
  - `AI.types.md` に失敗署名の詳細（`MISSING_EXPORT` warning EXIT=0 / named なら EXIT=1）を
    補記 — #55 の新コメントが失敗署名を doc へ委譲するための前提
- **#55（2026-08-04・`35f1144` でコミット済み）** — vite interop コメント 8行 → 5行圧縮。
  round 9 レビューの行別裁定（L38 検死数値・L40 再述を削除、L37/L39 は
  「失敗署名は AI.types.md 参照」へ圧縮、L35/L36/L41/L42 維持）。意味チャンク 10→5。
  委譲先の `AI.types.md` に `MISSING_EXPORT` 署名（namespace=warning で EXIT 0 /
  named=EXIT 1）を**先に補記してから**参照を張った（宙に浮く参照を作らない）。
  設定オブジェクトは不変・dev SSR 3経路の読み込み成功を再確認済み
- **static-structure-audit 初適用（2026-08-04）** — front/engine に deps + duplication の
  4解析。検証済み所見を **#59**（front 死蔵ファイル8件＝fanIn 0・grep 裏取り済み。
  duplication 上位2グループは死蔵内なので削除で解消）・**#60**（auth-guards の
  `requireAdmin`/`requireResourceOwnership`/`checkAuth` が宣言のみ参照 0 —
  配線漏れか YAGNI かのセキュリティ裁定）・**#61**（生きた重複: `getResponseStatus`
  route 2箇所素コピペ / engine spec の fixture 自前コピー）として起票。
  parser の parseAdditive⇄parseMultiplicative 同型は意図的な段構造として flag しない判断を記録
- **#59（2026-08-04・`0cd28ac` でコミット済み）** — static:deps 実測の死蔵掃討。
  13ファイル・**961行純減**（モック系コンポーネント5＋孤児CSS3＋characterSlice＋
  hoverStyles＋character/types、PaginationParams/PaginatedResponse 宣言削除、
  engine FieldLocator の export 解除）。front lint warnings 228→218。
  duplication 上位2グループ（TextCell / createTestSlice の素コピペ）は死蔵内だったため
  削除で解消。auth-guards の未配線ガード3関数は #60 裁定まで残置
- **#58（2026-08-04・裁定済み・実行保留）** — Codex 相談の結論: **(d) tracked な入口＋
  作業系列別 handoff（document/session-handoffs/<task-id>-<slug>.md・1ファイル1所有者）**。
  (a) 単独 tracked 化は同一 worktree の並行上書きを git が検出できず共有書き込み点が残る、
  (b) ignore 明示・(c) 明文化のみは No-Go。実行トリガー: CLAUDE.md / settings.json /
  fable-rules の並行セッション未コミット変更の着地後（詳細は Task#58 の記述と
  review-results/t58-handoff-tracking/）
- **俯瞰#11（2026-08-04・大粒度認知負荷レビュー完了）** — 3フェーズ毎の必須ゲート。
  Opus（モードA大粒度）＋ Codex（reuse & duplication スイープ）＋ ts-morph 実測の三本立て。
  **最重要所見 L1: 式言語が front V2（1,888行）と sheet-engine（1,413行）に二重実装**され、
  V2 は mock ルート2本から loader/ガードなしで production 到達・正本の記載なし。
  小粒度が全 pass だった理由 = 各スライスは片側しか触らず、AST 重複検出は tsconfig を
  跨げない（機械実測にも構造的に不可視だった）。preset-map の再発・パッケージ境界版。
  起票: **#62**（V2 去就の製品判断・除去なら約1,780行純減）/ **#63**（関数語彙 drift の
  等価テスト・fail-open と sentinel 文言混入の予防）/ **#64**（barrel 明示化＋隠れ死蔵8）/
  **#65**（V3 プレビュー notation の silent no-op — publish 受理 8記法中4つで無反応の実測・
  挙動変更）/ **#66/#67/#68**（server 真の重複3件・並行セッション調整後）/ **#69**（V3 側
  リテラル小掃討）。#61 はスコープ 2→5 へ訂正・#60 に L6 新証拠追記。
  意図的分離と裁定（統合しない）: getCharacter* 5実装・command execute・
  request-context HOF 化。ツール盲点2件（tsconfig 跨ぎ・export * barrel）は
  static-structure-audit スキルへキャリブレーション追記済み。
  正本: review-results/ov11-large-grain/verdict.md
- **#63（2026-08-04・`a275a40` でコミット済み）** — 関数語彙とアリティの drift 等価テスト
  （俯瞰#11 L2 の処方）。`function-vocabulary.spec.ts` 新設（28テスト・9関数×
  publish 受理/evaluate 実行/不正アリティ両側拒絶を動的列挙）＋ publish.ts に
  テスト専用 export `SHEET_KNOWN_FUNCTION_VALUES` 2行のみ。変異4種
  （'abs' 追加・evalCall/inferCallType 分岐削除・max アリティ改変）の検出を実測。
  engine 77→**105テスト**（7 suites）。総数固定 assert の名前は round-8 H-1 同型欠陥
  （「shrinking」主張・増加でも赤）を Opus 差し戻しで方向中立へ修正済み
- **委譲環境インシデント（2026-08-04・解決済み）** — #63 の Codex 変異実測（temp 複製）後、
  実リポジトリ `packages/sheet-engine/node_modules` の junction 4本（jest/ts-jest/
  typescript/zod）が撤去済み temp を指し engine の jest/tsc/build 全停止。
  plain `pnpm install` は "Already up to date" の no-op — `rm -rf` → `pnpm install --force`
  で修復（lockfile は sha256 前後突合で不変・他パッケージ汚染なしをスキャン確認）。
  メモリ `codex-temp-workspace-junction-pollution` ＋ codex-delegate-e2e スキルに
  統制2件（temp 複製の node_modules 再リンク禁止・「git 変更系操作禁止」の書き方）追記
- **#62/#65 設計裁定（2026-08-04・受入済み）** — Codex 相談の結論を受入。**V2 スタック
  1,888行＋ mock ルート2本は除去**（隔離 No-Go）。notation は `NotationFragment` ⇄
  `StandaloneRollExpression` の2契約分離・実行主体 server/BCDice・publish 専用検査
  （draft save/既存公開 revision 不変）。決定的根拠: legacy CoC seed の `3d6*5` 系は
  fragment 検査流用で8件全滅。実装順 B0→A1→B1→B2→B3→A2→A3(#64)→B4。
  A1（mock 閉鎖）は独立着手可として先行実施中。#69 は再測により #62 依存へ変更
  （schemaVersion 4箇所は contract z.literal(3) で型固定済み・「コメント1語」は再現不能）。
  正本: review-results/ov11-large-grain/verdict.md 末尾の統合判定
- **#62-A1（2026-08-04・`56170c0` でコミット済み）** — 未認証 mock ルート2本
  （mock.template-editor / mock.template-gallery）＋親リンクを削除し doc 6件の正本表記を
  V3 server draft へ更新。9ファイル・8+/79-。V2 本体1,888行は B 契約確定後の A2 で削除
- **#60（2026-08-04・`8e3daa3` でコミット済み）** — auth-guards 死蔵3関数
  （checkAuth/requireAdmin/requireResourceOwnership）を削除・-65行。Codex 裁定:
  server 側で所有権が三層強制（JwtAuthGuard・service authorDiscordUserId 検査・
  repository owner 条件クエリ）を実測確認・front ガード欠如はセキュリティ欠陥に非ず。
  checkAuth は封筒を user として返す誤実装だった。**将来リスク記録**: character sheet PUT の
  最終 CAS クエリ（character.repository.ts:139 付近）は owner 条件を含まない —
  controller 前置チェックを迂回する新規 caller を作らないこと（再評価条件）。
  正本: review-results/t60-auth-guards/
- **#65-B0 進行中（2026-08-04）** — notation 契約固定（design-v1.md 拡張＋characterization test）を
  Codex へ委譲中。**DB read-only 監査は DNS 隔離で SRV 解決が拒否されブロック**
  （`querySrv ECONNREFUSED`・Fable 自身が回避せず中止 — 委譲先へ課す統制と同一規律）。
  裁定済み互換方針（publish 専用・既存公開 revision 不変）により監査は B1 の必須ゲートではなく
  定量情報のため、無しで進行。ネットワーク隔離が解ける環境なら再実施可
  （scratchpad の audit-roll-notations.cjs 参照・集計のみ出力の read-only 設計）
- **#65-B0（2026-08-04・`54ea6c4` でコミット済み）** — RollExpression 二契約を design-v1.md へ
  固定（受理対照表つき）＋ characterization test（engine 105→112・front 110→161）。
  front で coverage threshold 罠が的中（diceRoller.ts が分母入りし global 79.64%）—
  Opus 修正ラウンドで diceRoller 全 export 表面を凍結し global 85.84% へ回復。
  凍結した現状挙動4件（parse のレンジ検証不在・[0d6] が rolls:[] を返す・Map キーが trim 前・
  validate L28 死枝）は B4 削除まで仕様承認ではない。DB 監査は DNS 隔離でブロック（前項）
- **俯瞰#12（2026-08-04・大粒度認知負荷レビュー完了）** — #63/A1/#60/B0 の4スライス後。
  Opus モードA大粒度＋ Codex reuse&duplication＋ ts-morph の三本立て。矛盾突合で事実対立1件:
  #63 の総数 pin（Opus「唯一解」⇄ Codex「テスト側独立コーパスで同数置換も検出可」）→
  **Codex 採用**（B1 に同梱）。両者一致: dev ルート残骸クラスタ削除基準充足（→**#70**・
  corsApiWithJwt:17 の生 JWT ログ含む・~671行）・Editor⇄Preview sections.map は**統合しない**
  （意図的分離・定量反証つき）。他の裁定: RC-2 B0 契約文の二段明示化（Fable 即時修正済み）・
  CL-2 認証入口3方式分裂（→**#72**）・CL-3 AI.*.md 5本の V2 断定（signpost 5件 Fable 記入済み・
  →**#71** で正本1本化）・CL-4 閾値がコードを生む（メモリ追記済み）・RC-5 冗長 fixture（B1 で除去）。
  skill キャリブレーション追記: fanIn=1 アンカー越し死蔵の不可視性。
  正本: review-results/ov12-large-grain/verdict.md
- **#65-B1（2026-08-04・`5336941` でコミット済み）** — StandaloneRollExpression の publish 静的検証。
  engine 新設 validateStandaloneRollNotations（公開 API 1本・parseExpression 再利用・上限
  256字/100個/1000面）＋ server は validateForPublish のみ配線（validateForSave 不変を spec 固定・
  変異 M-B で実証）。validatePublishTemplate 本体不変 = draft save 不変。legacy seed 緑維持。
  RC-3（独立コーパス集合等価）・RC-5（冗長 fixture 削除）同梱。engine 129・server focused 54・
  front 161 全緑。コミット時に prettier hook が4行整形（事前計測496→492）— テキスト生存・
  再ゲートで無害確認済み。次: #70（dev ルート削除）→ #72（認証入口裁定）→ 俯瞰#13 → B2
- **#70（2026-08-04・`91fe817` でコミット済み）** — dev ルート残骸クラスタ削除。20ファイル・
  **671行純減**（routes 8本＋corsApiWithJwt＋store 3＋features/mock）。生 JWT ログ出力も同時解消。
  全ファイル参照0を削除前再実測・lint warnings 211→179。連鎖候補: immer が app 内参照0
  （依存整理は別スライス・未着手）
- **#72（2026-08-04・`9e6fb77` でコミット済み）** — 認証ガード規約を per-loader インライン検査へ
  1本化。requireLogin を _user.user.tsx へ挙動不変インライン化し auth-guards.ts 削除。
  規約は frontend-trpg-remix-app.md 設計メモが正本（親子二重検査は必要・soft degrade は
  UX 改善候補で現状維持）。裁定は新規相談なし — #60 相談の Remix 意味論実証＋ CL-2 定量を根拠に
  Fable が統合判定（4+/-49・48+/49-）
- **俯瞰#13（2026-08-04・大粒度認知負荷レビュー完了）** — B1/#70/#72 の3スライス後。対立なし・
  軸相補（Codex=契約正しさ・Opus=認知負荷）。**B1 に publish 契約欠陥3件**（すべて再現つき）:
  CH-1 placeholder 参照解決・型検査欠落（dangling が素通り・server spec が誤固定）/
  CH-3 文書化済み `({ref})d10` の誤拒否 / CH-2 front 検証ボタンと server の受理集合分裂
  → **B1-fix ラウンド実行中**。CL-1（jwt の await 跨ぎ不変条件）と /users 2往復の意図は
  frontend doc へ明文化済み。CH-2 の単一入口化は #42 へ・上限 named export は B2 へ・
  CL-6 re-export 移動は #64 へ積んだ。beginsPrimary/endsPrimary は統合しない（両者一致）。
  Opus 既報の engine fixture 私物コピーは #61 が既にカバー。
  正本: review-results/ov13-large-grain/verdict.md
- **#65-B1fix（2026-08-04・`7a8f108` でコミット済み）** — 俯瞰#13 の契約欠陥3件を修正。
  CH-1: RollField.notation を publish.ts 既存 validateNotation へ接続（resolvedRefs 解決＋型検査・
  dangling/text 拒否・server spec の誤固定を訂正）/ CH-3: 括弧スタックに placeholder 由来を保持し
  `({ref})d10` 受理 / CH-2: front 検証ボタンに standalone 検査を合流。コメント4件＋ jwt 不変条件
  doc 化同梱。10ファイル・全ゲート緑（engine 133・server focused 58・front 161）。
  prettier hook 再整形（175→182）はテキスト生存・再ゲートで無害確認
- **#65-B2（2026-08-04・`30c35f2` でコミット済み）** — `POST /dice-roll/preview` 新設
  （DicePreviewModule・JWT→rate limit guard 順・DB/Discord import 0）。補間済み最終式のみ受理・
  rate limit は依存追加なしの per-user 固定窓（10req/10s・in-memory の限界コメント済み）・
  engine 上限3定数 named export＋単式入口 validateStandaloneRollNotation（CL-3(b) 完了）・
  api-contract に dice-preview schema。16ファイル・444+/10-。全ゲート緑
  （engine 135・dice-roll focused 133・front 161）。Fable 事実訂正を記録: 実行実体は
  domains/dice-roll/services/dice-execution.service.ts・bcdice は in-process npm 依存
- **#65-B3（2026-08-04・`c5fefbf` でコミット済み）** — V3 プレビューのロールを resource route
  （templates.dice-preview・#72 認証規約完全適合: setServerRequestContext を最初の await 前・
  withJwt 明示・finally clear）経由で server BCDice 実行へ接続。rollDice ブリッジ撤去・
  純粋関数3本（buildDicePreviewRequest/classifyDicePreviewError/readDicePreviewActionData）＋19 spec・
  400/422/429/network 文言分岐・未解決参照はローカルエラー・v3_fetcherPersist 対応の
  non-idle→idle 遷移検知。api-contract runtime schema は SSR bundle 内包
  （production image が dist 未コピーのため・client chunk 0.00 kB）。7ファイル・544+/30-。
  全ゲート緑（front 180/180・coverage 87.62/84.97/85.50/86.82・tsc 0・build 緑・
  eslint 0 errors/179 warnings）。**silent no-op（俯瞰#11 L5）解消**。
  trip-wire 発火: `--only` コミットは worktree（prettier 整形後）を記録し index に原文残渣4件
  → `git restore --staged` で除去・worktree==HEAD 確認・ゲート再実行済み。
  残りは A2（V2 削除）→ A3=#64 → B4（diceRoller 削除）
- **俯瞰#14 完了・差し戻し裁定（2026-08-04）** — B1fix/B2/B3 の必須大粒度レビュー。二重レビュー
  （Opus 認知負荷モード A＋Codex reuse&duplication）完了・矛盾突合で相反ゼロ・
  verdict は review-results/ov14-large-grain/verdict.md。**blocking 3件（全件 Fable 独立裏取り済み）
  → B3-fix2 ラウンドへ差し戻し（Codex code mode 実行中）**。
  F-3（Codex 検出・Fable 静的裏取り）: publish.ts:893 の `Unclosed notation token` throw を
  validateNotation が捕捉せず、server assertEngineValid も generic Error を捕捉しない →
  **draft save / publish の両方が `1d6{` 入力で 500**（front 検証ボタンのみ try/catch 済み）。
  処方: validateNotation で例外→PublishIssue 変換（最小）。字句3実装の1本化は #73 へ backlog。
  他: 未知キー方針分裂は #74 へ backlog・resource route 401 JSON 例外は
  frontend-trpg-remix-app.md へ追記済み・全面統合系は両者一致で No-Go 維持。
  **B3-fix2（2026-08-04・`6bd93f7` でコミット済み・検収完了）**: F-1 route を唯一の正規化点化
  （DicePreviewActionError 単一形・ErrorEnvelope 復号・errorCode 統一・fixture 実形化・
  server spec に filter 登録の実 HTTP 422 封筒固定）／F-2 templates_.$id.edit.tsx へ un-nest
  リネーム（manifest parentId=root 実測・**editor chunk が初めて client へ出荷**）／
  F-3 validateNotation で未閉鎖 token throw→PublishIssue 変換（save/publish の 500 解消・
  server spec で 400 固定）。10ファイル・+199/-58（rename 100% 検出）。
  全ゲート緑: engine 136/136・server focused 37/37・build/循環0・front 181/181
  （coverage 87.50/85.38/85.71/86.70）・eslint 0/179。trip-wire 同型再発（2ファイル MM 残渣→
  restore --staged で除去・worktree==HEAD 確認・ゲート再実行済み）。
  次: **A2（#62 V2 スタック削除・unblocked）** → A3=#64 → B4 → 俯瞰#15。
- **#62-A2（2026-08-04・`60f2379` でコミット済み・#62 完了）** — V2 式言語スタック削除。
  8ファイル（Preview/Editor/formulaEngine/validation/dependencyGraph/hooks 3本）1,534行＋
  barrel 8行の純削除（+8/-1,542）。dependencyGraph は Codex 着手前監査が私の grep 漏れ
  （同一ディレクトリ相対 import はパス接頭辞つき grep をすり抜ける — memory
  verify-claims-before-prescribing #10 に記録）を検出して停止→再実測→追加承認の経緯。
  全ゲート緑: front 181/181（coverage 不変）・tsc 0・build 緑・**eslint 0 errors/130 warnings
  （179→130・V2 分49警告純減。以後の受入上限は 130 を基準にする）**・basename 全域 grep 参照残0。
  trip-wire 一致（+8/-1542 完全一致・残渣なし）。AI.feature.md 冒頭注記に V2 削除を記録。
  残置: diceRoller.ts（B4）・DependencyGraph 型 types/index.ts:147 定義1消費0（#64）。
  次: **A3=#64（barrel 明示 re-export 化＋隠れ死蔵8＋DependencyGraph 型＋ov13 CL-6 の
  standalone-roll re-export を index.ts 直行へ）** → 俯瞰#15（B3fix2/A2/A3 の3フェーズ分・必須）→ B4
- **#64-A3（2026-08-04・`dbd45e5` でコミット済み・#64 完了）** — barrel 明示化＋死蔵掃討
  （+59/-611）。死蔵島5ファイル436行（Gallery/FieldAddModal/store3本・外部消費者0を
  シンボル別 grep で実測）・types/index.ts の V2 型15本＋玉突き6本＋DependencyGraph・
  types/v3.ts エイリアス4本を削除。現用 Template（V2→V3 移行経路 isV2LocalTemplate/
  TemplateListV3 消費を実測確認）は匿名構造型へ畳み込み維持。barrel は named re-export のみ
  （diceRoller 行も外部消費者0で削除・本体/spec は B4）。engine CL-6: standalone-roll 公開を
  index.ts 直行化（公開集合不変を diff 確認）。static:deps: re-exported-by-another-module 31→0・
  unusedExports 44→22（null 10・tests-only 12）。eslint 0 errors/**105** warnings（130→105）。
  全ゲート緑（front 181/181・engine 136/136・server build/循環0）。trip-wire 発火
  （+58/-603→+59/-611・v3.ts 1件 MM→除去済み）。
  **顕在化した reason=null 10件（FormulaPreview 等）と likelyUnreferenced 2件は俯瞰#15 で裁定**。
  次: **俯瞰#15（実行中）** → B4（diceRoller＋spec＋AI.feature.md:209 記載の削除で #65 完了）
- **俯瞰#15 完了・条件付き受入（2026-08-04）** — verdict は review-results/ov15-large-grain/verdict.md。
  3フェーズ（B3fix2/A2/A3）のコード変更に挙動退行なし（barrel 12/12 過不足0・engine 公開集合不変・
  feature 実装 25→12ファイル/4,021→1,929行）。blocking は「doc/残渣の未追随」層に集中:
  FormulaPreview＋types/formula の死蔵島110行（Gallery と同型・A3 の取り残し）・
  A2 が約束した doc 整理未実施（AI.types.md:5 の文言）・正本 doc 3行陳腐化。
  唯一の相反（doc 整理の深さ）は CLAUDE.md の削除許可＋git 履歴保全を根拠に Opus 案
  （削除・縮約）を採択。**B4 確定スコープ = 削除4本398行＋export 解除7件＋RuntimeValue/
  RoundingMode re-export 削除＋layout 9行＋dice-preview un-nest リネーム（Codex 実行中）**。
  Fable 側 doc 手術は実施済み（B4 と同一コミット予定）: AI.api/AI.security/AI.ui 削除・
  AI.feature を V3 現況25行へ縮約・AI.types を正本注記＋engine 境界節のみへ（consumer 2→3件の
  事実修正込み）・design-v1.md の B1→B4 予定表現を完了へ・frontend doc L6/L11 修正
  （L35 テスト数は B4 最終値で更新予定）。
  **backlog 起票**: #75（isV2 ガード弱い→/templates クラッシュ）・#76（fixture 実形化・429 に
  details なし/requestId あり）・#77（normalize 所有者＋roll notation 非対称の裁定）・
  #78（shouldRevalidate）・#79（zustand/immer 依存衛生）・#80（残る export * barrel）・
  #73 に症状追記（`1d6{` プレビューの誤誘導文言）。getResponseStatus は #61 のまま（B4 純度維持）
- **#65-B4（2026-08-04・`32be7b4` でコミット済み・★#65 feature 完了★）** — V2 完全撤去。
  21ファイル・+99/-1686。コード純減411行（diceRoller＋spec・FormulaPreview＋types/formula 島・
  export 解除6＋RuntimeValue/RoundingMode/layout・dice-preview un-nest リネーム）＋
  doc 整理（AI.api/AI.security/AI.ui 削除・AI.feature 縮約・AI.types engine 境界のみ・
  design-v1 完了表現・frontend doc 陳腐化4件・削除 doc への参照残3件更新・
  trpg-remix-frontend skill reference を V3 現況へ書き換え）。
  Codex は2回正当停止（spec import 追随・layout fixture 追随）→ 各1行/3箇所を承認して完走。
  **feature 完了ゲート**: doc 事実照合レビュー（Codex adversarial fact-check）で blocking 5件
  検出→全件修正済み（削除 doc 参照残・sheetTemplateApi の契約主張誤り・api.ts 陳腐化・
  route 名・2d6+1 受理表）。俯瞰#15 が feature 完了時の大粒度を兼ねる（B4 は同 verdict の
  逐語実行・逸脱ゼロを検収で確認）。
  全ゲート緑: front 7 suites 130/130（coverage 86.14/84.87/84.61/85.02）・tsc 0・build 緑・
  eslint 0 errors/**93** warnings（以後の受入上限は 93）・残骸 grep 0・
  static:deps reason=null 0/likelyUnreferenced 0。trip-wire 発火（v3.ts 残渣1件→除去済み）。
  **#65 サマリ**: B0 `54ea6c4`→B1 `5336941`→B1fix `7a8f108`→B2 `30c35f2`→B3 `c5fefbf`→
  B3fix2 `6bd93f7`→B4 `32be7b4`。silent no-op（俯瞰#11 L5）は「publish 静的検査＋
  server BCDice 実行＋UI エラー文言分岐」の縦系列で解消。V2 は計約2,500行純減。
  **次の候補**: #69（V3 リテラル小掃討・#62 完了で unblocked）・#61・#71（doc）・
  #66/#67/#68（server・並行セッション調整待ち）・backlog #73〜#80
- **#69・#71 完了（2026-08-04・attrition 消滅を実測確認・コミット不要）** —
  #69: schemaVersion は型 `schemaVersion?: 3` で全5サイト機械固定・既定テンプレートは
  templates.tsx:78 の1箇所のみ（第2複製は削除フェーズ群で消滅）。
  #71: route lifecycle fact の doc 6複製は #70/A2/B4 の doc 削除で消滅し、残存は
  frontend-conventions.md:9 の正確な1行のみ。両タスク新規作業なしで閉鎖
- **#61 完了（2026-08-04・`fa532b8`）** — getResponseStatus を api-response.util.ts へ1本化
  （許可リスト route 別方針は不変）＋ sheet-engine.spec.ts の private baseTemplate を
  test-utils 共有版へ（形状完全一致・assert 変更0）。+11/-31・numstat 完全一致・全ゲート緑
  （front 130/130・coverage 85.48/83.25/83.33/84.31・engine 136/136・eslint 0/93）
- **#75 完了（2026-08-04・`5f9f797`）** — isV2LocalTemplate に name/各 field.id の string 検査を
  追加。spec 7ケース・slugifyId(undefined) 不到達を固定。front 137/137・eslint 0/93・numstat 一致。
  **訂正（俯瞰#16 F-1 で反証・Fable 実測確認済み）**: コミット記録の「他項目は migration
  フォールバック済み」は誤り。フォールバックがあるのは version/tab/label と**未知の type** だけで、
  既知 type の必須 payload は無条件消費される — v3Template.ts:274 `computed`→`field.formula`・
  :279 `roll`→`field.diceFormula.replace()`。`{schemaVersion:2, name:'x', fields:[{id:'a',
  type:'roll'}]}` はガード通過後 TemplateListV3.tsx:183（JSX map・render 中・try/catch 外）で
  TypeError → /templates 全落ち。#75 の標的と同一クラスのクラッシュが2経路残存 → F-1 修正ラウンドへ
- **俯瞰#16 完了（2026-08-04・必須ゲート: B4/#61/#75 の3フェーズ分・verdict:
  review-results/ov16-large-grain/verdict.md）** — 二重レビュー（Codex reuse&duplication＋
  Opus 認知負荷モード A）。判定: `32be7b4` 条件付き受入・`fa532b8` 受入・**`5f9f797` 受入不可**。
  - **F-1 [blocking・両者一致・Fable 実測確認]**: #75 ガードは既知 type の必須 payload 未検査
    （v3Template.ts:274 computed→formula・:279 roll→diceFormula を無条件消費・フォールバックは
    未知 type の default 節だけ）→ TemplateListV3.tsx:183（render 中）で TypeError・/templates 全落ち。
    Codex probe: 欠落＋数値型違い 4/4 通過→throw。**F-1 修正ラウンド＝Task #81 実行中**
    （prompt-code-f1.txt・MigratableV2Template 新型は YAGNI で不採用裁定）
  - **突合の矛盾1件裁定**: lib→feature 逆依存は Opus が正（lib/hooks/useCharacters.ts:2・
    useCharacterSummaries.ts:3 に実在）。Codex の「なし」は #61 スコープでのみ真 → F-5 裁定は生存
  - Codex 単独所見（Fable 裏取り済み）: status extractor 第3実装＋型穴＋spec 不在（→ **#82 起票**）・
    B4 doc 残件（README.md:119-120・dicePreviewRoute.spec.ts:38 describe 名）・
    engine CoC シナリオ重複（→ **#83 起票**・#61 起因ではない）
  - Opus 単独所見: api-response.util.md が存在しない API を文書化（縮約要）・import 形式3分裂・
    空 dir（rmdir 済み）。backlog 妥当性: 全件生存・#73 範囲限定・#77 改稿・**#78 前提訂正
    （現状は再検証1回・親子2回ではない）**・#79/#80 完了条件/在庫更新 — 台帳反映済み
  - 実行順: #81 → doc 残件小スライス（README/describe 名/api-response.util.md）→ #82 →
    F-5 裁定 → #76 → #79 → #77。全面 ErrorEnvelope 統合は俯瞰#15 No-Go 維持（両者一致）
  - 俯瞰#14 の CL-1/CL-2 詳細はここから削除（B3fix2 `6bd93f7`・B4 `32be7b4` で解決済み。
    詳細は review-results/ov14-large-grain/）
- **#81 完了（2026-08-04・`d4c6aa1`）** — F-1 修正: ガードへ roll→diceFormula /
  computed→formula の string 条件付き検査＋消費表コメント（最小契約の明示込み）＋
  spec 拒否4/受理/契約閉包テスト。MigratableV2Template 新型は不採用（verdict 裁定）。
  検収: front 143/143（+6）・coverage 85.86/84.51/83.58/84.72・tsc 0・eslint 0/93・
  numstat 完全一致（74+/5-）。
  **訂正（俯瞰#17 OV17-1 で反証・Fable probe 確認済み）**: 当時の検収記録「消費表の全行を
  migration 実読と突合して真を確認」は**過大**。`field.tab` 行が偽 — `sectionsByTab[field.tab]
  ?? basic` は prototype 継承キー（'constructor'/'toString'/'__proto__' 等9値）で truthy を返し
  フォールバック不発 → collectFieldIds が TypeError・render 中クラッシュの第3経路が残存。
  実読突合は敵対値 probe を欠いた目視だった。→ OV17-1 修正ラウンド（blocking・E1c 完了後）
- **俯瞰#16 doc 残件完了（2026-08-04・`4da5587`）** — README.md:119-120（削除済み
  AI.{ui,api,security}.md 参照と旧 route 名の訂正）・api-response.util.md を 213行→現況
  正本（32行）へ全面縮約・frontend doc テスト数 137 へ。api-response.util.md は commit 時
  prettier hook の MM 残渣が出たが worktree==HEAD 確認済み・restore --staged で収束
  （commit-unit-verification の既知パターン5回目）。残るテストコード分
  （describe 名リネーム）は #82 スライスへ併合済み
- **#82 完了（2026-08-04・`a71d891`）** — status extractor を共有1所有者へ（sheet route の
  ローカル responseStatus 削除・3 route 利用）＋getResponseStatus に typeof number 絞り込み
  （文字列 status は理論上のみ・sheet route :95 の Response init 素通し経路も 400 へ安全化）＋
  spec 5件＋describe 名を templates_.dice-preview へ追随。指示書の「消費側はリテラル比較のみ」
  という当初主張は起動前裏取りで sheet route :95 に対し不正確と判明し精密化してから投入
  （verify-claims 項目11の運用）。検収: front 148/148（+5）・coverage 86.68/86.40/85.07/85.63・
  tsc 0・eslint 0/93・numstat 完全一致（30+/10-）
- **#84（F-5）完了（2026-08-04・`a2a5383`）** — useCharacters 死蔵削除（66行）＋
  useCharacterSummaries を features/character/hooks/ へ純移動（blob SHA 一致・git rename 100%
  検出）＋ import/no-restricted-paths（target ./app/lib ← from ./app/features）で層規約を
  機械固定（server #31 の front 版・既存 @trpg 制限とはルール ID 直交で上書きなし）。
  負の対照実測: ルール先行追加で既存2違反を検知→移動後0。検収: 148/148・
  coverage 86.68/86.40/85.07/85.63・tsc 0・--print-config で lib 配下の活性確認・
  **eslint 新基準値 0 errors / 92 warnings**（削除した useCharacters.ts:54 useEffect 由来の
  warning 1件が消滅）。付随 docs: `5b50afa`（api-response.util.md #82 解消記録）。
  **俯瞰#16 後3フェーズ（#81/#82/#84）到達 → 大粒度俯瞰#17 が必須ゲート（起動済み）**

- **俯瞰#17 完了（2026-08-04・verdict: review-results/ov17-large-grain/verdict.md・旧 cadence
  下で起動済みだったため完遂・以後は feature 完了時のみ）** — 判定: `d4c6aa1` 条件付き受入
  （**OV17-1 blocking**: 消費表 tab 行が偽 — `?? basic` は prototype 継承キー9値で不発・
  render TypeError 第3経路。Codex「全行一致」と矛盾し Fable probe で Opus 正と裁定。
  #81 検収記録も反証→訂正済み・メモリ項目12）・`a71d891` 受入・`a2a5383` 条件付き受入
  （OV17-9 doc ゲート違反 → Fable 即日修正 `9da0617` で充足）。
  処理区分: #93 起票（OV17-1 hasOwn 1行＋type 別負の対照＋OV17-7 zone basePath・
  E1c 完了後起動・prompt-code-ov17-1.txt 準備済み）・#92 起票（OV17-8 死蔵掃討＋#78 合流・
  #78 単独着手禁止）・OV17-4/5/6 は #76 へ併合・OV17-3 は #77 へ注記・OV17-10 rmdir 済み。
  backlog 全件更新（#73 4実装/対象2本・#79 vite.config.mjs・#83 coc-acid 削除候補ほか）

## 運用変更（2026-08-04 ユーザー決定・最優先）

**キャンペーン終了条件 = full-review 台帳（TRPG-SERVER/docs/reviews/full-review-2026-07-26.md）の
本流残＋第5群の消化**。以後の大粒度俯瞰は **feature 完了時のみ**（3フェーズ毎は廃止）。
**low 所見は起票だけで処理義務なし**（blocking/should は従来どおり処理）。
メモリ fable-primary-coding-review-protocol に記録済み。

**本流残の実測（2026-08-04・Fable 確定）**: Must 系（CE-1/SP-2/SP-3）・第3群 a/b・
第4群 a〜e・E1a は完了済み。残: **E1b-front（#86）→ E1b（#87・拘束は俯瞰#7 主判定1）→
第4群 originals（#88 customId 統一・#89 characterThread 一本化・#90 CH-9）→
第5群スイープ（#91 umbrella・候補11系統）**。

- **#86（E1b-front）完了（2026-08-04・`f965edd`）** — CustomError の envelope 分岐を
  `[0]` → `.join(' / ')` へ（1行・俯瞰#7 条件(d)の順序拘束を充足）。spec 12ケース・
  fixture は satisfies ErrorEnvelope で実形固定。検収: 159/159（+3）・tsc 0・eslint 0/92・
  numstat 一致（75+/14-）。**E1b は E1b-1（route 水準 pin 先行固定・追加のみ・実行中）→
  E1b-2（pin 13件再ホスト＋@UseFilters 3箇所撤去＋wire 拡張宣言＋riders CL-4/CL-5）の
  2分割**。@UseFilters 実測: auth:41・character:46・user:47（character-sheet は別 filter・
  対象外）
- **E1b-1 完了（2026-08-04・`a4a882e`）** — before wire pin 4本を追加のみで固定
  （/auth/login 400 は ValidationPipe 配列の ', ' join 平坦・details なし＝現行 wire を実測記録・
  401/404 は ApiError 系封筒）。user は route 水準 literal pin 不在と棚卸し→ /users 404 追加。
  検収: build・循環0・full suite 233/3218 全緑（+1/+4）。
- **#87（E1b-2）完了（2026-08-04・`a03d8c6`）— E 方向完遂**。pin 13件（旧 filter spec 11＋
  character-http filter 2・記録と現況一致）を global-exception.filter.spec へ再ホスト →
  @UseFilters 3箇所撤去 → HttpExceptionFilter（73行）＋旧 spec（170行）削除（参照0・
  barrel から export 除去、interceptor 行不変）。wire pin を実 APP_GLOBAL_EXCEPTION_FILTER_PROVIDER
  配線へ更新: **401/404 の3 pin は全キー・全 literal 不変**（E1a 逐語移植の等価性を実 HTTP で証明）・
  /auth/login 400 のみ details[]（N=2）追加 = wire 拡張は pin diff が宣言。riders CL-4/CL-5 済み。
  実測: 封筒生成点 7→5・wire 系統 3→2・includeStack 3→2・filter 概念 3→2・
  lint コード由来 4→2（拘束(c)充足）・純減102行。検収: build・循環0（598 files）・
  full suite **232/3218 全緑**（−1 suite は spec 削除の検算どおり）・
  numstat 一致（274+/376-）。コミット後の MM 残渣2件（global spec / auth.controller.spec =
  整形のみの stale index）は worktree==HEAD 確認のうえ restore --staged で収束（6回目）。
  AI.refactor.md へ「E1c＋E1b: E 方向完遂」節を追記済み
- **#93 完了（2026-08-04・`c73dc18`）** — OV17-1/2/7 反映: migration tab 振り分けを
  Object.hasOwn 化（prototype 継承キー9値の第3クラッシュ経路封鎖・消費表 tab 行を実装どおり
  訂正）＋type 別最小 fixture 9本＋負の対照2本（敵対値でのみ落ちる欠陥も検知する網）＋
  eslint zone の無言失効2経路閉鎖（basePath＋resolver project 二重固定 — 後段 settings が
  前段を上書きするため2箇所、は委譲先の発見）。round1 は指示書の検証コマンド前提矛盾で
  正当停止 → Fable 3 probe 切り分け（root の素 pnpm exec は音を立てて落ちる・無言経路は
  alias 解決の tsconfig 発見）→ 修正版で完走。検収: Fable 自身の root＋alias probe が
  修正前 0 errors → 修正後 error を確認・156/156（+8）・tsc 0・eslint 0/92・
  numstat 一致（113+/23-）

- **#85（E1c）完了（2026-08-04・`1a26624`）** — '; ' join 文字列 BadRequest の全4発生源
  （台帳の「3発生源」は grep 実測で4と確定・全 production 到達）を配列 throw 化 →
  global filter の details[] 写像へ合流・front 無改修で N 項目表示復帰。区切り '; '→', ' を宣言。
  controller に実 APP_PIPE/APP_FILTER 配線の supertest 400 route pin 新設。
  **前提修復同梱**: app.module.spec の controller 名簿へ DicePreviewController 追加
  （#65-B2 `30c35f2` の追従漏れ — 着手前ベースライン 231/232 赤の原因。
  focused 検収が大域不変条件 spec を素通しした再発事例をメモリ
  verify-full-suite-before-merge へ記録済み）。
  検収: build・循環0（599 files）・focused 8/8 88/88・**full suite 232/232 / 3214/3214**・
  numstat 完全一致（132+/26-）・残渣なし（並行 M 群のみ）
- **#88 着手時実測（2026-08-04・Fable）** — 新鮮実測の結果:
  (1) **CH-6 現存**: thread-interaction.service.ts の create{CoC7,DnD5e,SW25}Buttons に raw literal
  `dice_{system}_{action}_${channelId}` が 13 箇所（coc7×5/dnd5e×4/sw25×4）＋ボタンラベルが
  契約側 ACTION_REASON と二重管理（（簡易）有無は全 13 action で規則的 — 導出可能と突合済み）。
  → **#88-a 完了（2026-08-05・`cbfd96a`）**: PRESET_DICE_ACTIONS（順序付き action/label/semantic）を
  契約側へ新設し ACTION_REASON を導出化（preset-dice.custom-id.spec 無変更全緑 = 導出等価証明）・
  13 literal → PresetDiceCustomId.create・builder 3→1（83行→13行）・style/emoji は feature 側
  PRESET_DICE_BUTTON_APPEARANCE（契約の discord.js 非依存維持・台帳⇄appearance 欠落は pin が
  builder 実走するため TypeError で赤化=閉包）・13 ボタン {custom_id,label,style,emoji}×順序 literal pin。
  検収: build・循環0・full 232/3218 全緑（±0 検算どおり）・認知負荷 同時保持7→5/概念6→5/ホップ3→2。
  ※Codex run は前セッション終了で「stopped」通知になったが実際は完走（output 全文あり）—
  停止通知時は output ファイルと worktree を先に確認すること。コミット時 MM 残渣（7回目）も
  worktree==HEAD 確認→restore --staged で収束。
  **#88-b 完了（2026-08-05・`fb198cd`）**: 契約 character-field.custom-id.ts へ prefix 定数2本＋
  中置正本 characterFieldSectionInfix() を追加（createEdit/createAdd 自身も同定数から合成・
  三者 byte 一致を spec 固定）。探索側 probe 置換の真理区分 = byte 完全保存6サイト
  （refresh/compact create() 参照・edit-section・field prefix・中置4種）＋生成集合等価の
  引き締め3関数（isBasic 化・isFieldOperation/isSectionSelection の末尾ハイフン付き prefix 化 —
  根拠コメント＋非生成形の負例 pin）。type !== 3 → ComponentType.StringSelect（値不変）・
  type !== 2 は MessageLike 純関数のため理由付き維持。spec 4本へ敵対値含む15件追加。
  round1 は Fable の前提誤り（「type !== 2 が唯一」— grep が `!==` 欠落）で正当停止 →
  事例13としてメモリ記録・前提訂正 round2 で完走。
  検収: build・循環0・focused 28/420・full **232/3233 全緑**（+15 検算どおり）。
  Codex follow-up 所見: 作成モーダル 'character-create-basic-*' に対し modal registry pattern が
  'char-edit-*' のみという既存 routing gap（CE-2 の dead 経路下流・潜伏）→ #94 系で起票のみ。
  **#88-c 完了（2026-08-05・`d53b7ce`）**: byte 一致既存定数の機械的参照化4サイト
  （演算・真理不変・hex 突合）。full 232/3233（±0）。build 初回失敗は一過性（exit 0×2 で再現せず）。
  → **Task #88 完遂**（CH-6=cbfd96a・CL-3=fb198cd・CH-7=実測決着・残件は #94 起票のみ）。
  AI.refactor.md に「第4群 #88」節を追記済み。
- **#89（characterThread 一本化・CL-2+CH-3+CH-8）着手（2026-08-05・in_progress）**:
  Fable 事前 grep で CL-2 骨格の現存を確認 — スレッド作成2経路
  （thread-creation.service/util = `🎭 ${name} [date]`・buildThreadUrl 3引数 vs
  thread-manager.service/util = `🎭${name}`・buildThreadUrl 2引数）。
  **read-only Opus 実測エージェントへ委譲中**: 呼び出しグラフ（イベント経由 vs セレクトメニュー）・
  DC-30 'default-guild' の生死裏付け・CL-2 複製4種・CH-3 親チャンネルヘルパ残存・
  CH-8 Embed 2系統・並行 M 重なり表（M かつ候補は numstat で内容差分まで）。
  **Opus 実測完了（2026-08-05）— 設計を決めた事実**:
  (1) スレッド作成2経路は「**1 live＋1 dead**」— select 入口 'character-thread-select(-with-thread|-current)'
  を setCustomId する production コードが存在せず（唯一の :30 `data` は未使用フィールド）、
  thread-creation.service(293行)・character-thread.orchestrator(97行)・thread-creation.util(209行・
  7 export 全部)・character-thread-select.handler(30行)＋custom-id＋各 spec が**丸ごと死蔵**。
  削除で複製 D1(スレッド名)/D2(buildThreadUrl 同名2実装)/D3(ダイス5連投稿 2/3)/D4(materialized
  分岐A側)/D5(Embed dead側) が自動消滅。live 経路 = commands-components/character-thread.service:112
  → character-thread-create.handler → character-thread-select.service:264 → emit → thread-orchestrator
  → thread-manager。
  (2) **DC-30 は所在訂正のうえ実質成立**: literal 'default-guild' は character.creation.completed.ts:149
  の1箇所のみ（台帳の thread-manager:72 は変数 fetch で誤り）。イベント経由の自動スレッド作成は
  live-but-broken（:149 の「Channel Create Orchestrator で更新される」コメントは stale —
  onModuleInit がリスナー登録をスキップ）。**手動は動くが自動が壊れている**。修復は guildId 供給源の
  契約変更を要する挙動変更 = #89 の一本化スコープ外 → 起票。
  (3) CH-3: characterThread 内5実装は集約済み。境界外に R1（characterSheet adapter・意味論同一・
  JSDoc で意図的分離）＋R2/R3/R4（dice 系・PrivateThread 非対応の意味論差・意図か漏れか未検証）→ 起票のみ。
  (4) CH-8: live = character-embed.service。**未報告 D6** = 同ファイル内 :58-118 と :283-339 の
  enhanced embed 二重記述（dead 削除では消えない）→ #89-b 候補。
  (5) 並行 M との重なり **0 件**（characterThread 配下 M ゼロ・discord M 群の内容差分は
  AI.discord.md/DESIGN.md の doc 2件のみ）。
  **#89-a 完了（2026-08-05・`32186df`）**: 9ファイル削除＋live 側の死蔵断片・配線・stale JSDoc 掃討 =
  18ファイル +16/−1634（**純減1618行**）。handler 総数 25→24（DESIGN.md の「23」は drift — #90 材料）。
  検収: build・循環0（**589 files** = 598−9 検算一致）・full suite **228 suites / 3187 tests 全緑**
  （−4/−46 = 削除 spec 40＋死蔵分岐3＋死蔵 pattern 検査3 の検算どおり）・start:dev は TS 0 errors・
  DI 解決成功（DB 接続は DNS 隔離で環境上到達不可・Codex は回避せず停止 = 統制どおり）。
  live の isCreateSelect / flexible dice 分岐は不変（diff 実読で確認）。
  ※コミットはコマンド長でシェルが壊れたため `--pathspec-from-file` 方式に切替（以後の多ファイル
  コミットはこの方式を使う）。
  **#89-b（最終）= D6 統合を Codex へ委譲中**: character-embed.service.ts 内 :58-118
  （postEnhancedCharacterInfo）と :283-339（updateExistingCharacterEmbed）の enhanced embed
  二重記述を単一 builder へ（wire byte 不変・両経路の embed JSON literal pin 先行）。
  **#89-b 完了（2026-08-05・`f6ee30a`）→ Task #89 完遂**: 2ブロック wire 完全同一と棚卸し確定 →
  mode 引数なし private buildEnhancedCharacterEmbed(guildId, character) へ逐語抽出（production
  純減52行・enhanced wire 所有 2→1）。pin 先行（service 未変更で両経路 toJSON() exact literal 緑）
  = wire byte 不変の証明。検収: build・循環0（589）・full **228/3187 全緑（±0）**。
  r1 は「M ゼロ」前提の stale で正当停止 → 可変状態は開放形で書く教訓を
  delegation-prompt-must-name-invariants へ記録済み。
  **#89 総括**: 89-a 32186df（純減1618）＋89-b f6ee30a（純減24）。CL-2/CH-8 解消・
  CH-3 は境界内集約済み＋境界外 #96 起票・DC-30 修復 #95 起票。
  次: **#90（CH-9 DESIGN.md 実態同期・Fable 直筆）** — 材料: handler 総数実測 24（DESIGN 記載 23 は
  drift・89-a で 25→24）・89-a/b の削除反映・DESIGN.md は並行 M 1/1 内容差分ありの吸収裁定から。
  その後 #91（第5群スイープ）でキャンペーン終了。
- **#90 完了（2026-08-05・`8415ee6`）— 第4群 originals（#88/#89/#90）全完了**:
  DESIGN.md を 2026-08-05 実態へ同期（53+/51-・Fable 直筆＋Codex fact-check ゲート）。
  同期内容: **登録 handler の正本 = production 実物列挙 27 件**（module 内訳 6/8/8/5・§11 を
  4 module 分類へ全面改稿）・Phase 0 完了宣言・As-Is 図現行化・DiscordService ラッパー削除反映・
  Phase 2 特例 if [x]・Phase 3 custom-id [x]（契約 2/6/9）・§6.3 Legacy 廃止済み化・
  stale パス3件・controller 消費者 0 明記。
  **fact-check（64 主張・真52/偽12）が blocking 6 検出**: 最重要 = spec pin 24 を総数の正本と
  誤認（production は 27・spec は characterSheet hub 3 件を含まない部分集合。**#89 の実効果も
  production 28→27 で「25→24」は spec 内の数字 — AI.refactor.md の 89-a 記録訂正済み**）。
  他: 'dice_button' raw literal 1本残存（#94 (4) 台帳済み）・Phase 4 残件の過大表現・
  builder/service の生成元取り違え等。全 findings（blocking 6/should 3/low 1）反映後、
  Fable が数値を module 実物列挙で独立再計測（6/8/8/5=27 一致）して受入。
  教訓 = verify-claims 事例14（spec pin ≠ 母集団）。
  **コミット結合の新知見**: hunk 分割方式（add → apply --cached -R）は pre-commit hook
  （prettier）が worktree 全文を再ステージするため**成立しない** — 並行セッション B の
  Approved 済み 1 hunk（L175 permission overwrite）は同梱となり、amend でメッセージに
  帰属を明示（内容は正確・無害）。教訓は parallel-session-commit-coupling へ。
  同一ファイルに並行変更がある場合は (i) 同梱＋帰属明示 (ii) 着地待ち の2択のみ。
  証跡: review-results/ledger-close/prompt-review-90.txt。
  次: **#91（第5群スイープ・umbrella）— 消化でキャンペーン終了**。台帳は Task #91 の
  description（13 系統・#90 副産物 2 件追記済み）。着手前に fresh 測定（attrition 確認）。
- **#91 着手・fresh 測定完了（2026-08-05・Opus read-only・正本 =
  review-results/ledger-close/g5-measurement-digest.md）**: 13 系統のうち
  **close 3**（系統10 split 死枝 = attrition 済み／CE-18 = 対象特定不能［台帳取り込み漏れ］／
  系統11 = 「44件」再現不能＋untracked 並行生成物のため不触）。
  **台帳訂正 3**（サブクラス未到達は6種**全て**・CL-1 は 14 中 13 死蔵・OV6-3「6ファイル」は
  現在も 6 だが 6 番目の親 TestAppModule は消費者 0）。
  誤検出注意 2（jest globalSetup/teardown の default・types/express ambient = 削除禁止）。
  **スライス確定: G5-a（純削除 ≈−3,170: dependency-analysis.json・controller 2＋spec・
  src/types 4・CE-19・DC-13・全死蔵ファイル4本）→ G5-b（メソッド/export 単位 ≈−400・
  test/mocks は並行 M で対象外）→ G5-c（api-response.util＋サブクラス6種＋oracle literal 化・
  結合必須）→ G5-d（character-ui 4 ファイル ≈−1,110）→ G5-e（CH-7 4 メソッド＋
  handlers.integration.spec 45 assertion の書換・検証能力純減禁止）**。
  G5-a を Codex code mode へ委譲中（prompt-code-g5a.txt）。
  **G5-a r1 は着手前監査で正当停止**（統制機能・3例目）: 測定の「CE-19 は module 配線のみ」に
  barrel re-export（services/index.ts）＋characterEdit/index.ts の CharacterEditValidator 型参照＋
  event-integration spec 残骸が漏れ・「commandType は controller 専用」も 6 config 型注釈で偽。
  Fable 裁定: Validator はクラスごと削除（死蔵 61 件リスト内・ChannelCreationContext は生存側定義で
  無傷・event-integration の constructor は空を実読確認）／commandType は残置（G5-b 送り）→
  **r2 実行中（prompt-code-g5a-r2.txt）**。削除 spec 5 本の事前検算 = 56 tests。
- **G5-a 完了（2026-08-05・`c3b4d1b`）**: 19 ファイル削除＋配線除去 9（+0/−3,660）。
  検収は Fable 独立再実行 — build 0・循環 0（589→571・−18 = 削除 .ts 数一致）・
  full suite **223 suites / 3131 tests 全緑**（−5/−56 = 検算完全一致）・numstat/D 19 突合一致。
  spec 残骸の not.toHaveBeenCalled 4 件はモック未注入（実挙動を観測せず）と評価し除去。
  ベースライン更新: **223 suites / 3131 tests・circular 571 files**。
  次: G5-b（メソッド/export 単位。@ApiErrorResponse・handleHttpError・CL-5 getter 5・
  CL-4 display 3・stale JSDoc・ts-morph 死蔵 export の src 側個別分 — HandlerWithPattern/
  RegisterHandler は G5-e 送り・test/mocks 並行 M と testcontainers 2 件は不触）。
- **G5-b 完了（2026-08-05・`a9c7553`）**: 29 ファイル・+11/−993（F-6 @ApiErrorResponse・
  EV-22 handleHttpError＋非互換 interface・CL-5 getter 5＋連鎖 2［spec は生存機能検証を
  内部状態 pin へ置換］・CL-4 display 3＋連鎖 2・stale JSDoc・fresh 再測定の真の死蔵 export
  29 件全裏取り→宣言ごと削除＋連鎖 2・空化した 2 ファイル削除）。スキップ 0。
  検収 Fable 独立再実行: build 0・循環 0（571→568）・full **223/3112 全緑**（−19 検算一致）。
  static:deps 対象条件 29→0（残は意図的除外のみ）。コミット後 stale index 残渣 4 件
  （8回目・worktree==HEAD 確認→restore --staged 収束）。
  **ベースライン更新: 223 suites / 3112 tests・circular 568 files**。
  次: G5-c（B-1 結合: api-response.util＋spec 削除・サブクラス 6 種＋dto spec 削除・
  oracle literal 化 4 spec・test-auth.controller 2 箇所インライン化［CRLF ノイズ M につき
  編集可・最小限］）→ G5-d → G5-e。
- **G5-c 完了（2026-08-05・`7576566`）**: 15 ファイル・+138/−543（純減405）。OV6-3 拘束消化。
  oracle literal 化 4 spec は it 数不変（28/27/17/15）・stripVolatile は HEAD 既存慣行を確認。
  スコープ外に見えた production 6 ファイルの差分は stale コメント文言のみ（実行行ゼロ）を
  Fable diff 実読で確認し受入。検収独立再実行: build 0・循環 0（566）・
  full **222 suites / 3090 tests 全緑**（−1/−22 検算一致）。
  **ベースライン更新: 222 suites / 3090 tests・circular 566 files**。
  次: G5-d（B-2: character-ui 4 ファイル同時 ≈−1,110・生存 = updateCharacterEmbed 1 経路＋
  util 4 シンボル）→ G5-e（CH-7・最終）。
- **G5-d 完了（2026-08-05・`71158f9`）**: CL-1 消化・5 ファイル +6/−1,000。3 ラウンド
  （r1 停止 = 対象外 spec の型モック残骸 → 5 ファイル目承認／r2 停止 = 発注側指示の矛盾
  「コメント編集禁止×残存 grep 0」→ 対象内 stale コメント削除承認／r3 = ランナーが
  sandbox helper 故障 1312 で結果不受理 → **編集は worktree 完全適用を確認し、検収を
  Fable 全ゲート独立実行で受理**）。build 0・循環 0（566）・full **222/3057 全緑**
  （−33 検算一致）・残存 grep 0・生存経路健在。残渣 1 件収束（9回目）。
  **ベースライン更新: 222 suites / 3057 tests・circular 566 files**。
  次: **G5-e（最終）** = CH-7 4 メソッド（matches/matchPattern/findAllMatches/hasHandler）＋
  HandlerWithPattern/RegisterHandler 削除・spec 7 本を本番経路（findBestMatch/route/
  getMatchScore）検証へ書き換え（検証能力の純減禁止）。**G5-e 完了で #91 完了 =
  キャンペーン終了 → feature 完了ゲートの大粒度俯瞰#18（二重）→ 台帳クローズ記録**。
- **G5-e 完了（2026-08-05・`5a0e067`）**: CH-7 消化・10 ファイル +134/−223（production −106）。
  **handler 選択**の accept 判定 実装/入口 **5→1**（正本 route→findHandler→findBestMatch→
  getMatchScore のみ。※characterEdit 内の customId→action 第2段判定は未統合 = 俯瞰#18 CL-1）。
  spec 7 本を本番経路検証へ書き換え（it **112→112**・handlers.integration の hasHandler×45 →
  production type filter＋findBestMatch・正例は handler 同一性まで強化）。書き換え前に
  真理値等価性監査（matches ⇔ getMatchScore>0・override 0・stateful regex 0）・
  負の対照実測（pattern 隔離変異→該当 assertion 赤・変異残存なし）。旧 matchPattern の
  数値スコア契約は base getMatchScore spec が保持。検収 Fable 独立再実行: build 0・
  循環 0（566）・full **222 suites / 3057 tests 全緑**（±0 検算一致）・6 シンボル残存 grep 0・
  spec 抜き取りで findBestMatch 経由を実読確認。コミット numstat = Codex 申告と完全一致
  （hook 巻き込みなし）・stale index 残渣なし。
- **#91 完了 = 第5群スイープ終了（2026-08-05）**: G5-a〜G5-e の 5 コミット
  （`c3b4d1b`/`a9c7553`/`7576566`/`71158f9`/`5a0e067`）で **累計 +289/−6,419（純減 ≈6,130 行）**。
  13 系統中 10 消化・close 3（attrition／CE-18 特定不能／系統11 再現不能）・台帳訂正 3。
  ベースライン: **222 suites / 3057 tests・circular 566 files・build 0**。
  **full-review 台帳 mainline＋第5群消化完了 = キャンペーン終了条件成立**。
  残ゲート: feature 完了の大粒度俯瞰#18（二重: Opus 認知負荷モードA大粒度＋Codex
  reuse&duplication・焦点 = G5 削除の取り残し・新規重複なし・G5-e spec 書換の等価性）→
  台帳クローズ記録（CE-18 取り込み漏れ・系統11 数値再現不能の注記）。
- **俯瞰#18 完了・キャンペーン終了（2026-08-05）**: 二重レビュー突合矛盾なし・判定 **Go**
  （Codex blocking 0・G5-e 等価性は両輪とも抜けなし）。close-out 2 コミット =
  **G5-f `2d1fb7c`**（死蔵 PatternMatchResult＋stale 注記 4・+3/−21・全ゲート Fable 独立検収）＋
  **docs `403b1fb`**（DESIGN.md/AI.md/AI.test.md/README 3 本の削除追従・+43/−55）。
  主張スコープ訂正済み（「accept 判定 5→1」→ handler 選択に限定・第2段判定は #97）。
  起票: #97 [High] CL-1 第2段判定統合／#98 CL-3 台帳 27/24 乖離／#99 CL-4 掃き残し 4 件＋
  ts-morph barrel 素通り申し送り／#94 追記 CL-2。full-review 台帳へクローズ注記済み。
  証跡: review-results/overview-18/（integration-verdict.md 正本）。
  正本記録: AI.refactor.md「俯瞰レビュー#18」節。
  **最終ベースライン: 222 suites / 3057 tests・circular 566・build 0・HEAD `403b1fb`**。
  **2026-07-26 full-review 起点の修正キャンペーンは全群消化で終了**。
  未コミットの M doc プール（AI.refactor.md・AI.discord.md・AI.character.md 等）と
  SESSION_HANDOFF（版管理外・#58）はユーザーの push/コミット判断待ちのまま維持。
- **【H フェーズ開始 2026-08-05】俯瞰#18 宿題の消化（ユーザー指示「これらは処理して継続して」）**:
  対象 = #97 [High]・#98・#99・#94 CL-2。スライス構成（結合事実順）:
  **H1-a=#99 純削除 → H1-b=#94 CL-2 modal 契約採用 → H1-c1=#97 button 経路統合 →
  H1-c2=#97 select 経路（pattern⇄predicate 1:1 検証つき・不成立なら最小手当てへ縮退）→
  大粒度レビュー（3 フェーズ規律）→ H1-d=#98 台帳一本化**。
  指示書 = review-results/overview-18/prompt-code-h1{a,b,c1}.txt。
  設計上の発見: enhanced-character-edit.util の parseModalSubmitCustomId は**意味論が異なる
  第3 parse**（素朴 split('-')・最終要素を characterId とする損失系・「現挙動」JSDoc 明記・
  spec pin 済み）→ H1-b スコープ外に明示（統合すると挙動変更）。
  create の pattern ≡ isBasic∪isCancel（同 2 prefix）を実読確認 → C1 の防衛枝は到達不能。
- **H1-a 完了（2026-08-05・`1827f79` +2/−242 相当・7 ファイル）**: #99 消化。
  character-dice.custom-id 削除＋barrel 行除去／characterEdit の importer 0 barrel 2 本削除／
  error-handler の getErrorStats＋BackgroundTaskErrorHandler 削除（spec 13→9 it）／
  character-notification の no-op 2 本削除。検収 Fable 独立実行: build 0・循環 0
  （**566→563**）・full **222 suites / 3053 tests** 全緑（−4 検算一致）・残存 grep 0。
  再測定（barrel 裏取り込み）: **src 側の真の死蔵 0**（残 = test/mocks 21［並行 M 不可侵］＋
  testcontainers 2［既知誤検出］）。コミット後の空行 1 行残渣（hook 整形差）は checkout で解消。
  **ベースライン更新: 222 suites / 3053 tests・circular 563 files**。#99 completed。
- **H1-b 完了（2026-08-05・`b113942` +8/−25）**: #94 CL-2 消化。modal customId の契約採用 —
  character-modal-handler.util のローカル prefix 2 定義削除＋parseEditCustomId を契約 parse()
  委譲＋narrowing へ（等価性 = ロジック行同一を双方実読）・character-section-editor.util の
  buildDirect/SessionModalId を契約 Factory 委譲へ（byte 等価）。prefix 宣言 4→2・parse 実装
  2→1・generate 所有 2→1。損失系 parseModalSubmitCustomId は意味論相違で対象外のまま。
  **Codex サンドボックスで full suite が V8 native crash（exit 3221225477 →
  `Check failed: page_->ContainsLimit`）— Codex は統制どおり回避せず停止し、Fable の独立実行で
  受入**（build 0・循環 0［563］・full 222/3053 全緑・focused 100 tests 前後不変）。
  H1-a コミット時の hook 整形差（末尾空行 1 行）が error-handler.spec と
  character-notification.service に残存 → checkout で解消（新パターン: --only コミット時に
  hook が staged を整形すると worktree と 1 行ずれる）。
  次: **H1-c1（#97 button 経路）実行中** → H1-c2（select）→ 大粒度 → H1-d（#98）。
- **H1-c1 完了（2026-08-05・`0882990` +78/−61・9 ファイル）**: #97 前半（button 経路）消化。
  専用入口 handleRefresh/handleCreate/handleCompact 新設・3 handler 直結・generic
  handleButtonInteraction と refresh/compact predicate 削除（残存 grep 0）・共通エラー処理は
  private executeButtonAction 1 本。refresh の実行順（action→emitEmbedRefresh）spec 固定。
  create は本質的 2 分岐残置＋防衛枝（warn＋ephemeral・pattern ≡ isBasic∪isCancel 確認済みで
  契約 drift 時のみ到達）。r1 正当停止（5例目・発注側制約矛盾: 8 ファイル制約 vs grep 0 —
  integration spec の DI mock property）→ 9 ファイル目最小移行を裁定（mock 3 入口化・it 38 不変）。
  負の対照 = Jest プロセス内 overlay 変異（ディスク非改変・赤確認・残存 0 — 新手法として優良）。
  検収 Fable 独立実行: build 0・循環 0（563）・full **222/3053 全緑**・grep 0・diff 実読一致。
  同時保持 5→3・refresh 変更時の意識 family 4→1。
  次: **H1-c2（select 経路）実行中**（prompt-code-h1c2.txt・integration spec の select mock
  移行を 9 ファイル目として先回り組込済み）→ 大粒度（A/B/C1/C2 俯瞰）→ H1-d（#98）。
- **H1-c2 完了（2026-08-05・`5d2fc1c` +128/−103・9 ファイル）→ #97 [High] 完結**:
  select 経路統合。sectionEditor.execute を 2 専用入口へ分割（共通前処理 =
  getCharacterForInteraction・共通例外 = executeSelectAction）・enhanced service の generic
  select 削除＋C1 ラップを executeInteractionAction へ一般化・integration spec select mock
  最小移行。**defer 意味論保存**（section = 前処理前 defer・valid field = defer なし）。
  挙動差 = delta クラス（character-field-{edit/add 以外}）の silent→warn＋ephemeral のみ。
  spec 17→18 it（+1 防衛枝）・負の対照 = 読み込み時 overlay（SHA-256 で実体不変）。
  検収 Fable 独立実行: build 0・循環 0（563）・full **222 suites / 3054 tests 全緑**
  （+1 検算一致）・grep 0・diff 実読で defer/ガード順保存を確認。
  **コミット時の新事象**: hook（prettier）が staged を 1 行形へ collapse して commit し、
  worktree/index に複数行形が残留 → restore --staged＋checkout で HEAD に整地・
  整地後 focused 29 tests 全緑。characterEdit の customId→action 判定は
  **registry 1 段＋handler 直結のみ**に。副産物: isSectionSelectionCustomId が死蔵化
  （宣言＋自 spec のみ）→ H1-d で削除。
  **ベースライン更新: 222 suites / 3054 tests・circular 563 files・HEAD `5d2fc1c`**。
  次: 大粒度レビュー（3 フェーズ規律・H1-a/b/c1/c2 俯瞰・二重）→ H1-d（#98）。
- **俯瞰#19 完了（2026-08-05・H1-a/b/c1/c2 の 3 フェーズ規律大粒度・二重レビュー）**:
  判定 **Go**（正本 = review-results/overview-18/ov19-integration-verdict.md）。
  突合: 事実矛盾なし。焦点の「エラーラップ 2 層」は両輪一致で **H 以前からの既存**＋
  `ErrorHandler.handleServiceError` は**必ず throw**（swallow なし・名前が誤解を誘う）。
  行動要否のみ相違（Codex 0 / Opus Med）→ 挙動影響ありにつき**新 task 起票へ裁定**。
  H1 主目的は両輪実測で確認（第2段 action 判定 2→0・削除残存 grep 0・退行 0）。
  主要 finding: CL-1 [High] 契約死蔵 11 member＋型 3（うち Refresh.is/Compact.is は
  **H1-c1 が新規死蔵化・コミットメッセージ未報告** = 報告網羅性の非対称）・
  CL-5 #4 modal catch 直書き（6 入口同型化で 12 行純減）・CL-3 create 防衛枝の規約逸脱＋
  registry 未登録と同文言（診断空振り）。
  **doc 分は Fable 直筆で消化済み**: characterEdit README（barrel 案内・不在ファイル・
  forwardRef）・AI.md:857 追記・AI.test.md:1709 追記・MIGRATION_GUIDE（手順 path・
  台帳正本 = DESIGN.md §11 宣言・診断手順に防衛枝の第5切り分け）・
  document/interaction-registry.md 歴史文書化。
  close-out 2 スライス: **H1-d（実行中・spec のみ・#98 台帳 27 化＋S-1/S-2 順序契約固定）**→
  **H1-e（prompt-code-h1e.txt 作成済み**・CL-1 死蔵削除＋CL-5#2 parseBasic 委譲生存化
  ［regex byte 同一を Fable 実測・挙動不変］＋CL-5#4 union 拡張＋CL-3 create 防衛枝
  respondEphemeralError 化＋文言分離［唯一の挙動変更・未 defer 枝では reply() に落ちて実質同一］＋
  コメント 3 件。H1-d コミット後にベースライン埋めて発注）。
  起票済み: **#100**（CL-2 select 経路 2 層ラップ一本化裁定）・**#101**（CL-5 #1 byte 同一
  switch ×2＋#3 同名 extractCharacterIdFromCustomId 2 実装［emitError characterId 常時
  'unknown' 実害］）。doc 追従コミット **`103483d`**（+31/−19・5 本・差分実読で自筆分のみ確認）。
- **H1-d 完了（2026-08-05・`c932d75` +88/−5・spec 3 本のみ・production 0 行）→ #98 完結**:
  台帳 27 化 — hub 3 handler（HubGroupSelect/HubPanelNavigation/HubGroupBrowserNavigation）を
  DI 組み立て・登録配列へ追加し pin 24→27・factory 生成 customId の正例追加・Thread 系
  登録確認 5→実数 8 本へ強化。負例 10 assertion は 27 本化後も全緑（受理化なし）。
  S-1: refresh の「最終更新の非同期完了→emit」を completionOrder で固定。
  S-2: section deferUpdate<findOne・delta deferUpdate<warn<followUp を invocationCallOrder で固定。
  負の対照 = HubGroupSelectHandler 隔離除去で pin＋正例 2 tests 赤（復元 SHA-256 一致）。
  検収 Fable 独立実行: production 実物列挙 6/8/8/5=27 を module 4 本の registerHandlers 実読で
  突合・hub constructor と mock 形状一致確認・build 0・循環 0（563）・
  full **222 suites / 3056 tests 全緑**（+2 検算一致）・diff 実読（既存 assertion 削除なし）。
  コミット時 hook 整形差は index 残渣のみ（worktree ≡ HEAD）→ restore --staged 整地・
  整地後 focused 75 tests 全緑。
  **ベースライン更新: 222 suites / 3056 tests・circular 563 files・HEAD `c932d75`**。
  次: **H1-e 発注**（最終スライス・prompt-code-h1e.txt）。
- **H1-e 完了（2026-08-05・`af2c95a` +22/−179・12 ファイル）→ H フェーズ完結**:
  CL-1 契約死蔵削除（11 member＋型＋カスケード定数＋isSectionSelectionCustomId・
  削除 member 直検証の spec 13 it 整理）・CL-5#2 parseCreationCustomId → parseBasic 委譲
  （挙動不変・死蔵→生存化）・CL-5#4 modal catch を executeInteractionAction へ（6 入口統一）・
  CL-3 create 防衛枝の respondEphemeralError 化＋文言分離（唯一の挙動変更・
  MIGRATION_GUIDE 診断手順へ追従 `c2464c1`）・コメント 3 件。
  検収 Fable 独立実行: diff 12 本実読（H1-d 順序 assertion 無傷確認）・build 0・循環 0（563）・
  full **222 suites / 3043 tests 全緑**（3056−13 検算一致）・残存 grep 0 独立実測・
  eslint 12 ファイル 0。コミット後の hook 残渣は index のみ（worktree ≡ HEAD）→
  restore --staged 整地（テスト済み内容 = コミット内容のため再テスト不要）。
  **環境注記（重要）**: V8 native crash が**ローカル検収中にも再現**
  （pnpm build 2 連続 exit 3221225477 → 3 回目成功・eslint segfault 139 → 単体再実行で回復）。
  Codex sandbox 固有ではなく**マシン全体の間欠事象**。exit 3221225477 / 139 は
  まず再試行・コマンド分割で切り分けてから診断する。
  **ベースライン更新: 222 suites / 3043 tests・circular 563 files・HEAD `c2464c1`**。
  **H フェーズ総括**: 宿題 4 件（#97/#98/#99/#94 追記）完了・コード 6＋doc 2 コミット・
  純減約570行・新規起票 #100/#101。#94 残りは跨ぎ modal 契約裁定のみ（low）。
- **I フェーズ開始（2026-08-05・ユーザーが #100/#101 を指名 → 消化中）**: 裁定確定済み。
  **#100 = I1（実行中）**: 内層 executeSelectAction から handleServiceError を撤去し
  通知＋原文 rethrow へ純化（変換・ログ・emitError は外層 1 箇所）。最終伝播例外は byte 同等。
  挙動差 3 点開示: error イベント原因文言が原文へ・service 層 ERROR ログ 2→1・
  sectionEditor 単体境界の throw 形が原文へ（消費者は enhanced のみ）。合成 spec（2 層貫通）を
  1 本追加（注意: getCharacter は findOne 失敗を null に飲むため、失敗注入は
  embedManager.createFieldSelectMenu throw 等の catch へ届く経路で行う）。
  **#101 = I2（prompt-code-i2.txt 作成済み・I1 後に発注）**: extract 合併
  （6 pattern・enhanced 側優先順・正本 = utils/enhanced-character-edit.util）で
  select/field の emitError characterId 'unknown' → 実 ID へ（modal は session 形式が
  決定不能のため据え置き）。enhanced spec:323 の characterization 追随が必要。
  getSectionData は section-editor.util 正本・modal util 側削除・modal-handler.service 直 import。
  characterThread の private 同名（別 family）は対象外。
  **Fable 裏取り済みの根拠**: emitError:110 は enhanced 版 extract を使用（実害確定）・
  両 extract は非アンカー regex list 同形・getSectionData は byte 同一・
  section-editor.util は modal util を import しない（循環なし）。
  I2 後: feature 完了ゲートの大粒度（二重・scope = I1+I2 と隣接エラー経路）→ 記録 → 報告。
- **I1 完了（2026-08-05・`22dca0a` +106/−45・3 ファイル）→ #100 完結**: 内層
  executeSelectAction から handleServiceError 撤去（ErrorHandler import ごと）・通知＋原文
  rethrow へ。内層 spec 4 エラー経路を rejects.toBe（原文同一性）＋notification→(warn→)rethrow
  順序固定へ追随（18→18・H1-d assertion 無傷を diff で確認）。外層に 2 層貫通合成 spec 追加
  （実物 sectionEditor＋実物 eventEmitter・createFieldSelectMenu 注入・原文イベント/logError 1 回/
  followUp 1 回/最終 500 を固定・I2 の characterId 変更と衝突しない objectContaining 形。12→13）。
  負の対照 = rethrow 握り潰し変異で合成 spec 赤（実体無変更）。
  検収 Fable 独立実行: build 0（間欠 segfault 1 回→再試行で回復）・循環 0（563）・
  full **222 suites / 3044 tests 全緑**（+1 検算一致）・eslint 3 ファイル 0・diff 実読。
  **ベースライン更新: 222 suites / 3044 tests・circular 563 files・HEAD `22dca0a`**。
  **I2 発注済み（実行中）**。bash 長コマンド EOF 破損が commit/status でも頻発 —
  コミットは pathspec/msg を review-results 配下の短パスに置く形へ切替済み（i1-*.txt）。
  （破損の正体も特定: harness のラッパー行が長コマンドで切れる。コマンド全長を短く保つのが対処）
- **I2 完了（2026-08-05・`2251a60` +55/−108・9 ファイル）→ #101 完結**: extract 合併
  （6 family・refresh/compact 優先・非アンカー first-match 維持・正本 =
  utils/enhanced-character-edit.util）＋getSectionData 1 本化（正本 = section-editor.util・
  modal-handler.service は直 import）。実装所有者 2→1 ×2。
  挙動差 = emitError characterId が select/field で実 ID へ（spec:277 'unknown'→'char-123' 追随・
  modal 据え置きは注記更新）。優先順位 adversarial pin
  （'character-edit-section-character-refresh-x' → 'x'）。移設 6 ケース＋純減 1 it。
  負の対照 = 契約 4 pattern 除去変異で 7 tests 赤（実体無変更）。
  検収 Fable 独立実行: diff 9 本実読・build 0・循環 0（563）・
  full **222 suites / 3043 tests 全緑**（−1 検算一致）・削除 symbol 残存 grep 0 独立実測・
  eslint 0。**ベースライン更新: 222 suites / 3043 tests・circular 563 files・HEAD `2251a60`**。
- **俯瞰#20 完了（2026-08-05・判定 needs-fix→I3 で Go 化）**: 正本 =
  review-results/overview-18/ov20-integration-verdict.md。二重（Codex review＋Opus 認知負荷
  モード A 大粒度）・事実矛盾なし。**F-1 [High]（Codex）: I2 合併 extractor の非アンカー・
  refresh 優先が衝突クラスの ID を短縮** — characterId は外部生成・@IsString のみ
  （create-character.dto.ts:40・character.service.ts:117-121）で公開 API から到達可能。
  I2 裁定「生成集合上不変」は Fable の誤り（adversarial pin が新挙動の追認化 →
  verify-claims-before-prescribing 事例15 追記済み）。CL-2 [High]（Opus）:
  error.occurred 唯一の購読者 handleFeatureError:117-120 が characterId を読まない。
  CL-1: 端から端は経路 4 変種（既存構造・I1 の 2→1 は service 層内で正）。
  【訂正 2026-08-05 実測】ERROR は registry:140 を欠いた過小計上で **正しくは 4 本
  （modal のみ 5 本）**・通知は select/modal/refresh 2 通・create/compact 1 通・
  create のみ最外周 reply()。内層 ErrorHandler 残存は **modal のみ**（refresh は
  followUp 直呼び＋原文 rethrow）。正本表 = AI.discord.md 最新メモ（2026-08-05）。
  消化計画: **I3 実行中**（prompt-code-i3.txt: 全 6 パターンアンカー化＋refresh/compact
  PARSE_PATTERN 契約新設 = CL-3 解消・pin 反転 'character-edit-section-character-refresh-x'→
  完全 ID・round-trip 6 family・CL-2(a) characterId ログ追加・CL-6 到達不能 throw 削除・
  CL-5 serviceName 訂正）。doc: AI.test.md 歴史注記 4 件（F-2）適用済み未コミット・
  AI.discord.md 経路表は I3 後。起票: **#102**（CL-1(b)(c)）・**#103**（CL-4）。
- **I3 完了（2026-08-05・`1d98569` +92/−22・11 ファイル）→ 俯瞰#20 Go 化**:
  全 6 パターンアンカー化（refresh/compact PARSE_PATTERN 契約新設・既存 4 定数 `^` 付与・
  extractor は契約定数 6 本のみの配列へ）。pin 反転
  （'character-edit-section-character-refresh-x' → 完全 ID）＋field 衝突＋中置 prefix 負例＋
  round-trip 6 family（衝突 ID 'character-refresh-x' で契約 create→extract 同一性）= +8 it。
  CL-2(a) handleFeatureError ログへ characterId（spec は Logger.prototype.error spy で文言固定）・
  CL-5 serviceName 実クラス名化（spec 2 assertion 追随）・CL-6 到達不能 throw 削除
  （**開示された適応**: catch 枝が値を返さなくなるため `return ErrorHandler.handleServiceError(...)
  as never` — シグネチャ never 化（不採用済み）ではなく呼び出し側の局所キャスト。受入）。
  負の対照 = refresh のみ非アンカー化の隔離変異で field 衝突 pin 赤（残存なし実測）。
  検収 Fable 独立実行: diff 11 本実読・build 0・circular 563/循環 0・
  full **222 suites / 3051 tests 全緑**（+8 検算一致）・eslint 11 ファイル 0（V8 crash 1 回→分割）・
  PARSE_PATTERN 消費者 = extractor のみ grep 実測・MM 残渣 restore --staged（numstat 0 = CRLF のみ）。
  doc 追従: AI.test.md 歴史注記 4 件 = `95e92be`。
  **ベースライン更新: 222 suites / 3051 tests・circular 563 files・HEAD `95e92be`**。
  AI.discord.md 経路表（CL-1(a)）記載完了（2026-08-05・5 変種 ×
  通知/ERROR/イベント文言/最外周分岐・Fable が registry:140/refresh/modal/compact/
  discord.js InteractionResponses.js:284 を現物裏取り）。俯瞰#20 verdict へ訂正注記・
  #102 起票文の前提訂正済み。**I フェーズ完全終了 — compact 推奨タイミング**。
- **push 完了（2026-08-06・ユーザー指示）**: origin/develop へ 203 コミット。ユーザー側で
  M doc プール＋スキル群を先行コミット済み（`53211df`〜`959f961`・SESSION_HANDOFF tracked 化
  = #58 完了）。CI（pnpm 11 初回）は gh CLI 不在のため未確認 — ユーザー確認待ち。
  bash ハーネス破損が恒常化 → PowerShell から Git Bash 実体パス起動へ切替（メモリ記録済み）。
- **J1 完了（2026-08-06・`62a84f3` +54/−36・4 ファイル）→ #102 完結**: modal 内層
  （modal-handler:73-88）の ErrorHandler 撤去 = select 同型「通知＋原文 rethrow」へ。
  refresh catch 通知（enhanced:173-176）を respondEphemeralError
  （deferredStrategy:'followUp'）util 化。挙動差 = ERROR 5→4・error.occurred 文言全経路原文
  （経路表更新 `03bef1d`）。spec は原例外 identity（rejects.toBe）＋通知→rethrow 順序
  observeRejection 形へ強化・modal emit message 原文 pin 追加・refresh mock は deferUpdate で
  deferred=true 再現。負の対照 = rethrow 握り潰しで 4 tests 赤。
  検収 Fable 独立実行: diff 4 本実読・build 0・循環 0（563）・full **222/3051 全緑**（±0
  検算一致）・eslint 4 本 0・modal-handler 内 ErrorHandler 残存 grep 0。
  **ベースライン: 222 suites / 3051 tests・circular 563・HEAD `03bef1d`**。
  次: **J2 = #103**（prompt-code-j2.txt: getSectionData/SECTION_NAMES/getSectionDisplayName を
  embed.util へ移設 1 本化・buildFieldSelectMenu 第 3 switch 撤去＋EDITABLE_SECTION_TYPES
  新設・'basic'→null pin 維持が罠・移設先は循環回避で embed.util 一択）発注。
- **J2 完了（2026-08-06・`9a1f954` +116/−111・6 ファイル）→ #103 完結**: getSectionData/
  SECTION_NAMES/getSectionDisplayName を embed.util（EmbedSectionType 定義所有者）へ移設
  1 本化（byte 保存・re-export なし・modal-handler/section-editor 再配線）。
  buildFieldSelectMenu 第 3 switch 撤去 → EDITABLE_SECTION_TYPES ガード＋正本参照
  （'basic'/'back'→null・空→追加メニュー不変）。buildSectionedEmbeds リテラル 4 件を正本参照へ。
  旧 util の「discord.js 非依存」ヘッダも実態へ更新（getSectionDisplayName 経由の透過依存を明記）。
  spec 10 移設＋drift 固定 1 追加。負の対照 = 'item' 除去変異で drift spec 赤（SHA 一致確認）。
  検収 Fable 独立実行: diff 6 本実読・build 0・循環 0（563 — 新循環なしの検証を兼ねる）・
  full **222 suites / 3052 tests 全緑**（+1 検算一致）・eslint 6 本 error 0
  （warning 2 は移設行の既存 assertion 由来）・旧定義残存 grep 0・MM 残渣 restore --staged
  （numstat 0 = CRLF のみ）。
  **ベースライン: 222 suites / 3052 tests・circular 563・HEAD `9a1f954`**。
  現在: **俯瞰#21（3 フェーズ規律 = I3/J1/J2・二重）起動** — Codex review＋Opus 認知負荷
  モード A 大粒度。対象コミット: `1d98569`/`62a84f3`/`9a1f954`（＋doc `95e92be`/`03bef1d`）。
- **俯瞰#21 完了（2026-08-06・判定 needs-fix→J3 で Go 化）**: 正本 =
  review-results/task-102/ov21-integration-verdict.md。事実矛盾なし・相補。両輪一致 =
  **3 スライスの本番挙動は全て意図どおり・認知負荷 net delta 純減**（Opus 実測表: 同一責務
  所有者 −9 実装・ERROR modal 5→4・イベント文言 2 種→1 種・過剰設計の芽 0）。
  needs-fix 根拠 = spec 検出力の穴 2 Med（Codex C-1: アンカー pin が refresh 系のみで他 5
  family の `^` 単独除去を検出不能／C-2: buildFieldSelectMenu 負例が 'basic' のみ）＋
  J2 取りこぼし（Opus CL-3: buildSectionedEmbeds が同一ファイル正本 getSectionData を迂回・
  Fable diff 実読で CONFIRMED）＋JSDoc 過剰一般化（Opus CL-4(a)）。
  消化: **J3 発注済み（実行中）** = 5 family 衝突 pin＋'back'/未知値 null pin＋
  data 引数 4 件正本参照化＋:256/:333 語彙正本化（Codex C-3）＋JSDoc 限定。
  Fable doc 済み: README（custom-id/・handlers/ 追補・utils 依存注記実態化・
  削除済み CharacterCreationService 行除去 — module exports 現物突合）・AI.test.md
  歴史注記へ J2 追記（正本 = embed.util）。
  起票: **#104**（[High] embed 独立 2〜3 系統 — 第 3 実装 characterThread/
  character-display.service:204 は Fable 発見）・**#105**（セクション 9 列挙テーブル化・
  CL-7 吸収）・**#106**（handleServiceError never 化 — 俯瞰#20 不採用への反証・30 呼び出し
  検査義務）・**#107**（通知文言 5 複製）・**#108**（modal.submitted payload 疑義）。
  Opus 輪は API 切断 1 回 → SendMessage 再開で完走（記録: 再開手順は有効）。
- **J3 完了（2026-08-06・`0614e8c` +74/−12・spec 中心）→ 俯瞰#21 Go 化・J フェーズ完全終了**:
  残り 5 family の衝突 pin（配列順で各 `^` 単独除去を個別検出）・'back'/未知値→null 負例・
  buildSectionedEmbeds data 引数と :256/:333 語彙の正本参照化（挙動不変）・JSDoc 主張限定。
  負の対照 2 変異（compact `^` 除去／guard 弱体化）とも赤・SHA 復元確認。
  検収 Fable 独立実行: diff 実読・build 0・循環 0（563）・full **222 suites / 3059 tests
  全緑**（+7 検算一致）・eslint error 0。doc 追従 `5b6aef1`（README 実態同期・
  AI.test.md 正本追記）。**ベースライン: 222 suites / 3059 tests・circular 563・
  HEAD `5b6aef1`**。push 済みは `959f961` まで — `62a84f3` 以降 6 コミットが未 push
  （push はユーザー判断）。残 backlog は #104〜#108（高優先は #104 embed 2〜3 系統）。
  **J フェーズ記録済み — compact 推奨タイミング**。
- **K フェーズ開始（2026-08-06・ユーザー指示「midium までが解消するまではこの実装レビュー
  ループは続けて」）**: スコープ = #104 [High]＋#105 [Med]（＋ループ中に出る新規 Med+）。
  #106〜#108 は Low/疑義で対象外。ループ完了時に俯瞰#22（大粒度二重）を実施して閉じる。
- **K1 完了（2026-08-06・`0848127` +17/−582・16 ファイル）— #104 完結**: 実測の結論は
  「2〜3 系統」ではなく **4 系統**（A=編集 UI messageUpdater / B=CharacterUIService 経由
  サマリ / C=characterThread 死蔵 2 関数 / D=同ハンドラのスレッド表示更新）。裁定 =
  **B 全削除で A へ一本化＋C の死蔵 2 関数削除・D とイベント契約は不変**。根拠 = B の唯一
  発火はレガシーキャラのモーダル保存のみ・出力は現行データ形状で `[object Object]` 破損・
  固有情報はダミー guildInfo 2 行・characterName 衝突で A を誤上書きするリスク。C は自認
  コメント付き no-op ゴースト＋本番呼び出しゼロ（Fable 直接裏取り 3 点）。
  正本 = review-results/task-104/k1-measurement-and-ruling.md（「無限に積まれる」初期報告の
  過大表現も同所で訂正 — 実際は恒常 1 通＋自己編集）。
  update.completed ハンドラは B ブロックのみ削除（系統 D・retry 契約・emit サイト不変）・
  stale mock 2 件掃除・K1b 微修正ラウンド（Opus・コメントのみ）で消滅クラス参照コメント
  4＋2 件を掃除（CharacterUIService は src 全域 grep 0）。
  挙動差の開示: レガシーキャラ保存時の破損サマリ embed 投稿が止まるのみ。
  検収 Fable 独立実行: diff 全実読（範囲一致・過剰実装なし）・build 0・循環 0
  （**559** = 563−削除 4 ファイル）・full **220 suites / 3042 tests 全緑**（−2/−17 検算一致）・
  eslint 9 本 error 0・pre-commit prettier hook の index 残渣は restore --staged で解消
  （HEAD⇄worktree 内容差分ゼロ確認済み）。
  **ベースライン: 220 suites / 3042 tests・circular 559・HEAD `0848127`**。
  次: K2 = #105（セクション記述テーブル化・設計ノート = review-results/task-105/
  k2-design-notes.md 済み）→ 俯瞰#22。
- **K2 完了（2026-08-06・`dfe8761` +202/−104・6 ファイル）— #105 完結**:
  character-section-descriptor.ts 新設 = 5 セクションの表示名/emoji/色/編集可否/メニュー
  説明の単一正本（pure・discord.js 非依存・editable type は satisfies で
  CharacterEntity∩UpdateCharacterDto キーへ型拘束 — **descriptor に架空キーを書く方向**の
  欠落は TS2322。entity/DTO へ追加して descriptor を忘れる逆方向は検出されない
  = 俯瞰#22 F2 で訂正済み。K2 コミット文の「セクション追加時の欠落がコンパイル
  エラーになる」は過剰主張）。embed.util は公開 API 不変の内部導出化（UI 出力 byte 不変・'back' の
  旧挙動 undefined を wrapper で維持）・enhanced-character-edit.util 独自 union と
  modal-handler.util 4 分岐 switch をテーブル参照化・contracts union は不変＋
  新規 spec 4 本で drift 固定。負の対照 2 変異（ghost 行→TS2322／displayName 改変→
  spec 赤）とも確認・SHA 復元済み。
  検収 Fable 独立実行: diff 全実読・build 0・循環 0（**561**）・full **221 suites /
  3046 tests 全緑**（+1/+4 検算一致）・eslint 5 本 0・旧列挙残存は spec pin のみ。
  prettier hook の index 残渣 2 ファイルは restore --staged で解消。
  指示書事故 1 件（統制ブロック定型の書き落とし → Codex が AI.refactor/AI.test を
  直接編集・内容正確で受入）はメモリ delegation-prompt-must-name-invariants へ記録済み。
  **ベースライン: 221 suites / 3046 tests・circular 561・HEAD `dfe8761`**。
  **Med+ ループの実装は完了（#104/#105）— 次: 俯瞰#22（大粒度二重レビュー）で close 判定。
  新規 Med+ が出れば消化を継続（ユーザー指示）**。
- **俯瞰#22 完了（2026-08-06・統合判定 needs-fix→K3 で close）**: 正本 =
  review-results/overview-22/ov22-integration-verdict.md。Opus（Go・実測 5 表）と
  Codex（needs-fix・Med 2）は事実矛盾なく相補 — ユーザー指示「Med+ 解消まで継続」により
  厳しい側を採用。Med 5 件全て Fable 裏取り CONFIRMED:
  C-1 extractSectionFromCustomId の editable 4 値独立列挙（新セクションで modal 経路
  silent null）／C-2 UI byte pin の穴（menu label/description・色 3/5 未固定）／
  F1 未知値の失敗モード TypeError 化（cast 握り潰し・到達不能）／F2 satisfies 一方向の
  過剰主張（記録訂正で消化・逆方向 closure は description が意図的 UI 外のため不採用）／
  F3 stale 配置理由（section-editor.util:9-14・README:48-49）。
  Low 3 件は起票: #109（re-export 鎖＋同名 2 契約）・#110（characterThread 5 サイト統合
  裁定・tab 'status'→parameter 意味ずれの単独裁定つき）・#111（update.completed の
  到達不能 retry 構造）。両輪一致の健全性: K1 残骸 0・D 検証能力純減なし・K2 挙動保存・
  認知負荷 net 純減。
- **K3 完了（2026-08-06・`c892fbf` +68/−22・8 ファイル）— 俯瞰#22 Med 消化・ループ close**:
  C-1 = EDITABLE_SECTION_TYPES 走査導出化（受理範囲・表順保存）＋descriptor 全行追従の
  completeness spec／C-2 = menu 4 option {label,value,description}＋embed 5 件
  {title,color} の期待値ベタ書き完全一致 pin（独立 oracle）／F1 = overload 化で cast 撤去・
  未知値→undefined 復元＋pin 2 本＋コメント実態化／F3 = descriptor import type 化・
  正本コメント/README 訂正。負の対照 3 変異全て赤・SHA 復元確認。
  検収 Fable 独立実行: diff 全実読・build 0・循環 0（561）・full **221 suites /
  3051 tests 全緑**（+5 検算一致）・eslint error 0（warning 2 は既存行）。
  **ベースライン: 221 suites / 3051 tests・circular 561・HEAD `c892fbf`**。
  **Med+ 消化ループ（ユーザー指示）は close — #104 [High]・#105 [Med]・俯瞰#22 の
  Med 5 件すべて消化済み。残 backlog は Low/疑義のみ（#94-#96/#106-#111 ほか）。
  push はユーザー判断（`62a84f3` 以降 12 コミット未 push）。
  K フェーズ記録済み — compact 推奨タイミング**。
  (2) **CH-7 決着**: 本番 dispatch は findBestMatch→getMatchScore の1本。matches/matchPattern/
  findAllMatches/hasHandler は spec 専用の意味重複（live 1＋spec-only 2）→ 死蔵去就は #91 へ。
  台帳訂正を AI.refactor.md 俯瞰#5 節に反映済み。
  (3) **CL-3 現況**: component type マジック数は production **2箇所**現存
  （enhanced-character-edit.util.ts:113 `type !== 2`・character-modal-handler.service.ts:470
  `type !== 3` — 当初「唯一」と誤記載。裏取り grep が `!==` を欠いた検証穴で、Codex round1 の
  前提矛盾停止で発覚 → verify-claims-before-prescribing 事例13）。
  探索側 literal probe は 3 ファイル約 10 箇所に現存（enhanced-character-edit.util.ts:117-118 /
  character-modal-handler.service.ts:56,473-475 / character-section-editor.util.ts:165-184）
  → #88-b（includes 意味論を保存した契約定数参照化）。
  (4) 副産物: postSkill/postAbility 257-node 重複と dnd5e/sw25 builder 111-node 重複を
  static:duplication で確認（前者は #89 領分）。customId 生成/解析サイトは並行 M ファイルと
  重なりゼロ（thread-interaction / characterEdit utils・services は M 群外）。
front 側 backlog（#76〜#80/#83 等）は low 相当につき起票のまま（処理義務なし）。

**並行 M ファイル統制（不変）**: TRPG-SERVER の未コミット M 群（discord 系・auth service/
jwt-token・response.interceptor・test-auth 等 = 2026-07-12 改善単位2〜7 の Approved 済み
未コミット成果）には触れない・巻き込まない。E1b/E1c のコード対象との衝突は実測済みで無し
（core/http は response.interceptor のみ M・E 系は触らない）。full suite ゲートは混在 worktree
での実行になるため、着手前ベースラインとの差分で判定する。
sheet-engine-template-validation.service.spec.ts の MM 残渣（index のみ整形差）は
restore --staged で収束済み（2026-08-04）。
- ユーザー側 TODO: ~~push~~（2026-08-06 完了 `959f961..f12ea17`）→ pnpm 11 CI 結果の確認

## 2026-08-06 開始: Next.js 移行キャンペーン（現在の feature・タスク #112〜#120）

ユーザー指示「Next移行で進めて」。**計画の正本 = `document/NEXT_MIGRATION_PLAN.md`**
（読み順: 本節 → 計画書 → 該当フェーズの review-results/next-migration/）。

- 方式 = **並行パッケージ `trpg-next-app` 新設**（Next 16.3.0 / React 19.2.8 /
  Mantine 9.5.1）→ ルート毎移植 → N6 で compose/CI 切替・trpg-remix-app 撤去。
  移行中は旧 app の feature 開発凍結
- N0 完了（2026-08-06）: read-only インベントリ（Explore・実カウント）で旧記録
  「12 ルート」を **17 ルート**へ訂正（実体 8＋redirect スタブ 5＋プレースホルダ 3＋
  resource 1）。設計ガード「Remix API は route 層のみ」は**不遵守**（routes 外 12 ファイル・
  等価物なし 5: useRouteLoaderData/useRevalidator/useNavigation/useFetcher×3）。
  地雷 7 件（lib バレル→node:http が Client 流入・serverRequestContext 可変グローバル・
  トップレベル初期化 throw・自作 env 二重機構ほか）を計画書 §3-3 に台帳化。
  dead code 4 群（COC edit ツリー/gridTest/fuse+moji 経路/zustand・immer）は移植対象外
- インベントリ報告の誤り 1 件を Fable 訂正: 「Next の layout は毎回サーバで実行される」は
  誤り（soft nav で再実行されない）→ #72 per-page インライン検査の正本は Next でも維持
  （計画書 §6-1）
- フェーズ: N1 scaffold → N2 認証基盤 → N3 user 系 → **大粒度レビュー#1** → N4 sheet →
  N5 templates → N6 切替・撤去 → **最終レビュー＋close**。受入ゲートは計画書 §5
  （新 app 4 コマンド緑＋旧 app build 緑＝非破壊証明＋diff 実読）
- **N1 完了（2026-08-06・`0d47420` 15 ファイル）**: trpg-next-app 新設（Next 16.3.0 /
  React 19.2.8 / Mantine 9.5.1・App Router・dark 固定 layout・theme/generateColors 移植・
  / ページ移植〔認証 TODO(N2) 暫定〕・dev ポート 3100 暫定）。Codex 実装＋Opus 微修正
  ラウンド（agentRules: false で dev の AGENTS.md/CLAUDE.md 自動生成を停止 — 外来
  CLAUDE.md の文脈混入防止・負の対照つき実証／.gitignore へ tsbuildinfo）。
  検収 Fable 独立実行: 新 app build/typecheck/lint/test 緑・旧 app build＋test 緑
  （7 suites/159）・**server full suite 221/3051 全緑**（lockfile の ts-jest optional peer
  再解決 29/30.0→30.4.1 が全 importer に及んだため実測 — jest 本体 29.7.0 不変・無害を実証）・
  dev / HTTP 200＋描画確認。**Mantine 7.17.8⇄9.5.1 の darken/lighten パレット出力等価を
  跨バージョン実測**（spec pin と三者一致）。theme/generateColors は字面書き換え移植
  （意味等価を diff 実読で確認・コメント除去は許容判断）。
  インベントリ誤り 2 件目の訂正: 旧 app の Mantine 実解決は 7.8.0 ではなく **7.17.8**
  （N1 以前から。install での変動なしを lock diff で確認）。
  次: N2（認証基盤 — env 機構・api-client 再設計・/login・ガード規約 Next 版）。
- **N2 完了（2026-08-06・`d890f63` 12 ファイル）**: 設計裁定の正本 =
  review-results/next-migration/n2-design-notes.md（裁定 6 件: callback hop 方式・
  serverRequestContext 全廃・requireJwt 許可＝#72 Next 版・cookie domain 死に分岐の
  非移植・env 遅延検証・旧 app 同一 import パス配置）。実装 = Codex（裁定からの逸脱なし・
  axios 1.18.1 直依存追加は必要追随）。
  検収 Fable 独立実行: 全 10 ファイル実読（LoginBtn は旧 login.tsx と UI 等価・
  no-op hover のみ非移植・逆方向 import 解消を確認）・build/typecheck/lint/test
  （3 suites/4）緑・旧 app build 緑・dev スモーク 3 点（/login 200＋OAuth URL・
  /user 未認証 307→/login・callback code なし 307→/login）・lockfile は
  trpg-next-app importer に閉包（server-only@0.0.1 のみ追加）。
  開示済み挙動差: rejectUnauthorized 旧 !isDevelopment → 新 isProduction()
  （NODE_ENV=test のみ差・開発系）。
  **大粒度レビュー#1 への申し送り**: auth.service.server の ErrorEnvelope 復号
  （getErrorEnvelopeMessages）は旧 app の api-response.util 系と同種ロジック —
  N3〜N5 で復号実装が増えたら 1 本化スイープ必須（旧 app で #82/#86 の統合経緯あり）。
  次: N3（user 系 — (user) layout・useAuth 再設計・Header/nav・character 一覧
  soft degrade・プレースホルダ 3）。
- **N3a 完了（2026-08-06・`6ab091c` 17 ファイル・N3 は a/b 分割）**: 設計 = n3-design-notes.md
  裁定 7〜9・12。getAuthState()（cache・非 throw）RSC 供給で useAuth 撤去・
  logout Server Action 化（旧実装は front の httpOnly cookie を誰も消せない構造 —
  修正として挙動変更を開示）・app/user/layout.tsx 合成 gate（Remix 親 gate 実行則と
  Next layout 実行則の同型性で挙動保存）・Header/Footer/AppLayout/UserPageNav/
  discordAvatar 等価移植（NavLink 素 href quirk 保存・Outlet context 消費者 0 で不採用）。
  検収 Fable 独立実行: 4 受入緑（4 suites/7）・旧 app build 緑・dev スモーク 4 点
  （/ 200 Header/Footer/未ログイン分岐・/user 307・/user/story 307・/login 200）・
  移植ペア 5 組の新旧 diff 実読。観察: Codex はコメントを一貫して剥がす傾向 —
  大粒度レビュー#1 で load-bearing コメント喪失の有無を確認する。
  次: N3b（/user/character 一覧・gameSystem 分離・到達可能性実測つき）発注済み。
- **N3b 完了（2026-08-06・`6b56189` 12 ファイル）— N3 完結**: Codex の到達可能性実測が
  優秀 — **削除導線は hook 返却のみで UI/props 配線ゼロ＝完全死蔵**（deleteCharacter
  呼び出し 0。#92 の裁定材料として実測供給・非移植）・Retry 分岐は到達不能
  （catch が常に未認証形を伴う）・card クリック console.log は quirk 保存。
  getCharacterListData = 旧 loader soft degrade 等価（spec 3 分岐）・再取得/Discord 投稿は
  Server Action＋revalidatePath＋useTransition・gameSystem.ts は JSON import のみの
  client-safe 最小化（barrel 不在 = 地雷 1 恒久解消・gameSystemList.json ハッシュ一致）。
  検収 Fable 独立実行: 4 受入緑（5 suites/10）・旧 app build 緑・dev スモーク
  （/user/character 307・/ 200）・CharacterCard/List/PageClient 新旧 diff 実読
  （UI byte 級等価・aria-label 1 件のみ追加）・旧ルート JSX との突合で
  CharacterPageClient の忠実性を確認。
- **大粒度認知負荷レビュー #1 完了（2026-08-06）— 統合判定 needs-fix → N3c で消化**:
  二重レビュー（Opus CL-1〜13・Codex F1〜9）は事実矛盾なし・相補。構造否定は両輪ゼロ
  （概念純減 18→15・方針遵守 6 項目実測）。正本 =
  `review-results/next-migration/ov1-integration-verdict.md`（Med+ 全 12 件 Fable 裏取り
  CONFIRMED・消化計画 A〜E・見解相違 1 件裁定・Low 同時消化・見送り 3 件）。
  裁定の要点: **307 統一と Action 失効 hard redirect は意図的変更として採用**（F4/F5・
  spec pin と AI.md 開示で消化）・F1（dev OAuth が旧 app へ向く）は運用注記・
  F8 revalidatePath は削除で旧挙動へ・Server Action 返却形は doc 1 行のみ（型導入否決）。
- **N3c 消化ラウンド着手（2026-08-06）**: Fable が `trpg-next-app/AI.md` を新設
  （消化 B: server-only 規則・requireJwt 理由・soft degrade 例外・Action 返却形 1 行・
  封筒不変条件・OAuth 制約と /auth/callback hop・dev OAuth 運用注記・307/F5 裁定開示）。
  Codex へ A/C/D/E を委譲（prompt-code-n3c.txt / run-n3c.sh）:
  A = api-response.util.ts 復元（旧同名 3 export・ApiResponseUtil は YAGNI 非移植）＋
  auth.service 縮約＋decoder spec、C = eslint 2 ルール移植（wire16 allowlist＋
  lib→features zone・Vite 固有の namespace 禁止は非移植・負の対照 probe 必須）、
  D = jwt 引数×5 と explicitJwt 分岐削除・requireJwt→Promise\<void\>・readJwt()/
  JWT_COOKIE_NAME 正本化・~/ alias 削除、E = server-only 2 行・意図コメント復活・
  F8 削除・callback 3 分岐 spec＋api-client spec。
  **Med+ 全消化の検収が通るまで N4（#117）に進まない**（campaign 規約）。
- **N3c 完了（2026-08-06・`1e482d7` 19 ファイル +397/−73）— レビュー#1 クローズ・#116 完了**:
  Codex は初回、server-only 追加が既存 2 spec を壊す点で統制⑥どおり停止→範囲錠追補
  （`jest.mock('server-only', ...)` 1 行×2・既存 .server spec の確立パターンを grep 裏取り）
  で再委譲し完走。検収 Fable 独立実行: build/tsc/lint/test（8 suites/31 tests）緑・
  旧 app build 緑・dev スモーク（/ 200・/login 200・/user 系 307・callback no-code 307）・
  eslint 負の対照を自前 probe で独立再現（wire allowlist＋lib→features zone の 2 errors・
  probe 削除済み）・api-response.util.ts は旧 app と 3 関数 byte 同一を実読確認・
  'jwt' リテラルは JWT_COOKIE_NAME 定義＋spec pin のみ・explicitJwt/~/alias 残存ゼロ・
  revalidatePath は character 側の意図的残置のみ（discord 側 F8 は削除）。
  Med+ 12 件＋Low 同時消化すべて完了。**次: N4（#117・$id.sheet 最重量）**。
- **N4 設計フェーズ完了（2026-08-06・裁定 13〜18 = n4-design-notes.md）→ Codex 委譲済み**:
  旧 sheet ルートは 191 行単一ファイル・依存 4 系統を実測。**要注意の実測 = /sheet-templates は
  封筒なし**（ResponseInterceptor は controller 単位適用・sheet-template controller に無し →
  `response.data` 直返しが正）。これに伴い **AI.md の「2xx は常に SuccessEnvelope」を
  封筒化 4 controller スコープへ訂正**（`ai-md-claim-scoping` の再発防止・8 件目を未然回避）。
  他の裁定: v3 型 55 行 wholesale 移植・sheetTemplateApi は N4 消費分のみ・
  getCharacter の CustomError ラップ非移植（status 破壊側・新イディオム優先）・
  Server Action saveSheet は {error, conflict?} 返却＋成功 redirect・sheet 無しは inline Alert
  簡略化・NumberInput は Mantine 9.5.1 実測で 7 系と同一意味論（NumberInputValue=number|string）・
  純関数（editableScalarFields/readEditableValue/deriveSheetChanges）を sheet-edit.ts へ抽出し spec pin。
- **N4 完了（2026-08-06・`54fec55` 10 ファイル +636/−2）— #117 完了**: Codex 一発完走。
  検収 Fable 独立実行: build（/user/character/[id]/sheet ルート生成確認）/tsc/lint/test
  （11 suites/49 tests）緑・旧 app build 緑・dev スモーク（未認証 sheet 307→/login）・
  v3.ts 新旧 byte 同一（--no-index 突合）・全 10 ファイル diff 実読。
  実装の要点確認済み: redirect は try/catch 外（NEXT_REDIRECT 保護）・sheet-edit.ts の
  CharacterSheetChange import は `import type`（server-only 越境なし）・quirk 全保存
  （hasInvalidNumber・disabled 条件・Alert 3 色・NaN Object.is spec pin つき）。
  **次: N5（#118・templates 一覧/編集/dice-preview の 3 ルート・fetcher 3 コンポーネント再設計）**。
- **N5 設計フェーズ完了（2026-08-06・裁定 19〜23 = n5-design-notes.md）→ N5a Codex 委譲済み**:
  実測 = ルート 3 本は薄く重量は component 3 本（Editor 587・List 224・Preview 198・全て
  useFetcher）と utils（v3Template 301＋spec 664・dicePreview 86＋spec 121）。
  **3 サブスライス分割**: N5a 一覧（v3Template wholesale・V2 型は types/v2.ts 新設・
  api 残 5 関数・List→Server Actions 4 本・page soft 形）→ N5b dice-preview Route Handler
  （401 JSON parity・status passthrough — Server Action では status 表現不能のため handler が正当。
  #78 は Next で構造消滅）→ N5c editor＋preview（save/publish Actions・preview は
  handler へ fetch）。旧 action の HTTP status 分岐は Server Action で表現不能 → 開示済み。
- **N5a 完了（2026-08-06・`16aa805` 11 ファイル +1682/−1）→ N5b Codex 委譲済み**:
  検収 Fable 独立実行: build（/templates 生成）/tsc/lint/test（14 suites/152 tests）緑・
  旧 app build 緑・dev スモーク（未認証 /templates 307→/login）・
  **v3Template.ts/spec は新旧 --no-index diff で import 差分のみを確認**（335/721 行 —
  設計メモの 301/664 は Measure-Object が空行を数えない計測誤り。Codex の指摘が正）・
  全 11 ファイル diff 実読。エラー表示面（上部/modal）の写像・localStorage v2 移行導線・
  autoFocus 例外の文脈保存を確認。
  レビュー#2 スイープ候補メモ: 移植した v3Template.ts 冒頭コメントが旧 app の
  `../AI.types.md` を参照（新 app に同 doc なし・stale pointer）。
  N5c 追補裁定は n5-design-notes.md 裁定 22 に記載済み（editor 実読完了・autosave 機構
  無変更移植・v3_fetcherPersist quirk は await 化で構造消滅・preview fetch の network
  例外分岐新設を開示）。
- **N5b 完了（2026-08-06・`7e9960e` 4 ファイル +451）→ N5c Codex 委譲済み**:
  検収 Fable 独立実行: build（/templates/dice-preview 生成）/tsc/lint/test
  （16 suites/169 tests）緑・旧 app build 緑・dicePreview utils は新旧 byte 同一
  （--no-index diff ゼロ再確認）・route spec 6 分岐実読・
  **dev 実測で 401 JSON 契約を確認**（未認証 POST → 401
  {"status":401,"messages":["認証が必要です"]}・認証が body 検証に先行 = 旧同順）。
- **N5c 完了 = N5（#118）完了（2026-08-06・`f091e00` 5 ファイル +1030/−5）**:
  editor 632 行を旧と突合実読 — saveState 5 状態・autosave 1800ms・signature merge
  （lastSaved/pending/templateRef）・localStorage・conflict reload・CRUD/JSX は行単位一致。
  意図差分は裁定 22 の範囲のみ: fetcher.submit → await saveTemplateDraft（fetcher.data 監視
  effect を await 直後へ移動・分岐同一）・inFlightIntent/actionMessages 明示化（保存ボタン
  loading の旧 stale `fetcher.data?.intent` quirk は in-flight intent 判定へ正規化 = 開示済み）。
  preview は fetch → N5b handler 消費・rollingFieldUid 全ボタンロック・fetcherPersist 構造消滅。
  spec 追加 4 ケース（12 キー写像 pin・update→publish 順序 pin・409/非 409）実読。
  検収: build/tsc/lint/test（16 suites/173 tests）緑・旧 app build 緑・dev 実測
  （未認証 GET /templates/dummy-id/edit → 307 /login）。
  **検収時の罠（N6 起票へ）**: 初回受入チェーンの `next build` が診断ゼロで型検査失敗 —
  next-env.d.ts の参照が dev（`.next/dev/types`）と build（`.next/types`）でフリップし、
  stale な生成型と組むと一過性失敗する。tsc 直叩き緑・build 再実行緑で解消。
  next-env.d.ts は HEAD 復元してコミット外に維持（gitignore 化の裁定は N6）。
  **次: N6（#119・配線切替＋Remix 撤去）**。起票済み候補: next-env.d.ts gitignore 裁定・
  v3Template.ts の stale `../AI.types.md` コメント・UserPageNav inline style・
  gameSystemList.json 247KB bundle・#78/#79 の close 処理。
- **N6 設計フェーズ完了（2026-08-06・裁定 24〜32 = n6-design-notes.md）→ N6a Codex 委譲済み**:
  **3 分割** = N6a 配線切替（Codex・旧 app 存置のまま Dockerfile 新設/compose ×2/nginx/
  verify.yml/root package.json/redirects 5 本/start script/gitignore/stale コメント）→
  N6b 削除（**Fable 実施** — git rm -r trpg-remix-app・workspace yaml・pnpm install lockfile 追随・
  trpg-remix-frontend skill 削除・next-env.d.ts rm --cached）→ N6c doc 全面更新（Fable）。
  主要裁定: コンテナ内 3000 統一（dev host 3100:3000・start script は既定 3000 へ）／
  nginx は service 名参照へ（**pre-existing prod 欠陥開示**: default.conf が dev の
  container_name TRPG-CLIENT:5173 を参照し prod では解決不能だった）＋ / に ws upgrade（HMR）／
  redirects 5 本 307（旧 302 → 307 統一裁定・開示）／next-env.d.ts gitignore 化＋
  **CI は build→typecheck 順へ**（clean checkout では next build が型宣言を生成してから
  tsc の必要・N5c footgun の恒久対処）／rename しない（churn>益・記録のみ）。
  **ops 注意点**: trpg-next-app/.env 不存在（実測）— compose 切替後は DISCORD_APPLICATIONID 必須
  （env.server.ts throw）。ユーザーが trpg-remix-app/.env の内容を N6b 前に移すこと。
  full stack up 検証は Atlas DNS 隔離で不能 → app イメージ単体 build＋dummy run で代替。
- **N6a 完了（2026-08-06・`651de27` 10 ファイル +123/−23）→ N6b は権限ブロックで停止中**:
  Codex は実装後 pnpm verifyDepsBeforeRun ゲート（package.json 編集で要 install）で統制⑥停止 →
  Fable が `pnpm install`（lockfile 無変更・状態更新のみ）後に受入を独立実行:
  クリーン相当チェーン（next-env.d.ts/.next 削除 → build 12 routes → tsc → lint →
  test 16 suites/173）緑・旧 app build 緑・compose config 両方 exit 0・
  **redirects 5 本を dev 実測（全て 307 → /user/character）**・全 diff 実読（裁定逸脱なし）。
  **docker image build は環境ブロックで未実施**: Docker Desktop エンジン pipe 不在・起動要求後も
  プロセス不成立（service Stopped・GUI/昇格が必要）・WSL も swap vhdx 欠落で不動。
  → ユーザー引継ぎ: Desktop 起動後 `docker compose -f docker-compose.prod.yml build app`＋
  dummy env run で確認（恒久化は #20 CI 追補と合流）。
  **N6b（trpg-remix-app 削除）は auto mode の権限クラシファイアが `git rm -r` を拒否**。
  迂回せず停止（削除の最終判断はユーザーへ）。
- **docker 実測完了（2026-08-06・`32e0640` next-env 追跡解除＋`8ee77e5` Dockerfile 追補）**:
  ユーザーの初回 build はエンジン rpc EOF で落ちた → 根因 2 つを特定・修復:
  ① .wslconfig（memory=2GB・swap=1GB）の swap 置き場 C:\temp が不存在で swap 無効 →
  並列 pnpm install ×2 が OOM（exit 137）。C:\temp 作成＋`wsl --shutdown` で swap 有効化。
  ② base の manifest COPY に tools/static-analysis/package.json が欠け、COPY . . 後に
  verifyDepsBeforeRun が「workspace structure has changed」で build 拒否（**旧 Dockerfile にも
  潜在**・tools/ 追加後 docker 未再ビルドだった）。COPY 1 行追加（`8ee77e5`）。
  検証結果: build/production 両 stage 緑（stage 分割の逐次 build で OOM 回避）・
  dummy env run で GET / 200・**/character 307 /user/character（redirects が prod 実測で動作）**・
  コンテナ内 wget 200（healthcheck 経路）。N6a コミットの「未実施」開示は本追補で解消。
  検収メモ: `git commit --only` は working tree 状態を取るため index 限定削除
  （rm --cached）を表現できない → staged がその 1 件のみを diff --cached で確認し plain commit。
- **N6b 完了（2026-08-07・`e179640` 130 ファイル +260/−19,809）**: .env 移送＋`git rm -r` ×2 は
  ユーザー実行（クラシファイア拒否のため）。Fable が workspace yaml entry 削除・Dockerfile 旧
  manifest COPY 削除・`pnpm install`（lockfile −374 packages/−5,371 行・zustand/immer 消滅 =
  #79 自然解消）を実施。未追跡残渣（trpg-remix-app/ の .env・node_modules・build）はディスク残存
  （git 管理外・ユーザーがフォルダごと削除してよい）。
  検収全緑: next chain（build 12 routes/tsc/lint/test 16 suites/173）・server build＋
  check:circular（循環ゼロ）・**docker build/production 両 stage＋起動 smoke
  （GET / 200・/character 307）を新 lockfile で再実測**。
  docker 検収で新たな罠 2 つを実測・恒久対処: ① review-results/ が docker context に入っており
  証跡書き込みの度に COPY . . キャッシュが飛び重 step が並列再実行 → 2GB WSL VM で next build が
  SIGKILL（OOM）→ **.dockerignore へ review-results 追加**（N6b 同梱）。
  ② `git commit --only` は working tree を取るため rm --cached（index 限定削除）を表現できない →
  staged 内容を diff --cached で確認して plain commit。
- **N6c 完了（2026-08-07・doc 全面更新 = Fable 直接実施）**: README.md（Remix→Next・ポート実態）・
  document/README.md・project-status.md・open-issues-next.md（Remix 項目に消滅注記）・
  frontend-trpg-remix-app.md（歴史資料ヘッダ）・NEXT_MIGRATION_PLAN.md（完了バナー）・
  TRPG-SERVER/AI.md（封筒正本ポインタ → trpg-next-app/AI.md・関連リンク）・
  スキル 9 本（trpg-architecture ×2 は front 節を App Router/Mantine 9/サーバ境界規約へ書換・
  trpg-refactor ×2・code-comment-rules ×2・static-structure-audit（例と俯瞰#12 注記の Next 読替）・
  large-file-refactor-review-loop・tools/static-analysis README）。
  AI.refactor.md 等の経緯記録・TRPG-SERVER/docs/reviews・CLAUDE_HANDOFF は歴史として不変更
  （残存 grep で意図的残置のみを確認済み）。
  **次: #120 最終大粒度レビュー（二重・Opus read-only + Codex adversarial）→ campaign close**。
- **#120 完了（2026-08-07・campaign close）**: 二重レビュー完走（Opus 260k tokens / Codex
  gpt-5.6-sol xhigh）。統合判定の正本 = `review-results/next-migration/final-review-verdict.md`。
  要旨: 事実矛盾なし・相互補完（Opus のみ検出: H1 Dockerfile 破損ほか／Codex のみ検出:
  tables 編集のデータ喪失 C-H2・OAuth state 欠如ほか）。**両者一致の「stub 3 枚無ガード」は
  過大主張**（user/layout.tsx:9 の requireJwt＋/users hard gate を両者とも見落とし — Fable 実測で
  訂正。一致≠裏取りの実例としてメモリ反映済み）。
  即消化: H1（`2aa1294`）／C-H2＋M-5＋L-2＋M-3 doc-in-code = **Codex FR1 スライス**
  （createEditorSignature 純関数化＋spec 4 本・table-only 編集が dirty/autosave/復旧 cache に
  乗る・再整形ループ防止の正規化つき。Fable 独立検収: 範囲 6 ファイル一致・diff 実読・
  build/tsc/lint/jest 16 suites 177 tests 全緑を再実行）／prod compose nestjs 直結＋
  DISCORD_APPLICATIONID 必須化（fail-fast を config で実証・dummy 値で構文 PROD_OK）／
  verify.yml に docker-build ジョブ（両 image production build — GH runner 初回実行は次 push 時）／
  dev compose に api-contract volume（L10）／AI.md 一括訂正 8 項（redirect 3 系統・UI 受入無しの
  明示・bare 3 controller・action 返却形全量表・二段ゲート・state 未実装開示・spec fixture 許容・
  移行期 policy 終了）／計画書 N6 受入行の実態訂正（M8）。
  残余は #121〜#130 へ起票（復号一本化・client テスト基盤・OAuth state・prod nestjs env・
  auth 3 信号・editor 残債・bare 負のアサーション・248KB payload・dice validator・Low batch）。
  L11 credential 疑義は別セッション chip（task_dedfbb73）のまま。
  **Next 移行 campaign（N0〜N6＋最終レビュー）はこれで close。**
- （旧記録・経緯）#120 中間時点の Opus verdict = close NOT YET
  （High 4・Med 8・Low 11）。blocking: **H1 = TRPG-SERVER/Dockerfile:17 が削除済み
  trpg-remix-app/package.json を COPY → server イメージ build 不能（N6b 起因・Fable 裏取り済み・
  trpg-next-app＋tools manifest へ修正適用済み・base stage 緑・dev stage full build 検証中）**／
  H2 = AI.md の UI 受入根拠（旧 app 目視突合）が旧 app 削除で消滅・client 13 コンポーネント spec 0／
  H4 = AI.md「307 統一」の過大主張（Server Action 経由 redirect は Next 仕様で 303・実測 8 サイト
  未計測）＝ claim-scoping 8 例目／M8 = 計画書の N6 受入「compose build＋healthcheck・CI」が CI に
  未実装。主要 Med: M1 封筒バレ側の負のアサーション欠如／M3 Server Action 形の未記載例外 2／
  M4 requireJwt 例外 4 実 1 記載・stub 3 枚無ガード／M6 prod compose の SERVER_DOMAIN が
  service 名不整合（pre-existing）＋ M7 DISCORD_APPLICATIONID 未配線（prod smoke は env 経路を
  構造的に踏まない 2 アサーションだった開示含む）。
  **L11 = TRPG-SERVER/rest.http（tracked）に非プレースホルダの credential らしき 1 行
  （205 文字・値未読）→ 別セッション chip 発行済み（task_dedfbb73・ローテーション案内含む）**。
  統合判定は Codex 側到着後（相互矛盾突合 → 消化スライス設計）。

## 2026-08-07 開始: FR 消化 campaign（#121〜#130・優先順・必要性再裁定つき）

ユーザー指示: 「順番に行っちゃって。ただ本当に必要なのかは再判断して。低に関しては特に
オーバーの可能性が高い」— 高→中→低の順で消化し、各項目に YAGNI 再裁定ゲートを掛ける。
低優先 3 件は縮小 or 見送りの方向（最終裁定は完了報告で全件開示）。

- **前段（campaign 外）**: CI 初回実行で lint-server の既知赤を確認 → 残存 error 2 件
  （jest/no-conditional-expect）を FR2 スライスで消化し `f161c0a` を push 済み。
  lint-server は required 昇格可能になった（GitHub 設定はユーザー操作）
- **#123 完了（S1・`c08ba56`）**: OAuth CSRF state 導入。/auth/start（新設 Route Handler）が
  state 発行＋oauth_state cookie（httpOnly・lax・600s）→ /login hop が転送 → callback が
  照合前に無条件削除（single-use）・三者一致時のみ code 交換。redirect_uri と jwt cookie 契約は
  不変。検収: build/tsc/lint/jest 17 suites 182 tests 全緑を Fable 再実行。AI.md の state 記述を
  実装済みへ更新（未コミット・campaign 末尾で docs commit 予定）
- **#124 配線部分 完了（未コミット）**: prod compose nestjs へ必須 6 env
  （environment.schema.ts の REQUIRED_VARIABLES 実測: TOKEN/DISCORD_APPLICATIONID/
  DISCORD_SECRET/JWT_SECRET/MONGODB_URI/DISCORD_TOKEN_ENCRYPTION_KEY）を
  `${VAR:?required}` で fail-fast 配線。dummy 値で `config` PROD_OK。full-stack smoke は
  DNS 隔離のため本機では実測不能（ユーザー環境でのみ可）と裁定
- **#121 実行中（S2・Codex）**: 復号 4 変種の一本化。設計: dice-preview の getUpstreamResponse を
  正準 reader として lib へ昇格・extractApiErrorMessages を lib へ移設・sites 5-7 を正本経由へ・
  eslint に feature↔feature 禁止 zone。守り: dice-preview/route.spec.ts は編集禁止のまま全緑が
  受入条件。意図的文言変更 2 件（discord 固定 JP→復号 join・auth statusText 簡約）を許容
- **#121 完了（S2・`c71e230`）**: 復号 4 変種→lib 正本 1 本
  （getUpstreamResponse を正準 reader に昇格・extractApiErrorMessages 移設・
  character 生文字列漏れ / discord 握り潰しを正本経由へ・auth statusText 簡約）。
  **設計ラウンド 1 回**: Codex が統制⑥で正しく停止 — feature↔feature 全面禁止 zone は
  実在 3 辺（character→characterTemplate 型共有・characterTemplate→character 作成フロー・
  character→discord 投稿）で成立せず＝**レビュー両者の zone 処方が過大**だった。
  Fable 裁定で「宣言済み有向辺のみ許可」方式へ変更（許可辺の正本 = AI.md・except 無断追加禁止）。
  getResponseStatus は data 不問の寛容 reader として維持（既存 spec が pin）。
  守り: dice-preview/route.spec.ts 差分ゼロで全緑。検収: build/tsc/lint/jest 17 suites
  185 tests 全緑を Fable 再実行
- **低群 正式裁定**: #128 見送り（bundle 一回コストに codegen 維持費は過剰）・
  #129 見送り→#74 着手時に同時裁定（タスク description へ記録済み）・
  #130 は縮小実施（読者を誤導する嘘コメント・壊れた dev ツール残骸のみ。
  C-L1 export 縮小/C-L3 dead click/postCharacterToDiscord 正規化/requireJwt lint/
  clean-checkout typecheck は YAGNI で落とす）
- **#122 完了（S3・`6522b09`）**: jsdom client テスト基盤。testEnvironment node 維持＋
  ts-jest `jsx: 'react-jsx'` override＋setupFilesAfterEnv（window ガード付き matchMedia/
  ResizeObserver polyfill）＋TemplateEditorV3.spec.tsx（docblock jsdom・4 ケース: tables 編集→
  autosave payload／保存後再発火なし／recovery cache 書込／reject 表示＋編集保持）。
  devDeps 3 本は minimumReleaseAge 通過。検収: 範囲 5 ファイル一致・diff 実読・
  build/tsc/lint/jest 18 suites 189 tests 全緑を Fable 再実行。
  **検収での発見**: 現行 submitDraft catch は `error instanceof Error ? error.message : 固定文言`
  （transport 失敗で raw message 露出）— S5 の B-2 指示書へ正確な現状として反映済み。
  spec の reject ケース（error.message 期待）と mock の ok/intent は S5 で追随更新が必要
  （指示書に明記済み）
- S5/S6 指示書 準備済み: `prompt-code-fr125-126.txt`＋`run-fr125.sh`（#125 auth 単一正本化＋
  #126 縮小 M2/M5/L2-cache 削除・9 ファイル錠）／`prompt-code-fr127-130.txt`＋`run-fr127.sh`
  （#127 bare 3 controller 負のアサーション＋#130 縮小コメント 5 箇所真実化 — 現物確認済み:
  bundle 理由虚偽・test:watch 不存在・trpg-remix-app パス 4 箇所）
- **#130 縮小の Fable 分 完了（`d8ee04d`）**: start-dev.bat → trpg-next-app／
  kill-port-3000 → 3100 改名（ホスト待受実態）／docker-aliases.ps1 の死 volume rm 削除・
  dcvc→dcnc（.next）・Remix 表記一掃／ローカル pre-commit hook の inert trpg-remix-app 撤去
  （版管理外）。README・skill 言及（dcr/dcup/dcl/dch）は現状と整合済みを確認
- **大粒度認知負荷レビュー #2 完了（3 スライスゲート・判定正本 =
  review-results/next-migration/cognitive-load-review-2-fr-verdict.md）**: High 1・Med 5・Low 3。
  最重要 = CL-1（非 409 サーバ失敗の `{template なし}` 応答で TemplateEditorV3 が saving 固着・
  autosave 恒久停止。S5-B1 の ok 削除前に :125 の遷移修正が必須 — Fable 実読で確定、
  ただし「脱出はリロードのみ」は過大で手動保存で復帰可）。裁定: CL-1/CL-2a(LoginBtn _blank)/
  CL-8(debounce 定数) → S5 指示書へ吸収済み・CL-3(22 行 ladder 削除)/CL-2b(callback warn ラベル)
  → S6 指示書へ吸収済み・CL-4(AI.md テスト節)/CL-6(claim 縮小＋eslint コメント) → Fable 実施済み・
  CL-5(cookie 名移設) 見送り（churn>gain）・CL-7 起票（#131）・CL-9 → #76 合流。
  S5/S6 計画自体への異議なし
- **S5 実行中（Codex・prompt-code-fr125-126.txt 改訂版）**: #125 AuthState 単一正本化＋
  #126 縮小（B-1 ok/intent 削除・B-2 catch 分割・B-2b saving 固着修正・B-2c debounce 定数・
  B-3 localStorage cache 削除）＋LoginBtn _blank 除去。10 ファイル錠。
  起動時の教訓: Bash tool 直接起動は既知 EOF 破損（exit 2）→ PowerShell 経由
  `& bash.exe <wrapper>` が正
- **S5 完了（#125＋#126 縮小＋レビュー消化・`7c6ba98` 10 ファイル +69/−86）**:
  AuthState {user} 単一化・/user layout probe→getAuthState 統合（dedupe で /users 2→1）・
  ok/intent 削除＋EditorIntent 独立・catch 分割（transport は固定文言・raw message 非表示）・
  **CL-1 saving 固着修正**（dirty 遷移＋pendingSignature 破棄＋再編集で autosave 再開の
  回帰テスト）・LoginBtn _blank 除去・AUTOSAVE_DEBOUNCE_MS 定数化・localStorage cache 削除。
  検収: 範囲 10 ファイル錠と完全一致・diff 全実読（負の対照差し替えなし）・
  build/tsc/lint/test 18 suites 189 tests 全緑を Fable 独立再実行
- **S6 round 1 完了→fix round 実行中**: 実装 8 ファイルは完了（A 負のアサーション it 1 件・
  B コメント 5 箇所・C-1/C-2）だが、Codex は server 受入が既知の間欠 V8 crash
  （exit 3221225477・ensure:workspace-dist の並列 tsc）で落ちて統制⑥停止 → Fable が受入を
  分割自走（server focused 6 tests 緑・engine 136 緑・lint-server 0 err）した際に
  **front tsc で実 blocking を検出**: C-2 が複合 guard を rejectionReason 変数経由に分解した
  ため narrowing が壊れ `loginOrRegisterUser(code)` が TS2345（⑥停止で front 受入未到達の
  未検出汚染）。fix round（prompt-code-fr127-fix.txt・callback/route.ts 1 ファイル錠・
  guard 復元＋ラベル計算を分岐内へ）を起動済み。教訓はメモリ
  delegation-prompt-must-name-invariants に追記済み（形の処方が narrowing を壊す／
  ⑥停止ラウンドは停止点以後の受入を Fable が必ず自走）
- **S6 完了（#127＋#130 縮小＋auth 残債・`a0acb4d` 8 ファイル +33/−39・fix round 1 回）**:
  bare 3 controller の負のアサーション（封筒不変条件の両面機械固定）・嘘コメント 5 箇所真実化・
  getLoginErrorMessage 削除（status ログ可視性維持）・callback 失敗 4 経路 warn ラベル。
  検収: 範囲一致・diff 全実読・受入 7 コマンド（server lint/focused 6 tests・engine 136・
  front build/tsc/lint/test 18 suites 189 tests）を Fable 分割自走で全緑。
  **環境知見**: 間欠 V8 crash（exit 3221225477）は NODE_OPTIONS=--max-old-space-size=4096 で
  安定回避できた（eslint 3 連続 crash → heap 拡大で即緑。heap 圧起因と判明）

## FR 消化 campaign 完了（2026-08-07）

#121〜#130 全消化。最終裁定: 実施 7（#121/#122/#123/#124/#125/#126縮小/#127/#130縮小）・
見送り 2（#128 YAGNI・CL-5 cookie 名移設）・繰延 2（#129→#74・CL-9→#76・CL-7→#131 起票）。
レビュー#2（3 スライスゲート）の High 1 件（saving 固着）は S5 で即消化。
campaign コミット: `c08ba56`(#123) `8a1b960`(#124) `c71e230`(#121) `f161c0a`(lint 前段・push 済み)
`6522b09`(#122) `d8ee04d`(#130 tooling) `7c6ba98`(#125/#126) `a0acb4d`(#127/#130 comments) ＋
docs commit。**push はユーザー指示待ち**（f161c0a まで push 済み・以降 7+1 コミット未 push）。
ユーザー側残タスク: lint-server の required 昇格・prod compose full-stack smoke
（--env-file TRPG-SERVER/.env・本機は DNS 隔離で不能）・trpg-remix-app/ 残渣削除（任意）・
rest.http credential 対応（chip task_dedfbb73）

## 2026-08-11 開始: キャラシート v1 実装ループ（キュー #9〜#12・進行中）

U14/U15/SM/U16 の設計確定（`7a79246d`・adversarial 監査全収束）を受けた実装フェーズ。
**入口 = design-v1-ui.md §3.6 実装境界表・台帳 = design-ledger.md（2026-08-11 監査・補修済み:
節0 基準 `1b23430a`・§2-2 に B-13〜B-16 追加・SM-16 は #11 所掌・§2-5 にキュー別検収コマンド）**。
運転 = fable-rules（粒度は小さく: 1 スライス = 1 層 × 1 機能・ユーザー指示 2026-08-11）。

- **9-S1 完了・検収済み（未コミット）**: sheet-engine の U14 layout 型＋publish 検証＋
  **publish warnings チャネル新設**（PublishWarning/required warnings・ok 不変。実装前は機構自体が
  存在せず Codex が正しく停止→裁定で新設許可）。test:engine 152 緑・レビュー pass
  （low 1 = `SheetSectionLayout | unknown` false affordance → 9-S2 先頭タスクへ繰越）。
  副産物: H-9 の旧記述「enum 外なら publish エラー」と §5 U14 決着の矛盾を検出し design-v1-ui を修正。
  証跡 = `review-results/impl-u14/`（prompt/run/acceptance-s1.md）
- **9-S2 完了・検収済み（未コミット）**: `normalizeTemplateLayout()`（正当 grid のみ・複雑 4 型非付与・
  legacy/不正素通し）＋**package ルート共有 JSON fixture**（fixtures/layout-normalization.json・5 ケース）。
  test:engine 157 緑。レビュー needs-fix（fixture 固定力・共有境界）→ round2 で解消。
  発見: 式 normalizer の実体は front の `normalizeTemplateReferences()`（v3Template.ts:126・server 呼び出しゼロ）
  → layout normalizer は呼び出し元ゼロのため **9-S3 = front 適用スライス**（buildPayload / V2 import /
  migration の persist 系 3 サイトに適用・preview は renderer 既定に委ねる）。
  大粒度レビュー繰越議題: preset 語彙の 2 複製の正本化。証跡 = acceptance-s2.md
- **9-S3 完了・検収済み（未コミット）**: persist 系 3 サイトに reference→layout の順で適用＋
  **H-15 解釈一致テスト**（front spec が共有 JSON fixture 5 ケースを engine expected と突合）。
  preview は非適用（保存時正規化の原則）。check:contract-stack exit 0（front 195 tests）。
  証跡 = acceptance-s3.md
- **大粒度認知負荷レビュー #1 完了**（run-bigreview-1b・初回 rc=66 = sandbox helper 故障で
  --no-sandbox 再実行）: medium 1 = preset 語彙 3 宣言の正本化（S2 の条件「consumer 増加時」が成立）
  → **統合スライス 9-S3b 実施中**（types.ts の readonly tuple へ 3→1・spec/fixture は独立オラクル維持）。
  low 1 = **columns/span 許容値・既定値の正本化は renderer スライス冒頭で実施**（繰越タスク・忘れ禁止）。
  放置裁定（実測つき）= 合成順 3 箇所（helper 化はホップ増）・isRecord 2 定義・U14 判定二重（意図的契約差）
- **9-S3b 完了・検収済み（未コミット）**: preset 語彙を types.ts の readonly tuple 1 本へ（3→1・+7/-3・
  挙動不変 = 157 tests 期待値変更ゼロ・contract-stack exit 0）。
  文書矛盾の 3 箇所目（§2 v1.1 :139「Zod で拒否」）も検出・修正。証跡 = acceptance-s3b.md
- **9-S4 完了・検収済み（未コミット）**: ①columns/span/既定値の正本化（宣言 7→4・照合ホップ 0）
  ②TemplateFormRenderer 骨格（103 行・stack のみ・複雑 4 型 placeholder・評価器非接続）＋
  B-11 zone 追加（負例拒否実証）。レビュー pass。証跡 = acceptance-s4.md
- **9-S5 完了・検収済み（未コミット）**: DOM 契約 4 属性で退化を機械固定＋grid 実描画
  （engine 正本 5 export 消費・リテラル再宣言ゼロ・判定順 = 語彙検証→既定値→clamp）。
  spec 6→16 tests。レビュー **pass・findings 0**。証跡 = acceptance-s5.md
- **9-S6 完了・検収済み（未コミット）**: table 実描画（semantic table・th=ラベル正本・複雑 4 型 colSpan=2・
  H-16 は #10 送り・spec 16→22）。小粒度レビュー medium 1（aria-labelledby に空白入り uid で
  accessible name が壊れる — publish 通過と Testing Library 破壊を実証）→ round2 で
  `TableFieldRow` 分離＋`useId()` 化＋regression spec。独立検収 = focused 23/23（既存 22 期待値不変）・
  contract-stack 218 緑・差分は characterSheet/ のみ。証跡 = acceptance-s6.md
- **大粒度レビュー #2 完了**（run-bigreview-2）: 三者判定差 = 意図的契約差で統合不要（小粒度と一致・
  判定表 6 行の突合つき）・述語/DOM 語彙/spec helper は健全。medium 1 = **TemplatePreviewV3 統合の
  裁定材料が確定 → 台帳 §5-2 に D-R1 として登録（ユーザー決定待ち）**。
  レビュー推奨 = 案(a) 統合（挙動差 7 点の characterization 前提・時期 = S8 前の専用スライス）。
  **D-R1 が決まるまで 9-S8（エディタ UI）に着手しない。9-S7 は独立・先行可**
- **9-S7 完了・検収済み（未コミット）**: モバイル固定折り畳み（:137-138）を CSS Modules で実装
  （インライン style 廃止・spec は機構断言へ置換・DOM 契約期待値不変）。round1 は委譲先の自己検収
  全緑のまま **Fable の実ブラウザ実測で CONFIRMED バグ**（media query 内 grid 折り畳みが詳細度
  0,2,0 < 0,3,0 で不発・jest/jsdom/build は盲目 → メモリ css-responsive-blind-to-all-green-gates）。
  round2 で同詳細度化＋不変条件コメント。検収 = 実ブラウザ両方向（375px 全 grid 2 列・span2 全幅／
  1280px 3/4 列不変）＋23/23＋contract-stack 218 緑。小粒度レビュー pass（レビュアー独自 Playwright
  実測も一致・low 1 = カスケード順コメント未記載 → 次スライス task 0）。証跡 = acceptance-s7.md
- **9-S9a 完了・検収済み（未コミット）**: 9-S9（検証タブ警告）3 分割の第 1 段 = レイアウト解決
  （resolveSectionLayout/resolveGridSpan/isSimpleField）を engine layout-resolver.ts へ純移動・
  renderer 46 行純減・task 0 = S7 low の CSS コメント消化。理由 = :141 の意味警告 3 種は
  「レンダラの解決結果」への警告で、publish 再実装は解決セマンティクス 2 複製 drift になるため。
  レビュー medium 1（stack preset が両 spec 未固定）→ round2 で spec 3 ケース追加。
  検収 = engine 172/172・renderer 23/23 期待値不変（純移動の証明）・contract-stack 218。
  純移動は正規化比較 6/6 一致・isRecord 3 定義は意図的分離裁定。
  **Mode B 条件付き Go: S9b 検収で publish の resolver 実 import を必ず確認**（未消費なら抽出根拠が
  崩れる）。normalizer との統合は out-of-scope（素通し哲学は意図的契約差）。証跡 = acceptance-s9a.md
- **9-S9b 完了・検収済み（未コミット）**: publish が resolver を実 import（9-S9a Mode B 条件充足）し
  `validateResolvedLayoutWarnings` 独立 pass で意味警告 3 コード発行（outside-grid／span-clamped／
  table-complex-demoted。セクション直下のみ・二重発行禁止・凍結 2 関数不変・ok/issues 不変）。
  レビュー medium 1（複合境界・警告順序の spec 固定不足・実装挙動自体は 5 意地悪入力すべて設計どおり）
  → round2 で複合 5 ケースを完全配列一致で固定＋既存 assert 強化。検収 = engine 192/192・
  contract-stack 218・差分 engine 3 ファイルのみ。grid 内複雑型 span の沈黙は :141 帰結として
  spec 固定済み。証跡 = acceptance-s9b.md
- **大粒度認知負荷レビュー #3 完了**（run-bigreview-3・needs-fix）: medium 1 = columns=5 変更タスクで
  無防護の手動同期点 3 箇所（CSS セレクタ 2 ブロック＋publish 範囲文言。renderer spec は CSS Modules
  全面 mock のため CSS 退化を検出不能）。low = GRID_FIELD_TYPES⇔isSimpleField の分類 2 表現／
  S9c 実装制約（front に code→message switch を作らない）／台帳への oracle 責務差追記。
  三者契約の維持・並行実装ゼロ・isRecord 分離妥当は確認。
  **裁定**: medium＋low#2 → 統合スライス 9-S10・low#3 → S9c の実装制約・low#4＋isRecord 理由 →
  台帳 §2-3 へ追記済み（isRecord 意図的局在・4 oracle 独立の 2 行）
- **9-S10 完了・検収済み（未コミット）**（大粒度 #3 統合スライス）: ①publish 範囲文言を tuple 導出
  ②CSS 同期 Invariant コメント ③CSS セレクタ集合⇔tuple の drift spec ④GRID_FIELD_TYPES 削除
  （分類 owner 2→1）。レビュー medium 1＋low 3（split の 2 個目 @media 破棄・DEFAULT 結合・
  昇順暗黙前提・type 3 回読み — 全 CONFIRMED）→ round2 +7/-4 で全消化（toHaveLength(2) loud failure・
  設計規則導出・Math.min/max・1 回読み）。検収 = engine 192/192 期待値不変・contract-stack 219・
  renderer 24/24。columns=5 タスクの無防護同期点 3→0（残る手動 2 箇所は drift spec が赤くして誘導）。
  証跡 = acceptance-s10.md
- **9-S9c 完了・検収済み（未コミット）**: TemplateEditorV3 の検証フローに警告表示（独立 state＋
  黄 Alert・配列順 `[path] message`・catch クリア・publish 非ブロック）。制約遵守 = warning
  code/message literal は editor/spec とも 0 件（spec は engine 実行で期待値生成）。レビュー
  **pass・findings 0**（normalize 前後の警告一致・同一 message の path 区別を実測検証）。
  検収 = focused 11/11・contract-stack 221/221。証跡 = acceptance-s9c.md
- **【大粒度 #4 high で訂正】#9 の残りは「S8 のみ」ではない**: TemplateFormRenderer は
  production consumer 0 件の未接続の島（spec のみ）。実 runtime 経路 = TemplatePreviewV3（preview 面
  = D-R1 所掌）と CharacterSheetEditClient（作成・編集面 = **D-R2 新設**・character→characterSheet の
  AI.md 辺＋eslint except が必要でユーザー裁定待ち）。**両面の配線と regression 通過まで U14 を
  完了扱いにしない**（台帳 §5-2 D-R2）
- **キュー #10 U15 開始・10-S1 実装完了・レビュー中**: U15 schema 語彙（blocks/pools/blockId/
  max/partsKeys・parts?: boolean 不変更）＋zod 形状検証（**U15 構造系はエラー = U14 layout 警告とは
  方針が異なる**・§3.6 Publish 行）＋語彙級 3 規則（parts×partsKeys 同時拒否・base/other 予約・
  partsKeys id 重複）。副産物の一元化 = scalarFieldSchema 抽出（relation attrs のインライン複製解消）・
  numberOrFormulaSchema（track.max と共通）・RESERVED_PARTS_KEY_IDS⊂RESERVED_IDS。
  レビュー high 1（重複 partsKey id の診断増幅 — 1 MiB id で message 1 MB・実測）＋medium 1
  （SURVIVED 変異 4 種）→ round2 で truncateIssueInput 適用＋spec 6 件。台帳 §2-4 へ
  「新設 message も truncateIssueInput 必須」転記文を追加（根本原因 = 転記漏れ）。
  検収 = engine 216/216・contract-stack 221。**10-S1 完了・検収済み**。証跡 =
  review-results/impl-u15/acceptance-s1.md
- **大粒度 #4 完了**（run-bigreview-4・needs-fix）: high = 上記の未接続 renderer 追跡誤り
  （→ D-R2 登録・handoff 訂正）。medium = publish.ts 増築停止の兆候（1069 行・validateField
  引数 10/制御点 14）→ **S2 の構造制約**: task 0 で table 検証を兄弟関数へ分割・S2/S3 の追加は
  section loop から呼ぶ**平坦な兄弟関数**にし validateField/validatePublishTemplate を太らせない・
  context 型や新レイヤー禁止。健全側 = 警告パイプライン owner 3/hop 9・front literal 0 維持・
  H-17 文書矛盾なし・base/other 共有は意図的一本化と裁定・§3.6 他 4 行は実装照合済み
- **10-S2 完了・検収済み（未コミット）**: 参照整合 5 規則＋H-6＋SM-3（section-empty/block-empty）。
  レビュー high 1（nested blockId 不在参照の素通り = H-10 違反）→ round2 で
  validateFieldBlockReferences 再帰＋境界 9 ケース完全配列固定。確定意味論 = `scope: []` は空集合・
  blockId は nested でも参照解決必須だが block-empty 所属判定は直下のみ・blocks 未宣言＋scope 省略 ok。
  構造制約遵守を実測確認（validatePublishTemplate 44→39 行・validateField 不変・H-6 二重走査は
  現分離が正と裁定）。検収 = engine 239/239・contract-stack 221。証跡 = acceptance-s2.md
- **10-S3 完了・検収済み（未コミット）**: max/cap/total の式検証（track.max と同一経路・H-13・
  H-6 正当位置のみ・detectCycles 新ノードなし）。レビュー high 1 = validateFormula 共有発行点の
  raw 反響（1 MiB で issue 1,048,606 文字 ×2・**既存増幅を S3 新入口が顕在化**）→ round2 で
  両発行点一括 truncate（既存経路も同時封止）＋1 MiB 回帰 3 件。検収 = engine 258/258・
  contract-stack 221。証跡 = acceptance-s3.md。
  **S5+（制約評価 API）への宿題（レビュー裁定）**: max 式の自己参照は publish 通過（track.max と
  整合）— **current-value 意味論を評価 API の受入ケースへ含める**。別セクション参照・
  sum(list subfield) の cap も通過 = 評価側の仕様確認対象
- **10-S4 は停止条件で正しく中断 → D-R3 新設＋10-S4a へ分割**: 委譲先が実測つきで検出 —
  evaluator は list 行を無制限取込（AST 1 でも 10,001 行で step 超過）のため、行数の裁定なしに
  H-18 不変条件「publish 通過物は必ず完走」の健全な上界は構成不能。**D-R3 として台帳 §5-2 に登録**
  （(a) list 行数上限新設／(b) 不変条件を静的部分へスコープ縮小＋H-18 文言修正／(c) 行 computed
  一律拒否=実質不可。ブロック対象 = H-18 完全達成宣言と 10-S4 クローズ）。
- **10-S4a 完了・検収済み（未コミット）**: 静的集約上界（list 除外・D-R3 注記）・
  既定値 2 種の evaluator 単一宣言化（**台帳 B-2 解消**）・publish options の上方迂回封止
  （astNodeLimit/evaluationStepLimit とも既定値 cap・NaN/Infinity ガード — 小粒度 high＋
  大粒度 #5 high を round2/round3 で消化）・回帰一式＋bench:h18。
  上界の健全性は反証に耐えた（CoC 級含め measured>estimated なし）。
  検収 = engine 272/272・contract-stack 221・bench 再現。証跡 = acceptance-s4a.md。
  **残件 10-S4b = D-R3 裁定後の行反復項追加**
- **10-S5a 完了・検収済み（未コミット）**: 制約評価 API コア（H-7 :270-283）—
  `evaluateConstraint` = `{status: ok|indeterminate|error, value?}`・2 段階決定的判定
  （欠落検査先行 = indeterminate＞error）・閉包は template から静的構築（computed 推移＋
  lookup 引数・未選択 if 分岐含む）・自己参照 max = current-value（S3 宿題の裁定を受入ケース化）。
  小粒度レビュー high 2（実測 CONFIRMED）を round2 で消化: ①存在判定を **own-property かつ
  非 nullish** 化（nullish entry の ok/value=0 を封止。null list container = 0 行・null row =
  indeterminate。キー family 非対称の疑義自体は反証）②number リテラル source に
  Number.isFinite（NaN/±Infinity → error）。JSDoc に value の永続/投影/書戻し禁止契約。
  共有 fixture constraint-evaluation.json（4 系＋nullish＋非有限 source・将来 H-12 参照）・
  constraint-evaluator.spec.ts（alias×nullish×list-row 全組合せ・distinct uid/path/id template）。
  検収 = engine **334/334**（既存 291 期待値変更なし）・contract-stack 221。証跡 = acceptance-s5a.md。
  **持ち越しノート（low）**: AST 子走査の形が 5 箇所（visitAst/publish 3 走査/countAstNodes）—
  次の AST 語彙拡張時に子ノード列挙の単一 owner 化を再評価。
  **→ Opus 二重レビュー（opus-review-s5a.md・needs-fix）→ round3 消化済み・再受入完了**:
  high = track 欠落検査漏れ（未入力 track が ok/0 → 誤超過警告 G1）→ isRawNumberInputField =
  track＋number scalar へ拡張（roll/boolean は意図的除外を JSDoc 固定）。medium = count 過剰依存
  → tracksRawValue フラグで値非依存化／nullish source TypeError → isFormulaConstraintSource
  ガードで error 縮退（parse/解決失敗も error に統一・成文化）／fixture 1e400 round-trip 劣化 →
  sourceRaw マーカー化＋同値回帰（14→20 件）。内部メモ局所化（公開 closure 3 フィールド）・
  ConstraintSource を types.ts へ移設（4 箇所型参照化）・ok/value へ表示専用 TSDoc・固定力回帰
  （相互 computed・row computed・roll/boolean 縮退）。
  round3 検収 = engine **360/360**（343＋17・既存期待値変更なし）・contract-stack 221・
  差分 4 ファイルのみ。**構造統合（AST 一本化・isRecord 5 本・alias 読取共有）と :279 閉包構築
  タイミングの仕様文言整合 = 大粒度 #6 議題**。
  Codex レビューとの矛盾なし（track/count は Codex 未走査領域 = 二重化が機能した初実例）
- **10-S5b round2 消化済み・受入完了**: limit 経路の throw を境界捕捉（displayValue/over のみ
  省略・module 全滅封止）・累積和の非有限化寄与 skip・scope:[] warnings 完全配列固定・
  resolveNumberValue の barrel 非公開化（index.ts を evaluator 明示 5 symbol export へ）。
  検収 = engine **365/365**・contract-stack 221。証跡 = acceptance-s5b.md
- **Opus 横断再レビュー完了（2026-08-11・ユーザー依頼）**: 5 面レビュー＋所見別反証の 2 段
  （22 エージェント）。**確定 5 / 反証 12 / 未検証 3（Fable 裁定済み）**。
  正本 = review-results/impl-loop-opus-full/integration.md（＋digest.json）。確定 → 修正スライス:
  **FIX-A**（partsKeys/blocks/pools の id 規約・label 接続・H-16 異 label エラー・H-6 非 scalar
  素通り＋task 0 = 大粒度 #5 の layout 検証統合 8→7）→ **FIX-B**（診断 path の単一 choke point
  封止 = 台帳 #33 前倒し）→ **FIX-C**（list コンテナ直接参照の publish 拒否 = H-18 実反例）→
  **FIX-D**（columns 検査の grid 限定・降格警告の可視化）。**FIX-E**（front drift spec 強化 =
  M1 詳細度/M2 値変異の検知）は並行。主要反証 = H-15 span 噴出（到達経路ゼロ・9-S8 前に裁定要）・
  block-empty 非対称（H-6 設計どおり）・publish O(F²)（ループ以前から・台帳へ性能候補記録）。
  AI.character.md:506 の俯瞰#10 旧裁定（既定値 2 宣言維持）へ失効注記済み。
  **FIX-A 実装完了・Fable 検収緑・小粒度レビュー委譲中**: task 0 = layout 検証統合（兄弟 8→7・
  入口 4 チャンク）＋ partsKeys/blocks/pools id の validateId 接続・label の
  labelSchema/nonBlank 接続・H-16 ブロック内異 label エラー・H-6 非 scalar 素通り封止
  （track.max のみ例外）。engine **396/396**（365＋31）・contract-stack 221・差分 2 ファイルを
  独立再実行で確認。既存 assert 変更 3 件 = reserved メッセージ文言の共通化のみ。
  **FIX-E 実装完了・Fable 検収緑・小粒度レビュー委譲中**: spec のみで詳細度検査
  （[data-*] 属性数比較）＋ mobile collapse 厳密値 pin ＋ M1〜M4 mutation 回帰（no-op 自己検査つき）＋
  table 行 a11y（NumberInput/Checkbox/Select の aria-labelledby）。contract-stack **226/226**
  （221→226）独立確認。**検収疑義注入 = 詳細度カウントが class を無視する簡易実装の穴**
  （class 落とし変異の素通り有無を実測させる）。
  **FIX-A 小粒度レビュー pass → 受入クローズ**（acceptance-fixa.md。low 2 件 =
  H-16 境界の exact 未固定・H-6 hasOwnProperty 境界未固定 → FIX-B task 0 へ持ち越し）。
  **FIX-B 実装完了・Fable 検収緑・小粒度レビュー委譲中**: 唯一の return 直前（:197-200）で
  issues/warnings 全 path を truncateIssueInput（131 文字・Zod 分岐も被覆・49 発行サイトの
  判断を単一出口へ集約）。倍率実測 = 1 MiB section.id で **×16.97 → ×0.0037**・最大 path 131。
  task 0 = H-16 5 境界＋H-6 4 境界の exact 固定。engine **407/407**（396＋11）・
  contract-stack 226 を独立再実行。既存期待値変更 = 閾値超過だった 150 文字 uid path 1 件のみ。
  以降順序: FIX-C → FIX-D → 大粒度 #6（Codex＋Opus 二重。cadence 注記: 2026-08-11 の
  Opus 横断再レビューが面 5 で俯瞰相当を実施済みのため、#6 は FIX 群完了後に
  delta＋構造議題を扱う）。
  **FIX-E round2 消化済み・受入クローズ**（acceptance-fixe.md）: 小粒度レビュー high =
  検収疑義的中（詳細度カウントが class 無視・class 脱落 6 変異素通り・実ブラウザ 500px で
  mobile override 無効化を実測）→ 詳細度を全成分 tuple 辞書式比較へ・class 脱落 M5〜M8 追加
  （修正前 detector 全素通り→修正後全検知の対照実測）・low = 厳密 pin の空白結合 →
  値の空白正規化。contract-stack **231/231** 独立確認。
  **FIX-B round2 消化済み・受入クローズ**（acceptance-fixb.md）: 出口で path（131）＋
  message（backstop 512）の二重封止・発生源 sweep（notation/lookup/dice 系を追加封止）・
  ok=false → resolvedRefs 空の契約化（消費者なし確認済み）・surrogate 安全切詰め。
  倍率 = path 系 ×16.97→×0.0037・message 系 ×15.99→×0.0058。engine **413/413**・
  contract-stack 231 独立確認・既存期待値変更なし。**台帳 #33 はエンジン層ほぼ消化**
  （server 側連結挙動が残スコープ）。
  **FIX-C 受入クローズ**（acceptance-fixc.md）: レビュー pass — 追加反証 12 ケースで
  「ok=true かつ throw」0 件・未 catch 経路 0 件・parentList 誤爆なし・認知負荷申告どおり。
  engine **418/418**・contract-stack 231。H-18 の型レベル反例は publish で停止。
  **FIX-D 受入クローズ — Opus 横断再レビュー確定所見 C1〜C5 全消化完了**
  （acceptance-fixd.md）: レビュー pass — preset×columns 30 組で resolver と
  normalize→resolve 30/30 一致・警告存続/併存を実測・pin 変更 5 件すべて正当・
  認知負荷減（if 4→3・選択点 5→4）。engine 425・contract-stack 233。
  low 1 = front spec のパラメータ化テスト名が 2/4 で実挙動と矛盾 →
  **次の front スライス task 0 へ登録**（名称変更のみ・要限定許可）。
  **大粒度 #6 完了（Codex＋Opus 二重・新体制初回）**: 統合判定 = bigreview6-integration.md
  （Codex = run-bigreview6-codex・Opus = opus-bigreview6.md）。9 議題中 6 一致・**2 衝突は
  実測の強い Opus 側を採用**（#2 alias 読取 = 統合〔'constructor' prototype 漏れの欠陥勾配が
  「意図差」前提を反証〕・#7 publish.spec 分割 = 現状維持〔分割は実行時間を 1ms も減らさず
  真因は #4 重複 — **大粒度 #5 の分割ゲートを上書き**〕）・**1 権限補正**（#6 で Codex の
  「D-R3(b) 正本化」処方はユーザー裁定の先取りとして棄却・材料追記のみ）。
  **Opus high = H-18 第二の破れ**: 注釈経路が計量チャネル外（estimate 9,909・ok=true で実測
  612,909 step・evaluateConstraint 毎回 10,000 新規予算 = 非共有を 5 連続 ok で直接証明）→
  **D-R3 へ決定材料として追記済み**（裁定前コード変更禁止・現本番露出 0）。
  文書系消化済み（Fable 直接）: design-v1-ui :276-280（track 拡張の追記＋:279 を「評価時構築」へ
  正本訂正・実測併記）・台帳 §2-3（isRecord 5 定義・H-6 述語 4 符号化・AST 実数 7＋2）・
  D-R3 行。スライス計画: **BIG6-S1 受入済み**（RESERVED_IDS へ 'constructor'＋理由コメント・
  front v3Template 同期＋集合等価 spec。engine 428/428・contract-stack 235 独立確認・差分 15 行。
  大粒度 #6 所見の消化ラウンドとして扱い小粒度レビュー省略 — S3 のような挙動変更スライスは
  レビュー必須で実施）→ **BIG6-S2 受入済み**（normalizeLimitOption 私有 1 本化 :146-149・
  正規化 5 ケースを 2-field 軽量化・1,024×11 結合回帰へ上方指定を接続維持。
  **engine suite 37.1s→14.1s（Fable 実測）**・428/428・bench:h18 完全再現
  〔9,999 pass/10,010 reject/11,264 reject・estimated=measured〕・差分 2 ファイル 42 行）→
  **BIG6-S4 受入済み**（コメント・命名一括: H-6/H-7 述語意図〔annotation-runtime :244 /
  constraint-evaluator :165〕・estimate 削除不可マーカー＋H-18 JSDoc 意味論〔publish :231/:240・
  Opus high の文書化分〕・warning 所有権相互参照〔annotation-runtime :6 / types :172〕・
  source→origin・ResolvedNumberScalar/numberScalars 改名〔spec 8 箇所追随〕。
  挙動変更なし・差分 47 行・旧名残存 0 を grep 実測。engine 428/428・contract-stack 235/235
  を Fable 独立再実行で確認。大粒度 #6 消化ラウンドとして小粒度レビュー省略）→
  **BIG6-S3 受入済み**（alias 読取の template-index 1 本化 = fieldCandidateKeys/
  readAliasedValue/canonicalFieldPath の 3 helper・evaluator readRaw/readRowFieldValue を
  own＋非 nullish 化〔**挙動変更**・characterization 13 件で新旧対比固定〕・annotation-runtime/
  constraint-evaluator の候補キー生成置換。小粒度レビュー needs-fix〔high 3 / medium 1〕→
  round2 で全消化: ①fieldsByUid 逆引きの重複 UID draft 罠 → canonicalFieldPath〔走査中
  sectionId から構築〕＋回帰 spec ②own 化の constraint/H-6 波及 = **Fable 裁定「許容」・台帳
  §2-3 記録済み**〔旧 ?? 連鎖と H-7 own 判定の内部矛盾解消・publish 境界が実 id 遮断・
  plain object 契約明文化・Proxy 非対応〕③④ spec 固定。engine 441/441・contract-stack
  235/235 を Fable 独立再実行で確認）→ **大粒度 #7 二重レビュー完了・統合裁定済み**
  （Codex needs-fix〔medium 1/low 1〕＋Opus needs-fix〔blocking 3〕。突合 = big7-integration.md・
  証跡 = opus-big7.md / run-big7-codex。**一致採用**: F1 constraint-evaluator の twin readers
  〔readRawValue 非 own＋hasOwnNonNullishEntry・:176 コメント偽・継承 list 容器で evaluator と
  実測分岐〕・F7 負の対照ゼロ。**矛盾は Opus 実測採用**: F2 canonicalFieldPath 採用 2/11
  〔publish.ts:185,186,310,613＋standalone-roll:41 の生リテラルを Fable grep で確定〕。
  **Opus 単独採用**: F3 uid:'constructor' publish 通過〔uidSchema 長さのみ・Fable 実読確認〕・
  F8 superset ガード無し。**却下**: F4 isRecord×5 再提起〔§2-3 確定済み〕・F13 Proxy 注記削除。
  **記録のみ**: F5 layout preset 3 実装・F6 validateField 引数 10・F9/F10/F11 → 台帳 §6 #13 へ
  登録済み。S2 完全達成・YAGNI 合格・characterization 相互重複なしは両者一致）→
  **BIG7-FIXA 受入済み**（F1 = readRawValue／hasOwnNonNullishEntry 削除・3 読取サイト全部
  readAliasedValue 経由〔:179 field / :181 list 容器 / :185 row subField〕・:176 コメント真化。
  F7 = RED→GREEN 証跡つき characterization 3 件〔実装者が指定 fixture の判別力不足を検出し
  レビュー実測の欠落 row 系へ正しく差し替え — 継承 list＋欠落 row が判別ケース〕。
  F8 = default export＋削除不可マーカーで barrel 非公開のまま 9 種 field 行列 spec。
  engine 455/455・contract-stack 235/235 を Fable 独立再実行。nit: constraint-evaluator :169
  マーカー文中「named export 化」が default export の実態と不整合 — 合同レビューで文言修正）→
  **BIG7-FIXB 受入済み**（F2 = canonicalFieldPath 5 箇所置換〔:191 hoist・:317・:620・
  standalone-roll〕・2 セグメント生リテラル残存 0 を Fable grep 確認。F3 = UNSAFE_UID_KEYS
  Set＋refine『uid is reserved:』・拒否 3＋受理 2 spec。F12' マーカー更新。engine 460/460・
  contract-stack 235/235 を Fable 独立再実行）→ **合同小粒度レビュー pass**（Low 2 =
  マーカー文言のみ。変異検証 = own 判定を外すと characterization 3 件全滅・置換 5 箇所は
  49 入力 UTF-8 比較で不一致 0・field/table 両 uid の拒否動作確認・認知負荷 = 所有 9→5 純減）→
  micro round でコメント 2 行消化 → **大粒度 #7 クローズ**（受入記録 = acceptance-big7.md。
  最終状態: engine 460/460・contract-stack 235/235・alias 読取所有 1・canonical path 所有 1・
  H-6/H-7 superset は spec で機械固定・publish 境界 = id RESERVED_IDS＋uid 汚染キー 3 種封止。
  残債は台帳 §6 #13）。**#10 U15 renderer 系に着手**（3 分割: R0 = H-17 ブロック構造 →
  R1 = evaluateAnnotationRuntime 配線〔cap 表示・警告・予算バー・pool〕→ R2 = parts 系
  〔H-11 ポップオーバー・H-16 table 列展開・H-14〕。**D-R2 非抵触を確認済み** — D-R2 の所掌は
  character→characterSheet の consumer 配線・U14 完了宣言で、renderer 内部拡張は対象外。
  各スライスに consumer 接続禁止を明記）。**U15-R0 実装受入済み・小粒度レビュー委譲中**
  （blocks 非空時のみ renderBlockGroups 分岐・既定ブロック先頭無見出し・first-win Map・
  不在 blockId 既定合流・preset ブロック毎再適用。持込条件消化 = it.each rename
  〔canonical layout 表現へ・アサーション不変〕＋警告所有権不変条件を指示書注入。
  front 239/239〔235＋4〕・engine 460/460 を Fable 独立再実行。小粒度レビュー needs-fix
  〔high 1 / medium 2〕→ round2 で全消化: ①空宣言ブロック非表示（SM-3・design-v1-ui :406-407
  実読裏取り・`.filter(group.fields.length > 0)`・3 preset spec）②pre-slice DOM を inline
  snapshot 固定（stack preset・動的 id 混入なし）③block 経路の controlled 契約 spec。
  front 243/243〔239＋4〕・engine 460/460 を Fable 独立再実行 — **U15-R0 受入済み**）→
  **U15-R1a 委譲中**（engine 層: SectionAnnotationRuntime へ `blocks: AnnotationBlockRuntime[]`
  追加 — H-17 の「ブロック見出し・cap 表示」に必要なブロック単位 cap 解決が現 API に無い
  ギャップを Fable が実読確認〔limits は field 単位・全 field が独自 max を持つ/空ブロックでは
  cap がどこにも現れない〕。cap 宣言ブロックのみエントリ・AnnotationPoolRuntime と同形 union・
  first-win 一致・per-field 経路不変・evaluateConstraint +cap ブロック数の計量増を報告義務化
  〔D-R3 隣接〕。**実装受入済み**: 467/467〔460＋7〕・243/243・型は Pool 同形 union・
  first-win 直後評価を Fable 実読。**レビュー pass**〔Go・Low 1 = blockIds/blocks の役割分担
  TSDoc 2 行 — writer lock 解放後の消化ラウンドへキュー。per-field 同値性・既存挙動不変・
  変異 3 種検出を確認済み〕）→ **R1b 実装委譲中**（front 面のみ。
  R1b = useMemo 配線・見出し cap Badge〔ok のみ表示・非 ok 沈黙〕・field-over-limit 文言
  renderer 著述・pool 予算バー〔ok=Progress＋残り・超過 danger・非 ok 沈黙〕・構造 skew 警告
  6 コードは検証タブ所掌で非表示・R0 snapshot 不変ゲート。**実装受入済み**: front 250/250
  〔243＋7〕・engine 467/467・snapshot 未更新で通過 = annotation 無関係 DOM 不変の直接証明。
  **小粒度レビュー = needs-fix〔high 2 / medium 1 / low 1〕**: ①重複 sectionId で
  annotationsBySectionId Map が last-win 越境〔重複 section id は publish 通過 — Fable 経路
  裏取り: 一意性ゲートは canonical path と uid のみ。台帳 §6 #14 へ publish 側裁定を登録〕
  ②重複 fieldUid で over-limit 文言 Map が last-win〔publish は uid 一意強制 = draft 限定・
  draft-safe 契約上有効〕③spec 補強〔displayValue 省略時 undefined 混入・構造 skew 非表示の
  固定〕④useMemo 参照契約は記録のみ〔D-R2 行へ接続時条件を記録済み〕。
  round2 で全消化: ①index 対応 join〔annotationRuntime.sections[sectionIndex]・React key に
  index 併記〕②曖昧 uid 沈黙〔buildOverLimitMessages 内局所化〕③spec 4 件 ④TSDoc 2 行。
  front 254/254〔250＋4〕・engine 467/467 を Fable 独立再実行 — **R1b 受入済み・R1 クローズ**。
  **Fable 検収で残存エッジ 1 件検出**: over-limit ゲーティングが warnings の sectionId 文字列
  一致のまま → 重複 section id＋section 跨ぎ同一 fieldUid の draft 複合病理で非超過 field に
  自己矛盾文言が出うる — 単独裁定せず大粒度 #8 の種問いへ）→
  **大粒度 #8 完了・統合裁定済み**（Codex needs-fix〔medium 2/low 2〕＋Opus needs-fix
  〔blocking 1＋major 3〕= big8-integration.md / opus-big8.md / run-big8-codex。
  **種問いは両者独立に同一実測で確定**〔非超過 field に自己矛盾超過文言・负の対照つき〕。
  対処の相違は **Opus 案 B-3 採用**〔AnnotationLimitRuntime/PoolRuntime の ok 分岐へ engine
  判定済み `over: boolean` — Codex 案の「pool の remaining<0 と対称」は当の pool 側が H-12
  唯一の逸脱と実測された当該物のため根拠にならない。B-3 は F2/F10/F15 同時解消・warnings
  引数消滅〕。**一致採用**: remaining 非有限→error 退化〔-MAX_VALUE 実測〕・grouping を
  engine の blockIds/fieldBlocks へ寄せる〔renderer first-win Map 2 個削除・raw は label のみ〕。
  **Opus 単独採用**: F4 空セクション全体スキップ〔SM-3・pool 浮遊バー含む〕・F5 到達不能
  widen 除去・F7 コメント。**却下**: Opus F11 snapshot 削除〔toBe 対と主張が別物 — 混同。
  唯一の pre-slice oracle として維持〕。**確定裁定**: F8 数値反復は導出関係の正しい帰結 =
  仕様として維持・spec 固定。**記録**: 台帳 §6 #15〔H-13 符号の穴・scope pool 配置・
  F13/F15 保留〕＋ D-R3 行へ計量値追記〔median 1.864ms/p95 2.135ms — 「現状明文化」案の
  実測補強〕。**BIG8-FIXA 受入済み**〔over 両系＋remaining 非有限→error 退化〔pool-over
  非発火セット〕＋TSDoc。round2 = constraint-evaluator.spec の 1 expectation 限定許可
  〔実装者が境界停止して許可要請 — 正しい停止〕。engine 470/470・254 独立確認〕→
  **BIG8-FIXB 受入済み**〔over 消費で warnings がフォーム経路から消滅・grouping を
  blockIds＋fieldBlocks[index] へ移行〔同数同順を engine 実読で確認・意図コメント化〕・
  空セクション全体スキップ・F5 widen 除去・F7 コメント・spec 8 件〔F1 P2/P3/P4・沈黙
  it.each・F8 pin・空 section・pool error 沈黙〕。front 262/262〔254＋8〕・engine 470/470
  独立確認・R0 snapshot 不変〕→ 合同小粒度レビュー needs-fix〔medium 1 = 空セクション
  skip 後の index 保持を固定する spec 欠落 — 1 section 構成では filter→map の index 詰め
  変異を検出不能〕→ micro round で回帰 spec 追加〔空＋非空 2 section・後続の超過文言表示・
  両変異の検出机上確認〕→ **大粒度 #8 クローズ**（受入記録 = acceptance-big8.md。
  最終状態: engine 470/470・front 263/263。到達構造 = 超過判定所有 engine 2 箇所のみ
  〔renderer H-12 逸脱 0〕・warnings チャネルのフォーム経路消滅〔join 欠陥クラス構造的
  不存在〕・H-10 grouping の engine 単一所有・SM-3 完全化・remaining 非有限 error 退化。
  残債 = 台帳 §6 #14/#15）。**U15-R2 は 3 分割で着手**（仕様再読の結果: ①表示値 =
  Σ(入力 parts) は base/other 暗黙キー込み〔:255・:241-244〕のため renderer の可視セル合算は
  意味的誤り＋parts 合算第 3 実装化 → engine 先行が必要 ②Web diff 契約〔:245-248〕=
  宣言キーごとの個別 {fieldUid, partsKey} 変更必須・whole-parts 一括書込禁止 → renderer の
  onChange 契約拡張が要る。**R2a 受入済み・レビュー pass〔findings 0〕**〔engine:
  fieldBlocks エントリへ displayValue?: number — number scalar のみ・resolveNumberValue
  再利用で新規合算ゼロ・base/other 込み Σ=29 のレビュー実測・省略規則 limits 同型・
  engine 476/476〔470＋6〕独立確認。max あり field の重複評価 +1 は D-R3 隣接の意図された
  重複として記録〕→ **R2b 実装受入済み・小粒度レビュー委譲中**〔table: H-16。実装 =
  table 単位 first-seen union・label first-win・宣言キーのみ NumberInput・合計 =
  displayValue 素通し・parts:true 縮退・colSpan 維持・onPartsChange 個別 emit
  〔whole-parts 経路ゼロ申告〕・.tableScroll CSS。front 268/268〔263＋5〕独立確認・
  **H-14 CSS は Fable 実ブラウザ検収済み**〔モバイル 375px: scroller 339/776 で内部横
  スクロール成立・body 非溢れ — scratchpad/h14-scroll-check.html・css-responsive メモリ
  履行〕。レビュー観点 = union 範囲の H-17 直交漏れ・非 number-scalar への partsKeys draft・
  per-key セルの a11y ラベル・0 の falsy 誤 skip・base 込み差分 pin の変異検出力。
  レビュー needs-fix〔medium 2/low 1〕→ round2 で全消化: parts:true 併存 draft の union 除外
  〔isNumberScalar ガード込み〕・sentinel displayValue=42 の raw 再合算変異検出 spec
  〔部分和 {5..35} と非一致〕・0 emit spec。front 271/271〔268＋3〕独立確認 —
  **R2b クローズ**〕→ **R2c 実装受入済み・小粒度レビュー委譲中**〔H-11: grid parts =
  合計＋PartsEditorPopover〔grid/table parts:true 共有・base 行編集・other 表示専用
  data-parts-readonly・新キー UI なし — 設計未規定 3 点は台帳 §6 #15b 登録済み〕・
  useState は Popover 開閉のみ〔フォームデータは props 経由 — 妥当性はレビュー判定〕・
  front 276/276〔271＋5〕独立確認・CSS 変更なし・既存期待値変更 0。レビュー観点 =
  local state へのデータ複製有無・raw の汚染キー/非数値の draft-safe・other の入力経路ゼロ・
  フォーカス開閉 a11y。**レビュー needs-fix〔medium 2/low 1〕→ round2 委譲中**:
  ①キーボード導線 ②grid 非 parts 境界 fixture ③外部 values 更新＋prototype キー spec →
  round2 で全消化〔withinPortal=false 採用・state 追加ゼロ・Escape/Enter/Space・spec 3 件・
  front 279/279〔276＋3〕独立確認 — **R2c クローズ**〕→ **大粒度 #9 二重レビュー委譲中**
  〔R2a/R2b/R2c・Codex＋Opus。観点 = parts 表示 3 経路の重複実測・per-key emit 契約一貫性・
  H-12 全数再監査・withinPortal=false×.tableScroll の相互作用〔行内 Popover の overflow
  クリップ — Opus に scratchpad 再現を指示〕・displayValue 二重計算の drift 可能性〕。
  **Codex 側完了 = needs-fix〔high 1/medium 2/low 3〕**: high = value-input.ts:134
  `allowsParts` が宣言モード（partsKeys）非認識 → publish 可能な partsKeys テンプレートの
  parts 入力を runtime 境界 3 箇所〔materializer×2・server writable-path×1〕で拒否する実測
  〔design :247-248 の「parts || partsKeys へ拡張（実装変更点）」の未実装分と整合〕。
  medium = ①finite-sum の value-input/evaluator drift〔MAX_VALUE×2 で schema 受理・evaluator
  拒否 — §2-3「責務差で意図的」裁定との突合が要る〕②partsKeys:[] 空宣言が plain scalar へ
  落ち onChange 経路になる。low = 多列/実ブラウザ未固定・GridPartsField 1-caller wrapper・
  fixture 複製。renderer 面 pass〔raw 読取 1・whole-parts 0・合算 0・Popover 共有妥当〕。
  **Opus 側完了 = needs-fix〔blocking 3〕・証跡 = opus-big9.md**: H1 = 空入力 undefined emit に
  下流受け皿なし〔SheetChangeDto @IsDefined・server writePathValue も undefined 代入で
  evaluator throw — clear の意味は設計未規定・D-R2 配線前に裁定必須〕。H2 = Mantine 途中入力
  文字列（'-'等）を undefined へ潰し**負値の逐次入力が実ブラウザで不能**（H-5 喪失・
  fireEvent 一括 spec では検出不能）。H3 = **台帳 #15b(b) の前提が誤り** — stack の宣言
  partsKeys field は base 昇格でなく whole-field 書込（parts 全消失経路・sheet-edit :44 は
  field.parts のみ partsKey:'base'）。H4 = モバイル Popover width 280 固定で viewport 227px
  超過（withinPortal は無関係と対照実験で確定）。M1 = .tableScroll クリップ懸念は**実測で
  否定**。M2-M5・L1-L6・spec 漏れ 5 系は opus-big9.md 参照。
  **big9 統合裁定完了（big9-integration.md・2026-08-11）**: 保存経路欠陥群〔Codex high＋
  Opus H1/H3〕を統合し **v1 = 数値のみ emit**（undefined・途中文字列を emit しない → H2 同時
  解消・clear は 0 入力代替・D-R2 配線時に clear UX 再裁定の留保）。**stack 宣言 parts も
  合計＋Popover へ**（#15b(b) 撤回 — whole-field 実測が前提を反証）。finite-sum は §2-3 の
  精緻化として value-input へ追加（失敗様式 false は維持）。partsKeys .min(1)・H4 =
  width="target"・M1 棄却確定。**台帳訂正済み**: #15b 全面改訂〔(b) 訂正＋(d) 数値のみ emit〕・
  #15c 新設〔M2・非 parts 行 colSpan・M1 否定・spec 保留〕・H-6 述語 5 符号化・isRecord 6 定義。
  **design H-10 skew 表へ M4 の 1 行追記済み**（parts:true＋partsKeys 併存 = parts:true 優先）。
  **BIG9-FIXA 検収通過（2026-08-11）**: engine 482/482〔476＋6〕・contract-stack 全緑
  〔front 279/279〕を Fable 独立再実行で確認。スポット読み一致〔allowsParts 拡張 :170・
  宣言キー制限は parts!==true 時のみ = H-10 新行と整合・有限和 false 返し・publish .min(1)〕。
  **ユーザー指示でコミットまでタスク化（2026-08-11）**: docs レーン 3 コミット済み
  〔.gitignore trpg-remix-app ignore = df31c40・docs 裁定群 = 4bfc04b・fable-rules 二重
  レビュー明文化 = 81638bc〕。残レーン = engine〔FIXA 二重レビュー通過後・tree 検証つき〕→
  front〔FIXB 検収＋レビュー＋実ブラウザ後〕。push は指示範囲外。
  **FIXA 二重レビュー = 両 needs-fix・同一根本原因へ独立到達**〔zod z.record が own __proto__ を
  黙って落とし検査対象と下流実データが乖離 — 受理集合が三面で割れる 8 反例。統合 =
  big9-fixa-integration.md: 生 parts 検査・UNSAFE parts key 全モード拒否・fail-open 全閉鎖/
  fail-closed 許容記録・base/other 1 定義化・helper 分割。Opus が H-10 追記の「publish は併存を
  拒否しない」を反証 → 訂正済み＋verify-claims メモリ 17 例目〕→ **FIXA-R2 検収通過**
  〔engine 508/508〔482＋26〕・front 283/283 独立確認・24 特殊キーベクタ全拒否・スポット読み一致〕。
  **FIXB 検収通過**〔283/283〔279＋4〕・emit ガード 3 経路・数値のみ emit・stack→Popover〕→
  **FIXB 二重レビュー**〔Codex pass/low 1・Opus needs-fix F1-F10〕＋ **Fable 実ブラウザ検収完了**
  〔scratchpad/fixb-harness・実物バンドル: H2 逐次 '-4' PASS・H4 モバイル溢れなし PASS・H3 実物
  確認。F2 clear 無言乖離と F3 55px dropdown を実測確定 → D-R2 議題へ記録〕→ 統合 =
  big9-fixb-integration.md → **BIG9-FIXB-R2 検収通過（2026-08-12）**〔engine 508/508 不変・
  front 289/289〔283＋6〕独立確認。F1 同期コメント＋allowsParts 関係 spec・併存 pin・
  F4 UNSAFE_PARTS_KEYS export 化＋Popover 除外反転・F5 Select null 非 emit・F9 base 重複行
  解消・F6/F8/F10 全消化〕— **大粒度 #9 クローズ**（blocking 3＋high 1 を含む全 findings 消化・
  実ブラウザ検収込み）。
  **コミット完了（ユーザー指示 2026-08-11「git commit までをタスク化」）**: df31c40 chore
  〔.gitignore trpg-remix-app〕→ 4bfc04b docs → 81638bc skills → **ae9345a sheet-engine＋front
  一体コミット**〔33 files +6428/-90〕→ 最終 docs コミット（本更新）。push は指示範囲外・未実施。
  **当初は engine/front を 2 コミットへ分割したが worktree 隔離検証で中間 tree が赤と実測**
  （v3Template.spec の front⇔engine 予約語集合一致 pin 3 件 — RESERVED_IDS 'constructor' が
  engine 単独 tree で割れる。跨ぎ drift pin が設計どおり分割を拒否した形）→ 未 push のため
  soft reset で 1 コミットへ squash。教訓: `cmd | tail` は exit を隠す — 検証チェーンは pipefail。
  **D-R3 ユーザー裁定（2026-08-12）**: 前半 = (a) LIST_ROW_LIMIT 新設・512 仮置き（表上限と
  同形の単一定数・変更容易を確認済み。上げ = 公開済み再検算・下げ = データ移行の注意を H-18 に
  記録）・後半 = 注釈式の独立予算（式ごと既定 10,000）を仕様として明文化。共有予算化・見積もり
  加算・行内 computed 拒否・参照深さ制限は却下（台帳 §1-4 に理由つき記録。深さは
  トポロジカル 1 回評価で非増幅・循環は publish＋評価の二重防御済み）。design-v1-ui H-18 を
  確定文言へ更新・台帳 §5-2 の D-R3 行クローズ・§6-1 #16 に消化スライス登録済み。
  **D-R3-IMPL round1 = Fable 検収 blocking → R2 差し戻しで解消（2026-08-12）**: round1 が
  保存境界へ「行内容無検証（z.unknown）の list 受理」を新設していた — 従来は
  「not an input field」で list 値**全拒否**（inputSchemaFor に list 分岐なし）だったものを
  cap の副作用として開放しており、保存受理×評価 throw の fail-open 再導入。R2 で受理を撤回し
  全拒否へ復元（512 行でも拒否の負方向 spec つき）・H-18 に「保存境界は list 値不受理・
  受理導入は将来スライスで行内容検証とセット」を追記。維持 = evaluator 防御 cap・publish
  見積もり行項（listRowLimit options は下方クランプ・上方のみ許可の実装者裁量 — レビューで検証）・
  独立予算 pin spec・JSDoc。**検収通過**〔engine 515/515〔508＋7〕・front 289/289 独立確認・
  残骸 grep 0〕。**D-R3 二重レビュー完了 → 統合裁定（dr3-impl-integration.md）→ R3 委譲中**:
  Codex M1 = 欠落検査の全行走査（評価は先頭 512 なのに欠落検査だけ 513 行目を見る境界不均一 →
  constraint-evaluator 限定許可で slice 化）・両者一致 = コメント虚偽 2 箇所・Opus F3 =
  **listRowLimit 公開オプション撤去**（行上限を設定しない見積もり倍率・production caller 0・
  YAGNI）・Opus F2 = h18-bench が支配項（512×行項）を測らない → list ケース追加。low 群 =
  コメント配置・行項 0 pin 復元・独立予算 spec の load-bearing 記録（実測 9,043 step/回・
  余裕 957）・JSDoc 追記・spec タイトル。確認済み = round1 残骸 0・B-2 不変（11 組合せで
  緩め経路なし）・見積もり上界 4 系成立。
  **U15-E1 検収通過**〔front 301/301〔289＋12〕独立確認・diff 2 ファイル +262・スポット読み一致
  （clear = property 省略・parts:true 無効化・formula 欄なし・D-R1 領域不可侵）〕→
  **E1 レビュー pass**〔low 1 = as Partial キャスト 3 箇所 → E2 項目 0 へ畳み込み〕。
  **R3 検収通過 → D-R3 分コミット済み（5ba01e6・2026-08-12）**: engine 513/513〔515−4＋2〕・
  front 301/301 独立確認・残骸 grep 0・constraint-evaluator :184 slice 化スポット確認。
  台帳 §6-1 #16 を消化済みへ更新。5ba01e6 は worktree 隔離検証 VERIFY_ALL_GREEN（pipefail）。
  **U15-E2 検収通過（2026-08-12）**: front 303/303〔301＋2〕独立確認・diff 2 ファイル
  +598/-1（E1+E2 累積）・E1 low のキャスト 3 箇所除去確認（as Partial カウント 10→7 =
  E1 前基準）・ConstraintInput で number/formula 切替を共通化・patch 形は property 省略規約
  （total のみ必須維持 = {formula:""} 残置）。
  **大粒度認知負荷レビュー #10 完了（2026-08-12・二重・両者 needs-fix）**: 突合と裁定 =
  review-results/impl-u15/big10-integration.md。採用 4 件で **U15-E2-R2 委譲中（Codex code・
  prompt-u15-e2-r2.md / run-u15-e2-r2）**: A1 base/other 候補削除（publish が構造的拒否 —
  Fable 指示書起因ミス・メモリ verify-claims 第 18 例）／A2 ConstraintInput の mode useState 廃止
  = value から導出（H1 cap 切替不能＋H2 pool 行削除で式が数値上書き保存されるデータ破壊の根本修正。
  契約変更裁定済み: 非 required cap の formula 切替は {formula:''} を書く = total と統一）／
  A3 blockId 自 section 候補＋タブ切替で選択解除（別 section の blockId 書込可を実測）／
  A4 scope 空クリア経路 spec。No-Go 一致 = 行編集 UI 3 複製の generic 化（台帳 §2-3 へ登録済み）。
  Fable doc 消化済み = design-v1-ui H-18 :352 訂正・台帳 §2-3 LIST_ROW_LIMIT・§2-2 B-17
  （own-undefined×hasOwnProperty・現状到達不能）。E3 へ持込 = blocks/pools issue の chip 語彙欠落
  （extractFieldId が field path のみ）。
  **E2-R2 Fable 検収通過（2026-08-12）**: front 308/308〔303＋5〕・engine 513/513 独立再実行・
  diff 範囲 = editor 2 ファイルのみ・スポット読み一致（mode 導出化 :81・useState 0・
  typeof key 撤去・selectedField は activeSection 内検索へ :399・候補 = 宣言済みのみ :228・
  H1 spec が裁定契約 {formula:''} を :485 で固定）。実装者申告 = 回帰 2 本の修正前赤確認済み。
  留意 = :116 は `(formula || required)` 解釈で、非 required の式欄を空にすると number へ
  自動復帰（安全方向だが要レビュー確認）。
  **E2-R2 二重レビュー完了（両者 needs-fix）→ 突合裁定 = r2-review-integration.md →
  U15-E2-R3 委譲中（Codex code・prompt-u15-e2-r3.md / run-u15-e2-r3）**:
  F1 :116 の `(formula||required)` 解釈で非 required の式が空経由編集で数値断片として
  無言永続化（両者一致 high・Opus 実測 cap 0.2。formula 分岐は常に {formula}・clear は
  number 切替経由へ・誤契約を固定する既存 spec 2 本〔max clear・cap clear〕書換）／
  F2 タブ切替の明示解除 :740 削除 = activeSection 内導出へ一本化（処方箋対立を Opus 案で裁定:
  M4 緑実測＋認知負荷優先＋片道 spec が M3 検出器化。タブ往復で選択復元の UX を spec 固定）／
  F3 dead key 2 個削除（M9 緑）／F4 scope 候補順序 assert／F5 total ?? 0 削除（M11 緑・到達不能）／
  F6 blockOptions 2 箇所相互参照コメント。記録のみ = I-1 行削除時の検索語持ち越し（実害なし）・
  I-2 blockId 自由入力の他 section id（publish 拒否 = fail-noisy）。
  認知負荷 = R2 で最大同時保持 9→9 横ばい（T1 -2 を T2/T3 +1 ずつが相殺）・F1-F3 処置後見込み 8。
  **R3 Fable 検収通過（2026-08-12）**: front 309/309〔308＋1〕・engine 513/513 独立再実行・
  スポット読み一致（:114 常時 {formula}・タブ解除は deleteField の 1 箇所のみ・dead key 0・
  ?? 0 撤去・相互参照コメント :225/:880・F1 回帰 spec = 空→欄維持→{formula:''}→打ち直し・
  タブ往復復元 spec・max/cap clear は number 切替経由へ書換）。実装者申告 = 修正前赤 1 本確認。
  → **front レーンコミット済み（2ee02fe・E1+E2+R2+R3 一括・editor 2 ファイル・
  +770/-5）**。docs レーンも 9b65f27 でコミット済み（tree クリーン）。未 push
  （push はタスク範囲外・運用判断待ち）。
  **U15-E3 Fable 検収通過（2026-08-12）**: 検証結果の位置特定表示 —
  describeIssuePath resolver 1 本（:985）を issues/warnings 両 Alert へ適用（:566/:573）・
  fallback = raw path・throw 経路なし。front 314/314〔309＋5〕・engine 513/513 独立再実行。
  spec は validatePublishTemplate 実出力経由で path 語彙を pin（warnings 4 path・
  issues 5 ケース = blocks id 形/pools/zod index 形/partsKeys 意味形/解決不能 fallback）。
  実測語彙 = zod index 形 `sections.0.fields.0.label`・意味検証 `sections.<id>.blocks.0.id`・
  field 系意味検証 `<sectionId>.<fieldId>.partsKeys.1.id`・warning `sections.<id>.blocks.0`。
  **E3 小粒度レビュー（needs-fix・G1 曖昧 path 誤解決／G2 nested 潰れ／G3 空白ラベル）→
  E3-R2 消化 → Fable 検収通過 → コミット済み（d4302e1・2026-08-12）**: 解釈候補を
  両語彙で列挙し**一意のときだけラベル化**（同一対象の重複候補も raw fallback = 保守方向）・
  itemFields/attrs 再帰・label.trim()||id。front 319/319〔314＋5〕・engine 513/513 独立再実行。
  回帰 spec 5 本は修正前赤を実装者確認。レビュー確認済み = raw 化変異で 5 spec 赤・
  意図的 raw fallback 対象の列挙（$・top-level・collection-level・tables/settings）・
  責務分離 ok（actionMessages 正規表現はサーバ自由文専用）。
  **U15 キューの現況**: エディタ UI（E1/E2 = 2ee02fe）・検証位置表示（E3 = d4302e1）消化。
  残 = renderer 配線（D-R2 待ち）・右ペインタブ化（D-R1 待ち）・9-S8 preset UI（D-R1 待ち）。
  **キュー #11 SM 開始（2026-08-12）**: スライス分割案 = SM-A deltas min1（engine・委譲中）→
  SM-B 空 deltas の防御的除外＋警告（server projection）→ SM-C resolve 分離
  （resolveForCreate/resolvePinnedRevision・character-sheet-template.service）→
  SM-D 409 currentRevision（api-contract＋server＋front SM-15）→ SM-E canMutate＋
  no-authorized-actions（SM-5/SM-11 projection）→ SM-F SM-1 proof 原子性 →
  SM-G partsKey 語彙検査（#15d(e)）→ front 系（SM-8 5 要素・SM-14 4 状態）。
  順序は独立性優先・server 系はスライス着手時に AI.md/service 実測で再設計する。
  **SM-A 完了・コミット済み（8078b06・2026-08-12）**: publish deltas min1。
  検収 = engine 515/515〔513＋2〕・front 319/319 独立再実行・レビュー pass（findings 0・
  4 宣言経路〔field role/rowRole/itemFields/attrs〕すべてに min1 が効くことを実測・
  下限の符号化は production 1 箇所のみ・server は単純コピーで重複なし）。
  **SM-B 設計完了・委譲中（Codex code・review-results/impl-sm/prompt-sm-b.md / run-sm-b）**:
  調査エージェント実測（証跡 = 本 handoff 直下＋prompt-sm-b.md）に基づく Fable 裁定 —
  配置点 = sheet-projection createGroupReferences（:148）1 箇所（select/warnings/panel/browser
  4 経路の共通点）・除外条件 = group の action 数 0（roll 混在 group は残す・action 数計算は
  :434-437 から内部ヘルパへ抽出し二重符号化回避）・警告 = invalid-custom-id-part 同形の
  ProjectionWarning 新 code・panel の stale customId は既存 title フォールバック退化を採用
  （案内 UI は SM-E）。記録 = createEphemeralPanel は uniqueWarnings 未適用で panel 経路の
  warning は logger に出ない（既存ギャップ・SM-E 隣接で裁定）。
  受入 = test:projection（基準 22）＋trpg-server の hub 3 spec ＋ build:projection。
  **SM-B 検収通過（projection 25/25・server hub 22/22・action 数符号化 1 箇所を確認）→
  小粒度レビュー needs-fix（medium 1）→ SM-B-R2 委譲中（prompt-sm-b-r2.md / run-sm-b-r2）**:
  レビュー実測で SM-11 の前提「空 deltas = 0-action group の唯一の発生源」が**反証** —
  無効 roll キーのみ・非正準 delta（-0/1e21/1e-7）のみの group も button 生成防御で
  0 アクションになり select に死に選択肢が残る。裁定 = 実生成可能アクション数基準へ
  （renderability 述語を builder と counter の共有内部関数へ抽出・符号化 1 箇所）。
  R2 通過後に design-v1-ui §3.5 SM-11 の「唯一の発生源」文言を Fable が訂正する（doc レーン）。
  観点 3 は白 = warning は ViewModel 内 2 経路生成だが uniqueWarnings＋logger 側 code@path
  重複排除で実害なし。
  **SM-B-R2 検収通過 → コミット済み（872b861・2026-08-12）**: renderability 述語 2 本を
  builder/counter で共有（:89/:93・使用 :98/:158/:160/:343・符号化各 1 箇所を grep 確認）・
  projection 28/28〔25＋3〕・server hub 22/22・build 成功。design-v1-ui §3.5 SM-11 の
  「唯一の発生源」文言を訂正済み（構造的発生源 = publish 閉鎖 SM-A／退化系発生源 =
  projection 一括被覆 SM-B の二層記述へ）。
  **大粒度 #11 走行中（Codex 返着 needs-fix・Opus 走行中）**: Codex high =
  countGroupActions は builder の第 3 条件（customId 100 文字予算・channelId 長の実行時文脈）を
  見られず「select に残るが panel 0 件」が残存（20 桁 channelId＋75 文字 key で実測）。
  処方箋 = counter 削除・**builder の実生成結果を group 生存/page 数の正本に**（所有者 2→1 純減）。
  Codex medium = server op 層が要求 delta を現 palette 宣言と突合しない（spec:1193 が未宣言 -3 の
  成功を固定＝暗黙契約化・stale button から未宣言 delta 適用可）。#15d(e) partsKey 語彙検査と
  同クラス。他 = sweep 4 系健全・変異 3 種赤・全ゲート緑・editor 1,147 行（+145）は
  resolver 局所化を優先し finding 化せず。
  **大粒度 #11 突合裁定完了（big11-integration.md・2026-08-12）**: counter×builder 不一致は
  **両者独立収束**（Opus は SESSION_HANDOFF の Codex 記録を読む前に probe 済みと申告）・
  severity は Opus の到達性実測（materializer は key≤35→customId≤82 で現行生成経路は
  予算 100 に到達不能・永続 schema に key 上限なし = 外部注入のみ）を採用し防御深度の欠落と裁定。
  Opus 単独採用 = M-2 describeIssuePath の throw 経路（label 欠落/非 string 8/8 node kind で
  TypeError → 検証レポート全損。コミット d4302e1「throw 経路なし」の反証 — メモリ
  verify-claims 第 19 例へ記録済み）・M-4 PublishWarning.path への表示ラベル上書き・
  L-1 isRenderableResourceDelta 純間接参照。台帳 B-18 新設（resolver 一意性×sections 語彙）。
  記録のみ = L-2 fieldId/path 非対称（server 構造化 path 返却スライスで再訪）・
  editor 1,147 行は分割しない裁定（両者一致: 分割は純減にならない）・
  コミット文言反証 2 件（872b861「符号化各 1 箇所」= 2/3・8078b06「唯一の発生源」）は
  履歴書換せず本記録で訂正。
  **修正 3 レーン全消化・コミット済み（2026-08-12）**:
  SM-B-R3 = ce7bd7d（builder 実生成正本化・top-level 関数 30→28・projection 29/29・
  server hub 22/22）／E3-R3 = 6dc601b（displayName 非 string ガード・warning 表示型分離・
  front 322/322）／SM-OP = a063ae5（宣言 delta 突合 :568 の 1 箇所・focused 99/99・
  build＋循環ゼロ・**server full suite 3056/3059 — 赤 3 は既知の L-2 再現 spec のみ**
  〔ユーザー裁定待ち・§6-1 優先 2。SM-OP 起因の赤ゼロを確認〕）。
  検収教訓: `cmd | tail` が again exit を隠した（メモリ既録の罠・full suite の Exit 1 を
  notification の exit 0 が偽装）— 判定は必ず末尾の Exit status 行か pipefail で。
  **大粒度 #11 クローズ**。
  **SM-C 設計完了・委譲中（prompt-sm-c.md / run-sm-c）**: 調査実測 = resolve は
  resolvePublished 1 本（template.service:71・:81 で draft/deprecated/version を単一 409）・
  production 呼び出し 2 箇所のみ（instantiation:29 = 作成／operation:415 resolvePinnedTemplate =
  保存:190・delta:279・hub:427 の共通ハブ）。分離 = resolveForCreate（published のみ）／
  resolvePinnedRevision（**deprecated 許可**・draft 不可・version 一致）。本命回帰 =
  deprecated pin キャラの save/delta/hub 成功（修正前赤の確認必須）。モック名追従 5 spec。
  **legacy-coc.reproduction（L-2 既知赤 3）は rename 以外変更禁止・赤 3 件同一維持を受入条件化**。
  **SM-C 完了・コミット済み（5d6f1d9・2026-08-12）**: 検収 = focused 96/99（赤 = 既知 L-2 の
  同一 3 件のみ）・build＋循環ゼロ・resolvePublished 残存 0 を grep 確認。レビュー pass
  （findings 0・hub none→publishing は既存 materialized の pin 投影 = pin 用で正・
  deprecated 除去変異 4 spec 赤・legacy-coc diff は rename 1 行 numstat 実測）。
  **SM-D 調査完了 → SM-D1 委譲中（prompt-sm-d1.md / run-sm-d1）**: 実測 = conflict payload の
  正本は operation.service:114-119（private interface・api-contract に schema なし）・
  **front は 409 payload を読まずに捨てている**（actions.ts:36-41 で固定文言化・theirs/mine
  ダイアログ未実装・baseRevision は prop 直読みで state 化が必要）・跨ぎ drift pin なし
  （赤くなるのは filter spec の封筒完全一致 1 本のみ）・SM-15 の対象 = sheet.revision
  （CharacterSheetEditClient）で TemplateEditorV3 の draftRevision conflict は別語彙・対象外。
  スライス分割裁定 = SM-D1（server 純加算: mergeConflict へ currentRevision・mine 再送前提の
  spec 固定）→ SM-D2（front theirs/mine 状態機械＋契約 schema を**消費者と同時に**導入 —
  死んだ抽象の先行を避ける）。retryConflict 系 409 は対象外。
  **SM-D1 完了・コミット済み（77168ff・2026-08-12）**: 検収 = focused 73/73 独立確認・
  レビュー pass（findings 0・currentRevision=0 変異 2 spec 赤・並行更新時の mine 再送は
  新 payload 409 で再提示 = SM-15 整合を実測）。
  **キュー #11 の消化状況**: SM-A（8078b06）・SM-B+R2+R3（872b861/ce7bd7d）・SM-OP（a063ae5）・
  SM-C（5d6f1d9）・SM-D1（77168ff）消化。**スライス数 3 到達 → 次の大粒度 #12 は
  SM-C/SM-D1＋次スライスの後**（大粒度 #11 が SM-B-R3/E3-R3/SM-OP を検収済みのため、
  #12 の起点は SM-C から数える）。
  **SM-G 完了・コミット済み（df77159・2026-08-12）**: 操作層 partsKey 語彙検査 —
  UNSAFE 全モード 422・宣言モードは base/other＋宣言 id（engine 定数 import・再宣言 0）。
  __proto__ の無言の嘘（成功・appliedChanges+=1・値不変）を characterization で確認後 422 化。
  受理集合は実装者・レビュアが**独立に engine 実測して全一致**・16 ケース同値 spec が
  drift 検出器。空キーは parts:true で engine 受理へ揃えて緩和（下流無害を到達実測）。
  レビュー pass（findings 0・変異 6 本赤）。台帳 #11 行へ消化状況を追記済み。
  **大粒度 #12 走行中（Codex 返着 needs-fix・Opus 走行中）**: Codex medium =
  **publish が UNSAFE キー（prototype 等）を宣言 partsKey id として受理**（実測:
  partsKeys:[{id:'prototype'}] が publish 緑 → value-input は reserved 拒否・操作層 422 =
  公開済みが提示するキーを誰も保存できない drift。SM-G 同値 spec は publish を通らないため
  盲点）。処方箋 = validateScalarPartsKeys で UNSAFE_PARTS_KEYS を再利用し publish 拒否＋
  「publish 成功の宣言キーは下流受理」境界 spec。他 sweep 健全 = 包含 operation⊆engine 16/16・
  status 集合再宣言 0（repository CAS の 1 件は責務別で意図的除外）・409 3 族とも定義 1・
  operation.service 累積影響は saveSheet 同時保持 8/11 横ばい・エディタ提示⊆操作層は
  **不成立**（宣言 id 無加工候補化 — publish 修正で上流閉鎖）。
  **大粒度 #12 突合完了（2026-08-12・big12-integration.md）**: Opus も needs-fix で返着し、
  F1 が Codex medium と**独立収束**（すり抜けは `prototype` 1 語と特定 — __proto__ は
  ID_PATTERN・constructor は RESERVED_IDS が既閉。機構 = UNSAFE 3 値の二重定義:
  publish.ts:46 UNSAFE_UID_KEYS ⇔ value-input.ts:14 UNSAFE_PARTS_KEYS に drift テスト無し。
  front 提示 3 兄弟関数の濾過非対称〔table 列無濾過／popover 宣言 = base/other のみ／
  自由 = UNSAFE〕も実測）。裁定 = **B12-FIX（engine 1 レーン）発行済み・走行中**
  （prompt-b12-fix.md: validateScalarPartsKeys へ UNSAFE 拒否＋UNSAFE_UID_KEYS を
  UNSAFE_PARTS_KEYS import へ一本化〔uid メッセージ不変〕＋3 キー回帰＋層間境界 spec）。
  繰延べ = renderer/editor の提示濾過（D-R2 接続時条件へ台帳追記済み — 書込は操作層 422＋
  materialize 再検証の二層で fail-noisy 済み・対象は既存公開データ防御のみ）。
  記録のみ = F2 409 status 判別（SM-D2 前提）・F3 非 draft 補集合形の fail-open
  （台帳 §2-2 B-19 新設・書換は YAGNI）・F4 同値 spec の track 未被覆（probe 一致・欠陥でない）。
  Opus scope-check の SESSION_HANDOFF mtime 変化は Fable 自身の並行更新で汚染ではない。
  **B12-FIX 返着・Fable 独立検収まで完了（2026-08-12）**: 本体差分は指示どおり最小
  （UNSAFE_UID_KEYS 削除→UNSAFE_PARTS_KEYS import 一本化・uid メッセージ不変・
  validateScalarPartsKeys へ拒否 1 分岐・truncateIssueInput 様式踏襲）。spec は
  publish 3 キー it.each 回帰＋phase2-engine の層間境界 spec（JSON.parse で own __proto__
  生成・実 publish＋実 safeParse 突合）。red-green 証跡あり（prototype 修正前赤）。
  Fable 独立再実行 = engine 519（515＋4）・projection 29・front 322 全緑 exit 0。
  **B12-FIX 完了・コミット済み（fd4c8be・2026-08-12）**: Opus レビュー pass
  （blocking 0・low 4 は big12-integration.md へ起票 — Low-1 uid 機構コメント復元は
  次の publish.ts スライスへ・Low-4 UNSAFE_PARTS_KEYS の ReadonlySet 化は次の
  value-input スライスへ折込。判別力の変異実測 = publish 検査削除 4 赤・literal drift 2 赤・
  uid 意味不変 = HEAD 並置 12 ケース diff 0）。**大粒度 #12 クローズ**。
  次 = SM-D2 委譲（設計前提は prompt-sm-d2-draft.md に固定済み:
  409 cause 実測形・原子的拒否ゆえ mine は全 dirty 再送・conflicts ⊆ 提出 path・
  D2a 契約＋action 層／D2b editor 状態機械の 2 分割）。
  **SM-D2a 委譲済み・走行中（prompt-sm-d2a.md）**: api-contract へ mergeConflict cause
  schema（zod 値 export・dicePreviewRequestSchema precedent）＋公開面 2 pin 更新
  （index.spec export 一覧・eslint allowImportNames = B-12）＋actions.ts の 409 構造化
  （malformed cause は現行固定文言へ fail-back・retryConflict は theirs/mine 対象外）＋
  CJS 跨ぎ void 0 検出の runtime smoke。CharacterSheetEditClient と server は不触。
  **SM-D2a 返着・Fable 独立検収まで完了**: schema の path 形 {fieldUid, partsKey?} は
  server 型（operation.service.ts:35-38）と一致を裏取り・fixture 出典（決定表 4 =
  operation.service.spec.ts:928・filter spec「409 conflicts」:147-167）の実在確認済み。
  独立ゲート = 契約 build 0・契約 test 20/20・front 324（322＋2）・eslint 0。
  **Opus レビュー = needs-fix（medium 4・証拠品質のみ・happy path 欠陥なし。証跡 =
  opus-review-sm-d2a.md）→ 修正ラウンド D2a-R2 委譲済み・走行中**: F1 = strip の根拠が虚偽
  （filter は message を deny・実 cause に message は載り得ない — **Fable 指示書起因**・
  メモリ verify-claims 例 #20 記録済み）／F2 = refetchRequired 分岐は byte 同一 no-op → 削除／
  F3 = bare-409（data なし）被覆の退行 → 復元／F4 = 内側 .strict() と .nonoptional() が
  未 pin → 2 ケース追加／F6 = eslint message 文言。**裁定済み（レビュー内で確定・再議論不要）**:
  strictness 混在は keep（外 = 汎用 pass-through ゆえ .strip() 正・内 = closed literal ゆえ
  .strict() 正・precedent = dicePreviewResponseSchema）・CJS 跨ぎ void 0 は本スライスで閉鎖
  （front jest は moduleNameMapper なし = Next と同一 dist を実行・ensure:workspace-dist 先行）。
  F5（server payload ⇔ 契約の機械結合ゼロ）は台帳 B-5 へ追記済み。
  **SM-D2a 完了・コミット済み（9c8dbb3・2026-08-12）**: R2 で 5 所見全消化を Fable 実査
  （strip 根拠コメント訂正・no-op 分岐削除で fallback 返却 2→1 箇所・bare-409 復元・
  strict/nonoptional の pin 2 追加・eslint 文言）。独立ゲート = 契約 22（20＋2）・
  front 325（324＋1）・eslint 0。
  **SM-D2b 委譲済み・走行中（prompt-sm-d2b.md）**: baseline（EditorValue レベル）＋
  baseRevision の state 化・非モーダル競合パネル（SM-15「表示中も編集継続可」のため
  Modal 不採用）・theirs/mine とも baseline[uid]=current・適用後 dirty 残があれば
  baseRevision=currentRevision で自動再送・再送 409 は新 payload で再提示・
  未知 fieldUid conflict は除外し全件除外なら汎用文言へ退化。
  CharacterSheetEditClient.spec.tsx 新設（RTL precedent 2 本あり）。
  actions/契約/server 不触・diff 目安 300 行。
  **D2b 返着・Fable 実査＋独立ゲートまで完了**: 差分 +324/−23（超過 47 行 = 新設 RTL
  spec 162 行由来・申告あり）。設計どおり（baseline/baseRevision state・payload 同一性
  ガードで選択状態を局所化・未知 fieldUid 除外→全除外で汎用文言退化・header の
  revision 表示も state 追随）。独立ゲート = front 332（325＋7）・eslint 0。
  **Fable 検収で検出した懸念 1 件をレビューへ付託**: 成功時 redirect 経路で action の
  await が undefined を resolve する場合、旧 setActionData(undefined) は無害だが
  新 presentSaveResult(result) は result.mergeConflict で TypeError になり得る
  （Next の redirect() throw 挙動の確定が要る）。Opus read-only レビュー走行中。
  大粒度 cadence: #12 起点からのスライス数 = D2a・D2b の 2（B12-FIX は修正レーンで
  非算入）→ 次の 1 スライス（SM-E 見込み）後に大粒度 #13。
  **D2b Opus レビュー = pass（blocking 0・証跡 = opus-review-sm-d2b.md）**:
  Fable 付託の redirect 懸念は**一次証拠つき棄却**（Next 16.3.0 は redirect で
  promise を reject → presentSaveResult 不到達・optional chaining 化は死んだ防御）。
  SM-15 逐条全充足・変異 8 中 5 killed。生存 3 のうち 2 = spec 被覆漏れ（F-2 baseRevision
  state 更新・F-3 パネル表示中の再 409 置換 — SM-15 中核条項）→ **R2 委譲済み・走行中**
  （spec 2 ケース追加のみ・production 不触・red-green 必須）。F-1（hasInvalidNumber ×
  undefined の無言ブロック・機構は既存）= 台帳 15e へ起票・F-4/F-5 = info 起票のみ。
  **SM-D2b 完了・コミット済み（4d864ed・2026-08-12）→ SM-D2 クローズ**: R2 は spec
  2 ケースのみ・red-green 証跡あり・production は SHA-256 一致で無変更を確認。
  Fable 最終ゲート = front 334（325＋9）全緑。
  次 = SM-E（ephemeral canMutate＋no-authorized-actions・owner/non-owner fixture・
  SM-5/SM-11 系）。SM-E 完了時点で大粒度 #13（D2a・D2b・SM-E の 3 スライス）。
  **SM-E 委譲済み・走行中（prompt-sm-e.md）**: projection = EphemeralPanelInput へ
  canMutate **必須**追加（optional 既定は fail-open のため不可）・resource 除外・
  no-authorized-actions の発火は「除外前 ≥1 ∧ 除外後 0」に限定（canMutate=true の
  既存 0 件経路は不変）・文言は仕様の文字列そのまま。server = 2 handler
  （hub-group-select:44・hub-panel-navigation:29）で毎 interaction 判定・
  **B-13 空文字 owner fail-closed 必須**・findByChannelId select に discordUserId が
  含まれるか実測して pin spec（repository.spec:465 系）と同時更新。
  hub 投影・group browser は U9 viewer 中立のまま不触。
  **SM-E 返着・Fable 独立検収まで完了**: diff +220/−12（予算内）・findByChannelId は
  既に discordUserId を投影済み（select pin と一致・変更不要を実測報告 —
  台帳 B-13 の「投影不足」の懸念は現行コードでは非該当）。独立ゲート = projection 32
  （29＋3）・server focused 82＋repository 43（jest がフラグ文字列をパターンに含めた
  ため単独再実行で確認）・engine 519 回帰なし。
  **Fable 実査の設計論点 1 件をレビューへ付託**: resource 除外が
  `action !== 'resource'` の deny-list で、将来の変異系 action 追加時に非所有者へ
  素通りする fail-open 構造（keep 'roll' の allow-list なら fail-closed）。
  **Opus レビュー = needs-fix（medium 2・low 2・全て機械的。証跡 = opus-review-sm-e.md）
  → R2 委譲済み・走行中**: F-1 = deny-list 論点は採用（allow-list 化は今日の挙動と
  完全同値を実測 — actions 到達 action は roll/resource の 2 値のみ）／F-2 = fail-closed
  ガードは変異生存（判別 spec ゼロ）＋前置項は型上到達不能 → 兄弟実装と同語彙の
  1 行比較へ縮約（'' / undefined owner は素の === で false = B-13 充足）／
  F-4 = owner 0 件経路の status 未 pin → 1 行追加／F-5 = 文言 2 箇所配置の裁定を
  台帳 §2-3 へ記録済み。記録訂正: 「server focused 82」の内訳 = repository 43 を含む
  3 suite 合計（レビュアの 2 suite 39 と両立・以後 suite 内訳を添える）。
  **SM-E 完了・コミット済み（196e629・2026-08-12）**: R2 消化を実査（allow-list 化・
  判定式 1 行化・status pin・red-green 2 件）・独立ゲート = projection 32・
  server focused 82（hub-panel 7・custom-id 32・repository 43）・engine 519。
  **コミット時の事故 2 件（復旧済み・メモリ記録済み）**: (1) `-m "..."` 内の
  バッククォート式が bash のコマンド置換に食われ、式が欠落したメッセージで
  コミット成立 → quoted here-doc（`-F - <<'MSG'`）で amend 修復（196e629 が正）。
  以後コミットメッセージは here-doc で渡す。(2) index 残渣 MM の 3 例目
  （worktree==HEAD・staged が整形変異）→ 対象限定 restore --staged で解消。
  **次 = 大粒度 #13**（D2a 9c8dbb3／D2b 4d864ed／SM-E 196e629 横断・
  Codex＋Opus 二重・cognitive-load モード A＋reuse sweep）。
  **大粒度 #13 走行中（Codex 返着 = pass・low 3・Opus 走行中）**: Codex 実測 =
  409 形の符号化 9（production owner 2・実行 spec fixture 6・compile-only 1）・
  権限 5 判定サイト全て fail-closed（roll handler のみ U13 の意図的 open）・
  baseline owner は state 1 箇所・editor 累積 120→259 行だが最深ネスト 3 不変・
  server focused 159（custom-id 32/hub-panel 7/repository 43/operation 77・
  既知 L-2 の赤は今回 0）。low = (1) builder の status 分岐が第 3 値に fail-open →
  `!== 'actions'` 化 (2) ConflictPanelState の raw payload 併存 → currentRevision のみ
  保持へ縮約（9→8 概念） (3) server⇔契約 conformance 不在は B-5 継続管理。
  **大粒度 #13 突合完了（big13-integration.md）・B13-FIX 発行済み・走行中**:
  Opus = pass・medium 1・low 8（独立実測申告あり）。独立収束 = builder status の
  fail-open → `!== 'actions'` 化。**Opus 単独 medium F1 採用** = 競合パネルが
  非競合エラー（422/500）で消える（probe 実証・spec 0 件）→ panel clear を
  mergeConflict 系経路に限定（裁定根拠 = SM-15 が Modal を不採用にした理由そのもの）。
  他の採用 = ConflictPanelState 縮約・SheetActionData を ReturnType 化・
  汎用文言 1 本化（owner = sheet-edit.ts）・死に文言 error:null 化・
  server MergeConflictPayload を契約型再利用へ（Opus F6 — Codex の
  「次回変更時 conformance」案より強く安い。B-5 の inner 要素 drift 窓を型結合で閉鎖）。
  記録のみ = 権限拒否文言 2 種は意図的（台帳 §2-3 追記済み）・所有者 1 行述語は
  統合しない・front の parts 付き競合 spec 0 件（起票）。
  **B13-FIX 完了・コミット済み（f188370・2026-08-12）→ 大粒度 #13 クローズ**:
  8 項目全消化を Fable 実査（+33/−25・panel 生存規則の red-green あり）。
  独立ゲート = front 335（334＋1）・契約 22・projection 32・engine 519・
  server focused 159。台帳 B-5 行を「inner 要素は型結合済み・外側 envelope は
  複製のまま」へ更新。
  **次 = キュー #11 残の設計**: SM-F（SM-1 proof 原子性・4 不変条件・単一プロトコル）
  → SM-8（保存失敗の 5 要素）→ SM-14（データ 4 状態）。次の大粒度 #14 は
  この 3 スライス後（cadence 継続）。
  **SM-F はブロックと裁定（2026-08-12・台帳 §5-2 L-2 行と #11 行へ記録済み）**:
  proof/nonce は契約・production とも完全未実装を実測（grep 全域 0・dice preview の
  wire は total/details のみ）・消費者 = ウィザード roll step UI も未構築。
  作成時ロールの在り方は L-2 裁定（a/b/c）そのものなので、先行実装は死んだ抽象＋
  裁定先取りの二重違反 → キューから外しユーザー決定待ちへ。
  **SM-8a 委譲済み・走行中（prompt-sm-8a.md）**: シート保存経路への 5 要素適用
  （分類 = response なし/429/5xx → retryable・422 → 恒久・409 は既存競合フロー不変／
  「保存されていません」バナー／手動再試行は最新 dirty 送信／single-flight は
  既存 isPending 機構の pin）。自動 backoff 系は延期列で導入禁止。
  エディタ autosave への適用は別スライス（SM-8b）。
  **SM-8a 返着・Fable 実査＋独立ゲートまで完了**: +192/−11・分類は
  status undefined（ネットワーク断）/429/5xx → retryable・
  saveChanges 冒頭の isPending ガード・バナー条件 =
  changes.length > 0 かつ（actionData.error または conflictPanel）。
  独立ゲート = front 346（335＋11）・eslint 0。
  **Opus レビュー = needs-fix（high 1・medium 3・low 2・証跡 =
  opus-review-sm-8a.md）→ R2 委譲済み・走行中**: high = ブラウザ→Next 断
  （fetch reject）で transition 未捕捉 → エディタ unmount → dirty 全消失
  （retryable 分類は server 間 axios 失敗しか扱えていなかった）。
  **Fable 突合で処方箋の穴を検出**: 素朴な try/catch は成功 redirect
  （promise reject で届く — D2b レビュー確定）まで握るため、
  unstable_rethrow / redirect 再 throw を R2 で必須化＋成功時 regression spec。
  他 = 再試行の空 changes ガード・バナー dirty clause 未カバー・
  single-flight spec 2 件の空振り是正・生 ECONNREFUSED 文字列の定型文化。
  F6（Alert 2 枚）は役割分離で現状維持と裁定。
  **SM-8a R2 返着・検収済み・コミット = `06bc38e`（2026-08-12）**: 6 項目全消化を
  Fable 実査で確認 — catch 先頭 `unstable_rethrow` の redirect 透過は
  digest 付き実エラーを Error Boundary まで届かせる regression spec で pin・
  ネットワーク定型文は sheet-edit.ts の 1 定義（production 2 参照）・
  再試行 disabled＝空 changes・single-flight は form 直 submit でガード直撃・
  role ベース枚数 assert 復旧。独立ゲート = 対象 2 suite 32/32・eslint 0。
  **既存障害の発見と修復 = `a03f607`**: front 全体実行で TemplateEditorV3 の
  大型テスト（単独 3218ms・suite 実行時 5246ms 実測）が既定 timeout 5000ms を
  超えて赤化＋次テストが cleanup 連鎖で巻き添え（4 回再現・SM-8a の import
  グラフと交差しない = コード変更なしの環境負荷起因）。個別 timeout 15000ms を
  Opus 委譲で付与し、front 全体 20/20 suites・350/350 tests に復帰。
  **次 = SM-14（データ 4 状態・design-v1-ui.md:481-485）**。その後 SM-8b
  （エディタ autosave への 5 要素適用）→ キュー #12 U16。大粒度 #14 は
  #13 から 3 スライス後（SM-8a が 1 本目）。
  **SM-14a 委譲済み・走行中（prompt-sm-14a.md）**: character レーン 2 route の
  loading.tsx（skeleton）＋error.tsx（定型文＋reset() 再試行・生 error.message
  非露出）新設と、getCharacterListData の畳み込み解消
  （Fable 実測: API 失敗が空一覧＋isAuthenticated:false に畳まれ page が error を
  捨てる = :485 の 1 セル畳み込み違反。裁定 = JWT なし/401/403 は未認証 soft degrade
  セル維持・その他は re-throw で取得失敗セルへ分離。既存 spec :64 の旧 app 契約 pin は
  置き換え）。SM-10 の空 CTA・templates レーン・404 notFound 化は out-of-scope。
  **SM-14a 返着・検収・コミット = `813beb1`（2026-08-12）**: +180/−6・逸脱なし。
  loading/error 各 2 route 新設・getCharacterListData は 401/403 のみ soft degrade で
  他は re-throw・生 error.message 非露出と reset 呼び出しを spec 7 件で固定。
  独立ゲート = front 全体 22/22 suites・357/357 tests・eslint 0。
  **小粒度レビュー（Opus read-only）= needs-fix（証跡 = opus-review-sm-14a.md）**:
  変異検証 5 種全 kill・不変条件全充足だが high 2。
  **F-1 = reset() は Next 16 では再 fetch せず手動再試行が空振り**（Fable が
  error-boundary.js:16-25/:87-91 を実読で裏取り — errorComponent には reset と別に
  retry〔refresh＋reset〕が渡されている）→ retry へ配線替え。
  **F-2 = backend 全断のハードロードでは /user layout の getAuthState が全例外を
  握って /login へ redirect し取得失敗セルに到達しない**（soft nav では機能する。
  公開ページの soft degrade と共存設計が要るため独立スライス SM-14c へ分離）。
  F-4（sheet の 401/403 誤誘導。requireJwt は cookie 存在チェックのみ = 期限切れの
  通常経路、を Fable 追加実測）・F-3 最小（refreshCharacterList の生文字列）・
  F-5（dead field 削除）・認知負荷 1a/1b（error セル共有化＋定数 co-locate）を採用、
  F-6 は却下。**SM-14a-FIX 返着・検収・コミット = `8afae4e`**: 5 項目全消化
  （retry 配線＋retry1/reset0 の spec pin・共有セル CharacterDataLoadError 新設＋
  定数 co-locate・sheet 401/403 → /login・refreshCharacterList 定型文化・
  dead field 削除）。独立ゲート = front 22/22 suites・361/361 tests（+4）・eslint 0。
  **次 = SM-14c（F-2 消化・3 本目のスライス）**: getAuthState は throw せず
  degraded フラグ返却（cache() が全消費者に同一結果を配るため throw は公開面の
  soft degrade を壊す）・/user layout のみフラグで throw・root app/error.tsx
  （共有セル再利用）で受ける。auth-state spec :61 の「throw せず logged-out」pin は
  分類形へ置き換え。その後大粒度 #14（SM-8a・SM-14a+FIX・SM-14c 横断）→
  SM-14b（templates レーン）→ SM-8b → キュー #12 U16。
  **SM-14c 返着・検収・コミット = `1f4d47d`**: 裁定どおり degradedByInfraFailure
  フラグ方式・/user layout のみ throw・root app/error.tsx 新設・共有セルを
  app/components/DataLoadError へ移設 rename（文言 SHA-256 一致）・
  auth-state 旧 pin を分類形 6 spec へ置き換え＋layout 分岐 3 spec＋root smoke 1。
  独立ゲート = front 24/24 suites・368/368 tests（+7）・eslint 0（AI.md の
  設定対象外 warning のみ）・typecheck 緑。AI.md の AuthState 契約も実装者が更新。
  **大粒度 #14 二重レビュー = 返着・突合済み（big14-integration.md が正本）**:
  Codex M3/L1・Opus H1/M5/L4。独立収束 = 401/403 述語と join helper の
  1 本化はどちらも No-Go（現状維持で確定）・discord 露出・定数名 drift・
  root loading セル。**最重要 = Opus O-F1[high]: 競合パネル表示中の保存が
  未解決競合 path を同梱し server 原子的判定で必ず 409 → SM-15「他 path の
  編集・保存は継続可」が実効していない**（payload 実測）。C-M1=O-F2
  （fail-back の旧パネル残存・寿命不統一 → 両経路とも破棄で統一）・O-F3
  （3 点同時成立の pin）・O-F4（baseRevision は server で情報値・判定は
  per-path CAS → コメント＋台帳）・O-F6+O-F7（一覧 401/403 の redirect 化と
  到達不能 soft degrade 分岐の削除 = 純減）・C-M2（app/loading.tsx）を採用。
  O-F8（枠差 = Next 構造制約）・O-F9（GET への 422 分類 = YAGNI）は却下。
  **BIG14-FIX-A = 検収・コミット `1013a7a`**: 競合 path の保存時除外
  （fieldUid＋partsKey 組・payload assert つき）・fail-back 両経路の旧パネル破棄
  統一・3 点同時成立 pin・per-path CAS コメント。非競合エラーでパネルを
  消さない規則は不変。独立ゲート = front 24/24 suites・372/372 tests（+4）・
  eslint 0。**BIG14-FIX-B = 検収・コミット `01cd3df` → 大粒度 #14 完全クローズ**:
  discord guard 2 箇所・一覧 401/403 redirect 化＋到達不能 soft degrade 分岐と
  isAuthenticated/英語ブロック削除（AI.md の旧例外規約も削除）・
  GENERIC_NETWORK_ERROR_MESSAGE へ rename（置き場は指示の sheet-edit 維持でなく
  api-response.util へ co-locate — discord が消費者に加わり越境 import を避ける
  実装者判断を Fable が採用）・app/loading.tsx。独立ゲート = front 26/26 suites・
  374/374 tests（+2）・eslint 0。台帳 #11 行に #14 の確定事項
  （1 本化 No-Go・per-path CAS・却下理由）を反映済み。
  **SM-14b = 検収・コミット `556fa1f` → SM-14 クローズ**: loading/error
  4 ファイル・getTemplateListData 分類化（401/403 redirect・error フィールド
  廃止・TemplateListV3 の server error prop 削除）・エディタ page 401/403・
  templates actions 5 sink（createTemplate/importV2Template/deleteTemplate/
  createCharacter/saveTemplateDraft）の network guard。独立ゲート =
  front 29/29 suites・388/388 tests（+14）・eslint 0。diff 352 行（spec 3 本分の
  超過・申告済み）。**次 = SM-8b（エディタ autosave への 5 要素適用・
  キュー #11 の最終着手可能スライス）→ キュー #12 U16**。
  大粒度 #15 は #14 から 3 スライス後（SM-14b が 1 本目）。
  **SM-8b 委譲済み・走行中（prompt-sm-8b.md）**: Fable 事前実測で
  **現行 autosave は失敗時に dirty へ戻し debounce effect が同一内容を
  再スケジュール = server 断が続くと無限自動再試行ループ**（SM-8 延期列
  「無限自動再試行は実装しない」違反の既存挙動）を発見。中核 = ループ停止
  （失敗時 signature 比較で同一内容の自動再送を抑止・編集再開で autosave 復帰）＋
  retryable 分類＋手動再試行＋catch 分岐のハードコード文言を
  GENERIC_NETWORK_ERROR_MESSAGE へ一本化。conflict/publish/成功経路の
  signature 突合は不変条件。
  **SM-8b = 検収・コミット `a6acf46` → キュー #11 の着手可能分クローズ**
  （残 = SM-F の L-2 裁定待ちのみ）。Codex 実装＋Fable 差し戻し 2 巡
  （①失敗中バナーが「autosave 待機中」と偽る → 失敗文言へ分岐・
  ②422 で存在しない再試行ボタンに言及 → 恒久側文言へ分岐）＋
  最終追補（messages 空配列の実在経路 — body {message:''} で split→filter が
  空を返すことを実 extract 実装で証明 — を定型文フォールバックで閉鎖）。
  負の対照 4 本。独立ゲート = front 29/29 suites・398/398 tests（+10）・
  eslint 0・typecheck 緑。
  **次 = キュー #12 U16（シート公開設定）の第 1 スライス設計**。
  大粒度 #15 は U16 第 1 スライス後（SM-14b・SM-8b・U16-1 の 3 本）。
  **U16 スライス分割を確定・U16-a 委譲済み・走行中（prompt-u16-a.md）**:
  a = 語彙導入（契約 characterSheetStateSchema へ required 追加・server 型正本・
  read 境界 normalizer 専用 1 関数を repository normalize 合成点 2 箇所へ・
  materializer/materializeOrThrow の明示コピー素通し・新規作成 private 固定・
  fixture 追随）→ b = summary read model（select+inline mapper+DTO/Wire+
  runtimeKeys の 4 点セット）→ c = 保存専用操作（enum DTO・422・所有者単項更新）→
  d = renderer（トグル＋注記・一覧バッジ・編集導線）。
  事前実測は Explore 委譲（characterSheetStateSchema:27-34 の .strict() 4 項目・
  normalizeCharacter(s):35-47 が summaries 以外の全経路を被覆・
  sheet-materializer:73-79 と operation:585-594 の 4 キー再構築・
  summaries は独立 mapper で別スライス・DiscordProjectionInput は
  visibility 非受領を型で確認）。required 化裁定の理由 = optional だと
  front まで undefined が漏れる（cross-package runtime 盲点メモリと同根）。
  **U16-a = 検収・コミット `c51b1fa`**: 23 ファイル 233 行・逸脱なし。
  独立ゲート = contract 25/25・server build＋circular 0・server focused
  149/152（赤 3 = 未変更 L-2 再現 spec の意図的赤のみと確認）・front 398/398。
  コミットは長コマンド EOF 破損を pathspec-from-file 方式で回避（メモリ追記済み）。
  **大粒度 #15（SM-14b・SM-8b・U16-a 横断）二重レビュー = 済（2026-08-12）**:
  Codex needs-fix（High 0/Medium 4）× Opus（blocking 1/high 2）・相互矛盾なし・
  主要 3 所見は独立収束。突合 = big15-integration.md。採用所見と消化順 =
  **FIX-0 = 済（6eefb3e）**（blocking F-1: U16-a が wire 契約 spec を赤で残置 — fixture
  visibility 欠落。Fable 再実行で赤確認 = focused 検収の見逃し・メモリ
  verify-full-suite-before-merge に 3 例目として記録。契約変更スライスの server 検収は
  全 suite 必須へ。検収 = server 222 suites 中 221 緑・赤 3 = L-2 のみを Fable 再実行）→
  **FIX-B = 済（d5e1ac7）**（両者収束: 空 messages 抽出で 8 sink 沈黙・saveSheet は
  Alert/再試行/バナー 3 点消失。sink 単位フォールバック・helper 化 No-Go 維持・
  status/retryable 分類不変・実 extractor を通す spec 8 本追加 398→406。
  検収 = front 29/406 全緑＋eslint 0 を Fable 再実行）→
  **FIX-A/A2 = 済（230a263）**（エディタ失敗状態機械の統合: F-2 署名基底不一致で
  無限再試行停止が非正規化 draft で無効〔高〕・C-3 未定義遷移 2・F-5 undo 行き止まり・
  F-6 conflict 黙殺・F-7 Alert 残留。failedSignatureRef/saveFailed/retryableIntent/
  actionMessages の 4 箇所 → 単一 SaveFailure union＋正規化 payload 基底署名の一致導出へ
  〔旧記録 L1466 等の actionMessages/failedSignatureRef 記載はこのコミットで置換済み〕。
  小粒度レビュー = blocking/high 無し・F-2 spec と成功経路 spec は変異実測で検出力確認・
  認知負荷純減 5→2。A2 裁定 = conflict 中の再試行ボタン非表示＋成功経路署名 spec 追加。
  検収 = front 29/410 全緑＋eslint 0 を Fable 再実行）→
  **FIX-C/C2 = 済（8d6e907）→ 大粒度 #15 クローズ（2026-08-12）**（C-1/F-4 publish
  部分成功境界 = 偽 409 解消〔update 成功時は常に更新済み template を返す部分成功 outcome・
  409 conflict フロー不変・跨ぎ契約は両端コメント〕・C-2 submitDraft の ref 同期
  single-flight＋両ボタン in-flight 無効化。小粒度レビュー = blocking 無し・
  single-flight/偽 409/intent 伝播とも変異実証済み・C2 で intent 伝播 spec 復元＋
  等価変異解消。検収 = front 29/416 全緑＋eslint 0 を Fable 再実行。
  記録のみ = F-4 編集レース中の publish 失敗は表示寿命 0〔内容アドレス表示の帰結〕・
  F-5 retryable 述語重複は #14 裁定面。証跡 = big15-integration.md）。
  F-8（sheet.visibility 無名 union×3・mapper 述語の型ゲート欠如）= U16-c へ折込。
  **U16-b = 済（a5dc046・2026-08-12）**: summary read model へ visibility（required・
  sheet 欠落 legacy も fail-closed で private・値関数 1 定義共有で述語複製 2→1・
  contract 25/25＋server build/circular＋server 全 suite 赤 3=L-2 のみ＋front 29/416＋
  eslint 0 を Fable 再実行。実 DB 統合 spec の追随は Docker ゲート持ち・通常 suite 対象外。
  コミット時に pre-commit formatter が import を再整形し index に stale 残滓 → restore --staged で解消）。
  **U16-c = 済（e4b0811・2026-08-12）**: 保存専用操作＋F-8 語彙命名（詳細 = 台帳 #12 行。
  検収 = contract 26/26・build/circular 0・server 全 suite 赤 3=L-2 のみ 3117 緑・
  front 29/416・eslint 0〔front 全体＋server 変更ファイル scoped〕を Fable 再実行。
  実 DB 統合 spec は Docker 停止中で未実行 = Docker ゲート持ち。
  formatter の index 残滓 MM 2 件を restore --staged で解消 — U16-b と同型・2 回目）。
  **U16-d = 済（3a70c84・2026-08-12）→ キュー #12 の実装スライス全完了**: renderer
  （公開トグル独立 component・一覧バッジ・編集導線の全行化。シート編集クライアント不変を
  diff 検収。**fix1 で退行差し戻し** = 指示書「Discord ActionIcon は hub ガード内のまま」が
  Explore 要約未検証の誤前提〔HEAD は無条件表示〕で、実装がガード内へ移動＋spec が退行を
  pin していた — verify-claims-before-prescribing 21 へ記録。
  検収 = front 31/434 全緑＋eslint 0 を Fable 再実行）。
  **大粒度 #16 = 済（2026-08-12）→ キュー #12（U16 シート公開設定）クローズ**:
  二重レビュー（Codex needs-fix medium 2／Opus blocking なし・相互矛盾 0・
  横断不変条件〔fail-closed 全 read 経路・公開 GET 認可・404 統一・revision 不変・
  Discord 非連動・EditClient 不変〕は両者実測で全項 ✓）。採用 5 項目 =
  FIX-BIG16（6ee13e0: front label/color 単一 Record 化＋導出・server 422 文言の
  schema.options 生成〔バイト同一〕・summaries/配列 read 経路の raw 未知値 spec 2 本・
  Tooltip touch/focus・filter why コメント。変異検収は実装者と Fable が独立実測 =
  負の対照 51/51 緑→MX1 で新 spec 1 本のみ赤→summary 迂回で table 2 件のみ赤）＋
  FIX-LINT（b2b3514: SM-G 由来 lint error 3 件を受理/拒否 2 系分割で解消・
  検証内容不変・server lint error 0 復帰）。不採用 = route 面 pin spec
  （台帳 §2-2 B-20 へ規約登録）。突合 = big16-integration.md。
  検収 = contract 26/26・server build/circular 0・全 suite 3120 緑（赤 3=L-2 のみ・
  新 spec 3 本含む）・front 31/434・eslint 0 を Fable 再実行。
  コミット時 formatter MM 残渣（character.service.ts・3 回目）→ restore --staged で解消。
  **キュー #9（U14）残工程の Explore 実測 = 済（2026-08-12・台帳 #9 行へ記録）**:
  工程 7 段中 6 段は実装済み（schema・publish H-9・renderer 3 プリセット〔consumer 0 の
  島〕・検証警告表示・canonical 正規化 H-15〔front 保存経路のみ・server は layout 0〕・
  fixture 7 ケース）。残 = 9-S8 エディタ UI のみで D-R1 裁定待ち（:1728 の停止裁定どおり）、
  renderer 配線と完了宣言は D-R2 待ち。
  **【ループ停止 2026-08-12】キュー #9〜#12 のうちユーザー裁定不要の作業を完遂**:
  #12 = クローズ（大粒度 #16 済）・#11 = SM-F（L-2 待ち）以外クローズ・
  #10 = 配線（D-R2）とタブ化（D-R1）以外クローズ・#9 = S8（D-R1）と配線（D-R2）のみ残。
  再開はユーザーの D-R1／D-R2／L-2 裁定から（§5-2）。未 push 76 コミット（push は
  タスク範囲外・ユーザー判断）。
  **【ループ再開 2026-08-12】D-R1 = 統合・D-R2 = 配線をユーザーが裁定**（条件形
  「TFR が今回実装なら統合/配線・旧物なら上書き」→ 事実解決 = TFR はキュー #9 S4〜S7 の
  新規実装 ae9345a7 → 両方採用。台帳 §5-2 の両行へ記録済み）。L-2 は未裁定のまま。
  **スライス列 = D-R1a（TemplatePreviewV3 の挙動差 7 点 characterization spec・
  production 不変）→ D-R1b（preview の入力描画を TemplateFormRenderer へ委譲する
  wrapper 化＋AI.md 有向辺 characterTemplate→characterSheet＋eslint 同期）→
  9-S8（エディタ layout 入力 UI・**ST-B2 同乗判定を着手前に行う** = 更新ヘルパ群を
  触るなら台帳 #17 の前提 3 点とセット）→ 右ペインタブ化 → D-R2 配線
  （接続時条件 4 点・regression）→ U14/U15 完了宣言 → 大粒度 #17（3 スライス毎）**。
  D-R1a を委譲起動済み。
  **D-R1a = 済（de4be 相当・characterization 11 tests・front 445）→
  D-R1b = 済（5048257・2026-08-12）**: preview の field widget を TFR へ委譲
  （scalar フル実装 2→1・repo 全体 3→2 = EditClient 部分実装は D-R2 まで残存）。
  TFR 拡張は renderField override 1 本のみ（roll 専用に縮小・computed は
  entity 生 formula のデータ加工＋Error 値供給で既定描画）。
  AI.md 4 本目の辺＋eslint 同期。小粒度レビュー（Opus）high 2/medium 5 を
  fix で消化 — H1 式表示の正規化変質（生 formula へ復帰＋参照つき pin）・
  H2 clear 乖離の表示 pin 復元（挙動は 15b(d) 整合で維持）・M4 override 縮小・
  M1 roll 成功 pin（overlay 順序の変異実証）・M2 死にガード整理。
  起票 = CSS mock 3 複製（jest config 化・低優先）・h2 二重表示（S8/タブ化で整理）・
  labelledBy 契約と characterSheet 移設代替（D-R2 配線時に裁定 = 台帳 D-R2 行 (e)(f)）。
  証跡 = opus-review-dr1b.md。検収 = front 32/447・eslint 0・tsc 0 を Fable 再実行。
  **運用変更（2026-08-12・コミット 59e667d）**: コード委譲へ code-comment-rules 準拠の
  コメント記載を必須化（fable-rules 正本・§6-3・メモリ登録済み）。D-R1b で初適用。
  **9-S8-pre = 済（deb8097・ST-B2 発動）**: 事前実測で「S8 は呼び出し側の再構築式を
  5→7 に増やす」と判明し同乗既定を発動。更新ヘルパ 5 本を produce カリー形へ
  （挙動不変・再構築式 5→0・キャスト解消・凍結 pin = 台帳 B-21 を機械固定）。
  **9-S8 = 済（47aacd4・2026-08-13）→ U14 の実装工程は全完了（残 = 配線と完了宣言）**:
  preset/columns/span の Select UI（grid のみ columns/span・未設定は property 削除・
  mount 時既定書込なし = fixture pin が機械ガード）。着手監査で指示書の受入矛盾
  （span クリアの payload 期待 vs normalizer 具現化）を実装者が停止検出 → 裁定修正。
  小粒度レビュー F1 = span 選択肢の正本乖離（columns 連動を読まず固定 4 択を指示 —
  verify-claims 18b に記録）を fix で消化・F2/F3（Mantine 暗黙 deselect の破壊経路閉鎖・
  legacy columns 引き継ぎ pin）・F4 消化。F5/F6 は許容範囲裁定で見送り。
  変異 8 種＋負の対照で pin 固定力実証。front 448→456。
  記録 = 並走負荷時の既存 pools spec flake 1 回（逐次で再現せず・負荷敏感性は別枠）・
  AI.md への U14 layout 記述は feature 完了時に反映。
  **TAB-1（右ペインタブ化）= 済（1b0ac9e・2026-08-13）**: 右ペインを controlled Tabs 2 枚へ
  （検証はタブに集約 = 正本 S2' 行充足。Discord プレビュータブは台帳 #18 起票の後続）。
  検証実行で自動切替・成功時肯定表示・未実行案内。小粒度レビュー high 2 消化 =
  実装者拡張「保存失敗時も自動切替」を撤去し保存失敗詳細＋再試行を全幅「保存エラー」
  Alert へ分離（SM-8 ⑤ 常時性を回復・変異で新 pin＋既存 3 本の赤を実証）。
  タブ内赤 Alert は「検証エラー」へ改名（spec 12 行追随）。front 456→460。
  レビュー実測の重要知見 = Mantine Tabs は keepMounted 既定 true —
  getByText はタブ状態非依存・タブ切替の検出は selected 状態の pin のみが担う。
  **次 = D-R2 配線（TemplateFormRenderer を CharacterSheetEditClient のシート編集面へ
  controlled renderer として接続。接続時条件 4 点＝immutable values・参照安定・
  annotation 評価計量・UNSAFE 濾過整理＋台帳 D-R2 行 (e) characterSheet 移設 vs
  5 本目の辺・(f) labelledBy 契約・(g) h2 二重表示 の裁定）→ U14/U15 feature 完了
  （SESSION_HANDOFF 全面更新＋trpg-next-app/AI.md へ U14 layout 記述＋大粒度 #17）**。
  **D-R2 S0 裁定 = 済（2026-08-13・正本 = 台帳 D-R2 行・事前実測 =
  review-results/impl-u14/dr2-premeasure.md）**: (e) 辺方式維持（app/components は
  zone 無し = fail-open・移設は機械固定の放棄）・(f) labelledBy 拡張不要
  （EditClient は override 不使用）・(g) TFR headingLevel prop（既定 2・block +1）・
  F2/F3 は現状維持・annotation 計量合格基準 = 式 1 本 ≤10,000 step。
  台帳 D-R2 行の eslint 記載の向き（except の追記先 = character zone が正）を訂正済み。
  **配線スライス = S1（TFR 内部: UNSAFE 濾過共有述語化＋headingLevel。EditClient 不変）→
  S2（annotation step bench・S1 並行可）→ S3+S4（境界配線＋scalar TFR 差し替え・
  toSheetTemplate useMemo・25 pin assert 不変）→ S5（parts 配線＋sheet-edit.ts:46
  partsKeys 拡張 = H3 残債）→ S6（後片付け・完了宣言＋大粒度 #17）**。
  記録 = page.tsx の template fetch は templateVersion 無視（SM-16 front ギャップ）・
  TFR 'use client' 無し（S6 検討）。
  **S1（TFR 内部整理）= 実装済み・Fable 検収通過（2026-08-13・未コミット）**:
  isPresentablePartsKey 1 本へ 3 サイト統一（reserved＋UNSAFE・自由モードの base/other
  専用行は不変）＋headingLevel prop（既定 2・block +1）。front 462 全緑・eslint/tsc 0。
  Fable 独立変異 2 種（UNSAFE 除外除去→2 pin 赤・h2 固定→heading pin 赤）＋負の対照緑。
  **S2（annotation step bench）= 実装済み・Fable 検収通過（Opus 委譲・未コミット）**:
  scripts/annotation-bench.ts＋bench:annotation。ベンチは Fable 再実行で byte 一致再現・
  engine 519 全緑。**重要所見 = case 3 予算超過**: 静的予算満杯 template ＋ 256 node 注釈式で
  実 step 10,255 > 独立予算 10,000（publish は注釈式を静的見積もりに加算しない設計のため
  構造的に超えうる・超過時は evaluateConstraint が error へ fail-safe 退化・hang なし・
  最悪 ~4.4ms/回で打鍵毎再評価も予算内）。レビューで反証確認中 → 妥当なら台帳へ記録。
  **S2 起動の教訓**: codex_run.sh は同一 tree に writer 1 本のロック（並行 code 委譲不可）
  → S2 は Opus サブエージェントへ切替えて並行維持。
  **S5 スコープ精緻化**: S4 は sheet-edit.ts 不変・onPartsChange は 'base' のみ
  （現行パリティ）。select/boolean の永続化＋宣言 partsKeys 書込は S5 へ
  （S4 の select/boolean は「表示されるが永続しない」暫定 — 完了宣言前に S5 で解消）。
  S3+S4 指示書 = prompt-dr2-s3s4-code.txt 作成済み・S1/S2 レビュー消化＋コミット後に起動。
  **S1 = コミット済み（9fe49e56）・S2 = コミット済み（e15db47a）**。合同レビュー pass
  （needs-fix 0・case 3 は「裁定材料として妥当」で確定 → 台帳 D-R2 行に裁定枠を記録済み
  = error 退化の仕様確定 vs publish 上限設計変更・完了宣言には非ブロック）。
  **S3+S4（境界配線＋EditClient の TFR 差し替え）= 実装済み・Fable 検収通過
  （2026-08-13・未コミット・二重レビュー走行中）**: eslint character zone except＋AI.md 辺⑤・
  rendererValues overlay（parts shape 保持で base のみ差し替え）・onChange は編集可能
  非 parts number/text ガード・onPartsChange は 'base' のみ・headingLevel={3}・
  sheet-edit.ts と状態機械 diff 0・既存 25 pin 無適応で全緑・新規 pin 3。
  front 465 全緑・eslint/tsc 0・境界負検証（except 除去→error・復元→0 を Fable 独立実測）・
  変異（overlay 平坦化→pin (a) 赤）＋負の対照緑を Fable 独立実測。
  **検収時の注視点（レビューへ委譲済み）**: 宣言 partsKeys field の base:undefined 注入の
  表示影響と、宣言 field base 編集→whole-field write（H3 経路の現行パリティ）の退行判定。
  **S3+S4 二重レビュー = 両者 needs-fix・突合済み（dr2-s3s4-integration.md）**:
  採用 3 点を FIX-S3S4 で消化中 — F1 overlay の undefined 注入停止（宣言 partsKeys の
  Σ 表示を S4 内で修復・両レビュー一致で S5 送り不可）・F2 検出器の穴 2 つ
  （宣言キー入力→changes 0 pin＝partsKey ガードの門番・pin(b) fixture true 化＝raw 基底
  喪失検出）・F3 コメント事実修正（H3 隠蔽の解消＋述語 3 者同期注記）。
  観点 3(b) は両者一致 = 書込は旧 UI と同一の H3 経路（悪化なし・S5 送り妥当）。
  記録 4 点は台帳 D-R2 行へ反映済み（table 宣言 field 編集不能の暫定・
  **2 平面構造の裁定枠 = S5 着手前に raw 一本化 vs overlay 恒久化**・
  hasInvalidNumber 死条件化・その他）。
  見かけ矛盾 1 件（Opus M3 赤 vs Codex 変異緑）は変異体の違いで両立と判定
  （crash 検出 vs 意味論素通り — pin 増強は Opus 案を採用）。
  **FIX-S3S4 = 済・Fable 検収通過 → S3+S4 クローズ（2026-08-13）**:
  F1 undefined 素通し（宣言 partsKeys の Σ/base 表示修復・pin 2 本）・F2 検出器増強
  （宣言キー入力→changes 0 の H3 門番 pin・pin(b) fixture true 化）・F3 コメント事実化。
  front 468 全緑・eslint/tsc 0・Fable 独立変異 = (a) 無条件注入戻し→2 pin 赤・
  (b) partsKey ガード除去→門番 pin 赤・負の対照 31/31 緑
  （※(b) 初回は sed 失敗で変異未適用のまま緑 = 無効実測。python 適用で正しく赤 —
  変異は適用確認とセットでないと偽緑になる教訓）。
  **次 = S5 設計（着手前に 2 平面裁定: raw 一本化 vs overlay 恒久化 — 事前実測つき）→
  S6（後片付け・U14/U15 完了宣言＋大粒度 #17）**。
  **S5 事前実測＋裁定 = 済（2026-08-13・dr2-s5-premeasure.md・台帳 D-R2 行反映済み）**:
  (B) raw 一本化採用・DTO baseValue optional 化・競合 echo current ?? null・
  deselect v1 非提供。server は宣言 partsKey per-path を既に受理（SM-G）で
  障壁は HTTP 境界 2 点のみと実測確定。分割 = S5a（server/契約）→
  S5b1（raw 一本化 refactor・31 pin 無改変緑）→ S5b2（per-path＋select/boolean・
  pin 反転 :606/:625）。
  **S5a = 済・コミット 37ea6e2（2026-08-13）**: baseValue optional＋競合 echo null。
  レビュー needs-fix 1 = 負方向 pin（既存値＋省略＋異 newValue → 409）を Opus fix で消化 —
  「省略を適用条件へ誤追加」変異は既存 79 pin 全盲目・新 4 pin のみ検出
  （実装者/Fable 独立実測）。記録 = S5b2 は競合 current:null の undefined 復号維持＋
  mine 再送 pin 必須（台帳反映済み）。dto.spec に formatter MM 残渣 4 回目 →
  git diff HEAD 空で restore --staged（既知処方）。
  **S5b1 = 実装済み・Fable 検収通過・二重レビュー走行中**: raw 一本化
  （overlay/EditorValue 並行 state/hasInvalidNumber 削除・path helper 2 本＋
  server 同期注記）。31 pin 無改変緑・front 468 全緑。実装者の正直報告 =
  正規化除去の変異が全緑で生存（非 pin 残差・指示どおり pin 未追加・S5b2 設計材料）。
  Fable 起票 = front writeSheetPathValue は flat number raw で server と異なり {} 起点
  （'base' 限定なら同結果・S5b2 の宣言キー再利用で base 消失）— 両レビューへ検証委譲済み。
  **S5b1 二重レビュー = 両者 needs-fix・突合済み（dr2-s5b1-integration.md）**:
  H1/F1 = 宣言 base 編集 payload の per-path 化（root cause = Fable 指示書の自己矛盾 —
  verify-claims 22 に記録）は**維持＋契約改訂で裁定**（旧 whole-field = H3 破壊の忠実再現は
  不合理・server 受理両者実測）。Codex H2 と Opus C3 の見かけ矛盾は測定面の違いで両立
  （機構 1 つ = annotation が退化 raw を直接見る）→ engine 意味論への統一として裁定・pin 化。
  Fable 起票は成立＋第 2 乖離（server {parts} 全置換 vs front 温存）まで検出 →
  S5b2 開始条件へ。FIX-S5B1 = pin 3 群（正規化表形式・宣言 base payload・Σ '0'）＋
  コメント事実化（同期コメントの誤誘導解消）を委譲中。
  **FIX-S5B1 = 済・Fable 検収通過 → S5b1 クローズ（2026-08-13）**: front 468→488
  （sheet-edit 純関数 pin 20 本＋EditClient 新 pin 2）・31 既存 pin 無改変・
  eslint/tsc 0。Fable 独立変異 = 正規化除去→6 赤（旧「468 全緑生存」の無防備領域が
  閉鎖されたことを実証）・partsKey 旧規則化→per-path pin 1 赤・負の対照 91/91 緑。
  **S5b2 は分割**: S5b2 = 宣言 partsKey の per-path 完成（H3 完全消化・conflictApply
  (uid,partsKey) 化・mine 再送 pin・flat 種付け裁定込み）→ S5b3 = select/boolean 永続化
  （型拡張の波及が別テーマのため分離）→ S6。
  **S5b2 済・FIX-S5B2 済・Fable 検収通過 → S5b2 クローズ（2026-08-13）**:
  Codex 実装（run-dr2-s5b2）= 4 ファイルのみ・:606 門番 pin 反転（裁定済み）＋新規 pin
  （flat 種付け・自由キー・宣言キー競合 theirs 兄弟温存・current:null theirs 削除・
  mine 再送 baseValue own キー欠落）。Fable 独立実測 = front 488→502 全緑・eslint/tsc 0・
  変異 3 種すべて指定検出器で赤・負の対照緑（証跡 = dr2-s5b2-acceptance.md）。
  **二重レビュー突合（dr2-s5b2-integration.md）**: 相互矛盾 1 件を Fable 実測で裁定
  （toEqual は own undefined と欠落を同一視 — Codex 正・Opus 観点 3 反証）。
  FIX-S5B2 = 削除 pin の toStrictEqual 化＋hasOwnProperty・宣言モード未宣言安全キー
  （legacy）遮断 pin・種付けケース一本化・同一 uid 複数 partsKey 競合の逐次合成 pin・
  server base:0 既定差コメント 1 行（挙動不変）。Fable 独立変異 = delete→undefined 代入
  2 赤/35・candidates 和集合化 2 赤/35・アキュムレート除去 1 赤/39・負の対照緑。
  台帳反映済み = F-2（isPresentablePartsKey 2 サイト重複 → S6 で 1 本化）・
  F-4（wire 表現不能な削除 change = 裁定枠）・F-6（table 宣言モード base 編集不能 = S6 判断材料）。
  コミット = d25749e2（code）＋87785412（docs）。
  **S5b3 実装完了・Fable 検収実測通過・二重レビュー実施中（2026-08-13）**:
  初回委譲は Codex が指示書の矛盾（列挙 pin 凍結と 4 種拡張の両立不能）を検出し停止 →
  例外指定（反転許可 = :69 系列挙 pin・:897 系 boolean pin の 2 本のみ・'checkbox'/computed
  除外は維持）を追記して再委譲（run-dr2-s5b3-r2）。依頼事故はメモリ
  verify-claims-before-prescribing 項目 23 に記録済み。
  実装 = 4 種 valueType 拡張・normalizeEditorValue 新設（F9 消化 = readSheetPathValue
  非 parts 分岐と readConflictCurrent の 2→1 純減）・boolean 表示チェックあり/なし・
  新文言。Fable 独立実測 = front 502→517 全緑・eslint/tsc 0・変異 3 種すべて指定検出器で
  赤（受理取り消し 6 赤/45・正規化素通し 8 赤/89・conflict 読取退行 2 赤/45）・
  負の対照 89/89・45/45 緑（証跡 = dr2-s5b3-acceptance.md）。
  **二重レビュー突合済み（dr2-s5b3-integration.md・blocking 0）**: 両者一致 =
  readConflictCurrent ゼロ判断 wrapper 削除。Codex = select 検出力（options 外通過 pin・
  select null mine 再送）。Opus = !field ガード pin 喪失（'checkbox' の TFR fallback 実経路）・
  server 非対称性コメント消失・select 競合表示の生値/label 不一致（FIX 10 で label 解決）。
  台帳訂正 = F9 は実装数 3→1 が正。台帳記録 = boolean 未設定 vs false の dirty 化
  （S6 判断材料）。**FIX-S5B3 済・Fable 検収通過 → S5b3 クローズ（2026-08-13）**:
  FIX 1〜10 全消化（select 検出力 pin 3 群・'checkbox' 契約 drift pin 復元・
  readConflictCurrent 削除・死条件縮約・Invariant コメント復帰・select 競合表示の
  label 解決）。Fable 独立実測 = front 517→523 全緑・eslint/tsc 0・変異 3 種すべて
  指定検出器で赤（options 検査追加 2 赤/95・ガード除去 1 赤/48・label 退行 1 赤/48）・
  負の対照緑（証跡 = dr2-s5b3-acceptance.md）。残差記録 = select 空文字 current の
  空表示（実害なし・acceptance doc 記載）。
  コミット = 5801c6c6（code）＋048a4655（docs）。
  **S6a クローズ（2026-08-13・コミット a511191b）**: 共有述語 1 本化
  （parts-key-visibility.ts 新設 — TFR export にしない理由 = 'use client' 付与で
  server 文脈からの非 component export 経路を作らないため）・table 宣言モード Σ セルの
  popover 統一（base 編集経路の復活 = F-6 裁定）・TemplatePreviewV3 headingLevel={3}・
  TFR 'use client'。Fable 独立実測 = front 523→528 全緑・eslint/tsc 0・変異すべて指定
  検出器で赤・負の対照緑（証跡 = dr2-s6a-acceptance.md）。
  **大粒度 #17 二重レビュー突合済み（2026-08-13・big17-integration.md）**:
  Codex blocking 5（完了不可）× Opus needs-fix 3＋info 4（条件付き可）を全件実読・実測で
  裁定。FIX 確定 = C-F1（TFR が制約評価 error を cap/pool/limit の 3 経路とも非表示・
  誤 pin 4 群）・C-F2（競合応答 base 無正規化 → JSON で own キー消失 → wire nonoptional
  違反を実測）・C-F3（editable 0 件で TFR 不描画 = design :117 違反）・O-F1（readPartValue
  flat base 欠落）・O-F2（table 宣言 popover 二重提示）・O-F3（競合パネル partsKey 無表示）。
  反転裁定 = C-F4 computed live は §3.6 Renderer 行に無し（記録へ）・C-F5 templateVersion
  badge はキャラページ（SM-13）スコープ = 既存裁定枠維持・§5-2 昇格。
  台帳記録待ち = O-F5 preview parts 無反応・O-F6 headingLevel 既定 2。
  **FIX-A/B 独立検収通過（2026-08-13・dr2-fixbig17-acceptance.md）**:
  FIX-B（server base ?? null＋JSON 往復 safeParse pin）= suite 210 緑（赤 3 = L-2
  allowlist のみ）・変異赤/復元緑。FIX-A（TFR 3 経路 status 契約化＋flat base＋
  excludedPartIds）= front 全 suite 534/534（528＋6）・eslint/tsc 0・変異 6 種
  すべて指定検出器で赤・負の対照緑。**合同小粒度レビュー（run-fix-big17-ab-review）と
  FIX-C（EditClient = O-F3＋C-F3・run-fix-big17-c）を並行委譲中**。
  **FIX-C 検収通過**（536/536・変異 3 種全赤〔見出し平坦化・条件付き描画復帰・
  label 解決除去〕・負の対照緑）。**合同レビュー pass**（blocking/needs-fix 0・nit 5 は
  FIX-AB2 で消化: constraint 語彙 rename・hasPartKey 死分岐除去・重複 pin 3 本を
  局所性/自由モード flat base pin へ転用・fixture 宣言キー 2 個化・server コメント
  role 分離。AB2 検収 = front 535/535・変異 6 種赤のまま再配分どおり・server 84/84）。
  **コミット済み = c9c72acf（FIX-A+AB2 front）・da908a48（FIX-B server）**。
  変異ハーネス書き戻しの EOL churn は内容差ゼロを確認して checkout 正規化。
  FIX-C の Opus レビューは**ユーザー停止**（結果未提出・作業キャンセル扱い）→
  キャンペーン既定の Codex review へ切替。結果 = needs-fix 2（いずれも pin 検出力:
  radiogroup accessible name＋独立解決検証の欠落・未宣言キー fallback 未検証）・
  実装本体は全観点 info で問題なし → **FIX-C2**（spec のみ・radiogroup 独立解決 pin＋
  自由モード 'custom' fallback pin）で消化。Fable 検収 = 52/52・front 全 536/536・
  変異 3 種（id 平坦化・label 平坦化・fallback 凍結）全赤・byte 同一復元。
  **【U14/U15 feature 完了（2026-08-13）】** コミット = c9c72acf（FIX-A+AB2 front）・
  da908a48（FIX-B server）・e4468ab6（FIX-C+C2 EditClient）・68957583（AI.md 設計正本）。
  完了宣言は §3.6 実装境界表基準・台帳 D-R2 行 big17 クローズと queue #9/#10 行に記録。
  post-FIX ゲート = front 536/536・server 3127/3130（赤 3 = L-2 allowlist のみ）・
  contract 27/27。検収証跡 = dr2-fixbig17-acceptance.md（変異計 13 種全赤）。
  残差（すべて記録済み・非ブロック）= D-R4（pinned 素引き・§5-2 ユーザー裁定候補）・
  computed live 表示裁定枠・preview parts popover 読み取り専用裁定枠・
  headingLevel 既定 2 据え置き・S2 ベンチ error 退化裁定枠。
  **次の候補（ユーザー帰還時の判断材料）**: キュー #12 U16 の残スライス続行／
  D-R4 ほか §5-2 裁定／push（未 push 100+ コミット・ユーザー判断）。
  **【ユーザー裁定ラウンド 2026-08-13】** L-2 = **(c) 常時ロール採用**・付帯 =
  **track 作成時ロールは廃止せず正式契約へ昇格**（起案 =
  track-roll-on-create-promotion-draft.md・契約形 A/B/C と順序が残決定点）。
  L-13 = **seeder 新設採用**（所有者指定はスライス設計時に提案）。D-R4 = **(a) pinned
  接続採用**。非ブロック裁定枠群 = **保留**（後でまとめて裁定）。
  **実装はすべて待機**（ユーザーの再開指示があるまで L-2/L-13/D-R4 スライスに着手しない）。
  **【追補】track 昇格の主要裁定も確定（同日）**: 契約形 A・範囲は全経路 advisory 化
  （正本 = track-roll-on-create-promotion-draft.md・現状調査の split-brain 実測込み）。
  **【再開 2026-08-13・ユーザー指示】** スライス順序は司令塔裁定:
  TR-1（L-2 (c) コア = roll 型常時ロール・track 契約外分岐は暫定温存・常時赤 3 件解消・
  Codex run-tr1）と D-R4 スライス（pinned 接続・Opus・事前実測 = GET /:id は user スコープ・
  pinned endpoint 不在・resolvePinnedRevision は published/deprecated 許可）を並行委譲中。
  後続 = TR-2（engine 契約 A＋drift 裁定）→ TR-3（正式契約読み置換＋422 撤廃）→
  TR-4a/4b（advisory 化＋split-brain 解消・± raw 基準）→ TR-5（front gauge）→
  TR-6（エディタ UI）。L-13 seeder は TR-1 検収後（同 package 並行回避）。
  3 スライス毎に大粒度レビュー（次 = #18）。
  **【進捗 2026-08-13 続報】** TR-1 = **コミット済み 736e5305**（レビュー pass 1 low →
  RollField 優先 pin は TR-3 へ同乗と裁定）。D-R4 = **コミット済み d2d0759**
  （レビュー pass Low 2 → FIX ラウンド消化: コメント作業番号除去＋encode pin 複合予約文字化。
  検収 = 変異 4 種赤＋FIX 後 D4 再変異赤・focused 11/11）。
  TR-2 = 実装完了・Fable 検収通過（engine 527/527・tsc 0・変異 E1/E2 = 4 赤・
  **E3 Zod 宣言除去プローブ = 全緑 → runtime pin 欠落を実証、レビューへ裁定委譲**）・
  Opus 小粒度レビュー中（prompt-tr2-review.txt）。
  L-13 = **コミット済み 51d83bf**（レビュー medium〔検証 2 関数の検出力欠落・Fable
  プローブで実証〕→ spec 追補 3 本で消化・プローブ赤化を実証。scripts 16/16。
  visibility 規約例外 = 受入裁定）。
  **重要所見 → 台帳 §5-2 L-13b 新設**: owner 'system' 行は assertOwner で一般ユーザーへ
  403（seeder 投入でも legacy 経路は開通しない・--execute 実走はこの裁定までブロック）。
  pnpm ERR_PNPM_VERIFY_DEPS_BEFORE_RUN は L-13 コミット後の pnpm install で解消
  （lockfile 差分なしを確認）。
  TR-2 = **コミット済み 16f91cc**（レビュー needs-fix Medium 2＋Low 3 全消化:
  boolean 形 runtime pin 追加〔E3 プローブ赤化を実証〕・advisory JSDoc の現実装矛盾解消・
  コメント 3 箇所。engine 528/528・server クロスチェック 286/286）。
  index 残渣（controller.spec の整形 staged 差分）は restore --staged で解消。
  **大粒度 #18 = 完了（両レビュー一致でクリーン・統合フェーズ不要・blocking 0。
  突合 = big18-integration.md）**。要点: CL-1（正式形と暫定読みの排他 = 死枝）は
  Fable 実読で確認し TR-3 へ内包／順序制約 = TR-4b 前に TR-5 禁止／司令塔裁定 2 件
  （itemFields 内 track の publish 拒否・提出値衝突 422）= 正本 draft 裁定 4/5／
  CL-8（取得不能注記の裁定文言未実装）= D-R4b 化／CL-3 formatError 死蔵 = チップ化／
  CL-2 検証セット 3 面手組み = 台帳 L-13 行に 2-2 型で記録。
  #18 消化 3 スライスの進捗: **TR-2b = コミット済み 5194d8e**（レビュー pass low 消化・
  変異 2 赤・engine 531/531）・**D-R4b = コミット済み f1fc41f**（レビュー needs-fix
  medium 通信断 pin＋low NEXT_REDIRECT 透過 pin を消化・変異 N1/N2/N3 各 2 赤・
  focused 17/17）・TR-3 = Fable 検収通過（feature 218/218・変異 S1〜S4 赤・
  反転 pin 3 件・assertCreationValuesWithinBounds は production 呼び出し 0 に →
  **TR-4a で method＋unit spec 削除**）・Opus 小粒度レビュー待ち。
  既知: backfill-template-pin.ts に出所不明の 1 行変更（チップ処方と同一・lint 緑・
  スライスコミットに含めない）。
  **TR-3 = コミット済み 17c978ef**（レビュー needs-fix Medium 3 Low 3 全消化。
  F-2 の司令塔裁定 = 非有限 max の作成時 422 喪失を受容・恒久受け皿 = track 描画の
  error 警告 → 正本 draft 裁定 6。コミット後 = **server 全 suite 3150/3150 全緑**）。
  **大粒度 #19 = 完了（両レビュー一致・blocking 0・新統合フェーズ不要。突合 =
  big19-integration.md）**。要点: #18 の 6 実装勘定へ 7 個目
  （value-input.validateTrackPartsRange・作成/保存両経路・Fable 裏取り済み）が追加／
  用語腑分け = 範囲検査は advisory 化・**有限性検査（非有限/overflow 診断）は維持**／
  Opus B-1 = assert 削除前の pin 移設が必須ゲート（parts overflow pin はリポジトリ唯一）／
  TR-4b は engine-only 禁止（server clamp 群と同一反転単位・Codex Medium）／
  ApplyResourceDeltaResultBase の clamp 3 プロパティは production 読み 0 → TR-4b で削除。
  **TR-4a1 = コミット済み 8890305**（pin 移設 4 群〔overflow 正負・非有限封筒・EPSILON〕→
  変異 M1/M2/M3 で検出力を機械確認 → assert 削除・レビュー medium〔EPSILON pin 喪失〕消化）。
  **TR-4a2 = コミット済み 67e665f**（悪化拒否撤去・assertFiniteTrackValues へ rename・
  悪化 pin 13 反転・E1 空洞化を実証 → EPSILON pin を legacy 投影 clamp へ再アンカー・
  レビュー medium/low 消化）。lint 負債 7 warning = チップ task_1301af1d。
  **TR-4b = コミット済み 3dd3536**（engine＋server の一括反転・split-brain 解消。
  検収 = 3 suite 全緑＋変異 7 種検出。二重レビュー needs-fix → FIX 消化 =
  投影メソッドを assertMaterializationTrackInputsFinite へ縮退 rename・
  ℹ️ 分岐 pin 2 本復活・min>max 422 の経路非対称〔± のみ暫定残存〕を pin 固定・
  再検収 3146/3146＋変異 4 種再確認）。併走チップ task_1301af1d の lint hunk 3 つを
  明記同梱・チップ専有ファイルは未コミットのまま維持。
  **大粒度 #20 = 突合済み**（big20-integration.md）: 有限性の全面統合 No-Go・
  front に clamp 残存ゼロ（TR-5 解禁）・保存経路の二重走査不整合（多重破損 track の
  修復不能と封筒分岐・未 pin）を両レビューが実証 → 裁定 7（司令塔・全 track 歩行へ
  1 本化＋封筒統一・拒否維持）＋純減 3 点 = **TR-4c として Codex 委譲中（run-tr4c）**。
  zero-delta 契約と bounds/atBound 一式の去就 = **ユーザー決定点 TR-D1 へ昇格**
  （design-ledger §5-2・min>max 裁定 3 は従属）。
  **TR-4c = コミット済み f576324**（有限性検査の全 track 歩行 1 本化〔裁定 7・明示 2 ループ〕・
  診断封筒統一・多重破損 pin 3 本・resource-eval/種付け/alias の純減 35 行。
  検収 = 3151/3151＋変異 N1/MF 赤・レビュー medium 1 消化）。
  **TR-5 = コミット済み df83d7c**（TFR の track placeholder を専用描画へ反転:
  15 / 10 超過明示・gauge 塗りのみ 0..100 cap〔絶対比率 pin つき〕・max は
  evaluateConstraint の 3 status〔error = インライン警告 = 裁定 6〕・表示専用の
  退化契約 helper・読み取り専用維持・checkboxes 専用視覚は後続送り・
  CL-3 Alert 1 本化同乗。検収 = front 555/555＋変異 G1/G2/G3 赤・レビュー pass・low 2 消化）。
  CL-6 実測補足 = rollOnCreateResults は wire 契約に非搭載（controller で型ごと破棄）・
  表示には 3 層スライスが必要 — ユーザー裁定枠のまま。
  **TR-6 = コミット済み cf61681**（エディタで track 作成・編集: V3EditorFieldType/
  型 Select/createField〔既定値は publish 通過形 max:10・style:gauge — autosave が
  publish 検証を通すため〕・詳細パネル max required/min/style/rollOnCreate〔空文字は
  property ごと落とす〕・text scalar への silent fallback を pin で封鎖。
  検収 = front 561/561＋変異 E1/E2/E3 赤・レビュー pass findings 0）。

  **【TR レーン完了宣言 2026-08-14】TR-1〜TR-6 実装完了。**
  大粒度 #21（TR-4c/TR-5/TR-6 横断・二重）= 両者 pass・blocking 0
  （突合 = review-results/impl-u14/big21-integration.md）。
  マージ前全 suite = engine 528 / server 3151 / front 561 全緑（Fable 実測）。
  相互矛盾 1 件（gauge clamp 2 実装の 1 本化）は「分母 0 の意味論が実際に異なる
  意図的二重」として見送り裁定。正本 doc 同期済み =
  track-roll-on-create-promotion-draft.md（冒頭を実装完了へ・実装コミット 10 本・
  残スライス節新設）＋ design-ledger.md（§0 現在地・マトリクス track/roll 行・
  front の蓋・L-2 解消・6-2 の track UI 除外・TR-D1 行）。
  **残（実装なし・記録済み）**: TR-D1（zero-delta/bounds 一式 — ユーザー裁定待ち・凍結）・
  checkboxes 専用視覚・試しロール UI・CL-6 出目提示（3 層）・role 編集スライス
  （TR-D1 非対称と CL-6 を同時設計）・未入力 track の表示割れ裁定枠
  （プレビュー 0 / 10 vs 実シート — / 10・保留グループ）。
  **ユーザー指示（2026-08-14）: Fable 使用量を削減**（メモリ reduce-fable-token-usage 参照。
  重い分析は Opus 検収エージェントへ・Fable は判定とゲート再実行のみ — TR-4c 以降の
  スライスはこの体制で実施済み）。
  **【一時停止 2026-08-12】ユーザー指示によりここでループ停止（設計更新のため）。**
  大粒度 #15 は依頼文作成済み・未起動（prompt-big15.md）。走行中の委譲レーンなし・
  作業ツリー clean・未 push 55 コミット。再開時はまず設計更新の内容を台帳
  （design-ledger）と本ファイルへ反映してから、大粒度 #15 の起動可否を再判断する
  （設計更新が直近 3 スライスの面に触るならレビュー依頼文の前提を更新すること）。
  **【設計更新の内容 = 状態管理（2026-08-12）】ユーザー決定:
  zustand 5.0.14 / immer 11.1.16 を導入する（= 済 `98694f5`・production 使用 0 のまま）。
  使うかどうか・どこで使うかは検討事項。**動機（ユーザー裁定）= (1) ネスト不変更新の
  煩雑さ (2) 状態共有/prop drilling。対象範囲 = front 全体の標準方針（採用時は
  新規実装の標準＋既存の移行順序も決める）。進め方 = Fable が調査して推奨を出し
  ユーザーが最終判断。**調査完了・推奨提示済み・ユーザー採否待ち（2026-08-12）**:
  調査 A（現状実測）＋ B（技術制約・負荷評価）＋追加測定 B2-plain（構造変更を
  immer 無しで行った場合の負荷分離）が返着。Fable 裏取り 3 点成立
  （useTransition 4 ファイル・エディタ本体に無し／zustand・immer import 0／
  jest resetModules 未設定）。3 レンズ反証レビュー（数値転記・実コード突合・
  論理整合、計 181 項目）で blocking 4 件含む指摘を全件反映済み。
  **推奨文書 = document/state-management-zustand-immer.md**（証跡 =
  review-results/state-mgmt-study/ の result-a-summary / result-b / result-b2-plain）。
  推奨骨子: (1) zustand 標準採用は見送り（動機 2 実需要 0・確定コスト最大。
  再評価トリガー = 離れた共有の実需要発生時、その際はコンポーネント所有 Provider 形）
  (2) produce を setState に入れるだけの案は不採用（負荷純増を実測）
  (3) テンプレートエディタ限定で連鎖畳み構造変更＋immer をセット採用（将来スライス・
  次点 = 構造変更のみ。シート編集クライアントは対象外。着手前に凍結不変条件を
  台帳 2-2 へ登録）。**ユーザー裁定（2026-08-12）= 推奨どおり採用で確定**。
  記録済み = 文書の決定記録節・台帳 §5-2 D-ST1（クローズ）・将来スライスは
  台帳 §6-1 #17（ST-B2・エディタ更新ヘルパを次に触るスライスへ同乗が既定）。
  **一時停止の理由が解消 → ループ再開。設計更新はコード無変更のため
  大粒度 #15 の前提（直近 3 スライスの面）に影響なし・prompt-big15.md のまま起動可**。
  D2b 設計は prompt-sm-d2-draft.md へ追記済み（baseline を EditorValue レベルで state 化 →
  theirs/mine とも baseline[uid]=current・mine は values 維持で再送 baseValue=current が
  server 決定表 2 で通る = SM-15 と一対一）。
  **その後**: SM-D2（front theirs/mine 状態機械＋契約 schema）→ SM-E canMutate →
  SM-F SM-1 原子性 → front 系（SM-8/SM-14）。
  キュー #11 SM（SM-16 解決分割・台帳 #15d(e) の op 層 partsKey 語彙検査を含む）→ #12 U16。
  **ユーザー決定待ち（台帳 §5-2）**: D-R1・D-R2〔renderer 配線 — clear UX（F2 無言乖離実測済み）・
  table Popover 幅の床（F3）・モバイル Drawer 化を議題に含む〕・#14 dup section id・#15 系〕
- **10-S5b 実装完了・小粒度レビュー委譲中**: ブロック/上限/プールの runtime 注釈評価 —
  annotation-runtime.ts 新設（evaluateAnnotationRuntime・警告 8 コード構造化データのみ・
  publish.ts/types.ts 不変・evaluator は resolveNumberValue export 1 行）。
  実装者申告 = engine 343/343（既存 334 期待値変更なし・新規 9 境界）・diff 452 行
  （目安 300 超過を申告 — レビューで YAGNI 監査）。Fable 独立再実行 = engine 343/343 確認済み。
  **小粒度レビュー結果（needs-fix）**: 注入疑義①が high CONFIRMED — 不正 parts の max 付き
  field 1 つで evaluateAnnotationRuntime 全体が throw（H-10「fail しない」違反・全 section 全滅）。
  追加 medium = 各 entry 有限でも累積和が Infinity になり ok で公開される（MAX_VALUE×2 実測）。
  疑義② path 乖離は反証（section 直下は template-index と同形を実測・alias 3 実装の統合は
  拡大しない = 大粒度 #6 議題）・疑義③ scope:[] 警告は弁護可能と裁定（spec で完全配列固定へ）。
  low = resolveNumberValue が barrel wildcard で package 外公開（非公開化へ）。
  **round2 指示書作成済み（prompt-s5b-round2.txt）— S5a round3 と同一ファイル衝突回避のため
  round3 完了後に委譲する（直列化）**。
  プロンプト = prompt-s5b-code.txt / prompt-s5b-review.txt
- **大粒度 #5 完了**（run-bigreview-5・needs-fix）: high = **astNodeLimit にも同じ上方迂回穴**
  （257 AST・NaN・Infinity の 4 プローブ全通過を実測。DEFAULT_AST_NODE_LIMIT の 2 宣言も
  evaluator export へ一本化せよ・B-2 台帳更新要）→ **round2 完了後に round3 で消化・10-S5 前必須**。
  medium#1 = section loop 8 兄弟 250 行/50 制御点 → **次に publish.ts を触るスライスの task 0** =
  validateSectionLayout＋validateResolvedLayoutWarnings の統合（8→7）＋入口 4 チャンク化
  （再帰 3 系と H-18 走査は統合禁止 — 責務・到達契約が異なる）。
  medium#2 = publish.spec.ts 1,428 行 → **S5 の spec は constraint-evaluator.spec.ts として新設**・
  U15 完了前に publish-u15/-layout-warnings/-h18 の 3 分割（既存 helper 維持・約 798 行へ）。
  健全側 = path 規約一貫・truncate 網羅・D-R1/2/3 のブロック対象は台帳と 3/3 一致・
  parse 二重は単一 owner のため結合なしと裁定
- 保留分: 9-S8（エディタ UI）と preview 統合スライス =〔**D-R1 ユーザー裁定待ち**〕。
  #11 SM（SM-16 resolve 分離含む）→ #12 U16 は #10 後。
  次回大粒度 #6 = 大粒度 #5 以降 3 スライス完了時点（S5a 済 → S5b → 次の 1 本の後）。
  **2026-08-11 ユーザー決定: 二重レビュー（Codex＋Opus）を大粒度レビューとコミット前
  全体検収でも必須化**（fable-rules へ反映済み）。適用初回 = 10-S5a へ Opus read-only
  レビューを遡及実施中（prompt-s5a-opus-review.txt・結果は opus-review-s5a.md へ保存予定）
- 未コミット: sheet-engine 3 ファイル＋document 3 件（ledger/design-v1-ui/本ファイル）。
  コミットはユーザー指示時（pathspec でスライス単位）

- **チップ消化（2026-08-13・別セッション）**: 大粒度 #18 CL-3 の formatError 死蔵 export を削除
  （shared/utils/error-helpers.ts＋spec の describe ブロック・純削除。scripts のローカル formatError
  2 実装は別物のため無変更）。実装 = Opus 委譲・Fable 独立検収 = src/shared jest 4 suites
  133/133 緑・`tsc --noEmit -p tsconfig.build.json` 緑・src/shared に formatError 残存 0。
  **未コミット**（error-helpers.ts / error-helpers.spec.ts の 2 ファイルのみ）

- **チップ消化（2026-08-13・別セッション）**: character-sheet/services 配下の既存 eslint warning
  解消（ディレクトリ一括 `--max-warnings 0` を緑化）。起票 7 件のうち実測 6 件
  （track-range:294 の 1 件は並行セッションの未コミットテスト削除で既に消滅 —
  **その削除が revert されると warning が 1 件戻る**）。内容 = 不要 non-null `!` 除去 1
  （operation.spec:1166）・不要 `as SheetField[]` 除去 2（track-range.spec:62/250）・
  sheet-materializer.spec 先頭へ file-scoped inline rule 設定
  （`jest/expect-expect` の assertFunctionNames に `expectUnprocessable` 追加。rule 生存
  = 無 assertion テスト注入で警告継続を Linter API 実測。src 配下で inline rule-config 初出）。
  実装 = Opus 委譲・read-only Opus レビュー受入（blocking/should 0・nit 2）・Fable 独立検収
  = eslint exit 0・jest src/features/character-sheet 13 suites 216/216 緑・
  委譲前スナップショット比較で diff 3 ファイル 4 hunk のみ。**未コミット**。
  注意: operation.spec / track-range.spec は並行セッションの未コミット変更と**同一ファイル同居**
  — pathspec コミットでも本チップ分が同乗する（ファイル内分離は不能）

## 【TR 残スライス着手 2026-08-14】TR-D1 裁定＋残スライス消化開始

- ユーザー裁定 3 件（2026-08-14）: (1) **TR-D1 = (a) delta 0 の契約拒否**（publish nonzero 化＋
  操作層ガード・bounds/atBound 一式と Discord ℹ️ 上限/下限文言を削除・従属の裁定 3
  〔min>max 422〕も同時撤去） (2) **未入力 track の表示割れ = (a) 実シート側を evaluated 基底の
  0 表示へ揃える**（壊れた保存値の「—」退化は表示退化契約として維持） (3) 残スライス群
  （checkboxes 視覚・試しロール UI・CL-6 出目提示・role 編集）の**着手許可**
- スライス計画（依存順・逐次実行）: TD1（TR-D1(a) server・削除主体）→ TD2（表示割れ(a) front）→
  TD3（checkboxes 視覚＋TFR :659 fallback の error→indeterminate 修正同乗）→ 大粒度 #22 →
  TD4（試しロール UI）→ TD5（CL-6 出目提示・controller/api-contract/front の 3 層）→
  TD6（role 編集 — TR-D1/CL-6 消化後に着手可）→ 大粒度 #23
- **TD1 実装完了（2026-08-14）**: publish の deltas を nonzero 化し、操作層の delta 0 ガード、bounds/atBound 一式と Discord 境界通知を撤去した。
  min>max の ± は advisory として raw 保存へ反転した。
  検収では server 4 suites / 185 tests、engine 13 suites / 530 tests、build、circular 0、server 変更 6 ファイルの ESLint が緑になった。
  engine は ESLint 実行環境と設定がなく、`Command "eslint" not found` で実行できなかった。
- **TD1 検収完了（2026-08-14・Fable 実測）**: 小粒度レビュー = Codex pass（blocking 0・
  should 2・nit 1 → FIX 全消化 = zero replay の noOp 優先 pin／publish Why コメント／
  min>max 両方向 pin）。変異 4 種（publish nonzero・zero ガード・post-delta 有限性 assert・
  noOp 短絡）全て赤・復元 sha256 一致。証跡 = review-results/impl-u14/td1-acceptance.md。
  次は TD2（未入力 track を evaluated 基底 0 表示へ統一。事前実測済み =
  engine 未入力評価 0・min 非依存／flip pin は TFR.spec :1827-1839 のみ／壊れ値「—」pin
  :1900-1907 は維持／hub・Discord 投影は既に 0 で一致）。
- **TD2 完了（2026-08-14）**: TFR renderTrackField の未入力（undefined のみ・null 除外）を
  0 表示へ統一（production 1 行＋Why コメント）。レビュー = Codex pass（blocking 0・
  should 1 = min 非依存 pin 欠落 → FIX で追加）。変異 3 種（0 既定除去・null 包含・
  min フォールバック）全て赤・復元 sha256 一致。suite 113/113。
  証跡 = review-results/impl-u14/td2-acceptance.md。次 = TD3（checkboxes 専用視覚＋
  :659 fallback の indeterminate 向き修正。視覚仕様は設計正本に無く司令塔裁定 =
  max ok・整数・1〜30 のときだけ読み取り専用マーク列・それ以外は現行テキストへ退避。
  指示書 = prompt-td3-code.txt 作成済み）。
- **TD3 完了（2026-08-14）**: checkboxes 専用視覚（定数＋helper・aria-hidden readOnly
  Checkbox 列・checked = floor の視覚 cap）＋:659 fallback の indeterminate 化。
  レビュー = Codex pass（blocking 0・should 1 = 境界/負値 pin → FIX で消化）。
  変異 6 種（cap/整数/off-by-one/style/上限>=/下限<=1）全て赤・復元 sha256 一致。
  suite 123/123＋Preview 12/12。証跡 = review-results/impl-u14/td3-acceptance.md。
  **視覚仕様は設計正本に無く司令塔裁定が一次記録（prompt-td3-code.txt）** — 恒久化するなら
  design-v1-ui への転記が残課題。
- **TD4 事前実測の重要所見（2026-08-14・Opus）**: 既存 /templates/dice-preview は
  executeDiceRoll（rands 合算 total・legacy 互換）で、rollOnCreate の
  executeEvaluatedDiceRoll（評価値 total・'3d6*5'→55）と **total 意味論が不一致**。
  試しロール UI は details 文字列のみ表示（末尾に評価値を含み正確）の front 完結案を軸に
  大粒度 #22 後に指示書化。dice preview UI 部品は TemplatePreviewV3 に inline 未抽出
  （共有部品は utils/dicePreview.ts のみ）。
- **大粒度 #22 消化完了（2026-08-14・突合 = review-results/impl-u14/big22-integration.md）**:
  Codex needs-fix（should 3）×Opus blocking 0 の二重 → blocking 0・runtime 複製なし・
  統合系全見送り（視覚 cap 3 実装と「未入力=0」= 正本 1＋狭い再表明 1 は意図的分離）。
  相違裁定 2 = checkboxes 仕様は**要旨のみ** design-v1-ui へ転記（8 契約逐条は pin と
  二重管理になるため不採用）・「未入力=0」台帳は Opus 分類採用。FIX 消化 =
  doc 同期 8 編集（Fable。ledger/draft 自己矛盾 4 件・AI.character 削除済み関数名指し・
  AI.refactor SP-2 失効注記・「表示割れ解消は undefined 限定」精密化）＋code 6 件（Codex。
  相互参照コメント・stale コメント/spec 名・TFR dispatch 集約〔ホップ 1→0〕・max<=0 Why・
  `0 / —` pin）。検収 = dispatch 変異赤・front 136/policy 38 緑・作業番号混入 1 件を
  差し戻しで除去。記録のみ = projection '—' 2 宣言（置き場所裁定待ち・非 export 選好）・
  spec の ℹ️ 負の対照 1 件は妥当。
- **TD4 完了（2026-08-14）**: 試しロール UI（エディタ track 詳細パネル）。
  requestDicePreview 純関数抽出（fetch 2→1）・client 検証先行・**details のみ表示**
  （preview total = rands 合算と rollOnCreate = 評価値の意味論不一致を封じ込め・pin で固定）・
  FIX = feedback 鮮度保証（notation 変更で消去・実行中入力 disabled）＋total 封じ込め強化＋
  catch 経路 focused test。レビュー = Codex pass（blocking 0・should 2・nit 1 → 全消化）。
  変異 5 種全て赤・復元 sha256 一致。suites 110/110。
  証跡 = review-results/impl-u14/td4-acceptance.md。
  次 = TD5（CL-6 出目提示・3 層。事前実測済み・指示書 = prompt-td5-code.txt。
  司令塔裁定 = Modal 内表示〔空なら現行 redirect 維持〕・label は server 側で付与・
  wire は required 配列。Discord 作成経路 0 件・secret 到達不能を実測済み）。
- **TD5 完了（2026-08-14）**: CL-6 出目提示・3 層（server: label 追加＋応答へ配列・
  api-contract: RollOnCreateResultWire＋required 配列〔名前 pin 43→44〕・front: 作成 Modal の
  判別 union 表示 `{label}: {details}`・空なら redirect 維持）。レビュー = Codex needs-fix
  （blocking 1・should 2・nit 2）→ FIX 全消化: **HTTP 境界の runtime 正規化**（旧 server 応答の
  欠落→空配列。wire は required 維持・新規 character.service.server.spec で旧形/新形 pin）・
  **request generation ID** で stale 応答破棄（close→別テンプレート再開の上書き防止 spec）・
  2 件 fixture で全件引き渡し/全行表示 pin・作業番号除去・目的外 hunk（req.user cast）復元。
  変異 = 本体 3 種＋FIX 4 種（正規化無効化・slice 切り詰め×2・stale ガード無効化）全て赤・
  復元 byte-identical＋残留 grep（復元リトライハーネスが間欠 OSError 22 を吸収）。
  ゲート = front 3 suites 30・server 4 suites 25・api-contract 27・build・circular・eslint
  （server warning 1 は HEAD 既存行）。eslint.config.mjs の allowlist 1 名追加は契約追加の
  必然随伴として受入（指示書側の記載漏れ）。証跡 = review-results/impl-u14/td5-acceptance.md。
  次 = TD6（role 編集 — 最終実装スライス。TR-D1(a)/CL-6 消化済みの前提で事前実測＋司令塔設計）
  → 大粒度 #23（TD4/TD5/TD6 横断・二重レビュー＋突合）→ Task #34 完了ゲート。
- **TD6 事前実測（2026-08-14・Opus・司令塔で拘束 3 点裏取り済み）**: role は
  engine 型・publish 検証・palette 生成まで**完全サポート済みでエディタ UI が無いだけ**
  （front 単独スライス成立・engine/api-contract 無改変）。重要実測 =
  (1) publish は resource role の到達可能性を検査しない（validateRole が非 rollable を
  early return）→ parts 無し field に付くと **publish 緑のまま palette に現れない
  silent dead role**（既存 publish.spec の fixture 自体がその形）。
  (2) palette 生成は resource の role.group を無視し section.label で上書き。
  (3) secret / role.when は publish が「未対応」拒否。(4) resource role の製品テンプレート
  供給源は現在ゼロ（legacy-coc は rollable 1 種のみ・HP/MP/SAN は computed で resource 不可）。
  **司令塔裁定（prompt-td6-code.txt が一次記録）**: (a) UI は track 詳細パネル限定
  （track は parts 常時有効で dead role 罠を UI 制約だけで回避）・(b) group/secret/when の
  入力は作らない・(c) deltas 新規行初期値 -1（0 は契約拒否値）・(d) 全行削除で role ごと
  undefined（rollOnCreate と同型）。**ユーザー裁定枠として記録** = engine 側の到達可能性
  検査追加（既存 publish.spec fixture が赤くなる契約変更）・rollable role 編集 UI・
  scalar+partsKeys への resource 適用。
- **TD6 完了（2026-08-14）**: track の resource role 編集 UI（front 単独・
  TemplateEditorV3 の 2 ファイルのみ +274 純増）。DeltasInput（NumberInput 行＋削除＋
  「delta 追加」初期値 -1）・全行削除で role ごと undefined・group/secret/when 入力なし。
  レビュー = Codex needs-fix（blocking 1・should 1）→ FIX 全消化:
  **既存 non-resource role の無告知置換防止**（警告＋「resource role へ置き換える」明示ボタン・
  押下前無接触・rollable 編集 UI は作らない境界を維持）＋**中間文字列の draft 管理**
  （''・'-'・'1.' を blur で確定値表示へ復帰・0 拒否は publish 検証へ委譲のまま）。
  変異 6 種（role 破棄・slice 切り詰め・クリア bypass・client 0 拒否・ガード bypass・
  blur 復帰除去）全て赤・復元 byte-identical。ゲート = jest 94/94・eslint・diff --check。
  証跡 = review-results/impl-u14/td6-acceptance.md。**TR 残スライスはこれで全消化**。
  次 = 大粒度 #23（TD4/TD5/TD6 横断・Codex＋Opus 二重レビュー＋突合）→ Task #34 完了ゲート
  （SESSION_HANDOFF 全面更新・promotion-draft/ledger クローズ・マージ前全 suite）。
- **大粒度 #23 消化完了（2026-08-14・突合 = review-results/impl-u14/big23-integration.md）**:
  Codex（needs-fix 6 件・11 suites 独自再実行）×Opus（14 件・static:duplication 実測）の二重。
  **blocking（両者同一箇所）= TemplatePreviewV3 の total 自己矛盾**（入力欄 = rands 合算 11 /
  結果行・作成値 = 評価 55）→ B23-FIX で dice-preview service を executeEvaluatedDiceRoll へ
  統一（total 消費 1 件のみ実測・Discord 経路不変・TD4 の「封じ込め」裁定を上書き改訂）。
  相互矛盾裁定 3 = RollOnCreateResult は alias 化でなく **IsExact＋キー集合双方向差分の型橋**
  （既存 entity/wire パターン準拠）・S3c 除去は正当（非作業番号の文脈のみ復元）・
  engine 到達可能性検査は**ユーザー裁定枠を維持**（材料 = 発見距離 3 ホップ→0、正本 draft へ
  追記済み）。他の消化 = 作成エラーの Modal 一本化（誤 title・?? マスキング解消）・
  design-v1-ui 行番号参照 6 件の節名アンカー化・total 非表示 pin の部分文字列偽緑解消・
  定数化/注記/語彙統一/spec 名改名。見送り（実カウント記録）= remove 系 3 複製統合・
  試しロール共有 hook・staleness 3 機構統合・materializer 複製（チップ完了後へ延期）。
  変異 = MN1/MN2/MN4 赤・**MN3（型への optional 追加）が初回生存 → B23-FIX2 で
  キー集合差分を追加して赤化**（型橋検収は drift 変異の赤で判定する教訓を記録）。
  正本同期 = AI.character.md（CL-6/role 編集/preview total の 3 記述）・promotion-draft
  （レーン全消化ヘッダ・TD4〜TD6 消化印・裁定枠 3 件）・design-ledger（:16 セル・CL-6 行）。
  次 = Task #34 完了ゲート（マージ前全 suite → SESSION_HANDOFF 全面更新）。
- **Task #34 クローズ（2026-08-14）— TR レーン完全消化**。マージ前全 suite 全緑を実測:
  api-contract 27/27・sheet-engine 530/530・server 224 suites/3151・front 33 suites/601
  （snapshot 1 含む。チップ 4 ファイルの未コミット変更を含む作業ツリーのままで緑）。
  コミット列 = TD4 8e9ebf3f / TD5 cbb27e3a / TD6 9e2188bb / B23 57c776af（＋#22 まで
  の 13 本 = promotion-draft ヘッダ参照）。**現在の状態**: TR レーン（L-2 (c)＋track 昇格＋
  残スライス）は設計〜実装〜二重レビューまで全クローズ。未コミット残 = 並行チップ 4 ファイル
  のみ（ユーザー管轄）。**〔2026-08-14 ユーザー指示で解消〕チップ 4 ファイルは 5376dd92 で
  コミットし、develop 137 コミットを origin へ push 済み（1b23430a..5376dd92・tree クリーン）**。
  **次にやること（すべてユーザー裁定待ち・Fable からは着手しない）**:
  D-3 / L-13b / L-1 / D-P3-1〜4 / C1 / README 未決 / computed live 裁定枠 /
  preview parts 裁定枠 / projection「—」1 本化の置き場所 /
  engine の resource role 到達可能性検査（#23 で材料追記済み・正本 draft §残スライス）/
  rollable role 編集 UI / scalar+partsKeys への resource 適用 /
  materializer 複製統合（チップ完了後）/ `messages.join(' / ')` 9 複製の統合スライス。

## 【DL レーン 2026-08-15】旧 CoC テンプレート配布＋使い方ガイド（Task #35）

- **発端（ユーザー要望 2026-08-15）**: 「全く使い方がわからない」＋「旧 CoC で誰でも
  キャラクター作成できるようテンプレートとして配布したい」。
- **裁定（ユーザー・AskUserQuestion）= system 特例方式**。visibility ベース共有・isSystem
  フラグ新設は却下。owner `'system'` の published テンプレートだけを読み取り特例で開放する。
- **使い方ガイド = document/character-sheet-user-guide.md（新設・Fable 直筆 = 司令塔成果物）**:
  ログイン→ /templates 直打ち→エディタ→publish（public 必須）→キャラ作成→シート編集→
  Discord /create-character-thread の全導線＋**画面の全用語の用語集（英語ラベルは日本語読みつき
  — ユーザー指示「翻訳すら億劫だから書け」）**。配布実装後の制限節・配布バッジ・seeder 手順も反映済み。
- **DL-1 server 完了（core＋FIX・未コミット→本コミットで確定）**: SYSTEM_TEMPLATE_AUTHOR 定数・
  一覧 `$or`（自分の全件＋system published）・resolveForCreate / resolvePinnedRevision のみ
  `assertRevisionReadableBy`（owner or system）。findOne・全 mutation は assertOwner 維持。
  Codex 認可監査 = blocking 0（迂回経路なし・identity は JWT＋保存済み所有者のみ）。
  FIX = 分岐別 403 pin 補完（metadata patch / draft remove / deprecated remove＋repository
  未呼出検証）・自明負 assert 除去。検収 = 51 tests 緑（Fable 再実行）・変異 MO1〜MO4＋
  MQ1/MQ2（update/remove の system 免除緩和）**6/6 赤**・eslint・diff --check。
- **DL-2 front 完了**: 「配布」Badge＋system カードの編集/削除非表示（作成導線は維持）。
  8 tests 緑・変異 MP1a/MP1b/MP2/MP3 **4/4 赤**。
- 証跡 = review-results/impl-u14/dl-acceptance.md（＋dl1-review / dl1-fix / dl2-code）。
  台帳 L-13b = 裁定・実装済みへ更新。
- **残**: seeder 実走はユーザーの運営作業
  （`cd TRPG-SERVER && pnpm seed:legacy-coc-template --execute`・dry-run 既定・冪等）。
  実機確認は D-3 実機受入に含める。
- **次 = DL-3（Task #36・ユーザー承認済み「これは実施する 基本日本語で記載する」）**:
  エディタ文言の日本語化（表示テキストのみ・構造変更なし・spec のラベル参照追随が主コスト・
  ガイド用語集と訳語を揃える）。

## 【DLX 2026-08-15】実機投入で出た不具合 2 件の恒久修正（Task #37）

- **経緯**: ユーザーの seeder 実走で (1) ts-node が ambient 型（src/types/express）を読まず
  TS2339 でコンパイル失敗 →（2）`--files` で通した後、キャラ作成の作成時ロールが
  「GameSystem is not found」で 500。根因 = seed の `gameSystemId: 'coc'` が BCDice に
  実在しない ID（旧 CoC 6 版の正式 ID は `Cthulhu`）。
- **修正（Codex 委譲・検収済み）**: seed を 'Cthulhu' へ＋Why コメント・
  **「seed の gameSystemId を StaticLoader で実ロードできる」spec を新設**（seed 値を動的参照 —
  pin 追随に依存せず任意の実在しない ID を赤にする。変異 MR1 'coc'/MR2 任意 ID = 2/2 赤・
  byte 一致復元）・payload/作成時ロール pin の 'Cthulhu' 追随・package.json の
  seed/backfill 2 スクリプトへ `--files` 恒久化。検収 = 3 suites/20 tests 緑（Fable 再実行・
  Codex は domain 一括 6 suites/87 緑）・eslint・diff --check。
- **運用ノート**: pnpm workspace は `verifyDepsBeforeRun: error` のため package.json 編集後は
  一度 `pnpm install`（状態更新のみ・lockfile 無変更）が要る（実施済み）。
  **ユーザーの実機 DB は投入済み行が 'coc' のまま**（seeder は skip-existing で上書きしない）—
  mongosh / Atlas GUI での `$set: { gameSystemId: 'Cthulhu' }` を案内済み・実施結果は未報告。
- **台帳 L-13c 新設**: publish 検証は gameSystemId 実在性を検査しない（エディタ製テンプレートは
  今も同じ事故を踏める・ユーザー裁定枠）＋試しロール = DiceBot / 作成時 = テンプレート方言の
  非対称（既知乖離・未修正）。ガイドの誤例 `coc` → `Cthulhu` 修正済み。

## 【DLY 2026-08-15】実機事故 2 件目: lookup miss でシート評価全面停止（Task #37 続き）

- **経緯**: gameSystemId 修復後、ユーザーが「lookup did not match table damage_bonus」に遭遇。
  Fable の再現実測（scratch script・削除済み）= damage_bonus 表は合計 2〜204 のみカバーで、
  STR/SIZ 両方欠損（missing = 0 評価）だと key 0 が miss → **evaluator は per-field 封じ込め
  なしで evaluateTemplate 全体を throw**（evaluator.ts:413）。出目が入った作成済みキャラは正常。
  発生面はユーザーへ確認中（legacy キャラの backfill pin 解決面が有力 — seeder 投入によって
  解決が 404 → 成功へ変わり、値未マッピングのまま評価される経路が開通した可能性）。
- **修正（Codex 委譲・検収済み）**: seed の表外周を番兵値へ（-999999〜64 / 165〜999999・
  中間 3 行無改変・Why コメント）＋spec 3 ケース（空 values で throw せず db '-2'・合計 0・
  合計 999）。検収 = 3 suites/22 tests 緑（Fable 再実行）・変異 MS1/MS2（外周を旧値へ戻す）
  2/2 赤・byte 一致復元・eslint・diff --check。
- **台帳 L-13d 新設（ユーザー裁定枠 2 件）**: engine の lookup miss per-field 封じ込め
  （SM-14 語彙への接続・LookupRow range 形の min/max 必須型制約含む）／publish 検証の
  表全域カバー要求（エディタ製の穴あき表は今も全面クラッシュ可能）。
- **ユーザー DB の入れ替えが必要**（構造変更のため $set では済まない・seeder は skip-existing）:
  Atlas で `charactersheettemplates` の `templateId: 'legacy-coc'` の行を**削除** →
  `pnpm seed:legacy-coc-template --execute` を再実行。作成済みキャラの pin は
  templateId＋version で再解決されるため壊れない。
  **〔2026-08-15 ユーザー報告で解消〕入れ替え後「治った」と確認済み。**

## 【DL-3 完了 2026-08-15】エディタ文言の日本語化（Task #36）

- **実装 = Opus 委譲**（Codex writer ロックが DLX/DLY で占有のため）。TemplateEditorV3 本体＋
  spec の 2 ファイルのみ。訳語辞書・除外境界は prompt-dl3-code.txt が正本。
  新設はラベルマップ 3 本のみ（SECTION_LAYOUT_PRESET_LABELS / FIELD_LAYOUT_SPAN_LABELS /
  SECTION_LOCATION_LABELS — .map 生成で label を value から作っていた箇所の value/label 分離用）。
  i18n 機構なし・保存 payload 不変・Select/SegmentedControl の value 語彙は英語のまま。
- **検収で変異 MV1（公開範囲の option value を '公開' へ破壊）が生存** → FIX 差し戻しで
  保存語彙 pin 2 本を追加（公開範囲 → visibility 'public'・端数処理 → rounding 'floor'。
  端数処理は初期値 round から floor へ選び直す形 — 初期値のままだと autosave が発火しない）。
  FIX 後 MV1/MV3 とも赤・byte 一致復元。
- ゲート = editor spec 96 tests・characterTemplate 一括 7 suites/259・**front 全 suite
  33 suites/606 全緑（レーンクローズ実測）**・eslint・diff --check。
- 未消化の既知残: 未選択 option（リンク限定/非公開/切り上げ/四捨五入）の value 破壊は
  依然 spec 生存（選択経路の代表 pin のみ。全網羅 it.each は YAGNI 見送り・実カウント記録）。
  ガイド §6 は「英語 = 内部名・検証メッセージ用語の対照」へ改訂済み。
- **次 = DL-4（ユーザー要望 2026-08-15）: `/templates` への画面内導線**（現状 URL 直打ちのみ）。

## 【DL-4 完了 2026-08-15】/templates への画面内導線（Task #38）

- Codex 委譲。Header のアバターメニュー（「ユーザーページ」直後）と UserPageNav
  （「キャラクター一覧」直後）へ「シートテンプレート」リンクを追加。追加のみ・
  spec 新設なし（このリポジトリのナビ系は spec なし運用に合わせた・記録済み判断）。
  **layout.tsx（ユーザー並行変更中）は非接触**。検収 = eslint・diff --check・対象 2 ファイルの
  型エラーなし。ガイドの前提節・制限節から「導線なし」を消し込み。
- **既知の front 型負債（DL レーン外・実測 2026-08-15）**: `pnpm exec tsc --noEmit` が 3 件で赤 —
  character.service.server.ts:38 TS2698・TemplateEditorV3.tsx の updateDelta（TD6 由来で
  DL-3 以前から存在を git show で確認済み。draft 配列 string へ非有限 number を代入しうる型穴）・
  dicePreview.spec.ts:159 TS2352。**〔訂正 2026-08-15〕** 当初「front には tsc ゲートが無い」と
  書いたが誤り — `trpg-next-app/package.json:10` に `typecheck`（ensure:workspace-dist → tsc --noEmit）
  が以前から存在する。正しくは**「ゲートは在るが誰も回していなかった」**（jest は transpile 実行で
  型を見ないため、スライス検収で jest だけ回すと型エラーが素通りする）。以後 front スライスの
  受入に typecheck を含める。修正はチップ化 → 下記で消化。

## 【大粒度 #24 2026-08-15】DL レーン横断・認知負荷レビュー（Task #39）

- Codex --mode review。verdict = needs-fix（blocking 1 / should 3 / 問題なし 2）。
  裁定正本 = review-results/impl-u14/big24-adjudication.md。
- **blocking = damage_bonus 番兵値は ±999999 まで**（有限入力はそれを超えられるので
  「全実数域」は過大主張 → 台帳 L-13d と handoff の主張を訂正済み）。本修正 =
  LookupRow 開放端の engine 導入だが、seed 構造変更 = ユーザー DB 再投入を伴うため
  **裁定枠へ**（直後の実機を再度壊さない判断）。
- should 消化 = **DLZ スライス（完了・検収済み）**: seed の 'system' 直書き → 定数 import・
  publish 検証 3 段の domain/seeder 複製 → 共有 collector
  （validation/template-publish-validation-issue.collector.ts）1 本へ集約。値・挙動不変 =
  DB 再投入不要。検収 = 8 suites/105 tests 緑（Fable 再実行）・段脱落変異 MT1/MT2 = 2/2 赤・
  eslint・diff --check・build＋check:circular 緑（Codex）・seeder dry-run skip-existing
  （= Nest 全 context 起動の実測を兼ねる）。台帳 L-13 の 2-2 記述を「残る手組みは front のみ」へ縮小。
  **これで DL レーン（DL-1〜DL-4・DLX/DLY/DLZ・大粒度 #24）は全クローズ**。
  残チップ 2 枚 = front 型負債＋tsc ゲート（task_3c6ff45b）・engine/front ID 語彙統合
  （task_c2314809）。裁定枠 = L-13c（gameSystemId 実在性の publish 検査・試しロール方言非対称)/
  L-13d（lookup 開放端＋per-field 封じ込め）。
- should チップ化 = engine/front の ID pattern＋予約語 4 定義（task_c2314809・
  drift pin 束ねコミット要件つき）。
- 問題なし（統合しない判断の実カウント記録）= 訳語 42 行突合ゼロ矛盾・ラベルマップ統合不要・
  認可述語 2 本は mode 引数化すると同時保持 4→5 で悪化。

## 【front tsc 型負債 3 件解消 2026-08-15】チップ（別セッション・develop 本体で実施）

- DL-4 節の既知負債 3 件を解消。**挙動不変の型のみ修正**（実装 = Opus 委譲〔codex writer lock
  回避のため〕・レビュー = Codex adversarial pass）:
  - character.service.server.ts: 受け値を union 型（`Wire | Omit<Wire,'rollOnCreateResults'>`）で
    受けて `in` narrowing の never 化を解消（TS2698）。指示書例の Omit＋optional 形は
    `in` narrowing が declared optional の undefined を落とさず不成立（実装者実測）→ union 形採用
  - TemplateEditorV3 DeltasInput: drafts を `Array<string | number | undefined>` へ拡幅
    （TD6 防御ガードの実態へ型を正直化・TS2322）
  - dicePreview.spec.ts: `as unknown as Response` 二段 cast（TS2352）
- `typecheck` スクリプトは依頼前提と異なり**既存**（package.json:10・追加不要だった）。
  CI/ゲート接続は依然無し（deferred・再発しうる）
- 検収（Fable 独立再実行）= tsc 0・jest 33 suites/606 全緑（ベースライン一致）・diff 3 ファイル限定。
  Codex レビューはコメント除去 transpile の SHA-256 一致で挙動不変を機械証明。
  証跡 = `review-results/front-tsc-gate/`
- FIX 1 件 = コメント断定の弱化（「非有限 number も返す」→ onChange 契約ベースの表現。
  メモリ ai-md-claim-scoping の新例・委譲先コードコメント面）
- **未コミット**。コミット時は 3 ファイルを pathspec 明示（並行セッションの変更が同居中）

## 【big24-f3 完了 2026-08-15】大粒度 #24 findings[3] 消化: ID 規則 4 定義→engine 正本 2（チップ task_c2314809・コミット `1464378b`）

- チップセッション（Fable 司令塔・実装 = Codex 委譲 prompt-big24f3-code.txt）。engine publish の
  `ID_PATTERN` を `SHEET_ID_PATTERN` へ改名 export（構築式・issue message byte 不変 =
  engine spec の pin 7 箇所無改変が証明）。front v3Template は既存 1 行目 import への named 追加で
  `SHEET_ID_PATTERN` / `SHEET_RESERVED_ID_VALUES` を直接参照（`RESERVED_IDS` は engine 由来の
  module-local view 化・export 剥がし）。等価 spec（集合等価＋per-id 54 ケース）削除。
  計 +13/−82（doc 込み +25/−86）
- **bundle-cost ゼロの裏取り済み**: v3Template は変更前から同 barrel を runtime import 済み
  （normalizeTemplateLayout）。メモリ cross-package-runtime-value-blindspot の旧差し戻し
  （Vite/trpg-remix-app・347KB 膨張）とは前提が異なることを確認してから実施
- 二重レビュー = Codex pass（findings 0）・Opus pass。**Opus B1 = 正本 doc の反証**を司令塔が消化:
  design-ledger 委譲定型文（SHEET_RESERVED_ID_VALUES の保全根拠を「front production が runtime
  参照する正本」へ・SHEET_ID_PATTERN 追加）・B-4 行（解消＋**残存リスク: top-level id の
  front⇔engine 外延一致 pin は無い** — validateId へ pattern/予約語以外の規則を足すときは front
  validateLocalTemplate を同時更新）・AI.character の統合起票記録（「14語」→実カウント 15 語訂正）。
  N1/N2（コメント boundary: `.source` はアンカー付きで表示用写しへ drop-in 不可等）は FIX
  ラウンドで反映。N3（engine spec テスト名の旧名残渣 1 語）はチップ task_2cb8c08e が作業ツリーで
  実施済み・本コミット非含有（pin 無改変証明の純度維持・コミットは当該チップ側）
- 検収（Fable 再実行・FIX 後）= engine build＋13 suites/530・front characterTemplate
  7 suites/204・eslint 0・front typecheck rc=0（既知 3 件は上記チップの並行修正で解消済みを実測）・
  pathspec 5 ファイルのみ・コミット後 index 残渣なし
- 認知負荷純減の実測（両レビュー一致）: production 定義 4→2・pattern const 名 3→1・
  手動同期ペア 2→0・語彙変更時の同時保持 3→1・新規 helper/層/別名 0。
  読む側ホップ 0→1（`SHEET_` prefix が正本所在を自己申告・受容済みの対価）

## 【チップ 2 本の取り込み 2026-08-15】ID 規則残渣＋front 型負債（Task #41・ユーザー許可「あなたがチップのコミットしてOK」）

- 対象 = (a) チップ task_2cb8c08e: engine publish.spec のテスト名に残った旧名
  `ID_PATTERN` → `SHEET_ID_PATTERN`（1464378b の純度維持のため別コミットにされていた残渣）
  (b) チップ task_3c6ff45b: front 型エラー 3 件（character.service.server.ts の受信側 union 化・
  DeltasInput の draft 型に `number` を許容・dicePreview.spec の二段 cast）。いずれも
  **Why コメント付きで型穴の意図を明示**しており、挙動変更なし。
- **`typecheck` スクリプトは既存**（上記訂正）。チップは新設せず既存を使う判断で正しい。
- Fable 独立検収: 全 4 パッケージ suite ＋ front typecheck ＋ engine 正本化の実効性変異
  （engine の SHEET_ID_PATTERN を壊すと front spec が赤 = front が本当に engine を見ている）。
- **未コミット残 = ユーザー環境ファイル 4 本**（TRPG-SERVER/AI.development.md・start-dev.bat・
  trpg-next-app/AI.md・trpg-next-app/app/layout.tsx）。ユーザー管轄のため触らない。

## 【DL-5 進行中 2026-08-15】gameSystemId を検索セレクト化（Task #40・ユーザー要望）

- 要望「gameSystemId はユーザーに入力させるのではなく検索式のセレクトにして作成させたい」。
  自由入力は L-13c（実在しない ID を publish できる → 作成時ロールで 500）の入口そのもので、
  セレクト化は**入力面からの実効的な封じ込め**になる（server 検証の要否は L-13c の裁定枠として別）。
- 事前実測 = workflow wf_41d945a5-328（5 面並列・read-only）。**設計を変えた実測 5 点**:
  1. **front に既に `app/static/gameSystemList.json`（224 件）があり、`SEARCH_KEY_KANJI` /
     `SEARCH_KEY_HIRAGANA` を持つ**（＝日本語検索がそのまま作れる）。既に client component が
     import 済みでバンドル増分ゼロ。→ **server の一覧エンドポイントは新設しない**。
     bcdice は 294 件持つが、名前解決が front 224 件と割れる・kana 検索キーが無い・
     api-contract の完全一致 pin と front eslint allowlist の同時更新が要るため採らない。
  2. **静的一覧の 224 ID は全件 BCDice でロード可能**（実測）。＝ここから選ばせれば DLX 級の
     500 事故は起きない。逆に **'DiceBot'（wrapper の既定）は一覧に無いがロード可能**なので
     「一覧に無い＝不正」ではない。
  3. **`null` / `''` を送ると autosave 全体が 400 で死ぬ**（DTO は通すが永続化 zod の min(1) が
     拒否）。Mantine Select の onChange 型は `Value | null` なので **null ガードが必須**。
     現行は undefined が key ごと落ちるため**そもそもクリア不能**（既存バグ）。クリア契約は
     DTO・zod・pickDraftUpdate の 3 層設計が要るので DL-5 では扱わない（clearable を付けない）。
  4. **Mantine 9.5.1 は data に無い value を空白表示にする**（実装読み取り）。'coc7' のような
     一覧外の既存値を持つテンプレートで「未設定に見える → 選び直す → 上書き確定」の事故になるため、
     既存値は必ず選択肢として残す。
  5. **台帳 L-13c の記述誤りを発見・訂正済み**（下記）。
- **台帳 L-13c 訂正**: 「試しロール = DiceBot の非対称が現存」は誤り。front は両 preview 経路で
  template.gameSystemId を渡している。真の非対称は **Discord のシート内ロール**
  （dice-roll-logic.service.ts:95-97）が常に DiceBot である点。また front が渡すことの
  **機械固定が無い**（preview spec は body 未検証・editor spec は gameSystemId 0 件）ため、
  DL-5 の pin で塞ぐ。
- 実装 = Codex 委譲（prompt-dl5-code.txt が設計正本）。front 単独スライス・4 ファイル。
- **完了・検収済み（証跡 = review-results/impl-u14/dl5-acceptance.md）**:
  jest 11 suites/242・tsc・eslint・diff --check 全緑。変異 = 一覧外値の補完 / ひらがな検索 /
  試しロールの方言転送 の 3 本が spec で赤、**null ガードは tsc が検出器**（素直な除去は TS2322。
  `as string` で握り潰した場合だけ生存 = 今日の「front 受入に typecheck を含める」運用変更が
  そのまま担保になっている）。
- **ハーネス知見**: 変異残渣の判定を部分文字列で行うと偽陽性が出る（2 スペース版が 4 スペース版の
  部分文字列）。**残渣は sha256 一致を正とする**。
- 残る既知 = 静的一覧 224 件は bcdice 294 件より古く 'DiceBot' も一覧外（＝「一覧に無い＝不正」では
  ない）。一覧の再生成は別スライス候補。クリア操作・published 時 disable・server 実在性検証は
  いずれもスコープ外（理由は acceptance 記録）。

## 現在の feature: ロール／技能レーン（RL）— 設計中・実装未着手

**発端**: ユーザーがいあきゃら相当のキャラシを作れるか質問 → 実測レポートを作成 →
「全部できるようにしたい」＋「`/route-design-work` で反復委譲に耐える仕様へ」と指示（2026-08-17）。

**対象 5 項目**: ①ロール用役割の編集 UI ②技能行の一括生成／複製 ③プレビューへの内訳入力配線
④計算結果のシート画面表示 ⑤Web でのロール実行。

**ユーザー裁定（確定・再議論しない）**
- **D-1**: ⑤の達成条件は「出目と成功/失敗まで」。多段判定（クリティカル／ファンブル）は射程外。
- **D-2**: 技能ロールの記法は `1d100<={value}` のまま。**ダイス式の許可リストと評価済み総和の
  抽出方法には触らない**（`dice-execution.service.ts:18,199-203` の連動警告を尊重）。

**実測で判明した重要事実（レポートの記述を訂正するもの）**
- ダイス実行コアは既に discord.js 非依存で、**REST 呼び出し元が稼働中**（エディタの試しロール＝
  `dice-preview.service.ts:19`）。⑤の新規部分は「キャラクター文脈のエンドポイント 1 本」のみで、
  残りは配線＋返り値の構造化。レポートの「⑤は新規」分類は過大だった。
- 成否は**自前の 2 値判定**（`dice-execution.service.ts:188-197`）で、`details` 文字列末尾に
  畳み込まれ構造化されて返らない。**多段判定はどこにも存在しない**
  （`dice-calculation.service.ts:194-206` のコメントが明言。`DiceRollResult.successNumber` は死に枠）。
- `role.notation` は NotationFragment 契約で **standalone roll 検証の対象外**。試しロール API は
  standalone 検証しか持たないため、**役割の記法を試す手段が無い**（`standalone-roll.ts:35`）。
  ①を作った瞬間に露出する（下記 I-2）。

**⑤は①に依存する（I-1）**: 役割が付いていない項目はシート画面にもボタンを出せないため、
①なしに⑤を作っても成果が観測できない。実装順序は G-1 → G-2 に拘束。
③→②も品質上の拘束（確認できないまま 60 行を量産しない）。

**成果物**: `document/character-sheet-proposals/roll-lane-framing.md`（Order 1 の追跡表・正本）。
台帳は `design-ledger.md`（L-14/L-15 を今回追加）。

**ルート（route-design-work / Route and orchestrate）**
1. `frame-purpose-goal-means` — **完了（Partial）**。⑤は取り違えのため再定義済み
2. `model-invisible-concepts` — **完了（Partial）**。I-5 解消（②は複製で足り、雛形は別目的として切り離す）。
   B-3 発見（「役割＝記法」という隠れた前提。①の UI を記法入力にすると実装の都合を作者へ転嫁する）
3. `model-domain-invariants` — **完了（Partial）**。⑤の OP-R1 契約を確定。
   **最重要不変条件 = 出目はサーバだけが決める（C-R2）／対象条件は「作成時ロールの記法を宣言しているか」
   であって「入力可能な型か」ではない（C-R1）**。この 2 件はどちらも **2-2（規約頼み・全緑でも壊れる）**
   なので委譲プロンプトで名指し必須。残 = G-b（記法取り出しの一本化）, G-c（`rerollable` の扱い）
4. `abstract-by-purpose` — **起動しない**（除外理由は framing doc に記録）。主要論点の④経路は D-12 で決着し、
   G-b は 4 行のヘルパーで抽象化の採否に当たらない
5. `loop-ledger-design` — **スライス計画まで完了**（framing doc の末尾）。台帳本体への転記は委譲開始時

**追加裁定（すべて決着・再議論しない）**
- **D-11**: `rerollable` フラグは使わない。振り直しの対象は「roll 式を宣言しているか」だけで区別する。
  engine の `rerollable` 宣言・publish 検証・seed・front の 2 箇所は掃除スライス（RL-8）で削る
- **D-12**: ④は front で再評価しない。サーバの計算結果を返す
- **D-13**: ②は複製ボタンのみ。技能セットの取り込みは範囲外
- **D-14**: 元の⑤（Web で技能判定）は範囲外で確定

**I-1 訂正**: 「⑤は①に依存」は古い⑤（卓ロール）の話。新しい⑤（振り直し）は role ではなく
作成時ロールの記法を見るので**①と⑤は独立**。並行可。

**スライス**: RL-1〜RL-8（framing doc に表）。並行可能な鎖は {RL-1→RL-2} {RL-3→RL-4} {RL-6→RL-7} RL-5 RL-8。
**RL-6 が最も事故りやすい** — C-R1/C-R2 は 2-2（全緑でも壊れる）。`assertWritablePath` を緩める最短経路を
取られるとクライアントが任意の数値を出目として書けるようになる。委譲プロンプトで禁止を明示すること。

### RL-6 完了（2026-08-17・コミット `404a8946`）

Opus サブエージェントへ委譲（ユーザー指示で Codex は使わない）。証跡 = `review-results/roll-lane/rl6-acceptance.md`。

- `POST /character/:id/sheet/reroll` を新設。`CharacterSheetOperationService.rerollCreationRoll`。
  入力は `fieldUid` と `baseRevision` のみで**値を受け取らない**（C-R2）
- 対象条件は新設 util `roll-on-create-notation.util.ts` の `rollOnCreateNotation`（track の
  `rollOnCreate.notation` / roll の `notation`）。`assertWritablePath` は**無改変で saveSheet 専用のまま**（C-R1）。
  作成時の private 述語を行単位でこの util へ移動したので、作成と振り直しが同じ対象集合になることが構造で保たれる
- 実行は作成時と同じ `executeEvaluatedDiceRoll`（`executeDiceRoll` は rands 合算の legacy 互換で意味が違う）
- CAS 敗北時は**再試行しない**（再実行すると別の出目になり「見た版に対する 1 回の振り直し」でなくなる）
- **Fable の指示書ミスを 1 件 FIX**: 他人のシートを 403 にしていたが、兄弟の `PUT :id/sheet` は
  不在と他人を 404 に畳んで存在を隠している。**404 へ揃えた**（委譲先が自力で発見・報告）
- **検収**: 全ゲート Fable 再実行（build / circular 573 files / **全 225 suites 3182 tests**）。
  変異 3 本（述語の広げ・入力値の採用・所有者判定の恒偽化）はいずれも Fable が独自選定し**全て DETECTED**、
  復元 sha256 一致。**C-R1/C-R2 は 2-2 から 2-1 へ移った**

### PV-1 完了（2026-08-17・コミット `0a3fde2d`）

証跡 = `review-results/roll-lane/pv1-acceptance.md`。変更は `packages/sheet-engine` の 3 ファイルのみ。

- `partsKeys[].default?: ConstraintSource`（既存の `numberOrFormulaSchema` を再利用・新語彙なし）
- `RollOnCreate { notation, partsKey? }` を新設し **scalar と track で共有**（scalar の作成時ロールは新規）
- publish 検証: 行き先は `base` か宣言済みキーのみ（**`other` は ± の領分なので専用診断で拒否**）／
  scalar の記法は track と同一経路（`validateStandaloneRollNotation`）／`valueType === 'number'` 限定／
  list itemFields と **relation attrs** で配置拒否／予約キーへの既定値を拒否
- **既定値の式は 4 経路すべてに合流**（参照解決・型検査・**循環検査** `publish.ts:1385-1390`・見積もり `:293-297`）
- 検収: engine 552 / server 3182 / 循環ゼロ。**変異 4 本を Fable が独自選定し全て DETECTED**（うち MP2/MP4 は
  識別変異で、テストが診断内容まで固定していることを確認）

**Fable の指示書の誤りを委譲先が 2 件訂正**（どちらも Fable が実測で裏取り済み）:
①「`max`/`cap` は既に循環検査と見積もりに乗っている」は誤り（`computed` のみ）。結果として
**既定値は max/cap より厳しい**。**厳しい側を維持する裁定**（緩めるのは後から安全・厳しくするのは破壊的）。
再判断条件は `estimateStaticEvaluationSteps` の JSDoc に残置。
②「`validateField` は relation attrs へ再帰していない」は誤り（`publish.ts:599` で再帰）。
欠けていたのは配置拒否だけで、FIX はその 1 点。

**環境の穴（記録）**: `packages/sheet-engine` を対象にする eslint 設定が存在せず、engine のファイルは
lint が一度も走っていない。engine を触るスライスで lint ゲートを成果として主張しない。

**PV-2 への申し送り**: `parts: true`（自由キー）だと行き先は `base` しか通らない。
**legacy-coc の能力値は `parts: true`** なので、行き先を宣言キーにしたいなら宣言モードへ移す判断が要る。

**ユーザー裁定待ち（RL-6 の欠陥ではない仕様の穴）**: 作成時ロールを持つ **track** を振り直すと
Discord の ± で積んだ `parts.other` が失われる（生の数値で上書きするため）。配布中の legacy-coc は
track を持たないので**到達しない**が、作者が track に `rollOnCreate` とリソース役割の両方を付けると到達する。

**⚠️ ⑤の対象取り違え（2026-08-17・要注意）**: Fable は⑤を「Web から卓のロールを実行して
結果を共有する」と解釈して設計を進めたが、ユーザーの意図は **「キャラクター編集画面で
そのキャラクターの値をダイスロールで振り直す」**。Web からの卓ロールは**保留**。
卓ロール前提の論点（振る権利・履歴・多段判定・Discord 整合）は⑤の射程外になった。
**決定的制約**: `value-input.ts:137-156` の保存境界は **track と scalar のみ**受理。`roll` 型の値は
保存経路が無い。にもかかわらず `rerollable?: boolean` はその RollField 側に宣言されている
（`types.ts:78`・`publish.ts:119`）。振り直しは書ける型（track / scalar）へ結果を書く形にしないと成立しない。

**Fable の誤り 3 件（実測で自己訂正・メモリ `ai-md-claim-scoping` 11例目に記録）**:
「多段判定はどこにも無い」→ 実在（`dice-roll-logic.service.ts:169-185` に CoC7 6 段階・spec 固定）。
「履歴は残らない」→ 両ロール経路とも DB 保存。「権限は未定義」→ `roll-palette.handler.ts:39` に
「ロールは参加者全員可」の明示決定。**誤った前提のまま裁定質問を出し、ユーザーの決定を汚染した**。

**人間裁定待ち**: I-2（役割を公開前に試せる手段を①の射程に含めるか）／⑤の振り直し対象。

### 認知負荷レビュー（2026-08-17・RL-6 + PV-1 の小粒度＋大粒度）

証跡 = `review-results/roll-lane/cognitive-load-rl6-pv1.md`。Opus read-only 2 本（小粒度 = RL-6 server 差分 /
大粒度 = engine+server 横断）。Fable はレビュー本文を書かず、**処方箋の根拠になっている事実主張だけを実測**。

**確定した欠陥 3 件（記述のみ・FIX ラウンド中。挙動・例外・メッセージ文字列は不変）**
1. `op.service:77` の JSDoc が 403、実装は 404（両レビュー独立検出・**Fable の指示書の残骸**）
2. `roll-on-create-notation.util.ts` の完結列挙が、PV-1 と同時着地した瞬間に偽になる（scalar を無言で落とす）
3. reroll だけ materialize 前の 2 段前検査が無い理由が書かれていない（`op.service:389`）

**却下した処方箋（重要）**: 大粒度が front の述語 3 複製を Medium とし
「`index.ts` に named re-export を足して統合せよ」と処方したが、**二重に反証**。
①`annotation-runtime.ts:293` / `constraint-evaluator.ts:169` に「barrel 非公開を保つため
**named export 化しない・削除不可**」と明記（漏れではなく意図的な非公開化）。
②「機械的等価ガードが無い」が偽 — `TemplateFormRenderer.spec.tsx:339,355` に 9 型マトリクスの
等価 spec が実在し、**処方箋が消そうとしている deep import そのもの**で突合している。
真に残るのは `sheet-edit.ts:21-24` の `usesPartsEditor` に engine への等価 pin が無い点のみ（Low）。

**PV-2 / PV-3 の指示書へ転記する不変条件**
- `rollOnCreateNotation` の戻り値を PV-3 で `{ notation, partsKey? }` へ広げ、**同時に scalar を対象へ含める**。
  `string` のままだと PV-3 の最短経路が「呼び出し側で partsKey を再読」になり、RL-6 が 1 本化した述語が即再分裂
- `op.service:497-501` の許可集合構築は `value-input.ts:87-89` の**逐語複製**（Fable 実測）。
  PV-3 が周辺を触るので engine 側へ 1 本化できる（既存ロジックの抽出・新概念なし）

**PV-2 の決定点（欠陥と断定しない）**: `parts`/`partsKeys` を持たない素の number scalar に
`partsKey:'base'` を宣言すると publish は受理するが `allowsParts` は false。
`base` を「値そのもの」と解釈すれば成立しうるので、死んだ宣言になるかは PV-2 の設計次第。

**統合候補（中・独立スライス）**: `rollOnCreate` の配置規則が `validateNumericAnnotationTarget`
（既に attrs `:510` / itemFields `:515` へ再帰し max/partsKeys の配置規則を保持）を迂回して
`validateField` 側に書かれ、配置ルール走査が 2 本並走。統合は純減だが
**非 section 分岐の追加**と**メッセージ文字列を保ったままの移送**が着手条件。

**メモリ追記**: `verify-claims-before-prescribing` 24例目（レビュアの処方箋・否定的主張も検証対象）／
`ai-md-claim-scoping` 12例目（並行スライスは合流後のツリーで主張を再評価する）。

**コミット済み（2026-08-18・ユーザー許可）**: PV-1 = `0a3fde2d`（engine 3 ファイル＋レーン設計正本
`roll-lane-framing.md`）／RL-6 = `404a8946`（server 10 ファイル＋`AI.character.md`＋SESSION_HANDOFF）。
順序制約: FIX で RL-6 の util JSDoc が `ScalarField.rollOnCreate`（PV-1 が足す型）を参照するため、
**PV-1 を先に**コミットする必要があった。TRPG-SERVER は pathspec `--only`。
`--only` 使用時に pre-commit の整形が index にだけ残る churn が再発したので、hook の整形版を正として
amend で吸収（該当 spec 11 tests 再実行済み）。HEAD で全 suite 225 suites・3182 passed を再確認。
**意図的に未コミットのまま残したもの**: `design-ledger.md`（L-14/L-15＋能力マトリクス行）と
`character-sheet-user-guide.md`（cap の定義訂正）はイアキャラ調査由来でコードに依存しないため別単位。
`AI.development.md`・`start-dev.bat`・`trpg-next-app/*` は別レーン。

**FIX ラウンド完了・受入（2026-08-17）**: 6 件対応。差分は JSDoc・行コメント・
ローカル定数名・`@ApiResponse` description のみで、条件式・例外・status・メッセージ文字列は不変。
Fable がゲート再実行: build exit 0 ／ `√ No circular dependency found!`（573 files）／
**全 suite 225 suites・3182 passed**（PV-1 検収時と同一件数 = テスト増減なし）。
実物確認: `403` は振り直し経路から消滅（残る 2 件は filter spec のテンプレート閲覧権 403・別経路）／
`expectSheetUntouched` 残存 0 ／ 兄弟エンドポイントの `@ApiResponse` 未変更 ／ util の実装は無改変。
**変異テストは実施しない**（変異させる挙動が無く、検証命題は「挙動不変」なので実物確認と件数同一で担保）。

**正本の欠陥を Fable が修正**: `roll-lane-framing.md` の OP-R1 行と T-R5 行が **403** のままだった
（`op.service:77` と同じ出所）。spec がこの表を正本として指すようになったため 404 へ訂正。
あわせて T-R5 の対応条件が **C-R5 の誤り**だったのを訂正（C-R5 は実行失敗の条件で認可とは無関係・
T-R3 が既に担当）。正しくは OP-R1 の呼出し側前提。

**PV-3 で再訪する未解決 1 件**: `assertFiniteTrackValues` のうち「変更された track の `max` 式の有限性」
だけは materialize が持たず、振り直しで非有限に到達しうるかは**未検証**（コードにも `未検証:` と明記）。
legacy-coc は track を持たないので到達せず、`min`/`max` は全経路 advisory なのでデータ整合性ではなく
表示・検証の問題。ただし保存経路は非有限 max を拒否しており**経路間で判断が食い違う**。

### PV-2 を 2 スライスへ分割（2026-08-18・着手中）

順序は **PV-2a（ロールの行き先）→ PV-2b（既定値の焼き込み）**。逆にできない。
先に既定値を入れても、作成時ロールの**フィールド全体を生の数値で上書き**する現行の書き込み
（`character-instantiation.service.ts:111`）がそれを消すため。

**初版 PV-2a は誤った前提で書かれ、委譲先が着手前に停止して切り直した（2026-08-18）。**
指示書に「scalar にはガードが無い」と書いたが、正しくは **scalar の作成時ロールはそもそも発火しない**
（`rollOnCreateNotation` が scalar を読まない）。これは Fable が同じセッションの FIX ラウンドで
当該 util の JSDoc に書かせた内容であり、認知負荷レビューの統合判定にも書いていた。
**自分の 3 つの記述と矛盾する指示書を出した**（メモリ `verify-claims-before-prescribing` 25例目）。
委譲先の指摘どおり、scalar を発火させる手段は「util を直す（振り直しに scalar が入り生値で内訳を壊す）」か
「呼び出し側だけで読む（util の文書化された不変条件を破棄）」の 2 つしかなく、どちらも境界外だった。

改訂後のスライス（順序どおり）:

- **PV-R 完了・受入・コミット済み（2026-08-18・`20815545`）**。証跡 `review-results/roll-lane/pvr-acceptance.md`。
  述語を `rollOnCreateSpec`（`roll-on-create-spec.util.ts`・旧 `rollOnCreateNotation` を改名）へ広げ、
  共有の書き込み規則 `creationRollValue` を `sheet-values.util.ts` に追加して作成・振り直しの両方から呼ぶ。
  ゲート = build 0 / 循環ゼロ / **225 suites・3188 passed**（+6 = 追加テスト数と一致）。
  差分は server 6 ファイルのみで `packages/` 無変更。
  **変異 4 本を Fable が独自選定し全て DETECTED**。MR4（振り直しだけ共有規則を迂回）は識別変異で、
  作成側を正しいまま振り直し側だけ壊しても 3 tests が落ちる = 「両経路の規則一致」が機械固定されている。
  T-R2 の反転は牙が抜けていないことを個別確認（混入値 99 は `base` 側で落ちる・元より強い）。
  **主目的だった「作成時ロールを持つ track の振り直しで ± が消える」穴は閉じた**（旧「ユーザー裁定待ち」解消）。
  **小粒度認知負荷レビュー＋FIX ラウンド完了（2026-08-18）**。総評は「差分は認知負荷を net で下げている」。
  確定した欠陥 3 件はいずれも **Fable の記述が原因**で、Fable が実測で裏取りしてから修正:
  ①「`partsKey` は常に undefined」が偽（`publish.spec.ts:2389-2396` が track の `partsKey: 'base'` を pin。
  `partsKeys` と `rollOnCreate.partsKey` を同一視した誤り・挙動は不変・伝播 4 経路を訂正）／
  ②「二重の防壁」が経路の取り違え（保存経路と提出経路に 1 段ずつ）／
  ③ 早期 return が宣言された行き先を捨てる差集合の存在（**PV-S の設計判断として記録**）。
  あわせて `creationRollValue` を `roll-on-create-spec.util.ts` へ移送（importer 4 → 2・ホップ 2 → 1・
  `@nestjs/common` 依存の局所化。測定された純減・新概念ゼロ）。
  FIX 後ゲート = build 0 / 循環ゼロ / **226 suites・3188 passed**（suite +1 は移送先 spec・件数不変）。
  **検出器を再測**（テストの表明を狭めたため必須）: MR1=1・MR3=5・MR4=3 と**失敗件数が FIX 前と完全一致**。
  射程を名前に合わせる改善が負の対照の牙を削っていない。
  `sheet-values.util.ts` が Nest 例外を投げる層の問題は、移送により解消（同ファイルから Nest import が消えた）。
  コミット時、移送で `sheet-values.util.ts` と同 spec が **HEAD と完全一致に戻り `git status` に現れなかった**。
  同種の移送では「触ったのに出てこない」を欠落と誤認しないこと。
  コミットは 9 ファイル・337+/66−、index 残渣なし。

- **PV-R の設計**（指示書 `review-results/roll-lane/prompt-pv2a-code.txt`。旧 PV-2a ＋ 旧 PV-3 を統合）:
  **scalar を発火させないまま、作成と振り直しの「書き込み側」だけを内訳対応にする**。
  `allowsParts` が true なら内訳 1 キーへ書き既存キーを保持、roll 型は生の数値のまま。
  述語 util の戻り値を `{ notation, partsKey? }` へ広げて改名する（後回しにすると書き込み側が
  `field.rollOnCreate?.partsKey` を再読して述語が再分裂する — 認知負荷レビュー大粒度 CL-1）。
  **track の既存ガードは無改変**。
  主目的 = **作成時ロールを持つ track を振り直すと Discord の ± が消える穴を閉じる**
  （旧「ユーザー裁定待ち」項目はこれで解消する）。
- **PV-S**: util に scalar 分岐を足して発火させる。PV-R で受け皿ができているので分岐 1 つで済み、
  「scalar が黙って振り直し対象になり生値で内訳を壊す」窓が発生しない。
  ここで初めて `partsKey` が `base` 以外になりうる。scalar 側の提出値排他ガードもここ。
  **PV-S の設計入力（認知負荷レビュー CL-4・Fable 実測済み）**: `validateScalarRollOnCreate`
  （`publish.ts:657-674`）は `valueType === 'number'` しか要求せず `parts`/`partsKeys` を要求しない
  （`publish.spec.ts:2381-2387` が「行き先なしの scalar 作成時ロール」を `ok: true` で pin）。
  一方 `allowsParts` は `parts === true || partsKeys !== undefined` を追加で要求する。
  **差集合（number scalar・rollOnCreate あり・parts 未宣言）は publish 合法だが、
  `creationRollValue` の早期 return に落ちて宣言された行き先も `other` 拒否も素通りする。**
  この扱いを決めるのが PV-S の主要な設計判断（publish で拒否するか、`base` を全体値と解釈するか）。
  反転する pin = `character-instantiation.service.spec.ts:240-270` の 'object' ケース（非発火 → 発火）。
  **→ 2026-08-19 に #46 で決着済み**（差集合は生の数値のまま。理由込みで下記
  「現在の feature: PV-S レーン」を参照。ここから下の PV-S 記述はすべて着手前の見立て）。
- **PV-2b**: `partsKeys[].default` を作成時に評価して内訳へ入れる。式の評価は既存の
  `evaluateConstraint`（`constraint-evaluator.ts:38`）。提出値との合成規則を決めて固定する。

**委譲先が発見した第 2 の防壁（不変条件の根拠として採用）**: roll 型への内訳形書き込みは
`value-input.ts:40` より手前、`sheet-materializer.service.ts:342-363` で先に落ちる
（roll 型の保存値は有限数か文字列のみで経路が別）。「roll 型は生の数値のまま」は二重に機械固定されている。

**実測でわかった重要事項（期待値の調整が要る）**: **配布中の legacy-coc は PV-2a の影響を受けない。**
能力値 scalar は `parts: true` だが `rollOnCreate` を持たず、作成時ロールは **roll 型フィールド**に
乗っている（`seeds/legacy-coc.template.ts:38` の `notation: ability.rollNotation`）。
roll 型は `allowsParts` が false なので保存形は変わらない。
**イアキャラのように「能力値そのものが 振った値 ＋ 修正」になるには、能力値を roll 型併存から
scalar の `rollOnCreate` ＋ 宣言 partsKeys へ移す必要があり、これは seed（配布テンプレート）の
構造変更**（PV-5 圏・公開済みテンプレートの不変契約に触れるので単独の裁定が要る）。

**保存境界の追加確認（検収記録の裏取り）**: `value-input.ts:40` に
`isPartsValue(value) && !allowsParts(field)` の拒否が実在する。先の統合判定では
「`allowsParts` が false だから保存境界が内訳形を受け付けない」を推論で確認扱いにしていたが、
直接の根拠はこの行。結論は変わらない。

### RL-7 振り直しボタン（2026-08-18・着手・ユーザー選択）

PV-R のコミット後、ユーザーが次の対象として**振り直しボタン**を選択した。
RL-6 のサーバ経路は完成済みで**消費者ゼロ**なので、繋ぐだけで成果が見える。

**フロントの実測（着手前ベースライン）**

- 振り直しの UI は**どこにも無い**（`trpg-next-app` に "reroll" の呼び出し 0 件）
- `packages/api-contract` に "reroll" の語が **0 件**。この経路だけ wire を持たない
  （兄弟の `PUT /sheet` は `SaveCharacterSheetResultWire`、`POST /from-template` は
  `CreateCharacterFromTemplateResultWire` を持つ）
- track はエディタで `rollOnCreate` を宣言できるので、作成から振り直しまでが
  ボタンひとつで通しで使えるようになる

**述語の所在は決着済み（D-11 の再確認）**: `rerollable` フラグは使わない。
対象は「作成時ロールを宣言しているか」だけで区別する。`rerollable` の削除は RL-8。
実装が `engine` / `publish` / `seed` / `front` の 4 箇所に散っているが、**動かない設定**である。

**3 スライスに分割した。1 スライス = 1 パッケージ境界。**

- **RL-7a 完了・受入・コミット済み（2026-08-18・`bc41e9ef`）**。証跡 `review-results/roll-lane/rl7a-acceptance.md`。
  移送先は `packages/sheet-engine/src/roll-on-create.ts`（新規）、server 側は
  `creation-roll-value.util.ts` へ改名して `creationRollValue` だけが残る。
  **純粋移送であることを機械比較で確認**（コメント・空白・セミコロンを正規化したトークン列で
  HEAD と `identical`。関数 2 本と型 1 本すべて）。
  ゲート = engine build 0 / **14 suites・564 passed**（+12）／server build Done / 循環ゼロ /
  **226 suites・3188 passed**（±0）。
  **dist の実物で barrel の named export を確認**（`typeof: function`・track の行き先が載る・
  scalar は undefined）。engine → front の runtime 値は既知の盲点なので宣言では確認しない。
  **変異 5 本すべて DETECTED**。うち跨ぎパッケージ変異（engine を壊して dist を再ビルドしてから
  server 全 suite）で **server 8 tests / 3 suites** が失敗 = 移送後もサーバ側の安全網が生きている。
  小粒度認知負荷レビュー（read-only Opus）＋ FIX ラウンド完了。総評は
  「移送は機械比較で純粋、**JSDoc の保証主張は差し引きで弱められている**」。
  **PV-S への申し送り（FIX-1 の実質・Fable が変異で切り分け）**: engine spec は
  「ガード無しで scalar を読む」（2 tests 赤）と「publish と同じ `valueType` ガード付きで読む」
  （1 test 赤）を**識別できる**ようになった。FIX 前は両設計が区別できなかった。
  `types.ts` は `ScalarField.rollOnCreate` を `valueType` で絞っておらず、絞るのは publish の
  `validateScalarRollOnCreate` だけ。**publish だけが絞っている宣言を述語側でどう扱うかが PV-S の判断点**。
  **→ 2026-08-19 に #46 で決着済み**（述語は `valueType` を絞らない。下記「現在の feature: PV-S レーン」を参照）。
- **RL-7a の設計**: 述語 `rollOnCreateSpec` と型を `packages/sheet-engine` へ移送し
  barrel から named export する。`creationRollValue` は Nest 例外を投げるので server 残留。
  **理由**: 述語は現在 TRPG-SERVER にあり front から import できない。
  このままだと front に **4 本目の複製**ができ、しかも正本が server なので
  front 側から等価 spec で固定できない（既存の等価 pin は engine に対して張られている。
  例 `TemplateFormRenderer.spec.tsx:339,355` の 9 型マトリクス）。
  複製を作ってから統合するより先に移す
- **RL-7b 完了・受入・コミット済み（2026-08-18・`3655764`）**。証跡 `review-results/roll-lane/rl7b-acceptance.md`。
  `RerollCreationRollResultWire`（型のみ・6 キー）を api-contract に追加し、controller の戻り型を
  `Promise<unknown>` から置き換え、service 応答に**保存値 `value`** を載せた。
  ゲート = api-contract 7/27 ／ server build Done / 循環ゼロ / **226 suites・3207 passed**（3204→3207）。
  **変異 3 本すべて DETECTED**（MW1=1・MW2=2・MW3=3。MW1 が 1 件なのは委譲先の自己申告
  「生の数値の roll は total と一致するため単独では検出できない」と実測が一致したもの）。
  **小粒度レビューの CL-1 が本命だった**: controller の wire 宣言は**実装と型検査されていなかった**
  （DI が `useExisting` 経由で Nest 側が `any`。実例 = `character-sheet-http-validation.spec.ts` の
  2 キー mock が型エラーにならない）。既存パターンで
  `src/domains/character/character-wire.contract.spec.ts` に橋を張り直した。
  **Fable が独自の負の対照で 2 本の腕を切り分け済み**: 結果型へのキー追加は `IsExact` と
  キー集合差分の**両方**が発火、optionality だけのずれは **`IsExact` のみ**が発火。
  FIX-3 の往復テスト（応答 revision を次の baseRevision に渡す／書き戻さないと 409）で
  MW3 の検出器が 2→3 に強化された。**これは RL-7c が踏むはずだった退行そのもの**。
- **RL-7b の設計**（指示書 `review-results/roll-lane/prompt-rl7b-code.txt`）: 振り直し応答を
  api-contract の wire として定義し、server 応答を合わせる。
  **wire には振り直し後の保存値を載せる。**
  載せないと front が出目の合計から保存形を自分で組み立てることになり、
  PV-R で `creationRollValue` の 1 箇所に閉じたばかりの変換規則が 2 実装に分裂する。
  応答に同乗している `character` 全体から読ませる案は採らない
  （`SaveCharacterSheetResultWire` の JSDoc どおり `character` は保証面の外に置く方針）。
  `index.spec.ts` が公開面を型名とランタイム値 19 名で pin しているので、その更新を伴う
- **RL-7c 完了・受入（2026-08-18・未コミット / ユーザー許可待ち）**。
  証跡 `review-results/roll-lane/rl7c-acceptance.md`。
  指示書 `prompt-rl7c-code.txt` ＋ FIX 指示書 `prompt-rl7c-fix.txt`。
  差分 9 ファイル・**+683/-18**。ゲート = typecheck 0 / `eslint .` 0 / **front 34 suites・588 passed**。
  実装形は `creationRollReroll?: { onRequest, pendingFieldUid }` の 1 オブジェクト prop。
  プレビュー漏れは**描画側と呼び出し側の両方**に pin がある。
  **変異 9 本を Fable が実測**（復元 sha256 全一致）。検出されるべき 7 本は全て DETECTED。
  沈黙する 2 本は理由が特定済み: **MF5**（`setBaseline` 削除）は今日の対象が track / roll で
  `deriveSheetChanges` が読まないため観測者を作れない（負の対照 MF6 は落ちるので spec 故障ではない）、
  **MF7b**（`handleReroll` の `!canReroll` ガード削除）は DOM ゲートが先に効く多層防御。
  **小粒度レビュー 7 件は全件 Fable が実物で裏取りし、6 件を FIX で消化**（FIX-1 のみ挙動変更）。
  1 件（CL-6・位置引数 10→11）はレビュア自身が「本スライスでは不要」と判定したので対応せず。
  **FIX-1 = 保存競合パネル表示中は振り直しの導線を出さない。**
  パネルを開く経路が `baseRevision` を進めないため、その間の振り直しは server 入口の
  revision 比較で必ず 409 になる。失敗時の案内が「ページを再読み込みしてから再入力」なので、
  **従うと未保存編集と競合パネルの両方を失う**（パネル自身は「他の項目は引き続き編集できます」と案内）。
  prop を渡さない形で塞いだので**新概念ゼロ**。判別力は Fable の変異 MF7a で確認済み
- **RL-7c の検収で判明した Fable 自身の誤り 3 件**（いずれも指示書経由でコードコメントまで伝播）。
  ①「`retryable` の判定を `saveSheet` に揃えろ」→ 消費者ゼロの値を生んだ（FIX-2 で削除。
  そもそも振り直しの再試行は安全でない。saveSheet の再送は `baseValue` CAS に守られるが、
  振り直しの失敗応答は保存有無を伝えないので再送は意図しない 2 回目の出目になる）。
  ② 先例参照の誤り（上の【訂正】）。③ 409 を 1 種と断定（実際は 3 種）。
  メモリ `ai-md-claim-scoping`（16 件目）と `verify-claims-before-prescribing` に記録済み
- **RL-7c の設計**: `CharacterSheetEditClient` に導線を足す。
  TFR へ optional prop を追加し、渡されたときだけ描画する。
  TFR の利用は 2 箇所（編集画面と `TemplatePreviewV3`）で、プレビューに振り直しが漏れてはいけない
  （プレビューの field は未保存なので、押せば 422 になる）。
  **【訂正 2026-08-18】** 設計時に「オプショナル prop の有無で機能を出し分けるのは
  `onPartsChange` と同じ既存イディオム」と書いたが、**これは誤り**（Fable の未検証の前提が
  指示書 → コードコメントまで伝播した）。実測すると TFR の既存 optional prop は
  `onChange` も `onPartsChange` も**未指定でも描画し続け、`?.()` で無効化するだけ**
  （`onPartsChange?.()` は :442 と :595、`onChange?.()` は :872/:885/:899/:911）。
  `creationRollReroll` は**この component で最初の「未指定なら描かない」prop** であり、
  保証を与えているのは early return 1 行だけ。だからこそテスト 2 本
  （描画側「未指定なら描かない」＋呼び出し側「TemplatePreviewV3 は渡さない」）で固定してある

**RL-7a → RL-7b は直列。** 両者とも `character-sheet-operation.service.ts` を触るため並行不可。

### 大粒度認知負荷レビュー（2026-08-18・RL レーン = feature 完了ゲート）

対象は engine の述語・publish 検証・server の書き込み規則と 2 経路・contract・front 消費の 3 パッケージ横断。
前回の大粒度は RL-6＋PV-1 時点で、以後 PV-R / RL-7a / RL-7b / RL-7c の 4 フェーズが経過していた。

**Fable が立てた複製仮説 6 本のうち 5 本が実測で否定された。**

- 「作成時ロール対象か」の述語は `rollOnCreateSpec` **1 本**で、runtime 3 経路
  （作成 `character-instantiation.service.ts:105` / 振り直し `character-sheet-operation.service.ts:382` /
  導線表示 `TemplateFormRenderer.tsx:717`）**すべてが経由**している。
  **front も server も `field.rollOnCreate` を直読みしていない**
- 行き先規則も `creationRollValue` **1 本**を作成と振り直しが呼ぶ。二重実装なし
- 2 つの結果 wire を同時に保持する必要があるのは `character.wire.ts` 1 ファイルだけで、
  キー名を揃えていない理由が `:186-188` に書いてある
- revision 意味論の 5 記述のうち 4 件はそれぞれの局所判断の理由で、全件が根拠コードを名指し

**PV-R・RL-6・RL-7a が「1 本化」を目的に置いた設計が機械的に効いていることの独立確認**になった。

残った findings は 4 件すべて RL-7c の差分外で、掃除スライスとして起票済み（**新しい層・抽象・contract を
足す提案はゼロ**。全て削除・局所化・欠落キー 1 個の追加）。実施順は RL-8 → CI-2 → CI-1 → wire label。

- **RL-8 完了・受入（2026-08-18・未コミット / ユーザー許可待ち）**。
  証跡 `review-results/roll-lane/rl8-acceptance.md`。差分 **8 ファイル・+50/-14**。
  削除 9 箇所・production の読み手は削除前から 0 件。
  ゲート = engine build 0 / **565 passed**（+1）、server build 0 / **循環ゼロ** / **3207 passed**（±0）、
  front typecheck 0 / eslint 0。
  **順序の制約（大粒度レビューの推奨を Fable が訂正）**: front の `types/v3` は engine の
  `SheetField` を再エクスポートするだけなので、engine の型を先に消すと余剰プロパティ検査で front が赤くなる。
  「engine 先行でも壊れない」は**保存済みデータの publish についてのみ**正しい。よって 1 スライスにまとめ、
  **書き手 → 宣言**の順で消した。
  publish spec に「出荷済みテンプレートが持つ `rerollable` は publish を通る」を 1 本追加（テスト名に退役キー名を残す）。
  **`.passthrough()` の意味論を union 直上にコメント化**（下記）。
  小粒度レビュー 2 巡・findings 6 件を全件 Fable が裏取りして全件消化。
  変異 RE1/RE2/RE3 で検出器を確定
- **`.passthrough()` について確定した事実（Fable の指示書の誤りを実測で訂正）**:
  **zod object の既定は reject ではなく strip**。`.passthrough()` は publish の合否ではなく
  **未知キーを保持して H-6 gate（`validateNumericAnnotationTarget`）へ届けること**を担う。
  外しても型エラーを出さないまま gate が黙って効かなくなる。合否が変わるのは `.strict()` 化したときだけ。
  依存しているのは非 scalar の **6 メンバー全部**（scalar だけ早期 return するので事情が違う）。
  番人は `it.each` 系列 `rejects passthrough numeric annotations on a section-level %s field`。
  **RE2（roll を外す）だけを測って「射程は roll に閉じている」と追認したのは Fable の推論ミスで、
  RE3（relation を外す）で反証した**。変異は自分が壊した場所しか測らない
- **front 全 suite の 5 件失敗は RL-8 と無関係**（タスク #53 TE-1）。
  `TemplateEditorV3.spec.tsx` の重い 5 本が jest 既定 5000ms を超える負荷依存のタイムアウト。
  失敗 describe 内の `'roll'` 出現数 0・describe 単独なら 5 passed/22 秒・
  `--testTimeout=20000` で 99 passed。**失敗テスト数が 0 でないので競合の署名ではない**点に注意
- **CI-1**（旧タスク #51 → **#46 へ吸収・裁定済み 2026-08-19**):
  `character-instantiation.service.ts:94-105` の提出値ガードだけが述語を経ず型直読み
  （`field.type === 'track' && field.rollOnCreate !== undefined`）。同一ループ内 8 行の距離に
  判定が 2 つある。PV-S で scalar を発火させるとガードが追随せず、**track は 422 で loud・
  scalar は無言上書き**という非対称が生まれる。
  **単独スライスにできないことが分かったので #46 へ畳んだ**。scalar が発火しないうちは
  `rollOnCreateSpec` が scalar に undefined を返すため scalar 側のガードが 1 度も通らず、
  受入テストが書けない。「PV-S と同一 diff に混ぜない」という以前の記載はこの理由で撤回する
- **CI-2**（タスク #52）: `collectTopLevelFields` が同名・異本体で 2 実装
  （instantiation 側は `Array.isArray` 防御あり、materializer 側はなし）。1 回の `instantiate()` で両方走る。
  `findTopLevelField` は返り値型も throw も違うので統合対象にしない（フラグ引数が生えて共有抽象結合になる）
- **wire label**（単独起票しない）: 振り直し wire に `label` が無いため front が 3 本目の top-level 走査
  （`fieldLabels`）を持つ。**キー名の統一は提案されていない**（`fieldUid` 優勢の理由が wire に明記済み）

**intrinsic として除外（Fable 追認）**: 出目と内訳の意味論、`other` 禁止の 2 層（宣言時検査と
書き込み時防壁で役割が違う）、`@ResponseMessage` が front で未使用（全ルートの規約）、
wire 型追加のたびに eslint allowlist を編集する儀式（永続化スキーマの front 使用禁止という理由がある）。

**TFR の描画ヘルパの引数形が分裂している**（位置引数 2 本・object 引数 2 本）のは **RL-7c 以前から**で、
RL-7c はどちらも既存形のまま末尾に 1 本足しただけ。将来 object 引数形へ寄せると
呼び出し側の保持事項が「11 の順序」→「11 の名前」になり**新概念は 0**。RL-7c の受入条件には含めない。

**フロント状態モデルの実測（RL-7c の設計入力）**

`CharacterSheetEditClient` は `baseline`（サーバ既知値）・`values`（編集値）・`baseRevision` を
props から `useState` 初期化子で保持する。初期化子は再レンダーで再実行されないので、
`router.refresh()` だけでは state が古いまま残る。だから応答から更新する必要がある。

- 振り直し対象（track / roll）は `editableScalarFields` の対象外なので `changes` に入らない。
  `values` と `baseline` を同時に更新すれば差分は生じない
- track の表示は `trackDisplayValue` が `raw.parts` を合算するので、内訳形の保存値をそのまま入れてよい
- **revision の扱いが兄弟経路と非対称**: `rerollCreationRoll` は
  `sheet.revision !== input.baseRevision` で即 409 になる（`character-sheet-operation.service.ts:371`）。
  一方 `saveSheet` の競合判定は path ごとの `baseValue` CAS で、`baseRevision` は再送規約用の情報値
  （`CharacterSheetEditClient.tsx:126` のコメント）。
  よって振り直し後は応答の revision で `baseRevision` を更新しないと次の振り直しが落ちる。
  未保存の scalar 編集は別 path なので per-path CAS を通り、振り直しでは失われない
- 【訂正】coverage threshold の罠は**旧 trpg-remix-app のもので、現行 trpg-next-app には閾値が無い**。
  閾値を持つのは TRPG-SERVER 側（メモリ `front-coverage-threshold-trap`）。
  「front は global 80% threshold」という以前の記載は誤りだったので撤回する

## 現在の feature: PV-S レーン（scalar の作成時ロール）— 2026-08-19 着手

**発端（ユーザー要望）**: 「式 `floor(({parameter.con} + {parameter.siz}) / 10)` があるとき、
con と siz にダイスのような計算式を許してほしい」。

**診断（実測）**: 配布中の Legacy CoC テンプレートは**作成直後に HP / MP / SAN が 0 になる**。
`legacy-coc.template.ts` の 8 能力値が scalar（`con`）と roll（`con_roll`）の二重宣言で、
作成時ロールは `values[field.uid] = ...`（`character-instantiation.service.ts:113`）と
**自分の uid にしか書かない**。出目は `con_roll` に入り、式が読む `con` は空のまま。
未入力 scalar は `numberOrZero` で 0 に落ちて静かに通るので `floor((0 + 0) / 10)` = 0 になる。
「振る役」と「式が読む役」が別フィールドに分かれているのが原因。

**宣言 4 形の実測**

| 宣言 | 作成時に振れる | 式から数値で読める | 手で直せる | エディタで宣言できる |
|---|---|---|---|---|
| scalar 数値（今の `con`） | ✕ | ○ | ○ | ○ |
| roll 型（今の `con_roll`） | ○ | 振った後だけ | ✕ | ○ |
| track ＋ `rollOnCreate` | ○ | ○ | ○ | ○ |
| **scalar ＋ `rollOnCreate`** | **✕ 発火しない** | ○ | ○ | **✕ 入力欄が無い** |

- roll 型が手で直せないのは `inputSchemaFor` が scalar / track にしか schema を返さないため
  （`value-input.ts:137-144`）。保存は `field ... is not an input field (roll)` で弾かれる
- roll 型を式が参照すると未ロールのうちは `{type:'dice'}` になり
  `Expected number, got dice` で式ごと落ちる（`evaluator.ts:181`, `:482`）
- track は `max` と `style` が必須でゲージ UI が付く。能力値には形が合わない
- scalar ＋ `rollOnCreate` は**型も publish も既に受理している**のに、
  `rollOnCreateSpec` が scalar を読まない（`roll-on-create.ts:56`）ため発火しない。
  エディタの scalar 分岐（1283-1334）内の `rollOnCreate` 出現数は**実測 0 件**

**ユーザー裁定 2 件（2026-08-19）**

1. **形は「scalar に作成時ロールを足す」**。con を数値 scalar のまま `rollOnCreate` で宣言し、
   作成時に 1 回振れて・式は数値を読み・あとから手でも直せる形にする。
   却下: seed の式を roll 側へ向け替える案（手で直せなくなる／点消費・年齢修正が不可）、
   式が dice を評価する案（computed は保存のたび `buildComputedCache` で再評価されるので HP が毎回変わる）
2. **提出値は「衝突するときだけ 422」**。track の一律 422（裁定 5）は不変。
   scalar は内訳を持てて作成時ロールは**内訳の 1 キーにだけ書く**ので
   （`creationRollValue(field, currentValue, total, spec.partsKey)`）、
   「職業ボーナスを `other` に入れつつ `base` は振る」が原理的に成立する。track にこの事情はない

**衝突の定義は `creationRollValue` の分岐から導ける**（実測。`creation-roll-value.util.ts`）:
`!allowsParts(field)` なら生の数値を返して提出を丸ごと捨てる／内訳形でない提出は `parts = {}` から
作り直されて捨てられる／内訳形の提出は行き先キー以外を保持する。よって衝突 =
`!allowsParts(field)` または提出が内訳形でない、または提出の `parts` が `partsKey ?? 'base'` を含む。

**射程の実測**: 今日クライアントから作成時に値が送られる経路は**無い**。
front の `createCharacter` の入力型は `templateId` / `templateVersion` / `characterName` の 3 つだけ
（`actions.ts:125-138`）。DTO 側は `values?` を optional で受けるので直接 API を叩けば到達する。

**PV-S は front の振り直し導線へ自動で波及する**。`renderCreationRollReroll` は
`rollOnCreateSpec` だけで対象を決める（`TemplateFormRenderer.tsx:722`）ので、
scalar が発火した時点で編集欄の下に「振り直す」ボタンが出る。front の変更は要らない。

**スライス**

| # | タスク | 内容 | 状態 |
|---|---|---|---|
| 1 | #46 PV-S | engine の `rollOnCreateSpec` が scalar を読む ＋ server の提出値ガードを衝突判定へ。CI-1 を吸収 | **実装＋修正 2 ラウンド完了・検収済み・未コミット** |
| 2 | #54 PV-S2 | エディタの scalar 分岐に「作成時ロール記法」入力欄を出す（track 分岐 1365-1397 と同型） | 未着手 |
| 3 | #55 PV-S3 | legacy-coc の二重宣言を 1 本に畳む。既存 published / pinned revision への影響を先に実測 | 未着手・**seeder の制約でユーザー裁定が 1 件必要**（タスク #55 の説明を参照） |

**#46 の変更は 8 ファイル**（engine 2・server 3・front 3）。検収記録 = `review-results/roll-lane/pvs-acceptance.md`。

**#46 で確定した設計判断**

- **提出値は「衝突するときだけ 422」**。衝突 = `!allowsParts(field)` ／ 提出が内訳形でない ／
  提出の `parts` が行き先キー（`spec.partsKey ?? 'base'`）を own property に持つ。
  この 3 条件は `creationRollValue` の分岐から導いたもので、独立した規則ではない
- **track の一律 422 は不変**（裁定 5）。契約外形（`rollOnCreate: true` 等）への提出も 422 のまま。
  この分岐だけが述語を経ず宣言の有無を直読みする。理由は「提出の拒否は発火の述語より外延が広い」で、
  engine 側 `roll-on-create.ts` の JSDoc が元から明記していた
- **述語は `valueType` を絞らない**。絞るのは publish の `validateScalarRollOnCreate` だけ。
  publish を経ずに保存された非 number scalar は発火し、`materialize` の
  `validateStoredValues` で **422 になる**（静かな破壊ではなく loud failure）。
  受理範囲と発火範囲を別々のゲートにしないための選択
- **内訳を宣言していない number scalar の出目は生の数値のまま**。内訳形にすると
  `value-input.ts` の `isPartsValue && !allowsParts` 拒否に当たり、以後クライアントから提出し直せない値になる

**#46 が front に波及した点（front のロジックは無変更）**

- `renderCreationRollReroll` は `rollOnCreateSpec` だけで対象を決めるので、
  **scalar にも振り直しボタンが自動で出る**。`TemplateFormRenderer.spec.tsx` に描画テストを 1 本追加して pin した
- `applyRerollResult` の baseline 書き戻しが**生きた挙動になった**。PV-S 前は振り直し対象が
  track / roll だけで `deriveSheetChanges` の対象外だったので無害だったが、scalar は
  `editableScalarFields` に含まれるため、baseline を進めないと振り直した値が
  偽の未保存差分として保存対象に入る。`CharacterSheetEditClient.spec.tsx` に検出テストを 1 本追加した
  （`setBaseline` を落とすとその 1 本だけが赤になることを実測）

## 参照

- 設計・経緯の詳細: AI.md / AI.refactor.md ほか AI.*.md（正本はそちら。ここは復帰用の要約）
- レビュー証跡: review-results/（俯瞰#6 は overview-6/）
- compact 直前スナップショット・要約: .claude/compact-log/
- Codex 委譲ランナー: `bash review-results/g3b-app-filter/retry-codex.sh <code|review> <prompt-file> <outdir>`
