# legacy-coc-v3: 技能セクションと技能ポイントの振り分け

2026-08-22。ユーザー要望「いあきゃらのように、技能を振るときに特定の値を参照して
それを最大値として割り振れるようにしたい」への設計。**実装前のレビュー用**。

## 前提: 機構は既にある

engine・シート画面・テンプレートエディタの 3 層とも実装済みで、
不足しているのは**配布テンプレートが技能セクションを持っていないこと**だけだった（実測で確認）。

| 層 | 実測結果 |
|---|---|
| engine | `SheetSection.pools: Array<{ id, label, total: ConstraintSource, partsKey, scope? }>`。`total` は式を書ける |
| engine | `AnnotationPoolRuntime` が `consumed / total / remaining / over` を返す。`pool-over` 診断あり |
| シート画面 | 「残り N / M」＋予算使用率バー。超過で `data-pool-status="danger"`（赤） |
| シート画面 | 内訳エディタ（「目星: 内訳を編集」）から振り分けられる |
| エディタ | `SectionPoolsInput`（予算 / パーツキー / スコープ）で作者が宣言できる |

## なぜ新しい templateId になるのか

`resolveReadableRevision` に明記がある — 「**Phase 2 は templateId ごとに単一バージョンのみを保持する**」。
版を上げると既存キャラの pin（`templateId` + `templateVersion`）が解決できず 409 になる。
`update` も published/deprecated の構造変更を `published/deprecated template structure is immutable` で拒否する。

したがって **`legacy-coc-v3` を新規に insert し、`legacy-coc-v2` を deprecate する**
（PV-S5 で作った deprecate 経路をそのまま使う）。既存 v2 キャラは pin 解決が通るのでそのまま開けるが、
「このシートは非推奨版のテンプレートに固定されています」の注記が出る。

**構造不変の帰結**: この技能リストを後から直すには `legacy-coc-v4` が要る。
だから**リストは実装前に確定させる**。

## 能力値のスケール（式の導出根拠）

この seed は能力値を**パーセンタイル（raw × 5）**で持つ。既存の computed 式がその証拠:

| 項目 | seed の式 | CoC6 原典 | 導かれるスケール |
|---|---|---|---|
| HP | `floor(({parameter.con} + {parameter.siz}) / 10)` | (raw CON + raw SIZ) / 2 | raw = pct / 5 |
| MP | `floor({parameter.pow} / 5)` | raw POW | raw = pct / 5 |
| SAN | `{parameter.pow}` | raw POW × 5 | pct = raw × 5 |

一方**技能値はパーセンテージそのもの**（目星 25 は 25%）でスケールしない。
よって能力値を参照する技能式だけ /5 が要る。

| 項目 | CoC6 原典 | このテンプレートでの式 |
|---|---|---|
| 職業技能ポイント | raw EDU × 20 | `{parameter.edu} * 4` |
| 興味技能ポイント | raw INT × 10 | `{parameter.int} * 2` |
| 回避の初期値 | raw DEX × 2 | `floor({parameter.dex} * 2 / 5)` |
| 母国語の初期値 | raw EDU × 5 | `{parameter.edu}` |

例: EDU 65 / INT 60 / DEX 65 → 職業 260・興味 120・回避 26・母国語 65。

## 構造

技能セクション 1 つに、内訳キー 3 種とプール 2 本を置く。

```
section: skill（技能）
  pools:
    - { id: 'occupation', label: '職業ポイント', total: { formula: '{parameter.edu} * 4' }, partsKey: 'occupation' }
    - { id: 'interest',   label: '興味ポイント', total: { formula: '{parameter.int} * 2' }, partsKey: 'interest' }

  各技能 field（scalar / number）:
    partsKeys:
      - { id: 'initial',    label: '初期値', default: <数値または式> }   ← PV-2b が作成時に焼き込む
      - { id: 'occupation', label: '職業' }                              ← 職業ポイントの振り先
      - { id: 'interest',   label: '興味' }                              ← 興味ポイントの振り先
```

技能値は内訳の合計。Discord の ± は予約キー `other` に積むので、上の 3 種とは混ざらない。

### 意図的に採らなかったもの

- **技能ごとの上限（`max`）は置かない。** 要望の「最大値」はプール予算のことで、
  技能個別の上限は CoC6 に無い。置くと正当な高技能値に警告が出るだけになる
- **職業技能の限定はしない。** CoC6 では職業ごとに振れる技能が決まるが、それはキャラごとの選択であって
  テンプレートには書けない。両プールとも全技能へ振れる形にする（いあきゃらも運用でカバーしている）
- **ブロック（`blocks`）と `pool.scope` は使わない。** 上の理由でプールを技能種別に絞れないため、
  ブロックを切っても予算の帰属は変わらない。分類は将来 U14 のレイアウトで扱う

## 技能リスト（CoC6 標準・確認をお願いします）

初期値は CoC6 の標準値。**式のものは 2 件だけ**（回避・母国語）。

### 戦闘技能

| 技能 | id | 初期値 |
|---|---|---|
| 回避 | dodge | `floor({parameter.dex} * 2 / 5)` |
| キック | kick | 25 |
| 組み付き | grapple | 25 |
| こぶし（パンチ） | punch | 50 |
| 頭突き | headbutt | 10 |
| 投擲 | throw | 25 |
| マーシャルアーツ | martial_arts | 1 |
| 拳銃 | handgun | 20 |
| サブマシンガン | smg | 15 |
| ショットガン | shotgun | 30 |
| マシンガン | machinegun | 15 |
| ライフル | rifle | 25 |

### 探索技能

| 技能 | id | 初期値 |
|---|---|---|
| 応急手当 | first_aid | 30 |
| 鍵開け | locksmith | 1 |
| 隠す | conceal | 15 |
| 隠れる | hide | 10 |
| 聞き耳 | listen | 25 |
| 忍び歩き | sneak | 10 |
| 写真術 | photography | 10 |
| 精神分析 | psychoanalysis | 1 |
| 追跡 | track | 10 |
| 登攀 | climb | 40 |
| 図書館 | library | 25 |
| 目星 | spot_hidden | 25 |

### 行動技能

| 技能 | id | 初期値 |
|---|---|---|
| 運転（自動車） | drive | 20 |
| 機械修理 | mech_repair | 20 |
| 重機械操作 | operate_heavy_machine | 1 |
| 乗馬 | ride | 5 |
| 水泳 | swim | 25 |
| 製作 | craft | 5 |
| 操縦 | pilot | 1 |
| 跳躍 | jump | 25 |
| 電気修理 | electr_repair | 10 |
| ナビゲート | navigate | 10 |
| 変装 | disguise | 1 |

### 交渉技能

| 技能 | id | 初期値 |
|---|---|---|
| 言いくるめ | fast_talk | 5 |
| 信用 | credit_rating | 15 |
| 説得 | persuade | 15 |
| 値切り | bargain | 5 |
| 母国語 | own_language | `{parameter.edu}` |
| 他の言語 1 | other_language_1 | 1 |
| 他の言語 2 | other_language_2 | 1 |
| 他の言語 3 | other_language_3 | 1 |

### 知識技能

| 技能 | id | 初期値 |
|---|---|---|
| 医学 | medicine | 5 |
| オカルト | occult | 5 |
| 化学 | chemistry | 1 |
| クトゥルフ神話 | cthulhu_mythos | 0 |
| 芸術 | art | 5 |
| 経理 | accounting | 10 |
| 考古学 | archaeology | 1 |
| コンピューター | computer | 1 |
| 心理学 | psychology | 5 |
| 人類学 | anthropology | 1 |
| 生物学 | biology | 1 |
| 地質学 | geology | 1 |
| 電子工学 | electronics | 1 |
| 天文学 | astronomy | 1 |
| 博物学 | natural_history | 10 |
| 物理学 | physics | 1 |
| 法律 | law | 5 |
| 薬学 | pharmacy | 1 |
| 歴史 | history | 20 |

計 62 技能。

### 確定事項（2026-08-22・ユーザー裁定）

| 論点 | 決定 | 備考 |
|---|---|---|
| 技能の過不足 | **CoC6 標準 60 種＋「他の言語」3 枠 = 62 本** | ハウスルール技能の追加・削除はしない |
| 初期値 | **CoC6 標準**（こぶし 50 / 登攀 40 / 応急手当 30 など） | 他版との差は採らない |
| クトゥルフ神話 | **職業・興味ポイントの振り先に含める** | 原典では作成時に振れないが、ハウスルールとして振れる形にする。他の技能と同じ 3 内訳キーを持たせる |
| 他の言語 | **固定 3 枠**（`other_language_1` 〜 `_3`） | 使わない枠は初期値 1 のまま残る |

### 「ユーザーが欄を増やせる形」を採らなかった理由

ユーザーの当初の希望は「他の言語をユーザーが後から増やせるようにする」だった。
実測すると、行を増やす機構（`list` 型）は層によって対応が割れている。

| 層 | list 対応 |
|---|---|
| engine の型・publish 検証・評価 | あり（`types.ts:124` / `publish.ts:136` / `evaluator.ts:71-78`） |
| server の materialize | あり（`sheet-materializer.service.ts:212`） |
| シート編集画面の描画・行追加 | **無い**（`TemplateFormRenderer.tsx:756-781` は scalar / track / computed / roll のみ。他はプレースホルダの箱になる） |
| **プール（職業・興味ポイント）への参加** | **無い**（`annotation-runtime.ts:134-135` の集計は `for (const field of section.fields)` で section 直下しか走査しない） |

front に list を描くだけでは要望を満たさない。list にした「他の言語」には**ポイントを振れない**。
プール参加まで通すには engine の集計範囲と publish の宣言探索まで変更が要り、3〜4 スライスになる。
**先に v3 を出して振り分けを使える状態にし、list 対応は別 feature とする**（2026-08-22 ユーザー裁定）。

**追記（2026-08-27）**: 上表のプール行と「ポイントを振れない」は当時の実測。その後
web-free-add S1〜S3（2026-08-26）で annotation-runtime が list 行の itemField partsKeys も
プール source に積むようになり、v4（legacy-coc-v4）のカスタム技能 list は職業・興味プールへ
参加する（pool の publish 資格＝partsKey 宣言の充足は引き続き section 直下 field のみ）。

なお v3 へ list 欄を後から足すには v4 が要る（構造不変のため）。
## スライスの分け方

| # | 範囲 | 依存 |
|---|---|---|
| PV-2b | 内訳の既定値を作成時に焼き込む（server） | — |
| **本スライス** | `legacy-coc-v3` の seed 定義（技能セクション＋プール）と seeder の v2 deprecate | PV-2b |

PV-2b が先である理由: 回避と母国語の初期値は式なので、焼き込みが無いと **0 になる**。
先に seed を書くと、その 2 件だけ壊れた状態で配布される。

## 受入条件（画面の名前を書く）

- **Web のシート編集画面**で、`legacy-coc-v3` から作ったキャラに「職業ポイント 残り N / M」
  「興味ポイント 残り N / M」が出る
- 回避の初期値が **DEX から導かれた数値**になっている（0 でない）
- 母国語の初期値が EDU と一致する
- 内訳エディタから職業欄へ振ると「残り」が減る
- 予算を超えるとバーが赤くなる
- 一覧に出る system テンプレートは `legacy-coc-v3` の 1 件（v2 は deprecated）
