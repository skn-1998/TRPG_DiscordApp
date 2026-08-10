# 画面×状態マトリクス（キャラクターシート三面 UI）

> **分類**: 検証補助（[design-v1-ui.md](design-v1-ui.md) の三面 UI について「画面 × 状態」の全セルを走査し、
> どの画面がどの状態でどう見えるかの未定義を塞ぐ。[u14-u15-verification-matrix.md](u14-u15-verification-matrix.md) の姉妹表）
> **作成**: 2026-08-09。仕様の正本は design-v1-ui.md（本表は検証状態の台帳であり、規範は持たない。
> 穴の裁定は design-v1-ui **§3.5「画面×状態の共通契約」**に固定・実装の入口は **§3.6 v1 実装境界表**）
> **監査**: Codex adversarial レビュー **round1〜4 で収束（round4 = pass・findings 0）**
> （2026-08-09・round1 = high 11/medium 3、round2 = high 4/medium 3、round3 = medium 1 —
> 全 22 件受諾・反映済み。証跡 = `review-results/screen-state-review/`）。
> さらに **cross-cut 再レビュー（round1〜4 で収束・round4 pass）と認知負荷・YAGNI 監査**を反映
> （2026-08-09・計 16 件受諾。証跡 = `review-results/{design-crosscut-review,design-cogload-review}/`）

## 画面カタログ

| # | 画面 | 面 | Phase / 対象 |
|---|---|---|---|
| S0 | キャラクター一覧 | (2) | 現行対象 |
| S1a | テンプレート自作一覧 | (1) | 現行対象 |
| S1b | 公開ギャラリー | (1) | **Phase 4・本表対象外**（行は状態要求の予約のみ） |
| S2 | テンプレートエディタ（編集領域） | (1) | 現行対象 |
| S2' | エディタ 右ペイン（入力/Discord プレビュー・検証タブ） | (1) | 現行対象 |
| S3 | キャラクター作成ウィザード | (2) | 現行対象 |
| S4 | キャラクターシート（閲覧/編集） | (2) | 現行対象(**materialized のみ**。legacy は SM-17) |
| S5 | Discord hub 共有メッセージ | (3) | 現行対象 |
| S6 | Discord ephemeral パネル | (3) | 現行対象 |
| S7 | /create-character フロー | (3) | **Phase 3（M3-4）**・裁定は U5 済み・状態詳細は Phase 3 設計 |
| S8 | migrate ウィザード | (2) | **Phase 3（M3-3）・本表対象外**（行は状態要求の予約のみ） |

## 状態カタログ

| # | 状態群 | 含む状態 | 主な出典 |
|---|---|---|---|
| G1 | データ | **読込中／空／通常／取得エラーの 4 状態を個別セルで走査**（1 セルに畳まない） | SM-3/SM-10/SM-14 |
| G2 | テンプレート版 | draft／published／**deprecated**／版 pin／新版あり | U4・U11・SM-16 |
| G3 | 評価（U15） | ok／indeterminate「—」／制約 error／基本評価失敗／超過警告／skew 退化（**制約 status は表示専用・値へ逆流しない**） | H-7・H-10・SM-9・SM-12 |
| G4 | 編集・保存 | 未編集／dirty／保存中／autosave 済み／競合（409 = theirs/mine 状態機械・currentRevision）／保存失敗（分類・single-flight・手動再試行）／roll proof（原子性） | U2・U4・欠陥5・SM-1/8/15 |
| G5 | 権限 | 所有者／非所有者（**Web read は owner スコープ 404 = v1 対象外**・将来の公開閲覧は U16 の拘束条件つき）／（GM = §8-11 凍結で対象外） | U13・SM-4/5・U16 |
| G6 | デバイス | デスクトップ／モバイル（**エディタは v1 デスクトップのみ**） | U14・SM-7 |
| G7 | hub ライフサイクル | **none／publishing／active／error**（実装正準名）＋再投稿・backoff | U12・L-4・SM-6 |
| G8 | キャラクター移行状態 | **legacy-unpinned／legacy-pinned／materialized**（`resolveCharacterState`） | SM-17 |
| G9 | シート公開設定（U16） | private（既定）／public（**v1 は保存とトグルのみ・読取経路なし＝fail-closed**） | U16 |

**注記**: 認証切れ・未ログインは auth 領域の設計に委ね本表の対象外。GM/秘匿は §8-11 凍結により対象外。

## マトリクス

**凡例**: ✅ 設計に答えあり（出典）／ 🩹SM-n 追補で閉じた（design-v1-ui v1.3 = 規範）／
− 該当なし／（P3/P4）該当 Phase の設計で扱う。
G1 セルは「読（読込中）／空／常（通常）／失（取得エラー）」の 4 項目を個別表記。

| 画面 | G1 データ（読/空/常/失） | G2 版 | G3 評価 | G4 編集・保存 | G5 権限 | G6 デバイス | G7 hub | G8 移行状態 | G9 公開設定 |
|---|---|---|---|---|---|---|---|---|---|
| S0 キャラ一覧 | 読🩹SM-14 骨格／空🩹SM-10 CTA／常✅（**編集導線＋公開バッジ**）／失🩹SM-14 | − | − | − | ✅ 自分のキャラのみ | ✅ 標準 | ✅ hub 状態バッジ（SM-6 縮約） | 🩹SM-17 旧形式バッジ | ✅ 公開バッジ表示 |
| S1a 自作一覧 | 読🩹SM-14／空🩹SM-10／常✅／失🩹SM-14 | ✅ draft/published 表示（U4）・🩹SM-16 deprecated 表示 | − | − | ✅ 自作のみ | ✅ 標準 | − | − | −（テンプレ側 visibility は G2） |
| S1b ギャラリー | （P4） | （P4） | − | − | （P4） | （P4） | − | − | （P4） |
| S2 エディタ編集 | 読🩹SM-14 骨格＋CTA disabled／空🩹SM-3 許容／常✅／失🩹SM-14 draft 再取得 | ✅ draft 正・preflight（U4）・🩹SM-16 deprecated 編集不可 | ✅ 試し値・skew 退化表（H-10） | ✅ autosave＋draft revision 競合（U4）・🩹SM-8 失敗分類 | ✅ 作者のみ | ✅SM-7 **v1 デスクトップのみ（確定）** | − | − | − |
| S2' プレビュー/検証 | 読=エディタに従属／空=編集領域と同種／常✅／失🩹SM-14 | ✅ 検証タブに集約 | ✅ 同一評価器・「—」・超過警告・warnings（契約2/3） | − | − | ✅SM-7 **v1 デスクトップのみ（確定）** | − | − | − |
| S3 ウィザード | 読🩹SM-14 骨格＋CTA disabled／空🩹SM-3 ステップ skip／常✅／失🩹SM-14 入力保持 | ✅ 作成時点 published 版に pin・🩹SM-16 入口に出さない | ✅ ライブ計算・「—」・予算バー・超過警告 | ✅ ステートレス（U2）・🩹SM-1 proof 原子性（順序固定・無消費 422・単一プロトコル）・🩹SM-2 離脱・🩹SM-12 required なし | ✅ 本人 | ✅ 1 ステップ 1 画面 | ✅ 確認ステップのミニプレビュー | − | ✅ 作成直後は private 既定 |
| S4 シート | 読🩹SM-14 骨格／空=（テンプレ構造due・SM-3）／常✅／失🩹SM-14 | ✅ templateVersion バッジ（U11）・🩹SM-16 削除済み注記＋resolvePinnedRevision | ✅ 🩹SM-9 二層退化（値=基本評価／status=制約評価の一方向）・SM-12 層別意味論 | ✅ diff 保存・🩹SM-15 theirs/mine＋currentRevision・🩹SM-8 失敗分類 | 🩹SM-4 非所有者 404（v1 対象外）＋**U16 公開トグル（所有者のみ）** | ✅ U14 固定折り畳み | 🩹SM-6 状態バッジのみ（CTA なし） | 🩹SM-17 legacy は対象外表示 | ✅ **U16 トグル（所有者のみ）＋「公開閲覧は準備中」注記** |
| S5 hub | 読−（キュー経由で描画待ち状態を持たない）／空−（action 0 件は G3 の SM-11 扱い）／常✅ 固定構造（U9）／失−（取得失敗の概念なし。**更新失敗は G7 の U12 分類のみ**で扱う） | 🩹SM-13 新版通知は出さない | ✅ resource 現在値（U7） | ✅ 更新キュー・stale drop（U12） | ✅ 参加者全員が閲覧 | − | ✅ 失敗分類（U12）・error 回復は L-4 裁定待ち | ✅ materialized のみ hub 対象 | −（hub 公開範囲は Discord 権限が支配・U13） |
| S6 ephemeral | 読✅ defer 応答／空🩹SM-5 非所有者は `no-authorized-actions`（権限案内）／常✅ パネル表示（U9）／失🩹SM-14 ephemeral エラー応答 | ✅ palette key 安定性（決着 h） | ✅ ロール実行・± 即時 ack・🩹SM-11 空 deltas group の防御的除外 | − | 🩹SM-5 canMutate capability | − | ✅ 20 超ページング（U9） | − | − |
| S7 /create-character | ✅ select ≤25（U5）・詳細（P3） | ✅ published のみ（resolveForCreate） | ✅ rollOnCreate サーバーロール | ✅ 即作成・Web 誘導（U5） | ✅ 本人 | − | ✅ スレッド＋hub 投稿 | （P3 詳細） | ✅ private 既定 |
| S8 migrate | （P3） | （P3） | （P3） | （P3） | （P3） | （P3） | （P3） | （P3） | （P3） |

## 穴一覧（SM-1〜SM-17）

**規範本文は [design-v1-ui.md](design-v1-ui.md) §3.5「画面×状態の共通契約」が唯一の正本**
（認知負荷監査 #1 で §3 Discord 配下から独立させた。実装の入口は §3.6 v1 実装境界表）。
本表は穴の識別と検証状態だけを持つ（裁定全文の再掲は同 #3 で廃止）。

| # | 穴（一言） | 検証状態 |
|---|---|---|
| SM-1 | proof 検証・nonce 消費・create の原子性と順序 | 🩹 round1 #6・round2 #1 → **4 不変条件＋単一プロトコル**へ縮約（cogload #6） |
| SM-2 | ウィザード離脱・リロードでの入力消失 | 🩹 |
| SM-3 | 空セクション/空ブロックの扱い | 🩹 |
| SM-4 | 非所有者のキャラページ | 🩹 round1 #5（**v1 は閲覧なし**・**将来必ず入る**ためフラグ = U16 を v1 で用意し公開専用 read 投影として後から新設） |
| SM-5 | ephemeral の非所有者表示 | 🩹 round1 #12・cross-cut #4（`canMutate`＋`no-authorized-actions`） |
| SM-6 | hub error の導線 | 🩹 round1 #7 → **v1 はバッジのみ・CTA は出さない**（cogload #8） |
| SM-7 | エディタのモバイル表示 | ✅ **v1 非実装で確定**（2026-08-09 ユーザー裁定「後から入れても問題ない」） |
| SM-8 | 保存失敗の再試行規則 | 🩹 round1 #14・round2 #7 → **5 要素へ縮約**・自動再試行は延期（cogload #7） |
| SM-9 | 評価失敗の退化と H-7 の整合 | 🩹 round1 #8・round2 #2・cross-cut #1（層の所有関係は一方向） |
| SM-10 | 一覧系の empty state | 🩹 |
| SM-11 | hub の「操作なし」条件 | 🩹 round1 #9・round2 #5・cross-cut #4（viewer 能力に相対的） |
| SM-12 | 未入力の意味論（層別） | 🩹 round1 #10 |
| SM-13 | 新版通知の場所 | 🩹 |
| SM-14 | データ 4 状態（読/空/常/失）の共通挙動 | 🩹 round1 #1/#4・round2 #4 |
| SM-15 | theirs/mine 選択後の rebase・再競合 | 🩹 round1 #13・round2 #6（409 に `currentRevision`） |
| SM-16 | deprecated テンプレと版 pin の両立 | 🩹 round1 #3・round2 #3（resolve 分離を v1 昇格） |
| SM-17 | legacy キャラクターの扱い | 🩹 round1 #2 |

## Codex レビュー証跡

| round | verdict | findings | 内容 |
|---|---|---|---|
| 1 | needs-fix | high 11 / medium 3 | 軸の欠落（S0/S8/G8/deprecated）・SM-4/6/9/11/12 の実コード矛盾・SM-1 原子性・SM-7 の決着/未決矛盾。全 14 件受諾（清書 = `review-20260809-screen-state-review-round1.md`） |
| 2 | needs-fix | high 4 / medium 3 | 残存: SM-1 の順序と transaction・SM-9 の formula parts 層・SM-16 の自己矛盾（resolve 分離を v1 に昇格）・G1 分解の不徹底・deltas min・currentRevision・Retry-After。全 7 件検証のうえ受諾（清書 = `review-20260809-screen-state-review-round2.md`） |
| 3 | needs-fix | medium 1 | #1/#2/#3/#5/#6/#7 解消確認。残存 = S5/S6 の G1 セルが 4 項目分解になっていない（本表で修正済み。清書 = `review-20260809-screen-state-review-round3.md`） |
| 4 | **pass** | 0 | round3 残存 1 件の解消を確認。**収束**（清書 = `review-20260809-screen-state-review-round4.md`） |

**G9 列（U16 公開設定）の追加分**は別キャンペーンで監査: Codex adversarial round1〜3 収束
（round3 pass・2026-08-09〜10・round1 = high 4/medium 3/low 1、round2 = high 2/medium 3/low 1 —
全 14 件受諾・反映済み。証跡 = `review-results/u16-visibility-review/`）
