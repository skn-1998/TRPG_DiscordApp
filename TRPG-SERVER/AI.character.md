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

**この上限が塞いでいるのは非有限経路だけ**。かつての反例だった範囲系 422
（`throwOutOfBounds` 約 200KB・`calculateBounds` の `resolved max below min` 約 100KB）は
TR-4a／TR-D1(a) の撤去で両方失効し、現行コードに範囲系 422 の発生源はない（履歴として保持）。
発生源の uid / label 無制限は **#28（コミット 32ee086・2026-07-30）で封鎖済み**
（publish schema の uid/label 全キーに ≤128。新規テンプレートは巨大 uid/label を持てない）。
**未封鎖の同クラス経路**: formula / notation は無制限・`tables[].rows` は `z.any()`・
lookup 検証は上限超過後も全行走査（理論 50MB 級）— Task#33 で対応予定。

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

## 必須キー導出とシート内部の重複整理（U1・2026-07-29・コミット 0805609）

- **必須キー導出の正本は `test/utils/character-http-contract.ts` の
  `requiredCharacterRuntimeKeys`（export・readonly）**。`characterEntitySchema.shape` から
  `safeParse(undefined)` で導出する実装はリポジトリでここ1箇所のみ。spec で必須キー検査を
  書くときは必ずこれを import する（独自に `.shape` から導出しない — S7e round 2 で
  複製が生まれ、sentinel なし側が fail-open だった実例がある）
- **fail-open sentinel は `expectRequiredCharacterRuntimeKeyCount()`**（長さ6の検査。
  根拠コメントも同関数に併記）。導出が空配列になる事故（zod メジャー更新・全 field
  optional 化）では HTTP ヘルパと repository projection 検査の両方がこれで落ちる
- `character-sheet-operation.service.ts` の `writePathValue` は parts 許可検査を持たない。
  検査は呼び出し前の `assertWritablePath` が唯一の担当（到達不能だった末尾ガードは
  U1 で削除。破壊的代入の後に置かれた潜在バグでもあった）。
  残余観察: `assertWritablePath` の戻り値 `SheetField` は現在消費者ゼロ（void 化は未実施・
  レビュー L-1 記録のみ）
- **`isPartsValue` は2系統あり意図的に別物**: engine 版
  （`packages/sheet-engine/src/parts-value.ts`・緩い `'parts' in value` 検査・index.ts 非公開）と
  server 版（`features/character-sheet/services/sheet-values.util.ts`・parts の型まで検査する
  厳格版）。統合すると挙動変更になるため統合しない（U1 裁定）

## palette ラベル書式の1本化（U3・2026-07-30・コミット d584020）

- **palette ラベル書式の正本は `packages/sheet-projection/src/palette-label.ts`**
  （純粋関数2個・import ゼロの葉モジュール・public API は関数2個のみ）。
  組み立て = `formatPaletteLabel(baseLabel, formattedValue)`、
  剥離 = `stripMatchingPaletteValueSuffix(label, formattedValue)`（厳密一致のみ・`—` は剥がさない）。
  palette ラベルに値 suffix を付ける・剥がすコードを書くときは必ずこれを使う
  （旧: materializer / operation / projection.ts の3箇所複製で、剥離 suffix と組立 suffix の
  一致が規約のみだった。SP-2 三重乖離バグ bd22017 と同族の構造）
- **値の選択責務は呼び出し元に残す**: materializer = 評価直後の生値（`type==='number'` のみ付与）、
  operation = クランプ後実効値、projection = parts 合算後文字列。palette-label.ts は
  文字列の組み立て・剥離だけを行い、評価・クランプへは関与しない
- **`—`（値なし記号）は共有定数化しない**（レビュー裁定・2026-07-30）:
  projection.ts の `formatResourceValue` は最高頻度 read path で、単一ソース化は
  読解ホップ +4 の確定コストに対し便益の実測頻度0（記号変更は創設以来0回）。
  結合は palette-label.ts 冒頭のコメント1行で明示している。記号を変えるときは両ファイル同時に
- characterThread（legacy 属性ベース）の `skillName (skillLevel)` 書式は**意図的に対象外**:
  データ経路も剥離側の相手も持たない別機能で、共有抽象で結合すると負荷増（U3 レビュー判定）

### U3 追記（#38・2026-07-31）

- projection.ts 内の `—` 4リテラルは **module-local const** へ集約済み（#38）。
  「パッケージ跨ぎ・export での共有定数化はしない」という U3 裁定は**維持**
  （palette-label.ts の private PALETTE_VALUE_PLACEHOLDER と projection.ts の
  RESOURCE_VALUE_PLACEHOLDER は別所有のまま・共に U+2014・結合コメントで連結）
- 区別基準の明文化: **契約に効く重複**（customId の生成側⇄parse 側の regex source 等）は
  1本化する。**表示のみの重複**（`—` 等）はファイル内集約まで — export 共有はしない

## publish 検証の見直し（#28+#23・2026-07-30・コミット 32ee086）

- **uid/label の長さ上限は publish schema が正本**（`packages/sheet-engine/src/publish.ts` の
  `MAX_UID_LENGTH = 128` / `MAX_LABEL_LENGTH = 128`・uid/label 名の全キーへ一律適用）。
  裸の `z.string()` に戻さないこと。根拠と選定理由は定数直上の Why コメントが正本
  （数値をここへ再掲しない — 過去に uid 16/45・path 98/131 の写しズレを2回起こした）。
  uid 64 案は canonical path 写しを弾くためレビューで 128 へ裁定変更した経緯あり
- **上限違反の issue は O(1) サイズ**（自前固定メッセージ・値非反響・zod 既定文言に依存しない）。
  publish.spec.ts の増幅 spec（sentinel 非含有・UTF-8 byte・per-issue 上限）が機械固定
- **投影規則の正本は `projection-key-validation.ts`**（OV-2/#35・2026-07-31 で1本化）:
  materializer は同ファイルから `isProjectedFieldType` / `projectionTarget` を import する
  （features→domains・ARCHITECTURE.md §4 の許可辺）。写し・両方更新の運用は廃止済み —
  投影型や投影先を変えるときはこのファイルだけを編集する。
  roll は publish 時点で rawValues 不可知のため一律拒絶（保守側）が裁定
- 旧「長大 uid/label は publish 可能」前提の再現 spec
  （non-finite-formula-save.reproduction.spec.ts）は前提を反転済み。実行時 422 の
  応答予算検証（4,096 bytes）は「過去に永続化された長大値」想定の防御層として存続
- 本番 DB 実測（2026-07-30・review-results/task28-23-data-survey/）: テンプレート0件・
  materialized キャラ0件 = **Phase 2 シート機能は本番未採用**。#28/#23 は採用前に締めた
  仕様変更で移行・互換分岐なし。U4 ベンチは実データ分布が存在しないため採用判断まで保留

## publish 検証の1本化（OV-1・2026-07-31・コミット e1a1ca5）

- **publish 検証の実装は1系統のみ**: `TEMPLATE_VALIDATION_PORT → SheetEngineTemplateValidationService
→（実体）packages/sheet-engine/src/publish.ts の validatePublishTemplate`。
  死蔵の第2実装 BasicTemplateValidationService（runtime 呼び出し0・#28 の上限が伝播せず
  実挙動6件乖離）は削除済み（純減357行）。**publish 規則を追加・変更するときは
  publish.ts と権威側 spec だけを見ればよい**
- 旧第2実装にのみ存在した8規則の採否は #36 完了時（2026-07-31）に裁定済み:
  **uid 空文字拒絶は採用済み**（uidSchema .min(1)・#36）。4上限（section/table/field 数・
  serialized size）は増幅封鎖と同根のため **#33 で値を導出して採用**。
  role.when / rowRole.when の黙殺は field.when 拒絶との非対称を揃えるため **#39 で採用**。
  **field 直下 secret のみ不採用**（passthrough 設計での未知キー黙殺の一事例。エンジンモデルに
  field.secret は存在せず、エディタも生成しない — 単独拒絶は場当たりのため意図的放置）

## publish 参照キー一意性（OV-3/#36・2026-07-31・コミット 85b2723）

- **canonical field path と table id は publish で一意性保証**（list itemFields 再帰含む）。
  重複はキー長にかかわらず**常に**報告し、issue の表示値のみ truncateIssueInput
  （MAX_CANONICAL_FIELD_PATH_LENGTH＝#39 以降 131・超過時 `…`）で切り詰める —
  「報告するか」と「どう表示するか」を分離するのが設計意図。
  報告条件に長さを混ぜる形へ戻さないこと（黙殺の fail-open 化と認知負荷過大の両方で
  レビュー棄却済み・切り詰め挙動は publish.spec.ts の 150 文字 pin spec が機械固定）
- uid は .min(1) で空文字拒絶（空白のみ uid の許容は不透明キーとして意図・spec で明示 pin）
- **一意性検査は3層の意図的多層防御**: フロント v3Template.ts（editor 内 uid/id）・
  engine publish.ts（canonical path/table id/uid）・サーバ projection-key-validation.ts
  （投影先ごとの field id 衝突 = 別セクション→同一 target を担保。engine は検出しない）。
  **層跨ぎの検査を「重複だから」と削除しないこと**（round 1 裁定・不変）
- 例外の記録（OV8-a/#40・2026-07-31）: projection-key-validation の **canonical path 検査
  のみ**削除した。これは層跨ぎ統合ではなく**同一関数内の死蔵**: canonical path
  `${section.id}.${field.id}` の一致は「同一 section.id ⇒ 同一 target」かつ「同一 field.id」を
  含意するため、**同じ関数に残した field id 検査が単独で厳密支配する**
  （Opus 7,063ケース: 発火514件は全件 field id 検査でも捕捉・server 単独発火0。
  Codex 16,384組で同結論）。projection 層固有の担保（別セクション→同一 target）は無傷。
  復活させないこと — 復活は field id 検査と全入力で重複する
- 残存する既知の検証素通り: validateId の path echo 増幅（#33）のみ。
  relation attrs・role/rowRole.when は #39（f60b0db）で解消済み — 後段の
  「publish 検証の素通り解消」節が正本

## 式検証の issue 単独発行（OV-4/#37・2026-07-31・コミット 451e036）

- **未知 function・max/min arity の診断は validateFunctionCalls が唯一の発行元**。
  inferCallType は Error ベース sentinel（FUNCTION_CALL_ISSUE_ALREADY_REPORTED）を投げ、
  validateFormula の catch は「sentinel 同一性 **かつ** 前段発行済み（issues.length 差分）」の
  ときだけ握る — **fail closed**（前段未発行なら sentinel の message が診断に残り黙って通らない）。
  ガードを**フラグ単独条件にしないこと**（無関係な型エラーまで握り潰すことを変異体実測で確認済み）
- 設計判断の記録: 「inferCallType へ統合」方向は first-error で複合式の2件目が欠落するため
  不成立（変異体実測）。発行元は validateFunctionCalls 側に置くのが正
- RESERVED_IDS は KNOWN_FUNCTIONS から導出（9リテラルを再掲しない）
- 観測可能な変化: `max/min expects 2 arguments` 文字列は消滅し `… is a binary function` へ
  一本化（依存ゼロ確認済み）
- 残存する同形の二重発行: 参照エラー（collectRefs → infer throw → catch 再発行・
  `{main.nope}` で2件実測）は first-error 契約の裁定が先 → #44

## 俯瞰#8 純減（OV8-a/#40・2026-07-31・コミット 2dc8b23）

- **lookup 結果型の優先規則（table.resultType → row.resultType → 値推論）の実装は1系統**
  （inferLookupTableType = lookupRowResult＋inferRuntimeInputType の合成）。
  nested array 等の型外入力を text へ落とす guard は旧挙動の保存で、理由は
  isNotationFragment の非 string String 強制（コード内 Why コメント＋pin spec あり）。
  guard の否定条件は inferRuntimeInputType が扱う値種別の補集合を維持すること
- **parts を持てる field の判定は @trpg/sheet-engine の allowsParts が正本**
  （value-input.ts。OV9-a/#45 で engine へ移設 — server の sheet-values.util は
  既存 import 経路維持のための re-export shim。engine/server どちらにも複製を作らない）
- **投影先語彙は projection-key-validation.ts の PROJECTION_TARGETS（as const）が単一編集点**
  （union・Set とも導出。片方だけの編集は型エラーになる）
- uid/canonical path/table id の一意性はすべて validateUniqueReferenceKey 様式
  （uid のみ issue path を非切り詰めで維持 — 理由はコード内コメント・pin spec あり）

## 型契約の1本化（OV8-b/#41・2026-08-01・コミット ce158c3）

- **CharacterSheetState / palette 型の正本は domains/character/models/character.entity.ts**。
  feature 側 types/character-sheet.types.ts は import type＋type-only re-export のみ
  （PaletteEntry = CharacterPaletteEntry の alias。feature 内の読者は従来名のまま）
- 削除時に型同一性を機械証明済み（AST メンバー単位比較・strict 双方向 extends・
  負の対照14/15発火・transpile byte-identical）。alias 化で契約の拡大/縮小はゼロ
- **注意（俯瞰#10 議題）**: 「編集箇所 2→1」は server 内スコープ。repo 全体では
  packages/sheet-projection の ProjectionPaletteEntry（domain 型と完全同一を機械確認）と
  packages/api-contract の characterPaletteEntrySchema（zod）が残り、
  palette 契約へのフィールド追加は依然 3 箇所同期（4→3）。
  境界逆流のため import 統合は不可 — 片方向型互換アサーションによる drift 検出が候補

## publish 検証の素通り解消（#39・2026-08-01・コミット f60b0db）

- **relation attrs は validateField 再帰で全検査を受ける**（canonical path 登録・グローバル uid
  一意性・ID_PATTERN/予約語・when 拒絶・role 検証）。attr 用の別検査関数を作らないこと —
  検証所有者は validateField 1本を維持する
- attr の canonical path は buildTemplateIndex に索引されず runtime 参照不能だが、
  一意性集合には superset として参加する（publish.ts にコメントあり・誤衝突は構造的に不能）
- **role.when / rowRole.when は拒絶**（`role.when is 未対応`）。field.when の
  `when is 未対応` とは message で区別（path は同一になりうる — secret role と同じ既存パターン）。
  真理値: undefined のみ許容・null/''/falsy は拒絶 = field.when と同一セマンティクス
- **MAX_CANONICAL_FIELD_PATH_LENGTH = 32\*4+3 = 131**（4セグメント:
  section.list.relation.attr）。path の形状前提を変える変更ではこの定数の再導出を必ず検討する。
  schema 上限 128 の uid は切り詰め非発動（切り詰めガードの pin は 150文字 table id spec が担保）
- 新規拒絶は validateForSave（同関数共有）でも発火する — save/publish の分岐是非は #42 の裁定事項
- packages/sheet-engine に lint gate は存在しない（eslint config なし）。「lint 4/99」基準は
  TRPG-SERVER スコープの数値

## OV9-a 機械的純減の設計記録（#45・2026-08-01・コミット 1cf6adb・俯瞰#10 で節を補完）

- **customId null 処理は acceptGeneratedCustomId（sheet-projection custom-id.ts）1本**。
  fail-closed の silent drop 残置は3箇所（projection.ts の continue / early-return / && 合流）で、
  いずれも生成側の前提から到達不能 — 各箇所直上の根拠コメントが正本（無い箇所は OV10-a で補完）
- **assertArity は engine arity.ts（index 非公開の葉）1本**。root barrel へ公開しないこと
- server custom-id barrel の死蔵5 re-export・regex alias 2名は削除済み（consumer-zero 実測）。
  復活させる場合は消費者の実在を先に示すこと
- 兄弟述語の意図的二重: **isPartsValue は engine（緩・schema 分岐用）と server
  （厳格・SheetPartsValue 判定）で異責務の2実装**。真理値が割れる入力（{parts:5} 等）が
  存在するのは仕様 — 1本化しない（俯瞰#10 F3 裁定・server 側に差分コメントあり）

## 俯瞰#10 の裁定記録（2026-08-01・正本 = review-results/overview-batch5/integration-verdict.md）

- palette 契約の drift 検出: domain⟷zod は character-wire.contract.spec.ts の IsExact が
  双方向被覆済み（プローブ実測）。domain⟷projection は hub-projection.service.spec.ts の
  片方向代入 assert で「domain が増えた」方向を固定（OV10-a）。optional key の drift は
  素の代入では検出不能 — 必要になったら IsExact へ昇格
- DEFAULT_AST_NODE_LIMIT 256 の2宣言（publish/evaluator）は現状維持＋相互参照コメント
  （1行定数の共有に import 辺を増やさない・U3 と同型の裁定）。値を変えるときは必ず両方
  **→ 2026-08-11 大粒度 #5（review-results/impl-u15/）で上書き**: 2 宣言の値乖離が publish
  通過⇔runtime 対応を静かに壊す実測（上方迂回穴）を受け、evaluator 単一宣言＋publish import へ
  一本化した。本行の旧裁定は失効（Opus 再レビューが decision-record-drift として検出・突合済み）
- palette 上限 512 は api-contract 内で1本化・server materializer とは同値要求コメントで連結
  （パッケージ跨ぎの定数統合はしない）。TABLE_ROW_LIMIT=512・SOFT_CAP=128 との一致は
  偶然 — 統合禁止
- front の ID 規則複製（ID_PATTERN/RESERVED_IDS 15 語×2 セット）は **2026-08-15 big24-f3 で解消**:
  engine が `SHEET_ID_PATTERN` を export し、front は `SHEET_RESERVED_ID_VALUES` と併せて
  直接参照（等価テスト削除・規則定義 4→2。旧記録の「14語」は実カウント 15 語の誤記）。
  front validateLocalTemplate が attrs/itemFields へ再帰しない非対称は別議題として記録

## palette 契約の drift 検出（OV10-a/#47・2026-08-02・コミット 561786f）

- **CharacterPaletteEntry ⇄ ProjectionPaletteEntry の完全一致は
  character-wire.contract.spec.ts が機械固定する**（このファイルは「型で固定する橋」が役割で、
  @trpg/api-contract の同一性も同じ様式で固定している。新しい判定器を作らず既存
  IsExact / OptionalKeys / MismatchedValueKeys / AssertBothNever を合成すること）
- **判定器の検出力は実装形で決まる**: repo の IsExact は双方向 `extends` 版で、
  required 追加・削除・rename・型緩和・union 拡大・required↔optional 反転は検出するが
  **pure な optional 追加だけは素通りする**（`{a}` と `{a, b?}` は相互代入可能）。
  それを補うのが OptionalKeys 集合の双方向 Exclude 比較。
  「IsExact だから完全一致」と読まないこと — 名前でなく定義本体を読む
- palette 上限は api-contract の PALETTE_MAX_ENTRIES（未 export・ファイル内3箇所で参照）と
  server の PALETTE_HARD_CAP の2箇所。**値の drift は機械固定されておらずコメント頼み**
  （型 drift は固定済みという非対称。固定するには api-contract のエクスポート面拡大が要る）

## track 昇格レーン完了（2026-08-14・TR-1〜TR-6）

正本 = document/character-sheet-proposals/track-roll-on-create-promotion-draft.md
（裁定一覧・実装コミット 10 本・残スライス）。証跡 = review-results/impl-u14/。

- **rollOnCreate は正式契約**: `TrackField.rollOnCreate?: { notation }`（契約形 A）。
  publish が standalone roll 文法で検証・itemFields 内は拒否。作成時は出目が canonical
  現在値（提出値との衝突は 422）。出目結果（rollOnCreateResults）は CL-6 消化（TD5）で
  作成応答の正式契約になった: controller が `{ characterId, rollOnCreateResults }` を返し、
  wire は `RollOnCreateResultWire[]`（required・label は server 付与）。front は作成 Modal で
  `{label}: {details}` を提示（空なら従来どおり一覧へ redirect）。応答限りの提示で
  永続再照会 API は無い
- **track の min/max は全経路 advisory**: 提出・保存・± とも範囲超過を raw のまま採用。
  clamp は engine/server から全撤去（raw が canonical・表示 cap は front の視覚のみ =
  gauge の塗りと checkboxes のチェック数）。
  拒否するのは有限性・データ健全性のみで、検査は `TrackRangePolicy.assertFiniteTrackValues`
  1 本（全 track の raw 有限性 → 変更 track の max 式/修復可能性・診断は非有限封筒に統一）
- **TR-D1 (a) 完了（2026-08-14）**: palette の宣言 delta 0 は publish で拒否し、保存済み旧 palette に 0 が残る場合も未処理 interaction は操作層で 422 にする（適用済み interaction の replay は noOp 冪等が優先）。
  全経路 advisory 化で不要になった bounds/atBound と Discord の境界通知を削除し、min>max の ± も raw のまま適用する。
- front: 表示 = TemplateFormRenderer の track 専用描画（15 / 10 超過明示・
  max error 警告 = SM-9(b) 同型・未入力は evaluated 基底の 0 表示〔undefined のみ。null は
  「—」退化に留置 = TD2〕・checkboxes は max ok・整数・1〜30 のとき読み取り専用マーク列
  〔チェック数は視覚 cap = TD3〕）。エディタ = track 作成/編集可（既定値は publish 通過形 —
  autosave が publish 検証を丸ごと通すため）。track の resource role も編集可（TD6）:
  deltas 配列入力・全行削除で role ごと undefined・既存 non-resource role は警告＋明示置換
  ボタンで保護。エディタ製 track はこれで palette resource（± 到達）になれる。
  group/secret/when の入力は無し（group は palette 生成が section.label で決定・
  secret/when は publish 未対応拒否）
- **dice preview の total は評価済み最終値（2026-08-14 大粒度 #23）**: DicePreviewService は
  executeEvaluatedDiceRoll を呼び、preview 入力欄へ書かれる値と作成時保存値が一致する
  （'3d6*5' → 55。旧 executeDiceRoll の rands 合算 11 は preview から撤去。
  DiceExecutionService 本体と Discord 経路は不変）。試しロール・作成 Modal の
  details のみ表示は維持（details 末尾に評価値を含むため total を重複表示しない —
  両 UI 同一根拠へ収束）。RollOnCreateResult ↔ wire は contract spec の IsExact＋
  キー集合双方向差分で束縛（pure optional 追加も検出）

## テンプレート配布特例（DL・2026-08-15）

- 認可モデル: visibility は publish 前提条件のままで、**配布は owner `'system'` の特例**
  （`SYSTEM_TEMPLATE_AUTHOR` = character-sheet-template.constants.ts）。
- 読み取り特例は 3 点のみ: 一覧 `findListedSummariesForRequester`（$or = 自分の全件＋
  system published）・`resolveForCreate`・`resolvePinnedRevision`（`assertRevisionReadableBy`
  = owner or system）。**findOne（エディタ読み取り）と全 mutation は `assertOwner` を維持** —
  system 所有への update/remove は分岐別（metadata patch / draft remove / deprecated remove）
  に 403 pin があり、緩和は spec が赤になる（service.spec）。
- front（TemplateListV3）: system カードは「配布」Badge＋編集/削除非表示・作成導線は維持。
- 配布実体 = legacy-coc seed（owner system / private / published・pinned）。投入は
  `pnpm seed:legacy-coc-template --execute`（冪等・dry-run 既定）。利用者向け手順と
  画面用語集は document/character-sheet-user-guide.md が正本。

## 作成時ロールの振り直し（RL-6・サーバ側のみ・2026-08-17）

正本 = review-results/roll-lane/prompt-rl6-code.txt。画面は未実装（RL-7）。

- 経路: `POST /character/:id/sheet/reroll`（body = `{ fieldUid, baseRevision }`）→
  `CharacterSheetOperationService.rerollCreationRoll`。値のフィールドは DTO にも service 入力にも
  持たせていない。出目は `DiceExecutionService.executeEvaluatedDiceRoll`（作成時ロールと同じメソッド・
  pin 済みテンプレートの gameSystemId）の結果だけを `values[fieldUid]` へ上書きし、revision は +1。
- **対象条件は「作成時ロールの記法を宣言しているか」**（`services/roll-on-create-notation.util.ts` の
  `rollOnCreateNotation` = track の `rollOnCreate.notation` と roll の `notation`）。
  `assertWritablePath`（track/scalar だけを入力項目とする規則）とは別の述語で、流用も緩和もしない。
  作成側（CharacterInstantiationService）も同じ関数を使うため、対象集合は 1 箇所で決まる。
- roll 型は依然としてクライアント提出の入力項目ではない（`packages/sheet-engine/src/value-input.ts`
  の `inputSchemaFor` は track/scalar 以外に undefined を返す。saveSheet も 422）。
  roll 型の値が書けるのはこの振り直し経路のみ。
- 拒否: 記法未宣言 / 未定義 fieldUid / 実行失敗 = 422、他人のシート = 404（所有者判定は use case 側の
  `assertSheetOwner` だが、不在と他人を 404 に畳む点は saveSheet 経路の findOneForOwner と同じ）、
  baseRevision 不一致と保存 CAS 敗北 = 409（`refetchRequired: true`・出目を再現できないので再試行しない）。
- テスト = `services/character-sheet-reroll.spec.ts`（11 tests）。値混入時もサーバ出目が保存されること・
  saveSheet 側の roll 拒否・失敗時に値と revision が動かないことを含む。前 2 者は変異注入で
  検出できることを確認済み。
