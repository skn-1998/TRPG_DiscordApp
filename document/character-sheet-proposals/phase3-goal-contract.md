# Phase 3 Goal 契約（DRAFT v0.9 — ユーザー決定待ち）

- 状態: **ドラフト**。D-P3-1〜D-P3-4 のユーザー決定後に v1 確定
- 作成: 2026-07-13（Fable 主担当体制。材料収集＝正本ドキュメント全数抽出、レビュー＝独立サブエージェント）
- 前提: Phase 2 実装完了（PH-7 実機受入＝D-3 のみ残）。本契約は D-3 通過後に着工する
- 形式: [phase2-goal-contract.md](phase2-goal-contract.md) と同じ P/G/M/I 構造

## Evidence（出典台帳・抜粋）

| ID | 出典 | 内容 |
|---|---|---|
| E-1 | design-v1.md §7 | Phase 3 既定スコープ＝track/list/relation/tag＋ブロック UI＋Discord track±・行ロール＋palette/user-dice 名前空間統合＋**migrate ウィザード最小** |
| E-2 | design-v1-ui.md L165-166/U11(h) | migrate 最小＝差分プレビュー→orphan review→palette 再生成（key 維持）→hub rebuild。充実は Phase 4 |
| E-3 | phase2-goal-contract I-1/I-2（承認済み） | U5（Discord テンプレ作成）と既存スレッド rebuild は Phase 3 の領分 |
| E-4 | phase2-operation-contracts L24/OP-5/GAP-B | legacy→materialized 変換・error/posted-but-untracked からの手動 rebuild は Phase 3 |
| E-5 | README 未決 15＝checklist §7-1＝AI.character 追記7 | 作者ピン留めフラグが schema v3 に無く先頭20ロール縮退で出荷（三重記載の同一事項） |
| E-6 | AI.character 追記7b | listener の TypedEventService 直接登録を Phase 3 で ARCHITECTURE 方針へ追従／429 リトライ回数メモリ限定は残置 |
| E-7 | design-v1 §4/L62/§8-3 | v1.x 予約: `declare`(dec_)・`check`(chk_)・`when`。投影廃止ゲート＝全 consumer 移行＋backfill＋E2E 緑（期限でなく実装ゲート） |
| E-8 | seeds/legacy-coc.template.ts:124-126 | legacy-coc の skill セクションは「Phase 3 の list 導入まで」互換投影が正本 |
| E-9 | design-v1 §9/§8-11 | GM/セッション権限モデル・共有シート P14・リセット発火権限・SW 威力表 lookup は**持ち越し継続**（Phase 3 に入れない） |

## ユーザー決定点（着工前に必要）

| ID | 決定事項 | 推奨案 | 根拠 |
|---|---|---|---|
| D-P3-1 | Phase 3 スコープの確定: (a) E-1 の既定コアのみ／(b) コア＋U5／(c) コア＋U5＋v1.x（declare/when） | **(b)**。v1.x kind 拡張は field 型4種と migrate が安定してから | E-1, E-3, E-7 |
| D-P3-2 | 作者ピン留めフラグを schema **v3.1** として追加するか（published 不変性より新 version でのみ有効） | **追加する**。hub のピン留めが「作者の意図」を反映できないままだと G-5 の価値が半減 | E-5 |
| D-P3-3 | 投影廃止ゲートを Phase 3 の**exit 条件に含めるか**（含めると旧 skill_/ability_ の段階廃止まで） | **含めない**（ゲート成立の観測のみ。廃止実行は Phase 4 冒頭） | E-7 |
| D-P3-4 | migrate の対象範囲: 全 legacy 一括ウィザードか、キャラ単位のオンデマンドか | **キャラ単位オンデマンド**（所有者が実行・失敗時の影響半径最小） | E-2, E-4 |

## Purpose Map（ドラフト）

| ID | Actor | Purpose |
|---|---|---|
| P3-1 | テンプレ作者/プレイヤー | 複雑な TRPG（リスト技能・関係値・タグ・回数リソース）をテンプレ化できる（field 型の完成: track/list/relation/tag） |
| P3-2 | 既存ユーザー | legacy キャラを安全に materialized へ移行できる（migrate ウィザード最小） |
| P3-3 | Discord ユーザー | Discord 起点でテンプレ由来キャラを作成できる（U5） |
| P3-4 | 運用 | Phase 2 の残置負債の解消（listener 登録方式・作者ピン留め縮退） |

## Goal Contract（ドラフト・達成判定つき）

| ID | Purpose | Type | Observable condition |
|---|---|---|---|
| G3-1 | P3-1 | acceptance | 4 field 型が Web エディタで作成・publish でき、Discord で track ±・list 行ロールが実機動作。**ボタン→select フォールバックの実機確認**（E-1 の検証ゲート） |
| G3-2 | P3-1 | constraint | legacy-coc テンプレへ skill を list として追加し、互換投影と characterization が**双方向一致**（E-8 の解消） |
| G3-3 | P3-2 | acceptance | migrate＝差分プレビュー→orphan review→palette 再生成（**既存 palette key 不変**）→hub rebuild が1キャラで完走。**dry-run 既定・巻き戻し手順同梱**（M-2 backfill と同じ実行契約） |
| G3-4 | P3-2 | constraint | migrate 失敗時に legacy 原本が 1 bit も変わらない（変換は copy-on-write） |
| G3-5 | P3-3 | acceptance | `/create-character` でテンプレ select（≤25）→名前 modal→rollOnCreate→hub 投稿。**既存 legacy 作成フローと registry 併存** |
| G3-6 | P3-4 | spec | HubThreadEventListener を event registry 経由の登録へ移行（挙動不変・spec 固定） |
| G3-7 | P3-4 | spec | （D-P3-2 採用時）schema v3.1: PaletteEntry ピン留めフラグ＋projection の優先順位反映＋round-trip spec |
| G3-8 | 全 | constraint | Phase 2 と同一のゲート体系＋スライス毎独立レビュー（Fable 体制） |

## Means（ドラフト・スライス案）

| ID | Goal | 内容 | 依存 |
|---|---|---|---|
| M3-1 | G3-1 | packages/sheet-engine: 4 field 型の evaluator/publish 拡張（schema はマイナー版で後方互換） | なし（先行可） |
| M3-2 | G3-1 | Web ブロック UI（エディタ＋シート編集）＋Discord handler（track±/行ロール） | M3-1 |
| M3-3 | G3-3, G3-4 | features/character-sheet: MigrationService（copy-on-write・orphan 検出）＋front ウィザード | M3-1 |
| M3-4 | G3-5 | discord features: /create-character のテンプレ分岐（I-1 で凍結していた commands.list に初めて触る） | M3-1 |
| M3-5 | G3-6, G3-7 | 残置解消スライス（listener 登録・v3.1 ピン留め） | 独立 |
| M3-6 | G3-2 | legacy-coc v2（skill=list）＋characterization 拡張 | M3-1, M3-3 |

## Issue Ledger（ドラフト）

| ID | Type | 内容 | 扱い |
|---|---|---|---|
| I3-1 | assumption | GM/権限モデル・共有シート・リセット発火権限・SW lookup 拡張は Phase 3 に**入れない**（E-9 継続） | 要ユーザー追認（D-P3-1 に含意） |
| I3-2 | gap | 429 リトライ回数のメモリ限定は単一プロセス前提の既知制約として**継続残置**（スケールアウト時に再訪） | 記録のみ |
| I3-3 | assumption | D-3（PH-7 実機受入）通過が Phase 3 着工の前提。NG が出た場合は該当 PH の fix が先行 | 進行仮定 |
| I3-4 | gap | 節目バランスレビュー（2026-07-13 実施中）の指摘は確定後に本契約へ反映 | 反映待ち |

## 破壊質問（契約検査・ドラフト時点）

- 手段なしで目的達成可？ → migrate なしでも新規キャラは Phase 2 で成立するが、P3-2（既存ユーザー）は migrate が唯一の手段 → M3-3 は必須
- 目標達成でも目的未達の反例？ → G3-1 が通っても「シノビガミ特技表」等のグリッド型は表現不可（design-v1 §8-9 の予約どおり・スコープ外を明記）
- 他アクターへの害？ → M3-4 が I-1 で守ってきた commands.list に触る＝legacy 作成フローの回帰リスク最大点。registry 併存＋characterization で防御
- 手段の目的化？ → v1.x kind 拡張（declare/check/when）を「予約があるから」で入れない。D-P3-1 で明示判断
