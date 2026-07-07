# 案A2: スキーマ駆動フィールド定義方式（フロント DSL の昇格）

> **分類**: A系（表現モデル・排他）
> **ステータス**: 案出し（未決定・本命候補）
> **最終更新**: 2026-07-06

## 一言でいうと

`trpg-remix-app/app/features/characterTemplate` に既にある DSL（schemaVersion 2:
型付きフィールド＋式エンジン＋ダイス＋12カラムレイアウト）を**サーバー側 character-sheet ドメインの正本に昇格**し、
キャラクターは「templateId/version の pin ＋ `fieldId → 値` の Record」を持つ、フォームビルダー型の案。

## データモデルスケッチ

```ts
// テンプレート（現行フロント DSL をサーバー正本化。AI.types.md 準拠 + 拡張）
interface Template {
  // メタ: id / name / version(semver) / tags / schemaVersion / visibility / author ...
  fields: Field[]        // text | textarea | number | select | checkbox | computed | roll（+ 将来 repeater）
  layout: TabLayout[]    // タブ×12カラムグリッド
  tables?: LookupTable[] // 参照表（B1 で追加。ダメージボーナス用）
}

// フィールドへの拡張（B4 の Discord 注釈）
interface BaseField {
  // ...現行（id / label / tab / required ...）...
  role?: 'ability' | 'skill' | 'resource' | 'profile' // Discord UI 生成のための意味役割
}

// キャラクター側（再設計。詳細は B2）
interface Character {
  characterId: string // 不変
  gameSystemId: string
  // discordUserId / discordChannelId / discordThreadId ... は現行維持
  sheet: {
    templateId: string
    templateVersion: string
    values: Record<string /* fieldId */, string | number | boolean>
  }
  // 移行期間: 現行 5 セクションを materialized view として併存させ、Discord 経路を無傷に保つ
  status: AttributeSection
  skill: AttributeSection
  parameter: AttributeSection
  item: AttributeSection
  description: AttributeSection
}
```

- 保存時に computed を評価器（B1）でサーバー確定し、Discord 用の materialized sections
  （または B4 の roll palette）を同時に更新する

## 試金石: CoC の複雑ステータス

| 対象 | 表現 | 評価 |
|------|------|------|
| DEX（3d6×5） | roll フィールド `[3d6]` → computed `{dex_raw} * 5`（またはロール記法拡張で `[3d6*5]` 直接） | ○ |
| 半分値/5分の1値 | computed `floor({dex} / 2)` | ○（floor は実装済み） |
| ダメージボーナス | **現行 DSL では不可**。`lookup()` 関数＋「ダイス式を値に持てる computed」（B1 の 2 拡張）が前提 | △ B1 必須 |
| HP | computed | ○ |
| MOV（条件分岐） | `if()` ＋比較演算子（B1 拡張） | △ B1 必須 |
| 技能リスト（60 個規模） | 現行 DSL は repeater 非対応（AI.feature.md の非MVP に明記）。個別フィールド 60 本でも書けるが苦しい | △ repeater か「技能ブロック」（A4 の部分導入）が実用上ほぼ必須 |

## 長所

- **既存資産の再利用が最大**: エディタ / プレビュー / バリデーション（重複 ID・循環参照・式構文）/ ギャラリーの
  mock と仕様書（AI.types.md 等）をそのまま育てられる。フロントとサーバーで DSL が一本化される
- 入力型・レイアウト・式が揃い、「Excel 風」の体感を満たしつつ、**フィールドに id と型がある**ので
  検証・マッピング・Discord 注釈（B4）が成立する（A3 との決定的な違い）
- テンプレートが自己完結 JSON（import/export はフロント実装済み）＝配布（B3）と相性がよい

## 短所・リスク

- **character ドメイン再設計が本丸**になる（値の正本が 5 セクションから `sheet.values` へ移る）。
  移行は「legacy テンプレート切り出し＋materialized sections 併存」の 2 段構えが必要（B2）
- customId 契約・projection・repository spec の更新範囲が広い（B4 / S-1 の教訓）
- 現行 schemaVersion 2 に対して、lookup / ダイス値型 / repeater / role を足す **schemaVersion 3 相当の非互換拡張**を伴う
- 二重表現（sheet.values と materialized sections）の同期責務が発生する（同期方向のルール化が必須。B2 参照）

## 既存資産との関係

- **生かす**: フロント DSL・式エンジン・エディタ mock・ギャラリー mock。phase0 の mapping 雛形
  （fieldId → characterPath）は「移行期の互換層」の仕様として再利用できる
- **役割が変わる**: `attribute.types.ts` は「値の正本」から「Discord 向け materialized view の型」へ
- **凍結・置換**: phase0 §4.1.3 の「Character 同型テンプレート」案（A1 系）はこの案では採らない

## この案を選んだ場合に決めるべきこと

1. materialized sections を恒久維持するか、移行期のみとするか（恒久なら Discord 経路は永続的に無傷）
2. repeater を DSL に足すか、技能・リソースだけ A4 的ブロック（複合フィールド）にするか
3. fieldId の命名規約（英数＋アンダースコアは現行踏襲。**Discord customId の 100 文字制限**と衝突しない長さ上限）
4. schemaVersion 2 → 3 の互換ポリシー（mock 時代のテンプレートは自動変換しない、が現行方針）
