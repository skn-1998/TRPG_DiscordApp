# U14/U15 検証観点マトリクス（設計穴出し用）

> **分類**: 検証補助（[design-v1-ui.md](design-v1-ui.md) §2 v1.1/v1.2 追記 = U14 レイアウトヒント・
> U15 ブロック/上限/ポイントプール の設計穴を観点×要素の全セル走査で塞ぐ）
> **作成**: 2026-08-09。仕様の正本は design-v1-ui.md（本表は検証状態の台帳であり、規範は持たない）
> **監査**: Codex adversarial レビュー **round1〜3 で収束（round3 = pass・findings 0）**
> （2026-08-09・round1 = high 7/medium 5、round2 = high 3/medium 2 — 全 17 件受諾・反映済み。
> 証跡 = `review-results/u14-u15-design-review/`）。
> さらに **cross-cut 再レビューと認知負荷・YAGNI 監査を反映した縮約版**
> （2026-08-09・formula parts と資源上限の**個別**閾値を v1 から延期。証跡 =
> `review-results/{design-crosscut-review,design-cogload-review}/`）

## 使い方

1. 各セルを「観点 V×要素 R で設計は答えを持つか」で埋める。穴は H-番号で採番し下表で裁定・反映先を記録
2. Codex レビュー round では「セルの答えの反証」と「観点/要素の軸自体の漏れ」を攻撃させる
3. 実装ループはこの表の 🔎 を実測タスクとして消化する（§6-1 #9/#10 に紐づけ）

**凡例**: ✅ 元設計（v1.1/v1.2 本文）に答えあり ／ 🩹H-n 穴だったが追補で閉じた
（design-v1-ui §2「マトリクス起点の追補」= 規範。round1 反映済み）／ 🔎H-n 実装時の実測・API 設計で
確定する残タスク ／ ⏸H-n 依存機能の凍結解除まで延期 ／ − 該当なし・対象外

## 観点定義

| # | 観点 | 問い |
|---|---|---|
| V1 | 後方互換 | 既存テンプレ・既存キャラデータ・legacy-coc seed は無変更で動くか。**既存プロパティの型を変えていないか** |
| V2 | 三面契約 | (2)(3) は純解釈器のままか・同一評価器契約は保たれるか（**server materialize を含む**）・Discord 投影/fixture に影響しないか |
| V3 | 式・評価器 | 循環・評価順・AST/step 上限・丸め・未入力参照・型（number 必須）の扱いは**現行 evaluator の実挙動と整合して**定義済みか |
| V4 | publish/Zod 線引き | 何が Zod 拒否・publish エラー・警告のみか。線引きは「構造/作者起因参照=拒否／内容・実行時 skew=警告」と一貫か |
| V5 | 保存・競合 | baseRevision diff・parts キー単位 auto-merge（欠陥5）・**暗黙 base/other プロトコル**・server 書込経路と衝突しないか |
| V6 | UI 縮退 | モバイル・grid セル・未評価値・未知値で壊れず退化できるか。**省略値の canonical 化**は決定的か |
| V7 | エッジケース | 不在/重複 id・負値・空集合・when/visibleTo との相互作用は定義済みか |
| V8 | 実装ギャップ | 既存コードとの距離・実測が必要な前提はないか |
| V9 | 資源・運用上限 | 配列総数・式総数・列数・警告件数に publish で拒否できる上限があるか（round1 #12 で追加） |

**注記（visibleTo/gm）**: 秘匿系は design-v1 §8-11 で凍結中のため、gm-only フィールドの消費が予算バーへ
与える情報面の検討は v1 対象外（GM モデル導入時に観点 V10 として追加する）。
**注記（when）**: `when` は publish で一律拒否（`publish.ts:167-169`）＝凍結中。U15 との相互作用は
when 解禁設計に委ねる（⏸H-4）。

## マトリクス

### U14（レイアウトヒント）

| 要素 | V1 | V2 | V3 | V4 | V5 | V6 | V7 | V8 | V9 |
|---|---|---|---|---|---|---|---|---|---|
| R0 schema 拡張方式（新規 optional のみ） | 🩹H-9（既存 `section.layout` の狭め方を含む） | ✅ | − | ✅ | ✅ | − | − | − | − |
| R1 preset（stack/grid/table） | ✅ | ✅ | − | ✅ | − | ✅ stack 退化 | ✅ 未知値退化 | − | − |
| R2 columns / span | ✅ | ✅ | − | ✅ 警告 | − | 🩹H-15 canonical | ✅ clamp | − | − |
| R3 複雑 4 型の常時全幅 | − | ✅ | − | − | − | ✅ | ✅ table 内降格 | − | − |
| R4 モバイル固定折り畳み | − | ✅ | − | − | − | ✅ | 🩹H-14 | − | − |

### U15（ブロック・上限・ポイントプール）

| 要素 | V1 | V2 | V3 | V4 | V5 | V6 | V7 | V8 | V9 |
|---|---|---|---|---|---|---|---|---|---|
| R5 blocks / blockId | ✅ | ✅ 参照文法外 | − | 🩹H-10 | − | 🩹H-17 順序/preset 再適用 | 🩹H-6 🩹H-17 | − | 🩹H-18 |
| R6 scalar.max（式付き） | ✅ | ✅ track 同形 | 🩹H-8 🩹H-13 | 🩹H-13 | − | 🩹H-7 | 🩹H-2 | 🔎H-7 API 設計 | 🩹H-18 |
| R7 block.cap | ✅ | ✅ | 🩹H-8 | 🩹H-10 | − | 🩹H-7 | ✅ 優先順位 | − | 🩹H-18 |
| R8 partsKeys 宣言（**v1 は `{id,label}` のみ**） | 🩹H-9 別プロパティ | ✅ | ⏸H-3 formula 延期 | 🩹H-1 | 🩹H-1 base/other・書込制御 | 🩹H-11 🩹H-16 | 🩹H-5 ⏸H-4 | − | 🩹H-18 |
| R9 pools（total/partsKey/scope） | ✅ | 🩹H-12 三面共通 | 🩹H-8 🩹H-7 | 🩹H-10 | ✅ merge 経路不変 | ✅ 予算バー | 🩹H-5 🩹H-6 ⏸H-4 | 🔎H-7 API 設計 | 🩹H-18 |
| R10 超過（cap/pool）は警告のみ | − | − | − | ✅ 裁定（構造系は H-10 でエラー化） | − | − | ✅ | − | 🩹H-18 不変条件＋集約上限 |
| R11 残りは表示専用 | − | 🩹H-12 | ✅ 裁定 | − | − | − | − | − | − |

## 穴一覧（H-1〜H-18）

**規範本文は [design-v1-ui.md](design-v1-ui.md) §2 の追補が唯一の正本**。本表は「どの穴が何で・
どこで裁定され・検証状態がどうか」だけを持つ（裁定全文の再掲は認知負荷監査 #3 で廃止）。

| # | 穴（一言） | 裁定の所在 | 検証状態 |
|---|---|---|---|
| H-1 | 宣言 parts と暗黙 `base`/`other` プロトコルの衝突 | §2 追補「parts の名前空間」 | 🩹 round1 #6・round2 #4 |
| H-2 | max/cap の適用対象（合計 vs 内訳） | §2 追補「max / cap は parts 合計後」 | 🩹 |
| H-3 | formula 付き parts key の意味論・identity | §2 追補「formula 付き parts key は v1 では持たない」 | ⏸ **v1 延期**（cogload #4・cross-cut #1）→ v1.1 候補 |
| H-4 | when=false のフィールドの消費扱い | §2 追補「when との相互作用は延期」 | ⏸ when 解禁設計へ |
| H-5 | 負値 parts の可否 | §2 追補「負値 parts は許可」 | 🩹 |
| H-6 | 入れ子（list/relation）への適用範囲 | §2 追補「数値系注釈はセクション直下のみ」 | 🩹 |
| H-7 | 未入力参照の挙動（evaluator は 0 変換） | §2 追補「制約評価 API」 | 🩹 round1 #3・round2 #1（API 設計は 🔎） |
| H-8 | 端数処理（rounding は評価器未参照） | §2 追補「丸めの自動適用はしない」 | 🩹 |
| H-9 | schemaVersion / 後方互換（`parts` 型・既存 `section.layout` の狭め方） | §2 追補「schemaVersion は 3 据え置き＋既存 layout の狭め方」 | 🩹 round1 #1・cross-cut #2 |
| H-10 | 参照不整合の線引きと実行時 skew の退化 | §2 追補「参照整合の線引き」＋退化規則表 | 🩹 round1 #7・round2 #5 |
| H-11 | grid セル内の parts 宣言フィールドの描画 | §2 追補「grid セル内は合計値のみ」 | 🩹 |
| H-12 | 制約計算の実装箇所とズレ検出 | §2 追補「sheet-engine 共通ロジック」＋cross-package fixture | 🩹 round1 #11 |
| H-13 | 制約式の型 | §2 追補「max / cap / pool total は number 必須」 | 🩹 |
| H-14 | parts キー 3+ の table × モバイル | §2 追補「横スクロール容認」 | 🩹 |
| H-15 | grid の columns/span 省略時既定 | §2 追補「grid の canonical 既定値」 | 🩹 round1 #8 |
| H-16 | table の列集合・順序（field ごとに宣言が異なる場合を含む） | §2 追補「table の列規則」（first-seen union・label 一致必須） | 🩹 round1 #9・cross-cut #3 |
| H-17 | blockId の適用型・順序・preset との適用順 | §2 追補「blockId 適用表と順序規則」 | 🩹 round1 #10 |
| H-18 | 資源上限と step 予算の不整合 | §2 追補「資源上限は『不変条件＋実測由来の集約上限 1 個』」 | 🩹 round1 #12・round2 #3・**cross-cut r2 #1**（集約上限は v1 必須・個別 7 個のみ延期。1,024×11 反例を回帰固定） |

## Codex レビュー証跡

| round | verdict | findings | 内容 |
|---|---|---|---|
| 1 | needs-fix | high 7 / medium 5 | CONFIRMED 7 件は Claude が実コードで全件裏取りし全 12 件受諾。H-1/H-3/H-4/H-7〜H-10 を改訂・H-15〜H-18 を新設（清書 = `review-results/u14-u15-design-review/review-20260809-u14-u15-design-review-round1.md`） |
| 2 | needs-fix | high 3 / medium 2 | #1/#2/#4/#8〜#11 解消確認。残存 = 制約評価の優先順位と閉包・partsKeys.id 一意性と synthetic identity・上限と step 予算の不両立・Web diff 契約・skew 退化規則。全 5 件検証のうえ受諾（清書 = `review-20260809-u14-u15-design-review-round2.md`） |
| 3 | **pass** | 0 | round2 残存 5 件すべて CONFIRMED で解消・編集行に新規欠陥なし。**収束**（清書 = `review-20260809-u14-u15-design-review-round3.md`） |
| cross-cut | needs-fix | high 3 / medium 1 | **3 追記を最終状態で同時に見た初の監査**。H-3×SM-9 の層所有・既存 `section.layout` の狭め方・table 列の canonical・SM-5×SM-11 の空パネルを摘発。全件受諾（清書 = `review-results/design-crosscut-review/`） |
| cogload | needs-fix | high 1 / medium 6 / low 1 | 認知負荷（17〜22 箇所横断・同時 8〜12 概念）と過剰実装を実測。§3.5 独立化・§3.6 実装境界表・裁定の二重化解消・v1 スコープ縮小 5 件を受諾（清書 = `review-results/design-cogload-review/`） |
| cross-cut r2〜r4 | needs-fix → **pass** | high 3/med 1 → high 1 → 0 | 縮約による回帰（H-18 集約上限の除去で 1,024×11 反例が復活）・formula 残存・制約 API の value 自己矛盾・§3.6 分類漏れを是正し **round4 で収束**（清書 = `review-20260809-design-crosscut-round4.md`） |
