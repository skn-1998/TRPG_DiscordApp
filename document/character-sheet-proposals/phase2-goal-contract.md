# Phase 2 Goal 契約書 — frame-purpose-goal-means 出力

> **分類**: goal 契約（A-1。/route-design-work S-1 成果物）
> **ステータス**: **v2 — レビューループ1巡目（Codex spark・判定「修正後可」）の必須4件＋推奨を反映済み**
> **対象活動**: design-v1 v1.2 §7 **Phase 2** の着手（`character.sheet` 併存・palette・customId v2・投影生成・backfill・hub 化・templateVersion バッジ）
> **最終更新**: 2026-07-08

## Framing

Result: Partial
Result evidence IDs: E-2, E-9（目的はユーザー既承認の設計文書から導出＝human-confirmed。I-1/I-2 の範囲仮定が未確認のため Partial のまま進行。S-2 の事前条件〔目的・概念・正誤例〕は充足済み）

### Evidence Ledger

| Evidence ID | Type | Author or speaker | URI or path | Exact locator | Content | Confidence | Human-confirmed |
|---|---|---|---|---|---|---|---|
| E-1 | statement | ユーザー | 本会話 2026-07-06 | テンプレート要望の初出 | 「Web で Excel のようにシートのベースを作成・配布したい。CoC の DB のような複雑ステータスも」 | 高 | Yes |
| E-2 | decision | ユーザー＋Codex 討論 | design-v1.md | §7 Phase 2 行・§8 決着表 | Phase 2 の内容と検証ゲート（characterization 必須） | 高 | Yes |
| E-3 | decision | 同上 | design-v1.md | §3・§4 | 三層モデル・投影 read-only・palette・customId v2・key registry | 高 | Yes |
| E-5 | decision | ユーザー＋Codex 討論 | design-v1-ui.md | §3・§5 決着表 f〜j | hub 化・ephemeral パネル・hubMessageId 永続化・**edit 失敗の3分類**・共有 select 不変・バッジ前倒し | 高 | Yes |
| E-6 | fact | 本会話ゲート実測 | 2026-07-08 | wave 1/2 LGTM | Phase 1 実装完了（全ゲート緑・未コミット） | 高 | Yes |
| E-7 | fact | git log | TRPG-SERVER | E-6a〜e | CharacterEntity 公開型・BCDice 実行コア抽出は実施済み | 高 | Yes |
| E-9 | statement | ユーザー | 本会話 2026-07-08 | /route-design-work 引数 | 「レビューループ・契約型プログラミングで goal 明確化→設計実装」 | 高 | Yes |
| E-10 | inference | Claude | 本会話 | 「進めて」と Phase 2 提示の接続 | 対象活動＝Phase 2 という特定 | 中 | No（仮説・veto 可） |
| E-11 | decision | Codex レビュー（spark） | scratchpad p2-goal-review2 | 2026-07-08 R1 | 本契約 v1 への必須4件・推奨・軽微指摘 | 高 | — |

### Purpose Map

| Purpose ID | Actor | Purpose | Parent purpose | Evidence IDs | Status |
|---|---|---|---|---|---|
| P-0 | ユーザー（開発者/オーナー) | 自作シートを作成・配布し、Discord でそのまま遊べる（三面完結）。**Phase 2 は「Discord でそのまま遊べる」の実現段**（P-1〜P-4 へ逆算分解） | — | E-1 | 確認済み |
| P-1 | ユーザー | テンプレート由来キャラが**既存の Discord 体験で実際に遊べる**（三面の実働接続） | P-0 | E-2, E-3 | 確認済み |
| P-2 | ユーザー・既存プレイヤー | **既存キャラ・既存卓を一切壊さず**新基盤へ移行する | P-0 | E-2, E-3 | 確認済み |
| P-3 | プレイヤー（卓参加者） | スレッドが散らからず、迷わず・壊れず操作できる（**運用不具合＝重複投稿・無限リトライも「壊れ」に含む**） | P-1 | E-5 | 確認済み |
| P-4 | ユーザー（運用者） | 版 pin の可視化で「テンプレを更新したのにキャラが変わらない」を説明可能にする | P-2 | E-5 | 確認済み |

### Goal Contract

| Goal ID | Purpose ID | Type | Observable condition | Evidence IDs | Affected actors | Conflict |
|---|---|---|---|---|---|---|
| G-1 | P-1 | acceptance | **受入シナリオ行列（すべて実機）**: (a) テンプレ由来キャラ×新規スレッド×所有者が palette ボタン押下 → ロール結果がスレッドに投稿され `/dice-result` に記載 (b) 同ボタンを**非所有者**が押下 → ロール成功（ロール系は参加者全員可・decision i） (c) **同一 guild 内で legacy キャラの旧 `skill_` ボタンと新 `roll_` ボタンが同居して両方動作** (d) resource `res_` ± → 即 ack され値が更新される | E-2, E-3 | プレイヤー | なし |
| G-2 | P-2 | acceptance | (a) backfill 後、`templateId` 未設定キャラが 0 件 (b) characterization test「legacy-coc materialize 出力 ≡ 現行 5 セクション」緑 (c) **backfill は M-2 の実行契約（dry-run 既定・冪等・追記のみ・ロールバックスクリプト同梱）を満たす** | E-2, E-6 | 既存ユーザー | なし |
| G-3 | P-2 | constraint | 既存 Discord 全経路（旧契約・±・embed・履歴）が全 suite＋実機チェックリストで無傷 | E-2, E-3 | 既存プレイヤー | なし |
| G-4 | P-1 | spec | customId v2 が契約モジュール＋registry 登録され旧契約と併存。**併存の終了条件＝投影廃止ゲート（design-v1 §4）と同時**と明記し、**同一キャラで新旧ボタン同居の検証ケース**を持つ（G-1c と対応） | E-3 | — | なし |
| G-5 | P-3 | acceptance | **hub 受入シナリオ（実機）**: (a) 新規スレッド初期投稿が hub 1 メッセージ＝embed＋作者ピン留めボタン **20 個以下**＋グループ select 1 行 (b) グループ選択 → **ephemeral パネル**で返り、**共有 hub メッセージは編集されない** (c) グループ 25 超 → select 末尾「その他…」→ ephemeral group browser (d) パネル内 20 超 → パネル内ページング (e) ± 押下 → 3 秒内 ack・hub embed は**非同期**更新 | E-5 | プレイヤー | なし |
| G-6 | P-3 | spec | `hubMessageId` が character に永続化され、新経路の embed 更新が「直近50件探索」に依存しない | E-5 | — | なし |
| G-7 | P-4 | acceptance | キャラページに templateVersion バッジ＋「テンプレート更新に自動追従しない」表示 | E-5 | ユーザー | なし |
| G-8 | P-2 | spec | `sheet.revision` 楽観ロックが実配線され、Web 保存×Discord ± の並行で lost update なし（競合 spec で固定） | E-3 | — | なし |
| G-9 | P-2 | constraint | 各スライス: build／circular 0／全 suite／start:dev DI／front typecheck・build 緑＋Codex レビューループ通過 | E-6, E-9 | — | なし |
| G-10 | P-2 | constraint | domains 層への discord.js 侵入ゼロ・イベント RPC ゼロ・characterId 不変・投影直書きゼロ。**検証手段は M-7**（静的検査の自動化） | E-3, E-7 | — | なし |
| G-11 | P-3 | spec | **hub 更新の運用契約**: per-character キュー（coalesce・in-flight 1・latest のみ反映）＋**edit 失敗の3分類**（Unknown Message→再投稿＋id 更新／権限喪失→非リトライでエラーマーク／rate limit→backoff）を spec で固定 | E-5(g) | プレイヤー | なし |

### Means

| Means ID | Purpose ID | Goal ID | Purpose-specific role | Candidate means | Evidence IDs | Risk |
|---|---|---|---|---|---|---|
| M-1 | P-2 | G-2, G-8 | 値正本の二層化 | CharacterEntity＋@Schema へ sheet/computedCache/palette/hubMessageId 追加・materializer の保存実配線（revision） | E-3, E-7 | projection 全 select 更新（S-1 教訓） |
| M-2 | P-2 | G-2 | 既存データの非破壊移行 | **backfill 実行契約**: 手動起動の standalone スクリプト（`pnpm run backfill:template-pin` 想定）／**dry-run が既定**（`--execute` で実行）／対象＝`templateId` 未設定キャラのみ（**冪等**）／変更＝templateId/templateVersion の**追記のみ**／実行ログ（件数・characterId 一覧）出力／**ロールバック**＝同スクリプトの `--rollback`（追加フィールドの unset のみ）／実行者＝dev 検証は Claude・本番はユーザー | E-2, E-11 | なし（追記のみ） |
| M-3 | P-1 | G-1, G-4 | 新ロール経路の接続 | roll_/res_ 契約モジュール＋handler（palette 読取→DiceRollLogic 委譲・履歴は既存経路） | E-3 | 旧契約との registry 競合 |
| M-4 | P-3 | G-5, G-6, G-11 | 投影の UI 化と運用 | `packages/sheet-projection` 新設（行分割・fallback・embed 生成の純関数）＋hub 投稿サービス＋**更新キュー（G-11 契約実装）** | E-5 | 5行/25件制限の実装誤り |
| M-5 | P-4 | G-7 | 版 pin の可視化 | front キャラページのバッジ（summary API へ templateVersion 追加） | E-5 | 小 |
| M-6 | P-2 | G-3, G-9 | 回帰防止の運用 | characterization＋旧経路実機チェックリスト＋スライス毎 Codex レビュー | E-2, E-9 | なし |
| M-7 | P-2 | G-10 | 設計制約の自動検証 | スライスゲートに**静的検査を追加**: `rg` による禁止依存検査（domains 配下の discord.js import／waitForEvent 型 RPC／forwardRef/@Global）＋repository spec の select 文字列固定（既存様式）を CI 相当のゲート手順として明文化 | E-11 | なし |

### Issue Ledger

| Issue ID | Type | Affected IDs | Evidence IDs | Description | Question or recovery input | Status |
|---|---|---|---|---|---|---|
| I-1 | assumption | G-1, M-3 | E-10, E-11 | **Discord 側からのテンプレ作成は Phase 2 スコープ外**（Phase 3・design-v1-ui U5 が統合ポイント）。**境界条件: Phase 2 では `/create-character` 系コマンド・commands.list に一切触れない**（変更ファイル境界に明記） | — | **ユーザー承認済み（2026-07-12・D-2）** |
| I-2 | assumption | G-5 | E-5 | hub 化は**新規作成スレッドのみ**。既存スレッドの rebuild は Phase 3 の migrate ウィザードの領分。既存スレッドの旧 UI は不変（C-7 の害の緩和） | — | **ユーザー承認済み（2026-07-12・D-2）** |
| I-4 | assumption | G-1, G-5 | E-6, E-11 | 実機 acceptance の最終確認はユーザーの Discord サーバー。**提出物: 実機チェックリスト（手順書）＋Claude 側の起動・登録ログ**。私は start:dev～コマンド登録・handler 登録数の確認まで実施 | 完了報告に添付 | 進行仮定 |
| ~~I-5~~ | ~~gap~~ | G-2, M-2 | E-11 | ~~backfill 実行方式未指定~~ → **M-2 で契約化済み**（R1 必須指摘の反映） | — | 解消 |

### Contract Checks

| Check ID | 種別 | Check | Pass/Fail | Evidence IDs | Issue IDs |
|---|---|---|---|---|---|
| C-1 | 事後条件 | 各目的→1件以上の目標 | Pass | 表 | — |
| C-2 | 事後条件 | 各目標→1目的＋1件以上の手段（G-11→M-4） | Pass | 表 | — |
| C-3 | 事後条件 | 各手段の役割は1目的（M-4 は P-3 の UI/運用役割に限定） | Pass | 表 | — |
| C-4 | 事後条件 | 達成判定可能性（G-1/G-5 はシナリオ行列化・G-11 は spec 固定・他は suite/静的検査） | Pass | E-11 | I-4 |
| C-5 | 破壊質問 | 手段なしで目的達成可 → hub（M-4）なしでも P-1 は G-1 で成立＝**M-4 は P-3 専属・スライス分離可** | Pass | E-5 | — |
| C-6 | 破壊質問 | 目標達成でも目的未達の反例 → G-4 のみでは実働不明 → G-1 の実機 acceptance で担保。**G-4 の技術目的化は「併存終了条件＋同居検証」の明記で抑止** | Pass | E-11 | — |
| C-7 | 破壊質問 | 他アクターへの害 → 既存卓への UI 変化は I-2（新規のみ）で緩和。運用不具合の害は G-11 で契約化 | Pass | E-5, E-11 | I-2 |
| C-8 | 不変条件 | 技術名の目的化なし | Pass | — | — |
| C-9 | 事前条件 | 全目的が human-confirmed 根拠へ追跡 | Pass | — | — |

### レビューループ記録

- **R1（2026-07-08・Codex spark**〔CLI 制約で spark のみ利用可。強モデル復帰は CLI 更新待ち〕**）**: 判定「修正後可」。
  必須4件 → 反映: (1) G-10 に M-7（静的検査）を追加 (2) I-5 を M-2 の backfill 実行契約に昇格（dry-run 既定・冪等・追記のみ・rollback・実行者） (3) G-1/G-5 を受入シナリオ行列に分解 (4) design-v1-ui f〜j の運用要件を G-11（失敗3分類・キュー契約）と G-5(b)(c)(d) に反映。
  推奨 → 反映: I-1 の境界条件明文化・G-4 の併存終了条件と同居検証・I-4 の提出物定義・P-0 の逆算注記・表記の統一（20 個以下）。
