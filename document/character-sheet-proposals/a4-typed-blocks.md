# 案A4: 型付きブロック合成方式

> **分類**: A系（表現モデル・排他。ただし A2 への部分導入が現実解）
> **ステータス**: 案出し（未決定）
> **最終更新**: 2026-07-06

## 一言でいうと

シート＝「**意味を持つブロック**（能力値表・技能リスト・リソース・参照表・装備・自由記述）の並び」として定義する案。
各ブロック型が導出・UI・Discord 連携の既定動作を内蔵するため、**Discord 連携が全案中もっとも自然に決まる**。
Notion やフォームビルダーの「ブロック」に近い発想。

## データモデルスケッチ

```ts
interface Template {
  blocks: Block[]
}

type Block =
  | StatBlock       // 能力値表。rollOnCreate と派生値（半分/1/5 等）を標準装備
  | SkillListBlock  // 技能リスト。行構造（基本値・成長・合計）とロール記法を内蔵
  | ResourceBlock   // HP/SAN/MP。current/max・増減幅を持ち、Discord ±ボタンが自動で付く
  | LookupTableBlock// 参照表。入力式 → レンジ → 結果（数値 or ダイス式）
  | RepeaterBlock   // 装備・呪文などの可変行
  | TextBlock       // プロフィール・メモ

// 例: StatBlock
interface StatBlock {
  type: 'stat'
  stats: Array<{
    id: string
    label: string
    rollOnCreate?: string            // "3d6*5"
    derived?: Array<{ id: string; label: string; formula: string }> // half/fifth など
  }>
}

// 例: LookupTableBlock（ダメージボーナス）
interface LookupTableBlock {
  type: 'lookup'
  id: string
  input: string // "{str} + {siz}"
  ranges: Array<{ min: number; max: number; result: number | string /* "+1d4" */ }>
}
```

## 試金石: CoC の複雑ステータス

| 対象 | 表現 | 評価 |
|------|------|------|
| DEX（3d6×5）＋半分/1/5 | StatBlock（rollOnCreate ＋ derived 標準装備） | ◎ 作者は式を書かなくてよい |
| ダメージボーナス | LookupTableBlock（input `{str}+{siz}`、result にダイス式可） | ◎ **全案中もっとも素直** |
| SAN | ResourceBlock（max `99 - {cthulhu_mythos}`、初期値 `{pow}`） | ◎ |
| HP | ResourceBlock（max 式） | ◎ |
| MOV（条件分岐） | どの定型ブロックにも収まらない | △ escape hatch（computed ブロック＝自由式）が必要 |
| 技能 60 個 | SkillListBlock が行構造ごと解決 | ◎ |

## 長所

- **Discord マッピングが仕様で決まる**: SkillList → 技能ボタン/チャットパレット、Resource → ±ボタン、
  Stat → 能力ロール。B4 のフィールド注釈がほぼ不要になる
- 作者が式を書かずに済む範囲が広く、事故（循環参照・型不一致・表記ゆれ）が構造的に減る。
  配布テンプレートの品質が揃いやすい（B3 のモデレーション負荷も下がる）
- 現行資産との親和: `AttributeValue.values` の複数キー合算や `applyDiscordDelta`（other キーへの±書き込み）は
  ResourceBlock の先行実装とみなせる

## 短所・リスク

- **自由度がブロック型の品揃えに律速される**。「Excel のように」という要求の字面とはズレる
  （珍しいシステムへの対応＝運営側のブロック開発になりがち）
- ブロック型ごとにエディタ UI・評価・Discord 実装が必要で、開発が横に広い
- escape hatch（自由式ブロック）を用意しないと長尾を取りこぼし、用意すると A2 との違いが薄れる

## 既存資産との関係

- characterTemplate DSL とは別形状だが、「タブ＋フィールド」を「ブロック＋行」に読み替える変換は可能
- 現実解は**単独採用ではなく A2 への段階導入**:
  A2 の DSL に「ブロック＝role 付き複合フィールド」として SkillList / Resource / LookupTable の 3 つをまず足す。
  これで A2 の弱点（repeater・表引き・±操作）と B4 の注釈設計が同時に片付く

## この案（または A2 への部分導入）を選んだ場合に決めるべきこと

1. 初期ブロックセットの確定（CoC を成立させる最小: Stat / SkillList / Resource / LookupTable / Text）
2. escape hatch（自由 computed ブロック）を持つか、持つ場合の制約（B1 のサンドボックス前提）
3. ブロック内 id とテンプレート全体の名前空間（式からの参照方法）
