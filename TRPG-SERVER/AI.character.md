# TRPG-SERVER Character モデル設計メモ

最終更新: 2026-07-12

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
> **追記7（2026-07-12・Phase 2 実装完了＝PH-6b コミット 680db9a）**: hub UI スライスを完了。
> `packages/sheet-projection` 新設（DiscordProjectionViewModel 純関数＋golden fixtures）、hub 状態機械
> （none→publishing(opId)→active の CAS・自動再投稿なし）、耐久 worker（pendingRevision/appliedRevision・
> coalesce・edit 失敗3分類）、select/panel handler 3 本追加（feature module 計 5 handler・BOOT 実証済み）。
> 全ゲート緑（server 208 suites/2660・characterization・projection 12・engine 42・front 全部）。
> 開示制約: 作者ピン留めフラグ未定義→先頭 20 ロール縮退（README 未決 15）。
> **同日追記7b（9a3d2da）**: 補完スライス完了（materialized の旧投稿抑止＝ThreadOrchestrator/ThreadCreation 両経路、
> direct select 経路は ThreadCreationService→postHub 直接呼出で hub 到達性を保証）。Codex スコープレビュー反映済み
> （customId 契約を sheet-projection に一元化＋表現不能 delta の warnings 縮退／publish 非空 label 強制＋projection fallback／
> hub 遷移ガード assertCharacterHubTransition／worker の edit 失敗と CAS 永続化失敗の分離）。
> 既知の残置: 429 リトライ回数メモリ限定・listener の TypedEventService 直接登録（Phase 3 で ARCHITECTURE 方針へ追従）・
> jest.config の実 DB 3 spec 隔離が PH-6b コミットに同居（レビュー指摘・実質は正当）。
> 最終ゲート: 209 suites/2673 緑・projection 14・engine 44・BOOT 5 handler。残タスク＝PH-7 実機受入
> （`document/character-sheet-proposals/phase2-ph7-acceptance-checklist.md`。D-3・ユーザー実施）のみ。
> **追記6（2026-07-08・Phase 1 wave 2 完了）**: Slice C（`features/character-sheet` 新設＝features 層の最初の住人:
> SheetMaterializerService／CharacterInstantiationService、ValidationPort を sheet-engine 実装へ差し替え）・
> Slice E（`seeds/legacy-coc.template.ts`＋境界値 spec）・Slice D（Web エディタ実 API 化: `/templates` ルート・
> v3 モデル・draft autosave 409・publish・engine evaluator プレビュー・v2→v3 片方向移行）を Codex 実装＋レビューで完了。
> レビュー必須修正 4 件反映済み（**rollOnCreate が「3d6\*5」の ×5 を落とし能力値 1/5 で保存される実バグ**→
> dice-execution に評価済み値メソッドを追加〔既存メソッド不変〕／values から computed 除去／投影 5 セクション化で
> 値消失ゼロ／v2 移行式の canonical 化）。palette hard cap 512 実装。front 初のユニット spec 導入
> （tsconfig に jest 型追加・カバレッジ閾値 80% 充足）。全ゲート緑: server 2451／engine 27／front typecheck・build・
> jest 22／circular 0／start:dev DI OK（CharacterSheetModule 込み）。未コミット。**Phase 1 はこれで実装完了**
> （残: docker compose build のユーザー実証のみ）。
> **追記5（2026-07-08・C-0 workspace 化）**: リポジトリを pnpm workspace 化（root 単一 lockfile・
> `@trpg/sheet-engine` を両アプリに workspace:* 接続・Docker build context ルート化・pnpm 10.12.1 固定
> ※当時の固定。T19（2026-07-28）で 11.5.1 に更新済み。現在値は root `package.json` が正本）。
> ネストしていたサプライチェーン設定は root `pnpm-workspace.yaml` へ統合（調整の経緯は同ファイルのコメントが正本）。
> **副産物として front の重大な潜在バグ4層を修復**: 上限なし override が宣言レンジを破壊し、fresh install では
> vite:dev すら起動しない状態だった（remark-mdx の ESM 注入・Remix 非対応の vite 8・@babel/runtime 8 跳ね・
> esbuild 0.28 衝突）→ vite ^5.4.20 / typescript 5.4.3 / @remix-run/dev 2.16.8 固定と override の bound 化で解消。
> **front の `pnpm run build` が初めて緑化**。全ゲート緑（engine 27・server 2438・circular 0・front build/dev）。
> docker compose build のみ実機未実証（Docker engine 起動不可。Codex 静的レビュー済み・重大なし）。未コミット。
> **追記4（2026-07-08・Phase 1 wave 1 実装）**: design-v1 v1.2 の Phase 1 を着工し、
> **`packages/sheet-engine`**（standalone 純TS: schema v3 型・Zod publish 検証・式エンジン・notation 補間。5 suites/27 tests）と
> **`src/domains/character-sheet-template/`**（E-6d 様式 entity・CRUD/draft autosave 409/publish 不変・ValidationPort 暫定実装。4 suites/37 tests）を
> Codex 実装＋Codex スコープレビュー（指摘4件修正済み: publish の draftRevision 原子性・validator 拒否穴・
> resultType 照合・notation fragment の publish 時静的検証）で追加。ゲート: build／check:circular 0／全 suite 184 suites・2438 tests 緑／start:dev DI 起動 OK。
> **未コミット**（作業ツリー）。engine⇔server の依存配線は未実施（Slice C・配線方式はユーザー判断待ち）。
> **同日追記3（2026-07-07）**: フィールド型充足性の再精査（52 エージェント×約 40 システム＋Codex レッドチーム、
> `document/character-sheet-proposals/field-sufficiency-audit.md`）を実施し、design-v1 は **v1.2** に改版
> （TrackField min/resetTo・notation 差し込み文法 §2.1・仕様明文化 §2.2・when/declare 予約）。
> E-6 系列（threadId 撤去・CharacterEntity 公開型・BCDice 実行コア引き上げ）は**実施済み**の前提として設計へ反映済み。

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
  values?: AttributeNumberParts // 合算対象の数値群（index 以外の number はここへ）
  description?: string
  dice?: string // ゲームシステム固有のダイス記法
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
  values?: Record<string, number> // base, fluctuation, other など
  description?: string
  dice?: string
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

### AttributeValue正準形の契約（2026-07-12）

- **事前条件**: セクションと属性はプレーンオブジェクト。属性の許可キーは `name / index / values / description / dice / isVisible` のみ。`values` は有限数だけを値に持つ辞書で、`dice` は文字列。プリミティブ、配列、`null`、未知キーは拒否する。
- **成功時事後条件**: create/updateは辞書キー、`values` の全part、`dice` を保持する。ゲーム別能力値検証はプリミティブ値ではなく `getDisplayNumber(AttributeValue)` の合算値を使う。
- **失敗時事後条件**: 不正入力を `{ values: {} }` へ暗黙変換せず、永続化前に失敗させる。
- **不変条件**: 実行時判定は `core/types/attribute.types.ts` の `isAttributeNumberParts / isAttributeValue / isAttributeSection` が正本。HTTP DTO、event contract、作成コア、CharacterService、CharacterEntityは同じ形を使う。
- `dice` の構文はBCDiceのゲームシステムごとに異なるため、AttributeValue境界では文字列性だけを保証する。構文の可否は実際にロールを実行する境界で判定する。
- 過去に自システムが保存した `null` 付き属性、有限数/文字列プリミティブ、`name/value` 形は、外部入力を緩めずrepository読出専用adapterで正準化する。既知でない破損形は情報を捨てず例外にする。正規化は非破壊で、DBへの一括書戻しは行わない。
- legacy CharacterServiceのセクション単位更新は部分キーのdeep mergeではなく、検証済み `AttributeSection` 全体の原子的置換とする。Mongoose `Mixed` にはaggregation pipelineの `$literal` を使い、optional keyは定義済みのものだけを永続化境界へ渡す。
- 2026-07-12の隔離MongoDB検証で、新規 `values/dice` 往復とlegacy fixtureのread→正規化→同一セクションupdate→正準形保存を確認済み（2 suites / 19 tests）。

将来候補として、`index` を0以上の整数へ狭めること、ゲームシステム固有に`values.base`等を必須化することは別契約として検討する。

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

## 非有限値（Infinity / NaN）の診断と応答サイズ（S9 / S10・2026-07-28）

### ユーザーに届く診断

シートの保存・リソース更新で値が有限数にならない場合、**原因つきの日本語 422** を返す。
対象は computed（数式の結果）／roll／track の max 評価／track の入力値の4種で、
文面は `buildBoundedNonFiniteErrorEnvelope`（`features/character-sheet/services/track-range.policy.ts`）が
**唯一の生成元**。実装箇所ごとに文面がばらけるのを防ぐため、新しい非有限エラーを追加するときも
必ずこの builder を通すこと。

```
計算式の結果が有限な数値になりませんでした
（フィールド: uid-x / ラベル: X / 式: {a} / {b} / 結果: Infinity）。
ゼロ除算などが起きていないか式を確認してください
```

### 応答サイズの上限

builder（`buildSheetErrorEnvelope`）は **実際に送信する封筒そのもの**
（`{success:false, message:<ラベル>, timestamp, requestId, error:<診断>, issues}`）を組み立てて
UTF-8 の JSON 長で会計し、**4,096 bytes** に収める。U5-5b 以降、
`CharacterSheetHttpExceptionFilter`（controller-scoped・`@Catch(HttpException)` 限定）が
**同じ builder** で実封筒を作るため、モデルと実 HTTP body は byte 単位で一致する
（固定診断で 678 bytes を spec が固定。filter が builder を迂回すると一致 spec が落ちる）。
超える場合の縮退は次の順:

1. message 内の各要素（label / 式 / detail / 入力箇所）を段階的に切り詰める
2. それでも超えるなら **issue を丸ごと落とす**（保持する issue の `fieldUid` / `path` は切り詰めない。
   機械可読な参照を壊さないため）
3. 非有限診断の issue は**常に配列の先頭**に置き、既存 issue より先に保持する
4. 終端は入力に依存しない**定数封筒**（U5-5b 後の実 wire で 238 bytes）。
   エラー整形の内部で throw しない（throw すると 422 が 500 になり診断ごと失われる）

エラー面の封筒化（U5-5b）: sheet 2ルートの HttpException は上記 filter が
`error`=実原因・構造情報は **deny-list 方式**で `cause` へ転記
（`message` / `statusCode` / `error` / `issues` 以外の own fields をすべて同名保存 —
conflicts / refetchRequired / fieldUid / value / min / max / detail / 未来のキーも lossless）。
**body 内 `statusCode` と標準 reason phrase は意図的に載せない**（HTTP status line と冗長。
front は `error.response.status` を読む）。非 HttpException は素通しし、
APP_FILTER の `GlobalExceptionFilter`（1206a3e）が 500 封筒化する。

**この上限が塞いでいるのは非有限経路だけ**。同じ 100,000 文字 uid でも
`throwOutOfBounds` は約 200KB、`calculateBounds` の `resolved max below min` は約 100KB を返す。
根本は `validatePublishTemplate`（`packages/sheet-engine/src/publish.ts`）が
uid / label の長さを一切制限していないことで、発生源で止める対応は別タスク。

### 保存可否の不変条件

S9 / S10 は**診断の内容と到達性だけを変え、保存可否は HEAD から変えていない**。
HEAD 実装を oracle にした 18値 × 18値の総当たり比較で、
到達可能な経路の accept/reject はすべて一致することを確認済み。

唯一の差は「保存済みの `Infinity` / `NaN` を有限値へ直す更新」で、サービス直接呼び出しでは
HEAD=422 / 現行=ALLOW。ただし **HTTP からは到達しない**。JSON が Infinity / NaN を表現できず
`baseValue` が `null` になるため、`saveSheet` の merge 段（`character-sheet-operation.service.ts:208`）で
`sheetValuesEqual(Infinity, null) === false` となり **409 conflict が先に立つ**（HEAD も同じ）。
したがってユーザーから見える保存可否の変化はゼロ。

なお `{parts: {a: 1e308, b: 1e308}}` のように**各要素は有限だが合計が Infinity** になるケースは
JSON で表現できるため HTTP から到達可能で、こちらは HEAD も元から修復を許可していた。

### 検証の配置

- 通常 Jest（Docker 不要）: `non-finite-field-diagnostics.spec.ts` /
  `non-finite-formula-save.reproduction.spec.ts` / `track-range.policy.spec.ts`
- 予算の検証は **実 `CharacterSheetOperationService` / 実 `SheetMaterializerService` を通す
  supertest** で行う。formatter の出力をテスト側で例外に詰める形は**禁止**
  （その形にしていた期間、unit 全緑のまま実 HTTP に 100KB / 300KB の穴が残っていた）

### 実データの非有限値（2026-07-28 実測・Task#30）

Atlas 実データベース（default db = test）の全8コレクション・729 docs を読み取り専用スキャンした結果、
保存済みの非有限数（Infinity / -Infinity / NaN）は **0 件**。
このため「非有限な保存値を HTTP から修復する」機構（JSON-safe sentinel 等）は**実装しない**。
書き込み経路は sheet-engine が persist 前に throw する多層防御で閉じており（S10 反証で
repository 未到達を確認）、将来1行でも現れた場合は一度きりの DB 操作で対応する。
なお楽観ロック境界（`character-sheet-operation.service.ts` の merge 段）は JSON が非有限値を
表現できないため `baseValue` が null になり 409 を返す — これは HEAD からの既存挙動で、
対象データが存在しない以上、実害はない。
