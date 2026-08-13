# track 作成時ロールの契約昇格 起案（DRAFT・ユーザー裁定待ち）

作成: 2026-08-13（L-2 裁定 (c) の付帯裁定「track は廃止せず昇格」を受けた起案）。
状態: **DRAFT**。契約形と実装順序が決まったらスライス化する。

## 背景

L-2 は (c)「roll 型は常に作成時ロール」で裁定済み。
(c) の素朴な実装は契約外プロパティ `rollOnCreate` を読む分岐を丸ごと消すため、
契約外の裏口として動いていた「track の作成時ロール初期化」（HP を出目で決める形）も一緒に消える。
ユーザー裁定（2026-08-13）はこの表現を**失わず、正式契約へ昇格する**こと。

現状の事実（L-2 裁定資料 §1 と合成 spec 実読より）:

- 存在証明は `character-instantiation.service.spec.ts` の合成 spec 1 本のみ
  （track に契約外 `notation`＋`rollOnCreate: true` → 作成時に振り、出目が min〜max 外なら 422）
- engine 契約（TrackField）に該当プロパティは無く、publish は passthrough で素通し
- エディタに入力 UI なし・実在テンプレゼロ

## 契約形の選択肢

| 案 | 形 | 利点 | 費用と論点 |
|---|---|---|---|
| **A: TrackField へ内包** | `TrackField.rollOnCreate?: { notation: string }` を正式追加 | 変更が track 局所で最小。既存挙動（出目 = 初期値・範囲外 422）をそのまま契約化できる | engine 型＋publish zod＋エディタ track 詳細 UI の 3 点セット。RollField の「型 = 作成時ロール」との語彙併存（ただし track は初期化手段の宣言であり意味論衝突はしない） |
| B: RollField 参照 | roll 型フィールドを別に置き、track 初期値がその結果を参照（`initialFrom` 等） | 「振るのは roll 型だけ」の一本意味論を完全維持 | 参照解決の順序設計・シートに出目フィールドが並ぶ表示影響・contract の参照整合検証が新規に必要 |
| C: 式言語で dice | track の初期値式に dice を許す | 汎用 | 実質 L-1（evaluator の dice 対応）と同じ言語拡張で費用最大 |

**起案者の推奨は A**。
昇格対象が「現に動いていた挙動の契約化」であり、A だけが挙動を変えずに正式化できる。
B と C は新設計であり、失われる挙動の救済という今回の目的を超える。

## ユーザー方針（2026-08-13・契約形の裁定前に確定した設計信号）

1. **契約形は即決しない**。現在の実装と問題点を洗い出してから再裁定する（Codex にも確認・本 doc の調査節へ追記予定）。
2. **修飾つき notation が普通に使われる想定**（例: `1d20+10`）。bare dice だけを前提にした契約は不可。
3. **範囲外の出目は拒否しない**。「TRPG はこのような範囲の超過は楽しむもの」（ユーザー原文）。
   現行の 422 前提（合成 spec）は昇格時に踏襲しない方向で評価する。
   超過値の表現（gauge 表示・±・保存）をどう扱うかが調査の論点になる。
4. 実装順序（(c) 先行か同時か）は**未定のまま**。

## 現状調査の結果（2026-08-13・Codex 調査 run-track-promotion-survey・Fable が要主張 2 点を実読裏取り）

### 範囲外値の現状意味論（層ごとに違う）

| 層 | 現状 | 根拠 |
|---|---|---|
| 作成時 | 作成時ロールを含む全 track を TrackRangePolicy で検査し、逸脱は materialize 前に 422 | instantiation.service :28-38 |
| Web 保存 | 変更 track の新規逸脱と悪化を拒否。既存違反の維持と縮小は許可 | track-range.policy :362-386 |
| Discord ± | raw を実効範囲へ clamp してから delta 適用。raw=999/max=10 だと `+` は実効 0・`-` は raw にだけ効き表示は 10 のまま | operation.service :320-365・clamp.ts |
| 保存と投影 | **split-brain（Fable 実読確認）**: materialize は clamp 済み値・`sheet.values` は raw を書き戻す。raw=999 を保存しつつ projection と palette は 10 になる | operation.service :234-253/:358-369 |
| front 表示 | **track の gauge/checkboxes 描画は未実装（Fable 実読確認）**。label と型名だけの placeholder で value/min/max を読まない | TemplateFormRenderer :622-648 |

含意: **作成時 422 を外すだけでは「超過を楽しむ」にならない**。
超過値が保存層にだけ残り、式参照・投影・Discord・画面からは隠れる。
超過を第一級にするなら、canonical 値・式参照値・投影値・± の基準値・数値表示を同じ意味論へ揃える必要がある（gauge の塗りだけ 100% で止め、数値は `15 / 10` のように超過を明示する形が候補）。

### 修飾つき notation は現状の実行経路で動く

- 実行系は `1d20+10` や `(2d6+6)*5` を受理し、total は最終値（修飾込み）で返る（実 BCDice probe = 13・75）
- ただし drift あり: standalone publish は `/` を拒否するが runtime は許可・track の隠し notation は検査対象外・publish が許す placeholder を instantiation は補間しない

### 契約形 3 案の評価（調査による）

| 案 | 修飾 notation | 範囲超過 | 主な含意 |
|---|---|---|---|
| A: TrackField へ `rollOnCreate?: { notation }` 内包 | ◎ 既存 standalone 文法と実行系を再利用 | raw を第一級にすれば ◎ | 既存ユースケースへ最短。boolean/string 二形態は廃止し単一オブジェクト形へ |
| B: RollField 結果参照 | ◎ | max 参照なら「ランダム容量」で超過ではなくなる | 現契約では表現不能（publish 静的型が track 参照 = number を要求）。作成フェーズ専用の型付き参照（`resolvedMaxFrom` 等）の新設計が要る |
| C: 式言語に dice | △ | ◎ | 決定的評価に乱数副作用を持ち込み、再 materialize の再ロール防止・原子性・proof まで波及。費用最大 |

調査の推奨 = **A を単一の正式形にし、出目は canonical current value として保存・参照・表示（gauge 塗りのみ視覚 cap・数値は超過明示）。random max は必要になった時に B の作成フェーズ専用参照として追加・C は不採用**。

### 反転・変更が必要になる既存 pin（裁定次第の分も列挙済み）

必須 = 合成 RollField の契約外 pin・track 422 pin・L-2 再現 3 red の緑化。
範囲意味論の裁定次第 = 提出値逸脱・parts 検査・悪化拒否・raw/投影 clamp・front 描画・HTTP proof の各 pin（詳細は調査ログ）。

## A 採用時の決定点

1. **範囲外出目の扱い**: 現行どおり 422（作成失敗）か、min〜max へ clamp か、再ロールか。
   現行 spec は 422 を固定しており、**422 維持が最小**。
2. **v1 に入れるか v1.x か**: エディタ UI まで含めると 1〜2 スライス。
   UI を後回し（契約と instantiation のみ先行）にする分割も可能。
3. **L-2 (c) スライスとの順序**:
   - 順序 1（推奨）: (c) を「roll 型分岐を追加し、track の契約外分岐は暫定温存」の形で先行 →
     常時赤 3 件を先に解消 → 昇格スライスで契約外分岐を正式契約読みへ置換。
   - 順序 2: 昇格設計の確定を待って (c) と同時に実装（スライスは大きくなるが暫定期間なし）。

## 影響面（A の場合）

engine 型（types.ts）、publish zod（passthrough 政策 B-15 と整合させ track のみ検証追加）、
instantiation（発火条件を正式契約読みへ）、エディタ（track 詳細に notation 入力・任意）、
既存合成 spec（契約化後の形へ書き換え）。
Discord の±（res_）意味論と materializer の投影は不変。
