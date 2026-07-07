# TRPG-SERVER Character モデル設計メモ

最終更新: 2025-08-11

> **関連（2026-07-06 追記）**: ユーザー自作キャラクターシートテンプレート（作成・配布・CoC ダメージボーナス級の
> 導出ステータス対応）に向けた **character ドメイン再設計・character-sheet ドメイン新設の案出しドキュメント集**を
> `document/character-sheet-proposals/`（README が索引）に作成した。表現モデル 4 案（A1〜A4）＋横断設計 4 案
> （B1 式エンジン / B2 ドメイン境界 / B3 配布 / B4 Discord 連携）。実装計画ではなく案の比較段階。
> 本ファイルの AttributeValue / 5 セクション構造は案 A1（温存拡張）の土台、案 A2 以降では
> 「Discord 向け materialized view」へ役割が変わる可能性がある。
> **同日追記**: 14 系統の TRPG を棚卸しした横断調査（`trpg-system-survey.md`）で、5 セクション・AttributeValue とも
> **汎用正本としては不足**（複合行・関係・トラック・秘匿スコープ等 P5〜P14 が構造ごと表現不可）と確認。
> ただし「合算数値（values）＋Discord ±操作」の意味論と「Discord 向け投影」としての 5 セクションは存続価値あり。
> **同日追記2**: Codex との討論 2 ラウンドを経て**具体設計 v1 が確定**（`document/character-sheet-proposals/design-v1.md`）。
> character 再設計の骨子＝ `sheet.values`（fieldUid キー・入力の唯一の正本）＋ `computedCache`（派生キャッシュ）＋
> palette／互換投影（旧 5 セクション・read-only・materializer 専有、廃止は実装ゲートで判断）。
> インスタンス化・materialize は新設 `src/features/character-sheet/` の所有とし、domains/character は
> 保存と不変条件（characterId 不変・DTO/Zod・projection 整合）に縮退する方針。実装は未着手（Phase 1〜4 の分割あり）。

## 目的

- 複雑なキャラクター属性（例: CoC の HP = 30(-10)+10 など）を型安全かつ拡張可能に表現する。
- 表示値は index を除く数値を合算したものとする。
- Discord からの増減操作は other のみを変更対象とする（他の要素は不変）。

## 基本コンセプト

- 合算対象の数値は `values` に集約する。
- `index` は並び順用で合算対象から除外する。
- 表示名はキー名と同一なら `name` を省略可能（i18n を考慮して保持も可）。

## 型定義（サーバ内での意図）

```ts
// 合算対象の数値群（自由にキー追加可: base, fluctuation, buff, debuff, temp, other など）
export type AttributeNumberParts = Record<string, number>

export interface AttributeValue {
  name?: string // 表示名（キーと同じなら省略可）
  index?: number // 並び順（合算に含めない）
  values: AttributeNumberParts // 合算対象の数値群（index 以外の number はここへ）
  description?: string
  isVisible?: boolean
}

// 各セクション（status/skill/parameter/item/description）で共通
export type AttributeSection = Record<string, AttributeValue>
```

補足:

- 「index 以外の number はすべて合算」のルールを、`values` という1階層に閉じ込めて表現する。
- Discord からの上下操作は `values.other` のみを加減する。

## Character スキーマ（意図）

```ts
export class Character {
  characterId: string
  characterName: string
  gameSystemId: string
  discordUserId: string
  discordChannelId?: string

  status: AttributeSection
  skill: AttributeSection
  parameter: AttributeSection
  item: AttributeSection
  description: AttributeSection
}
```

現状コードでは `Object` ベースのスキーマ定義だが、アプリ側の扱いは上記の意図で統一する。

## DTO 方針

```ts
// Create/Update 双方で共通の最小バリデーション
class AttributeValueDto {
  name?: string
  index?: number // 並び順（合算対象外）
  values!: Record<string, number> // base, fluctuation, other など
  description?: string
  isVisible?: boolean
}

class CreateCharacterDto /* extends DiscordDto */ {
  characterId: string
  characterName: string
  gameSystemId: string

  status?: Record<string, AttributeValueDto>
  parameter?: Record<string, AttributeValueDto>
  skill?: Record<string, AttributeValueDto>
  item?: Record<string, AttributeValueDto>
  description?: Record<string, AttributeValueDto>
}
```

バリデーション強化案:

- `index`: 0 以上の整数
- `values`: number のみを許容、NaN を排除
- 必要に応じ、`values.base` の必須化などゲームシステム固有制約を追加

## 表示・更新ユーティリティ（基準実装案）

```ts
// 表示用合算値を算出（index は対象外。values の number をすべて合算）
export const getDisplayNumber = (attr: AttributeValue): number =>
  Object.values(attr.values ?? {}).reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0)

// Discord 増減操作: other のみを変更
export const applyDiscordDelta = (attr: AttributeValue, delta: number): AttributeValue => ({
  ...attr,
  values: { ...attr.values, other: (attr.values.other ?? 0) + delta }
})
```

API 返却時の推奨:

- 計算済みの `display` をサーバ側で付与して返すとクライアントが簡潔になる。

```jsonc
// 例: サーバ応答（一部）
{
  "status": {
    "HP": {
      "name": "HP",
      "index": 1,
      "values": { "base": 30, "fluctuation": -10, "other": 10 },
      "display": 30 // ← サーバ計算: 30 + (-10) + 10
    }
  }
}
```

## 例: CoC の HP

```jsonc
status: {
  HP: {
    name: "HP",
    index: 1,
    values: {
      base: 30,          // 初期値
      fluctuation: -10,  // 変動（ダメージ等）
      other: 10          // Discord 操作の調整先
      // 必要に応じて buff, debuff, temp 等も追加可能
    },
    description: "ヒットポイント"
  }
}
```

表示値のルール:

- 表示値 = `sum(values.*)` = 30 + (-10) + 10 = 30
- Discord の上下操作 = `values.other += delta`

## クライアント/Discord 実装指針

- Remix: ネスト深度は `section.key.values.part` 程度（3〜4 階層）で実務上問題なし。
- 表示は `display` を利用（未付与なら `getDisplayNumber` をクライアント側で再計算）。
- Discord の上下ボタン等は `other` のみを変更するイベントを発行。

## 将来拡張

- ゲームシステム固有の制約（例: SAN 上限、最大 HP）をスキーマではなくユースケース層で検証。
- `values` キー追加でバフ/デバフ/一時値等を柔軟に表現。
- `isVisible` で UI 出し分け、セクション単位の並び替えは `index` に準拠。

## セキュリティ/バリデーション注意点

- `values` は number のみを許可し、NaN/Infinity を拒否。
- 更新 API は `other` のみ更新するユースケースを用意して誤更新を防止。
- 受領データはサーバ側で再計算（サーバサイド権威）して返却。

## 実装計画（サマリ）

1. 型: `core/types/attribute.types.ts` に `AttributeValue` 系を追加
2. モデル: `character.model.ts` のセクション型を `Record<string, AttributeValue>` に統一
3. DTO: `CreateCharacterDto`/更新 DTO に `Record<string, AttributeValueDto>` を導入
4. ユーティリティ: `getDisplayNumber`/`applyDiscordDelta` を共通化
5. API: サーバ計算済み `display` を応答に含める（段階導入可）
