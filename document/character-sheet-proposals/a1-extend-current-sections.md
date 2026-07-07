# 案A1: 現行セクション温存・最小拡張方式

> **分類**: A系（表現モデル・排他）
> **ステータス**: 案出し（未決定）
> **最終更新**: 2026-07-06

## 一言でいうと

Character の 5 セクション（status / skill / parameter / item / description）と `AttributeValue` の形をそのまま正本とし、
**テンプレート＝「同型セクションの雛形ドキュメント」**、複雑ステータス＝`AttributeValue` への `formula` 追加で賄う、
移行コスト最小の案。[phase0-character-sheet.md](../phase0-character-sheet.md) §4.1.3 の `CharacterSheetTemplate` 型の素直な延長線。

## データモデルスケッチ

```ts
// テンプレート（Character と同型のセクション + メタ）
interface CharacterSheetTemplate {
  templateId: string
  templateName: string
  gameSystemId: string
  authorDiscordUserId: string
  visibility: 'private' | 'public' | 'unlisted'
  version: string
  status: AttributeSection
  skill: AttributeSection
  parameter: AttributeSection
  item: AttributeSection
  description: AttributeSection
  tables?: Record<string, LookupTable> // ダメージボーナス等の参照表（B1 で定義）
}

// AttributeValue の正式拡張（core/types/attribute.types.ts を変更）
interface AttributeValue {
  // ...現行フィールド（name / index / values / description / dice / isVisible）...
  formula?: string      // 例: "floor(({parameter.con} + {parameter.siz}) / 10)"
  rollOnCreate?: string // 例: "3d6*5"（キャラ作成時にロールして values.base へ書く）
}
```

- キャラ作成 ＝ テンプレートのセクションをディープコピー（実体化）→ `rollOnCreate` をロール → `formula` を評価して `values.base` へ確定
- `formula` は保存後も再評価可能（依存元の値が変わったら再計算）
- phase0 §7-3 で仮置きされた「description に `formula:` prefix」案は、**専用フィールド新設によって廃止**する
  （description 二重用リスク＝phase0 §5 の解消）

## 試金石: CoC の複雑ステータス

| 対象 | 表現 | 評価 |
|------|------|------|
| DEX（3d6×5） | `parameter.dex.rollOnCreate = "3d6*5"` | ○ |
| 半分値/5分の1値 | `status.dex_half.formula = "floor({parameter.dex}/2)"` | ○（セクション横断参照の構文が必要） |
| ダメージボーナス | `parameter.db.formula = "lookup({parameter.str}+{parameter.siz}, 'damage_bonus')"` ＋ `tables.damage_bonus` | △ 結果が「+1d4」＝**ダイス式（文字列）**なので `values`（数値合算）に収まらず、`dice` へ書き分ける値型分岐が必要（B1 の主論点） |
| HP | formula ＋ floor | ○ |
| MOV（条件分岐） | `if()` 関数を B1 で足せば可 | △ |

## 長所

- **既存キャラ・既存 Discord 経路が無改修で動く**。`skill_` / `ability_` ハンドラ、`findByChannelId` の projection、
  `applyDiscordDelta`（±操作）、キャラ embed がすべて現行のまま
- ドメイン変更が最小: character-sheet ドメインを 1 つ足し、character 側は optional フィールド追加のみ
  （`templateId` / `templateVersion` は Phase 0b で追加想定済み）
- テンプレートとキャラクターが同型なので、実体化（コピー）とマッピングが自明

## 短所・リスク

- **「Excel のように」の自由度は低い**: セクションは 5 固定でタブ追加不可。text / select / checkbox のような入力型なし。
  レイアウト（配置・列幅）の表現がない
- `AttributeValue` が肥え続ける（name / values / description / dice / formula / rollOnCreate / isVisible ...）。
  1 つの型に「入力値・導出・表示・ロール」の関心が同居する
- 技能のような「行の集合」（基本値＋成長＋合計）は `values` の複数キー運用で**暗黙的にしか**表せない。
  テンプレート作者に規約を強いる（例: base / growth キーを使う、など）
- 表現力の天井が低いため、将来 A2/A4 へ再移行するならこの案の資産は雛形データのみで、二度手間になる可能性

## 既存資産との関係

- `core/types/attribute.types.ts` を**正式に変更**する（ドメインスキルの「独自形状を発明しない」という制約の
  正本そのものを更新する扱い。DTO / Zod / repository spec への波及を同時に行う）
- フロントの characterTemplate DSL（fields[] + layout）とは接続しない（DSL は mock のまま凍結するか、A2 へ温存）

## この案を選んだ場合に決めるべきこと

1. `formula` の評価タイミング（保存時に確定 persist するか、読み出し時に lazy 評価するか）
2. `rollOnCreate` の実行エンジン（bcdice に寄せるか、簡易ローラーか）
3. 5 セクションに収まらない情報（プロフィール・メモ等）の置き場（description セクション運用か、専用フィールドか）
4. セクション横断参照 `{parameter.dex}` の構文確定（B1）
