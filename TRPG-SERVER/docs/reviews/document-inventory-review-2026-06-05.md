# TRPG-SERVER ドキュメント整理レビュー 2026-06-05

> 本書は **レビュー専用**。既存 docs / 実装コードは一切変更していない。削除・移動・リネームは実行せず、
> 根拠付きの分類と推奨だけを記録する（委譲: `CLAUDE_HANDOFF.md` 冒頭「TRPG-SERVER ドキュメント整理レビュー（2026-06-05）」）。
> 断定と推測は分け、実ファイルを読めたものだけを分類した。読めていない/追えていない点は `未確認` または `推測:` と明記する。

> **【コミット後ステータス注記（2026-06-06 追記）】** 本レビューの git 状態スナップショット（現存 36 本 / 削除済み未コミット `D` 7 本 / 未追跡 `??` の `feature-inventory-2026-06-05.md`・現存 md 本数）は、すべて **`ecc6d63` 直後の作業ツリー時点**のもの。その後 **コミット `57bd2b5`「docs moved」で `TRPG-SERVER/docs/` 一式が追跡化され、削除 7 本もコミット済みとなった**。したがって本書の **「git 未追跡」「`D` 未コミット」「本タスクでは commit しない」系の記述は解消済み（履歴スナップショットとして保持）**。一方、**文書内容の陳腐化に関する分類・注記更新候補（Discord 設計系 As-Is、`AI.development.md` drift 等の現役 finding）は引き続き有効**で、本注記で弱めない。

## 結論

- TRPG-SERVER 配下のレビュー対象として現存 Markdown **36 本**、git 上 `D`（削除済み・作業ツリー未コミット）が **7 本**、合計 **43 本** を確認した。加えて本レビュー文書自身が新規作成されたため、作成後の `rg --files -g "*.md"` は **37 本** を返す。**※これらの本数は `ecc6d63` 直後の作業ツリー時点のスナップショット。`57bd2b5` で削除 7 本がコミット確定し、追跡 md 本数は変動済み（現状は git 追跡ベースで確認のこと）。**
- ドキュメント体系は概ね健全。**正本（canonical）は冒頭に正本ポインタ・履歴注記を持ち**、古い 2025 年スナップショットは自己注記で「履歴」と宣言されている。すぐ削除すべき「危険な誤導線」は少ない。
- 削除済み 7 本は `AI.refactor.md:1037-1039` の「削除（役目を終えた一過性メモ / 空ファイル）7 本」と**完全一致**しており、削除は**意図的**。レビュー時点ではワークツリー上 `D` のまま未コミットだったが、**`57bd2b5`「docs moved」でコミット済み＝解消（履歴スナップショット）**。
- すぐ対応すべきとして挙げた「**未追跡の正本 `feature-inventory-2026-06-05.md` を git 管理下に入れる**」は **`57bd2b5` で追跡化済み＝解消**。残るは「**索引(`AI.md` / `docs/README.md`)導線の整理**」で、こちらは削除ではなく索引化が推奨（`docs/README.md` から reviews/guides/history を案内済み）。
- すぐ削除してよいとは断定しない。下記「削除・統合の推奨順」で P0〜P2 として優先度付きで示す。

---

## 分類表

凡例: `AC`=Active canonical / `AS`=Active scoped / `HK`=Historical keep / `SS`=Superseded / `CC`=Cleanup candidate / `BM`=Broken/missing。
`CC` は **本タスクでは実行しない候補**。

| path                                                  | 分類         | 現在の役割                                                             | 根拠                                                                                             | 推奨アクション                                                                                                                         |
| ----------------------------------------------------- | ------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `AI.md`                                               | AC           | プロジェクト概要＋専門ドキュメント索引（入口）                         | `AI.md:5-10` 正本ポインタ・`AI.md:62-88` 索引                                                    | 維持。中盤以降の 2025 年スナップショットは注記済みで履歴。                                                                             |
| `README.md`                                           | AC           | TRPG-SERVER 入口・コマンド/スクリプト一覧・docs 案内                   | `README.md:69-81` ドキュメント案内                                                               | 維持。`AI.discord.md` を例示する `:80` の prose を後日 `src/discord/AI.discord.md` 表記に補正（link-risk 参照）。                      |
| `src/ARCHITECTURE.md`                                 | AC           | 全体方針・依存方向・置き場所決定表の正本                               | `src/ARCHITECTURE.md:1-14`、§12 決定表                                                           | 維持。Step 3 以降未着手の記述は計画として有効。                                                                                        |
| `AI.refactor.md`                                      | AC           | リファクタ進捗・現状・残課題の最新正本（最終更新 2026-06-04）          | `AI.refactor.md` 冒頭・`:1037-1040` 削除リスト                                                   | 維持。**削除候補の管理台帳**としても機能。                                                                                             |
| `AI.test.md`                                          | AC           | テスト戦略・テスタビリティ評価・カバレッジの正本（2026-06-03）         | エージェント精読（冒頭「最終更新 2026-06-03」）                                                  | 維持。                                                                                                                                 |
| `AI.features.md`                                      | AC           | feature 正本への索引（2026-06-05・実体は棚卸しへ委譲）                 | `AI.features.md:1-16`                                                                            | 維持。                                                                                                                                 |
| `docs/reviews/feature-inventory-2026-06-05.md`        | AC           | 実コード根拠の機能棚卸し現状スナップショット                           | 本書作成者が通読・`AI.md:82` / `AI.features.md:11` から被リンク                                  | 維持。レビュー時点は git 未追跡（`??`）だったが **`57bd2b5` で追跡化済み＝解消**。                                                     |
| `src/discord/DESIGN.md`                               | AS           | Discord 層統合設計（目標 arch・customId 契約・Phase 0〜4）             | 通読。Phase 1=完了・Phase 2 一部の更新済                                                         | 維持。**§2-3 As-Is（God Module 等）は解消済みで陳腐化**（feature-inventory D1）。注記更新候補（P1）。                                  |
| `src/discord/interactions/README.md`                  | AS           | Interactions レイヤーの役割・Handler 作法                              | 通読。`:33-34` が「God Module/特例分岐(移管予定)」と記載                                         | 維持。**特例分岐は P1-A で撤去済**＝陳腐化（feature-inventory D2）。注記更新候補（P1）。                                               |
| `src/discord/interactions/MIGRATION_GUIDE.md`         | AS           | Registry 移行・所有権移譲の手順書                                      | 通読。`:19` 「ルーティング1本化=Phase2 未着手」表記                                              | 維持。Phase 2 実態（slim 化済・特例撤去済）と差。注記更新候補（P1）。                                                                  |
| `src/events/DESIGN.md`                                | AS           | events 基盤の設計・バス一本化計画の現状正本（2026-05-31）              | `src/events/DESIGN.md:1-12`（T1〜T5 完了追記）                                                   | 維持。                                                                                                                                 |
| `src/events/AI.event.md`                              | AS           | イベント基盤の経路解説（冒頭=現状正本／以降=履歴）                     | 冒頭「この節が現状の正本・以降は履歴アーカイブ」                                                 | 維持。冒頭節のみ正本、後半は履歴と明示済。                                                                                             |
| `src/config/README.md`                                | AS           | 環境変数管理（schema/validator/AppConfigService）現役ガイド            | 通読。実 `src/config/*` と整合                                                                   | 維持。                                                                                                                                 |
| `test/testcontainers/README.md`                       | AS           | 使い捨て MongoDB E2E（`test:e2e:tc`）の現役ガイド                      | 通読。`README.md:54-57` から被リンク                                                             | 維持。「いつでも削除可」と自己明記。                                                                                                   |
| `src/discord/AI.discord.md`                           | AS           | Discord 層の現状メモ（日付付きメモ集積・正本ポインタ付）               | `:15-18` 「正本は DESIGN.md / AI.refactor.md」注記                                               | 維持。**下部 2025-08 残存課題（TS エラー22個等）は陳腐化**（注記済）。                                                                 |
| `src/discord/features/README.md`                      | AS           | features ディレクトリ概要（5 feature の役割）                          | 通読。末尾 `:502` 「最終更新 2025-08-21」                                                        | 維持。**機能横断フロー例・性能数値は古い概説**。詳細は feature-inventory が正本。                                                      |
| `src/discord/features/characterEdit/README.md`        | AS           | characterEdit feature の構成・公開 API                                 | 通読。`:206-208` に 2026-06-03 デッドコード削除注記                                              | 維持。比較的新しく実体と整合。                                                                                                         |
| `src/discord/services/README.md`                      | AS           | discord/services コアサービス群の scoped README                        | エージェント精読（末尾「最終更新 2025-08-21」）                                                  | 維持。実装と概ね整合（executeNotation=legacy 互換は現存）。                                                                            |
| `src/discord/services/channel/README.md`              | AS           | channel サービス群 scoped README                                       | エージェント精読（2025-08-21・実体整合）                                                         | 維持。                                                                                                                                 |
| `src/discord/services/dice/README.md`                 | AS           | dice 計算サービス群 scoped README                                      | エージェント精読（2025-08-21・主要メソッド整合）                                                 | 維持。                                                                                                                                 |
| `src/discord/services/monitoring/README.md`           | AS           | monitoring サービス群 scoped README                                    | エージェント精読（2025-08-21・設計整合）                                                         | 維持。                                                                                                                                 |
| `AI.character.md`                                     | AS           | キャラクター属性型（AttributeValue 等）の設計指針（2025-08-11）        | エージェント精読。`AI.md:78` から被リンク                                                        | 維持。**未確認**: src 実装との完全一致は未照合。                                                                                       |
| `docs/guides/IMPORT_PATHS.md`                         | AS           | 絶対パス import 設定の現役ガイド（最終確認 2026-06-03）                | `docs/guides/IMPORT_PATHS.md:1-3`「パスエイリアス方式は現役」                                    | 現役だが **`AI.md` 索引に未掲載＝導線弱**（P2 索引化候補）。                                                                           |
| `docs/guides/characterIds-usage-path.md`              | AS           | `DiceRollChannel.characterIds` 保存経路の調査（現役・2026-06-03 確認） | `docs/guides/characterIds-usage-path.md:1-3`「保存経路は現役」                                   | `docs/guides/` へ移動済み。必要なら `AI.md` / `docs/README.md` からの導線を維持する。                                                  |
| `AI.development.md`                                   | AS / HK 混在 | 開発・運用・パフォ・セキュリティ・リファクタ履歴                       | `:3`「作成日 2025-01-09」だが `:235` 「Phase S 完了 2026-05-31」                                 | 維持。**Phase S/操作系は現役・パフォ/カバレッジ数値は陳腐化（正本=AI.test.md）**。冒頭に正本ポインタが無く drift 注意（P1 注記候補）。 |
| `AI.architecture.md`                                  | HK           | アーキテクチャ概説スナップショット（2025-01-09）                       | `AI.architecture.md:3-5` 「スナップショット・陳腐化」自己注記                                    | 履歴として維持。正本は `src/ARCHITECTURE.md`。                                                                                         |
| `src/AI.architecture.md`                              | HK / SS      | 循環参照分析（2025-01-17）＋型定義戦略案                               | `src/AI.architecture.md:3` 「前半=H6 で解消済・後半=未実装」                                     | 履歴。循環分析は解消済で**参照価値低**。索引から外す候補（P2）。                                                                       |
| `AI.domain.md`                                        | HK           | DDD・イベント駆動の導入記録（2025-01-14）                              | `AI.domain.md:1-3` 「Phase4/5 は履歴・正本は events/\*」                                         | 履歴維持。基礎概念は有効、詳細正本は `src/events/*`。                                                                                  |
| `AI.types.md`                                         | HK           | 型不一致解決・型エイリアス方式の設計記録（2025）                       | `AI.types.md:1-5` 「正本は ARCHITECTURE §12 / AI.refactor.md」                                   | 履歴維持。現状の型方針は `src/ARCHITECTURE.md §12` が正本。                                                                            |
| `docs/history/PERFORMANCE_IMPROVEMENTS.md`            | HK           | 2025 パフォーマンス改善メモ（数値未検証）                              | `:4` 「履歴注記・効果数値は未検証見込み・正本は AI.refactor.md」                                 | 履歴として `docs/history/` へ移動済み。                                                                                                |
| `docs/history/DISCORD_SERVICES_ANALYSIS.md`           | SS           | discord/services 統合提案。Phase1 提案は撤回済                         | `src/discord/DESIGN.md:153-164` §4.5 が「Phase1 廃止は事実誤認で撤回」と否定・本書冒頭も撤回注記 | 作業導線から外し、履歴として `docs/history/` に退避済み。正本は `DESIGN.md §4.5`。                                                     |
| `docs/history/characterThread-dice-roll-functions.md` | SS           | 2025 のスレッドダイス関数フロー追跡メモ                                | `:4-5` 「handlers ベースへ移行済・正本は DESIGN.md」                                             | 導線から外す。現状は handler 構成＝feature-inventory が正本。**索引未掲載**（P2 退避）。                                               |
| `docs/history/flexible-dice-param-menu-existence.md`  | SS           | 2025 の flexible-dice メニュー存在調査メモ                             | `:4` 「現在は FlexibleDiceParamHandler 経由・正本は DESIGN.md」                                  | 導線から外す。**索引未掲載**（P2 退避）。                                                                                              |
| `docs/refactor/refactor-phase-S-plan.md`              | HK           | Phase S 実装計画（S1〜S4・2026-05-31 完了）                            | `:1-7` 「実施完了・詳細は AI.refactor.md」                                                       | 履歴維持（完了済み計画スナップショット）。削除対象リストに非該当。                                                                     |
| `docs/refactor/refactoring-audit-2026-05-30.md`       | HK           | src 直下 10 フォルダ監査（2026-05-30）                                 | `:1-6` 実施日・`AI.refactor.md:1045` で一部誤判定を訂正済                                        | 履歴維持。デッドコード誤判定は AI.refactor.md で訂正済。                                                                               |
| `CLAUDE_HANDOFF.md`                                   | AC(運用)     | 委譲メモの運用ファイル                                                 | `AI.refactor.md:1040`「CLAUDE_HANDOFF.md は維持（運用ファイル）」                                | 維持。削除対象外。                                                                                                                     |
| `AI.discord.md`（root・削除済）                       | BM           | （src 版と重複の旧 Discord メモ）                                      | git `D`・`AI.refactor.md:1039` 削除対象                                                          | 削除確定（意図的）。**未コミット**。本タスクでは commit しない。                                                                       |
| `INTERACTION_REGISTRY_IMPLEMENTATION.md`（削除済）    | BM           | （空ファイル）                                                         | git `D`・`AI.refactor.md:1039`「(空)」                                                           | 同上。                                                                                                                                 |
| `adapters復旧必要性分析.md`（削除済）                 | BM           | （adapters 復旧不要で決着）                                            | git `D`・`AI.md:57` / `AI.refactor.md:1039`                                                      | 同上。                                                                                                                                 |
| `postFlexibleDiceMenu-flow-analysis.md`（削除済）     | BM           | （解決済み分析）                                                       | git `D`・`AI.refactor.md:1039`                                                                   | 同上。                                                                                                                                 |
| `src/claude.md`（削除済）                             | BM           | （旧実行トレース）                                                     | git `D`・`AI.refactor.md:1039`                                                                   | 同上。                                                                                                                                 |
| `src/type-error-fixes.md`（削除済）                   | BM           | （解消済みの型エラー修正メモ）                                         | git `D`・`AI.refactor.md:1039`                                                                   | 同上。                                                                                                                                 |
| `コメントアウト箇所管理.md`（root・削除済）           | BM           | （コメントアウト管理メモ）                                             | git `D`・`AI.refactor.md:1039`                                                                   | 同上。                                                                                                                                 |

---

## Active canonical

現在の正本・索引（作業導線として最優先で参照すべきもの）。

- **`AI.md`** — 入口＋専門ドキュメント索引。冒頭 `:5-10` に正本ポインタ（AI.refactor / ARCHITECTURE / events DESIGN / AI.test）。中盤以降の 2025 年 Phase 3.x 等は注記付き履歴。
- **`README.md`** — TRPG-SERVER の起動/テスト/品質コマンドと docs 案内。現役。
- **`src/ARCHITECTURE.md`** — 依存方向・module ルール・横断置き場所決定表（§12）の最上位正本。
- **`AI.refactor.md`** — リファクタ進捗・残課題の最新正本（2026-06-04）。削除候補の管理台帳も兼ねる。
- **`AI.test.md`** — テスト戦略・テスタビリティ評価・カバレッジ正本（2026-06-03）。
- **`AI.features.md`** — feature 正本への索引（2026-06-05）。
- **`docs/reviews/feature-inventory-2026-06-05.md`** — 実コード根拠の機能棚卸し現状スナップショット。レビュー時点は git 未追跡だったが **`57bd2b5` で追跡化済み**。
- **`CLAUDE_HANDOFF.md`** — 委譲運用ファイル（`AI.refactor.md:1040` で維持と明記）。

## Active scoped

特定領域の現役 README / DESIGN / migration guide / 設計指針。

- Discord 設計系: `src/discord/DESIGN.md` / `src/discord/interactions/README.md` / `src/discord/interactions/MIGRATION_GUIDE.md` / `src/discord/AI.discord.md`
  - いずれも **目標アーキ・原則は現役**だが、**As-Is / Phase 進捗の記述が実装（P1-A/B/C・③・S 完了）に未追従**（陳腐化注記候補。feature-inventory D1/D2 と同旨）。
- events: `src/events/DESIGN.md`（現状正本）/ `src/events/AI.event.md`（冒頭節のみ正本・以降履歴）
- feature/サービス README: `src/discord/features/README.md`（概説は 2025-08-21・性能数値古い）/ `src/discord/features/characterEdit/README.md`（実体整合・新しめ）/ `src/discord/services/README.md` / `.../channel/README.md` / `.../dice/README.md` / `.../monitoring/README.md`（4 本とも 2025-08-21・実装と概ね整合・legacy 互換メソッドも明記）
- 基盤ガイド: `src/config/README.md` / `test/testcontainers/README.md` / `docs/guides/IMPORT_PATHS.md`
- 設計指針/経路調査（現役）: `AI.character.md`（属性型）/ `docs/guides/characterIds-usage-path.md`（characterIds 経路・2026-06-03 確認）
- 開発運用: `AI.development.md`（**Active/Historical 混在**: Phase S・操作系は現役、パフォ/カバレッジ数値は陳腐化）

## Historical keep

古いが意思決定・履歴記録として残す価値があるもの（作業導線の最優先ではない）。

- `AI.architecture.md`（2025-01-09 概説・自己注記で陳腐化宣言）
- `src/AI.architecture.md`（2025-01-17 循環分析。前半は H6 で解消済＝参照価値低・後半は未実装案）
- `AI.domain.md`（2025 DDD 導入記録・正本は events/\*）
- `AI.types.md`（2025 型管理設計・正本は ARCHITECTURE §12）
- `docs/history/PERFORMANCE_IMPROVEMENTS.md`（2025 改善メモ・数値未検証）
- `docs/refactor/refactor-phase-S-plan.md`（Phase S 完了済み計画）
- `docs/refactor/refactoring-audit-2026-05-30.md`（src 監査・一部誤判定は AI.refactor.md で訂正済）

## Superseded / cleanup candidates

新しい正本に置き換わっており、**作業導線としては使うべきでない**もの（＝削除/退避/索引除外の候補。本タスクでは実行しない）。

- `docs/history/DISCORD_SERVICES_ANALYSIS.md` — Phase1「facade 廃止」提案は `DESIGN.md §4.5` で**撤回**。正本は DESIGN.md。履歴として `docs/history/` に退避済み。
- `docs/history/characterThread-dice-roll-functions.md` — handlers ベース移行前の関数フロー。現状は feature-inventory / DESIGN.md が正本。
- `docs/history/flexible-dice-param-menu-existence.md` — flexible-dice の旧経路調査。現状は `FlexibleDiceParamHandler` 経由。
- `src/AI.architecture.md` 前半（循環分析）— H6 で解消済み（**HK としても可だが導線からは外す**）。

> 補足: 上記 SS 群は元々 **root 直下のスクラッチ調査文書**で、いずれも `AI.md` 索引に載っていなかった。履歴価値を残すため、削除ではなく `docs/history/` に退避する方針が安全。

## Broken / missing / link-risk

### git 上 `D`（削除済み）= 7 本 — ✅ `57bd2b5` でコミット済み（解消）

`AI.discord.md`(root) / `INTERACTION_REGISTRY_IMPLEMENTATION.md` / `adapters復旧必要性分析.md` / `postFlexibleDiceMenu-flow-analysis.md` / `src/claude.md` / `src/type-error-fixes.md` / `コメントアウト箇所管理.md`

- これらは `AI.refactor.md:1037-1039` の「削除（役目を終えた一過性メモ / 空ファイル）7 本」と**完全一致**＝**意図的削除**。
- レビュー時点はワークツリー上 `D` のまま未コミットだったが、**`57bd2b5`「docs moved」で削除がコミットされ解消**（履歴スナップショット）。

### link-risk（リンク切れ・導線リスク）

- **実害のあるリンク切れは検出されず**。`](...AI.discord.md)` 形式のリンクは全て現存する `src/discord/AI.discord.md` を指す（`AI.md:73` / `AI.features.md:15` / `src/discord/DESIGN.md:5`,`:321` を確認）。削除された root `AI.discord.md` を指す**実リンクは無い**。
- **prose のみの陳腐化**: `README.md:80` が AI.\*.md の例として `AI.discord.md` を列挙。root 版は削除され src 版のみ存続のため、表記は `src/discord/AI.discord.md` が正確（実害は無いが軽微 drift）。
- **未追跡の正本**: `docs/reviews/feature-inventory-2026-06-05.md` は `AI.md:82` / `AI.features.md:11` から被リンクされる正本で、レビュー時点では git 未追跡（`??`）だった ＝ ✅ **`57bd2b5` で追跡化され解消**。
- **索引未掲載（孤立）**: `docs/guides/IMPORT_PATHS.md` / `docs/history/PERFORMANCE_IMPROVEMENTS.md` / `docs/guides/characterIds-usage-path.md` / `docs/history/characterThread-dice-roll-functions.md` / `docs/history/flexible-dice-param-menu-existence.md` / `docs/history/DISCORD_SERVICES_ANALYSIS.md` は、初稿時点ではどの索引/正本からもリンクされていなかった。現在は `docs/README.md` から `guides/` と `history/` の置き場を案内する。

---

## 削除・統合の推奨順

> すべて**本タスクでは実行しない**。Codex の判断・承認を前提とした優先度付き提案。

### P0: 参照切れ・削除済み参照の修正

- **実リンク切れは無し**（上記検証）。P0 として緊急修正が必要なリンクは検出されなかった。
- 削除済み 7 本の **コミット是非**は ✅ **`57bd2b5`「docs moved」で実施済み（解消）**。

### P1: 作業導線から外すべき陳腐化 docs / 注記更新

1. `docs/history/DISCORD_SERVICES_ANALYSIS.md` を導線から外す（正本 `DESIGN.md §4.5`）。履歴として `docs/history/` に退避済み。
2. Discord 設計系の **As-Is/Phase 表記を現状へ注記更新**（`src/discord/DESIGN.md` §2-3、`interactions/README.md` `:33-34`、`MIGRATION_GUIDE.md` Phase 2 表）。**設計方針変更を伴わない注記限定**（feature-inventory D1/D2 と同旨。Codex 判断）。
3. `AI.development.md` 冒頭に正本ポインタ（パフォ/カバレッジ→AI.test.md）を 1 行追記し drift を抑止。
4. ~~`feature-inventory-2026-06-05.md` を git 追跡下へ（コミット）。~~ ✅ **`57bd2b5` で追跡化済み（解消）**。

### P2: 履歴として残すが索引/導線から外す docs

1. root 直下スクラッチ群は `docs/history/` / `docs/guides/` へ集約済み: `docs/history/characterThread-dice-roll-functions.md` / `docs/history/flexible-dice-param-menu-existence.md` / `docs/history/PERFORMANCE_IMPROVEMENTS.md` / `docs/guides/characterIds-usage-path.md`。
2. 現役だが索引未掲載だった `docs/guides/IMPORT_PATHS.md` は `docs/README.md` から案内する。
3. `src/AI.architecture.md` / `AI.architecture.md` / `AI.domain.md` / `AI.types.md` は履歴として維持しつつ、索引上「履歴・参考」区分（`AI.md:84-87` は既にその扱い）を徹底。

---

## 実行した調査コマンド

| コマンド / 操作                                                  | 重要な結果                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `rg --files -g "*.md"`（TRPG-SERVER 配下）                       | レビュー対象の現存 Markdown **36 本**を列挙。新規作成後は本レビュー文書を含め **37 本**。                                                                                                                                                                                                                                                                                      |
| `git status --short`（`.md` 抽出）                               | `D`（削除済み未コミット）**7 本** ＝ `AI.discord.md`(root)/`INTERACTION_REGISTRY_IMPLEMENTATION.md`/`adapters復旧必要性分析.md`/`postFlexibleDiceMenu-flow-analysis.md`/`src/claude.md`/`src/type-error-fixes.md`/`コメントアウト箇所管理.md`。`feature-inventory-2026-06-05.md` は `??`（未追跡）。                                                                           |
| `wc -l` 全 md                                                    | 行数を把握（大規模: AI.test 1913 / AI.refactor 1349 / AI.md 1211 / characterThread-dice-roll-functions 1183 / src/AI.architecture 1130 / src/events/AI.event 1389）。                                                                                                                                                                                                          |
| filename grep（各 doc 名を `-g "*.md"` で被リンク数集計）        | `IMPORT_PATHS`/`PERFORMANCE_IMPROVEMENTS`/`characterIds-usage-path`/`characterThread-dice-roll-functions`/`flexible-dice-param-menu-existence` は **被リンク 0（孤立）**。`AI.architecture`=7 / `AI.domain`=8 / `AI.test`=8 / `AI.types`=5 等は索引から到達可。                                                                                                                |
| `rg "\]\([^)]*AI\.discord...\)"`（削除ファイルへの実リンク探索） | 削除 7 本への**実リンク切れは無し**。`AI.discord.md` 系リンクは全て現存 `src/discord/AI.discord.md` を指すことを確認。                                                                                                                                                                                                                                                         |
| `rg "AI\.discord\.md" -g "*.md"`                                 | `README.md:80` が prose で `AI.discord.md` を例示（root 削除済・src 版存続）＝軽微 drift。`src/discord/DESIGN.md:5,:321` の `./AI.discord.md` は src ディレクトリ相対で現存ファイルに解決。                                                                                                                                                                                    |
| 実ファイル通読（本書作成者）                                     | `AI.md` / `feature-inventory-2026-06-05.md` / `src/ARCHITECTURE.md` / `src/discord/DESIGN.md` / `interactions/README.md` / `MIGRATION_GUIDE.md` / `src/events/DESIGN.md` / `AI.features.md` / `README.md` / `src/discord/AI.discord.md` / `src/discord/features/README.md` / `characterEdit/README.md` / `src/config/README.md` / `test/testcontainers/README.md` を直接読了。 |
| Explore サブエージェント精読（実ファイル読取・変更なし）         | root スクラッチ 6 本／`AI.*`（architecture/domain/development/types/character・src 版含む）／`AI.test`・`AI.refactor`・`events/AI.event`・旧 `document/*`／discord services README 4 本 を精読。各冒頭注記・日付・陳腐化痕跡を引用付きで取得（本書分類の根拠）。                                                                                                               |

---

## 未確認・要判断

- ~~**削除済み 7 本のコミット是非**（Codex 判断）。現状 `D` 未コミット。~~ ✅ **`57bd2b5`「docs moved」でコミット済み（解消・2026-06-06 注記）**。
- **Discord 設計系（DESIGN.md / interactions README / MIGRATION_GUIDE）の注記更新可否**は触らない範囲（Codex 判断）。本書は陳腐化の記録に留めた。
- **`AI.character.md` と src 実装（`core/types` 等）の完全一致**は未照合（`推測:` AttributeValue 設計は現役指針だが実装差分は要確認）。
- **`AI.development.md` の Active/Historical 境界**: Phase S・操作系は現役、パフォ/カバレッジ数値は陳腐化。文書内での厳密な現役行範囲は精読エージェント報告ベース（一部は引用のみで全行未照合）。
- **サービス README 4 本（2025-08-21）の細部メソッド整合**: エージェントが「概ね整合・legacy 互換あり」と報告。シグネチャ単位の全件照合は未実施。
- **`feature-inventory-2026-06-05.md` の内容妥当性**は前委譲（機能棚卸し）の成果物として受領。本書はその存在/導線/被リンクのみを評価対象とし、記載機能の再検証はしていない。
