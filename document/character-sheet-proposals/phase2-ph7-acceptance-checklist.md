# Phase 2 PH-7: 実機受入チェックリスト（D-3）

- 版: v1（2026-07-12）
- 受入者: ユーザー（実機 Discord サーバー）
- 準備者: Claude（起動・登録ログは §6 に添付）
- 対応契約: [phase2-goal-contract.md](phase2-goal-contract.md) G-1 / G-5 / G-2 / G-7、[phase2-implementation-plan.md](phase2-implementation-plan.md) PH-7
- 判定: 全行 OK → Phase 2 完了（D-3 受入）。NG 行 → 該当 PH へ切戻し（NG 行に PH 番号を記載済み）

## 0. 事前準備

| # | 手順 | 補足 |
|---|---|---|
| 0-1 | `pnpm install`（リポジトリルート） | workspace 化後の初回は必須 |
| 0-2 | `TRPG-SERVER` で `pnpm run start:dev` 起動、BOOT ログ確認 | §6 の Claude ログと同等になること |
| 0-3 | backfill 実行: `pnpm run backfill:template-pin`（**dry-run が既定**）→ 件数確認 → `--execute` | G-2 対応。ロールバックは `--rollback` |
| 0-4 | front 起動（`trpg-next-app` で `pnpm run dev` — dev サーバは port 3100）、`http://127.0.0.1:3100/templates` から legacy-coc テンプレートが公開済みであることを確認 | シード未投入なら legacy-coc シードを publish。旧 `trpg-remix-app` は N6b（`e179640`・2026-08-07）で撤去済み |
| 0-5 | テスト用に (A) legacy キャラ（backfill 前から存在・sheet なし）、(B) テンプレ由来キャラ（Web の from-template 作成）を各1体用意 | 3状態モデルの legacy-pinned / materialized に対応 |

## 1. G-1: ロール経路（palette / resource）

| # | シナリオ | 期待結果 | 結果 | NG時切戻し先 |
|---|---|---|---|---|
| 1-a | テンプレ由来キャラ(B)で新規スレッド作成 → 所有者が palette の `roll_` ボタン押下 | ロール結果がスレッドに投稿され、`/dice-result` の履歴に記載される | ☐ | PH-4 |
| 1-b | 同じ `roll_` ボタンを**非所有者**（同卓の別参加者）が押下 | ロール成功（ロール系は参加者全員可） | ☐ | PH-4 |
| 1-c | **同一 guild 内**で legacy キャラ(A)の旧 `skill_` ボタンと、キャラ(B)の新 `roll_` ボタンを両方押下 | **両方動作**（新旧契約の同居） | ☐ | PH-4 |
| 1-d | キャラ(B)の `res_` ±ボタン押下 | **即 ack** され、値が更新される（HP/MP 等 track フィールド） | ☐ | PH-4 |

## 2. G-5: hub UI（新規スレッドのみ・既存スレッドは不変）

| # | シナリオ | 期待結果 | 結果 | NG時切戻し先 |
|---|---|---|---|---|
| 2-a | キャラ(B)で新規スレッド作成 | 初期投稿が **hub 1 メッセージ**＝embed＋ピン留めボタン **20 個以下**＋グループ select 1 行。旧来の複数メッセージ投稿が**出ない** | ☐ | PH-6b |
| 2-b | グループ select で任意グループを選択 | **ephemeral パネル**で返り、**共有 hub メッセージは編集されない** | ☐ | PH-6b |
| 2-c | グループが 25 超のテンプレで select 末尾「その他…」を選択 | ephemeral group browser が開く | ☐ | PH-6b |
| 2-d | 1 グループ内フィールドが 20 超のパネルを開く | パネル内ページングが機能する | ☐ | PH-6b |
| 2-e | hub のあるスレッドで `res_` ±押下 | **3 秒内 ack**。hub embed は**非同期**で更新される（多少の遅延は正常） | ☐ | PH-6b |
| 2-f | legacy キャラ(A)で新規スレッド作成 | **従来どおり**の投稿群（1 bit も変わらない） | ☐ | PH-6b補完 |

## 3. G-2: backfill（0-3 と併せて確認）

| # | シナリオ | 期待結果 | 結果 | NG時切戻し先 |
|---|---|---|---|---|
| 3-a | dry-run 出力 | 対象件数と characterId 一覧が出る。DB は無変更 | ☐ | PH-3 |
| 3-b | `--execute` 後 | `templateId` 未設定キャラが 0 件。再実行しても変更 0 件（冪等） | ☐ | PH-3 |
| 3-c | 既存キャラの Discord 旧経路（`skill_` ボタン・±・embed・履歴） | backfill 後も無傷（G-3） | ☐ | PH-3 |

## 4. G-7: front 版 pin 可視化

| # | シナリオ | 期待結果 | 結果 | NG時切戻し先 |
|---|---|---|---|---|
| 4-a | キャラページ表示 | templateVersion バッジ＋「テンプレート更新に自動追従しない」表示 | ☐ | PH-5 |

## 5. Docker ゲート（ユーザー環境のみ・Docker Desktop 必要）

| # | 手順 | 期待結果 | 結果 |
|---|---|---|---|
| 5-1 | リポジトリルートで `docker compose build` | root-context 化後の全イメージがビルド成功 | ☐ |
| 5-2 | `TRPG-SERVER` で `pnpm run test:integration`（testcontainers） | backfill の実 Mongo 統合テストが緑 | ☐ |

## 6. Claude 側 起動・登録ログ（I-4 提出物）

2026-07-12 21:38 再実施（補完スライス＋レビュー fix 込み・コミット 9a3d2da）:

- BOOT: `successfully started` ✅・characterSheet 5 handler ✅・DI エラーなし（characterThread→characterSheet の module import 追加後）
- server: build ✅ / circular 0 ✅ / **209 suites・2673 tests 緑** / characterization 緑
- packages: projection 14 / engine 44 緑（customId 契約一元化・publish 非空 label 込み）
- front: tsc ✅ / jest 22 緑（sheet-engine publish 変更の影響なし）
- §2-a / 2-f（旧投稿抑止）は補完スライス実装済みのため**実施可能**

2026-07-12 20:16 実施（PH-6b 最終ゲート）:

- BOOT 確認: `Nest application successfully started` ✅（DI エラーなし）
- characterSheet feature handler 登録数: **5**（期待値どおり）— RollPaletteHandler / ResourceDeltaHandler / HubGroupSelectHandler[select] / HubPanelNavigationHandler[button] / HubGroupBrowserNavigationHandler[button]。`hub_groups_` の pattern は select と button で interaction 種別が異なるため競合なし
- server: `nest build` ✅ / `check:circular` No circular dependency found! ✅ / 全 suite **208 suites / 2660 tests 緑** / characterization 2/2 緑（golden fixture 無変更）
- packages: sheet-projection 12 tests 緑 / sheet-engine 42 tests 緑
- front: `tsc` ✅ / `remix build` ✅ / jest 22 tests 緑

## 7. 既知の制約（受入時に NG と混同しないこと）

| # | 内容 | 扱い |
|---|---|---|
| 7-1 | schema v3 に「作者ピン留めフラグ」が未定義のため、hub のピン留めボタンは**先頭 20 ロールへの縮退**で実装 | 仕様どおり。フラグ追加は Phase 3 検討（README 未決に記録） |
| 7-2 | hub の自動再投稿はしない（Unknown Message 時のみ再投稿、状態機械 CAS 管理） | G-11 契約どおり |
| 7-3 | 既存スレッドは hub 化されない（新規作成スレッドのみ） | I-2 承認済み |
