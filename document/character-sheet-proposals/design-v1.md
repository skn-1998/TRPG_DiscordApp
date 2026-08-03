# 具体設計 v1 — シートテンプレート基盤（A2＋A4 融合）

> **分類**: 具体設計（A/B 案・横断調査の統合）
> **ステータス**: **確定（v1.2）** — v1 確定（Codex 討論 2R・§9）→ v1.1（UI 三面）→ **v1.2 = フィールド型充足性監査
> （[field-sufficiency-audit.md](field-sufficiency-audit.md)・52 エージェント＋Codex レッドチーム）の反映**。
> **前提資料**: [README.md](README.md) / [trpg-system-survey.md](trpg-system-survey.md)（P1〜P14）/ a2 / a4 / b1 / b2 / b4
> **最終更新**: 2026-07-07

---

## 0. 採用方針（土台）

- 表現モデルは **A2（スキーマ駆動）＋ A4（意味ブロック）の融合**: 型付きフィールドの直和に
  track / list / relation / tag を加え、Discord 連携は role 注釈＋materialized palette（B4）で接続する。
- 現行 5 セクション（status/skill/parameter/item/description）は**汎用正本から退役**し、
  Discord 互換の投影（materialized view）としてのみ存続（B2・調査結論）。
- 式・参照表は「データとして安全に評価」（eval 禁止・AST インタープリタ・上限つき、B1）。

## 1. テンプレート正本フォーマット（schemaVersion 3）

```ts
interface SheetTemplate {
  // メタ（B3）
  templateId: string
  name: string
  version: string            // semver。published は構造完全不変（§5）
  schemaVersion: 3
  gameSystemId?: string      // bcdice システム ID（ロール記法の既定解決）
  tags: string[]
  visibility: 'private' | 'unlisted' | 'public'
  authorDiscordUserId: string
  forkedFrom?: { templateId: string; version: string }
  license?: string

  sections: SheetSection[]   // 5 固定を廃止。テンプレート定義の順序付きセクション
  tables: LookupTable[]      // named 参照表（ダメージボーナス等）
  settings: { rounding: 'floor' | 'ceil' | 'round' } // システム既定丸め
}

interface SheetSection {
  id: string                 // 作者可読 ID（§6 規約）
  label: string
  fields: SheetField[]
  layout?: GridLayout        // 現行 DSL の 12 カラムレイアウト継承（表示専用・意味を持たない）
}
```

### フィールド共通部と id/uid の二層（決着 §8-10）

```ts
interface FieldBase {
  id: string        // 作者可読 ID。式ソースの参照に使う（§2）。draft 内 rename 可
  uid: string       // ★エディタが自動発行する不変 ID（作者編集不可）。
                    //   character 側 values のキー・palette 逆引き・version 間 migration の
                    //   同一性判定に使う。式ソースには現れない
  label: string
  description?: string
  role?: FieldRole  // B4: rollable { notation, group } / resource { deltas } / profile
  visibleTo?: 'public' | 'owner' | 'gm'
  // ★v1 制約（決着 §8-11）: publish バリデータは visibleTo != 'public' および secret 系 role を
  //   「エラーで拒否」する（inert 受理は漏洩事故のもと）。GM 権限モデル導入時に解禁
  // ★v1.x 予約（v1.2・監査 G34）: when?: string（palette 生成ゲート・boolean 式。false でエントリ生成をスキップ）。
  //   v1 の publish は when 指定を「未対応」としてエラーで拒否（黙殺しない）。
  //   採用時: 式は既存の検証・resolvedRefs 対象、行内 role では {row.*} 可、未解決参照は publish 拒否、
  //   false 中に押された既存ボタンは「該当エントリなし」応答。
  //   ⇒ 帰結の明記: 状態依存のボタン無効化（例: ネクロニカの破損パーツ）は v1 非対応
}
```

### フィールド型（直和）

```ts
type SheetField =
  | ScalarField    // number | text | boolean | select
  | ComputedField  // 式。resultType: number | dice | text | boolean
  | RollField      // 作成時ロール（bcdice 記法）。再ロール可否
  | TrackField     // ゲージ/チェック列（P8）
  | ListField      // リピータ（P5）
  | RelationField  // 他キャラ/自由対象への参照＋属性（P7）
  | TagField       // タグ集合（P9）

// TrackField（侵蝕率・ストレス・死亡セーヴ）
interface TrackField extends FieldBase {
  type: 'track'
  min?: number              // v1.2（監査 R25）: 既定 0。負値域が要るシステム用
  max: number | { formula: string }
  style: 'gauge' | 'checkboxes'
  thresholds?: Array<{ at: number; label: string }> // v1 は到達ラベル通知まで（効果自動適用はしない）
  resetOn?: 'scene' | 'session' | 'rest'            // 発火は Web/Discord の明示操作（発火権限は未決・README）
  resetTo?: 'zero' | 'max' | { formula: string }    // v1.2（監査 G28）。既定: checkboxes→'zero' / gauge→'max'
}
```

**track の値意味論（v1.2・監査 G28/R25 の確定）**:

- **値域**: 現在値（parts 合算）は `[min(既定0), max]` にクランプする。± 操作で境界を越える delta は
  境界に届く分まで切り詰め、**切り詰め後の実効 delta を parts.other に書く**（合算がレンジ外にならない）。
- **reset の意味論**: reset は「現在値の上書き」＝ **parts を丸ごと `{ base: 解決値 }` に置換**する
  （`'zero'`→置換後合算 0、`'max'`→max の解決値、formula→式の解決値）。加算ではないので**冪等**。
- **reset のスコープと権限**: 明示発火はシート内の該当 `resetOn` を持つ全 track（list 行内 track は行ごとに
  `{row.*}` 込みで評価）。reset 後に追加された行は次回 reset まで対象外。実行権限は変異系＝所有者のみ。
- **resetTo formula の制約**: `{row.*}`＋グローバル参照可・publish 時 resolvedRefs 解決＋循環検査。
  **自 track の現在値は参照不可**（FATE 型「現在値と refresh の高い方を維持」は README 未決へ）。

```ts

// ListField（武器・忍法・エフェクト・パーツ）
interface ListField extends FieldBase {
  type: 'list'
  itemFields: SheetField[]  // ネストは 1 段まで（list 内 list 禁止）。深い構造は relation/別実体で逃がす
  rowRole?: FieldRole       // 行単位 rollable（武器ごとの命中ロール等）
}
// 行は保存時に必ず安定 rowId（短縮 nanoid）を持つ。式・palette からの index 参照は禁止（決着 §8-7）
```

- **parts（内訳）意味論**（決着 §8-6）: 「**可変（mutable）な number 値**」に対して `parts: true` を許可する
  —— scalar number・track の現在値・list 行内の number が対象。値は `{ base, buff, temp, other, ... }` の合算
  （現行 AttributeValue.values の意味論を継承。Discord ± は other へ）。computed / roll の結果・text には禁止。
- **GridBlock（シノビガミ特技表・P6）は v3 スコープ外**（決着 §8-9）。ただし将来 `grid` が field/list と
  **別の value model** を持てるよう、FieldPath・式・palette の拡張点を予約する（uid 空間・schemaVersion 運用で吸収）。

## 2. 式エンジン（sheet-engine）

- **パッケージ化**（決着 §8-2）: pnpm workspace に共有パッケージ `packages/sheet-engine` を新設。
  **純 TS 限定** —— parser / validator / evaluator / テストベクタのみを含み、
  NestJS・Mongoose・discord.js・bcdice への依存を持たない。ダイス実行はサーバー側 adapter
  （bcdice ラッパー）を evaluator に注入する。
- **参照構文**（決着 §8-1・二層表現）:
  - **ソース（人間向け）**: 式は常に canonical path `{sectionId.fieldId}` で**保存**する。
    エディタは flat 入力 `{dex}` を補完・受理し、保存時に正規化する（重複時は修飾を強制）。
  - **resolvedRefs（機械向け）**: publish 時に式中の全参照を fieldUid へ解決した依存メタを格納し、
    **materializer は uid 解決結果で評価**する。可読性・fork/diff は path が担い、
    rename 耐性・migration は uid が担う。
- 値型: `number | text | boolean | dice`。dice は算術に混入不可（型エラー）。
- 関数（v1）: `floor ceil round max min lookup if` ＋比較演算子、list 集計は `sum count` のみ。
  行内式は `{row.subFieldId}` スコープ（**list 内限定**。外部式から個別行の参照は禁止、集計のみ可）。
  SW 威力表型（多入力・振り足し）は v1 外（README 未決へ）。
- 丸め既定は `settings.rounding`。循環検出・AST ノード数/評価ステップ/テーブル行数の上限つき
  （テーブル行数上限は累積コスト表ユースケース＝〜100 行規模を根拠に設定）。
- 確定値の正本は**サーバー評価**。フロント評価はプレビュー専用（同一パッケージを import）。

### 2.1 role notation の差し込み文法（v1.2・監査 G02。**Phase 2 の legacy-coc 定義前に確定必須**）

- **許可トークン**: `{value}`（自フィールドの値）/ `{sectionId.fieldId}` / 行内 role（itemFields の subfield
  role・rowRole）では `{row.subFieldId}`。**rowRole では `{value}` を publish 時に拒否**（どの subfield か
  不定のため）し `{row.*}` を必須とする。リテラル波括弧は `{{` `}}` でエスケープ。
- **差し込み可能な値の型（インジェクション防止）**: number、および **publish 時に検証済みの notation fragment**
  （`computed(resultType:'dice')` の結果・lookup 表が返す dice / 断片 text）に限る。
  **自由入力 text（プレイヤーが入力する text/select 値）の notation 参照は publish 時にエラー**
  —— 任意 bcdice コマンド断片の注入経路を型で塞ぐ。
- **notation fragment**: 先頭符号付き・空文字の断片（`'+1d4'` / `'-1d4'` / `''`）を fragment として許容する
  **専用語彙**（式の `dice` 値型＝算術混入不可、とは別概念。混同しない）。符号正規化（`+-1`→`-1`、
  0 は省略）は fragment 連結境界で適用する。
- **差し込み位置**: 式が number / 検証済み fragment に評価される**任意の位置**（ダイス個数位置
  `({remainLois})d10` を含む）。
- **検証の二段構え**: (1) publish 時 —— notation 内参照も resolvedRefs へ uid 解決（rename 耐性）＋参照型検査。
  (2) materialize 時 —— **補間後の最終 notation を gameSystemId 付きで bcdice parse 検証**してから palette へ。
  失敗したエントリはエラー状態として保存し（黙って公開しない）、hub/Web に警告表示する。

#### RollExpression の二契約

role 補間用の断片と、単独で実行するロール式には異なる受理条件が必要になる。

- **`NotationFragment`**：role notation へ連結する断片。
  空文字、`+1d4`、`-1d4`、数値項を許容し、単独でロールできることは要求しない。
- **`StandaloneRollExpression`**：参照解決と補間を終えた後に単独でロールできる式。
  ダイス項を一つ以上含み、対象 `gameSystemId` の BCDice が受理することを要求する。
  定数のみの `10` は `NotationFragment` としては正当だが、この契約では拒否する。
  定数は scalar または computed で表現する。

| notation | fragment | standalone（B1 で導入する契約） | 旧 front roller（現状） |
|---|---|---|---|
| `d6` | 可 | 受理 | null（無反応） |
| `2d6+1d4` | 可 | 受理 | null |
| `1d6+1d6+2` | 可 | 受理 | null |
| `10` | 可 | **拒否**（定数のみ） | null |
| `3d6*5` | 不可 | 受理（legacy seed 使用） | null |
| `(2d6+6)*5` | 不可 | 受理（legacy seed 使用） | null |
| `2d6+1` | 可 | 受理 | 実行可 |

`StandaloneRollExpression` の検査は publish 専用とし、draft save には適用しない。
既存の公開 revision は検査導入後も読み取り可能なまま維持する。
ロールの実行主体は server の BCDice とし、旧 front roller の対応記法を拡張せず、sheet-engine に乱数実行を追加しない。

実装は B1（engine 検証）、B2（server preview endpoint）、B3（UI 接続）、B4（旧 roller 削除）の順に進める。

### 2.2 仕様明文化（v1.2・監査反映。実装時の解釈割れ防止）

1. 行内式は `{row.subFieldId}` に**加えて**通常の `{sectionId.fieldId}` を参照可。禁止は従来どおり
   「外部式 → 個別行」の一方向のみ（行内 computed が集計を参照する逆向き循環は publish 時に拒否）
2. `sum`/`count` の対象＝「number を返す itemField（行内 ComputedField を含む）」。外部からの集計参照は
   `sum({sectionId.listId.subFieldId})`、resolvedRefs には listUid＋subFieldUid のペアで格納。
   評価順序は依存グラフのトポロジカル順（行内 → 集計 → シート）で一意
3. TrackField への式参照は**現在値（parts 合算・クランプ後）の number** に評価される
4. 等値比較（`==`/`!=`）は同型スカラー全般（text/select 含む）で可、大小比較は number のみ。
   select の式中の値は option value（text）
5. list の itemFields 内 subfield に付与した role は**行ごとに** materialize され fieldRef{uid, rowId} 付き
   PaletteEntry になる。rowRole（行代表ロール）と subfield role が並存する場合は**別エントリ**
   （key は registry 発行で衝突しない。label は「行ラベル＋subfield ラベル」、group は各 role 指定に従う）
6. itemFields 内の Track/Computed の式（max 式含む）は {row.*}＋グローバル参照可で**行ごとに評価**。
   行内 track の resource role も行ごとに palette 化される
7. itemFields 内の RollField は **v1 では publish 時に拒否**（number 手入力を正とする。
   「行追加時に自動ロール」は将来拡張）
8. RollField の結果値は**事後編集不可**。成長・老化は「roll 原値の凍結＋修正 scalar＋computed 合算」の
   3 点セットで表現する
9. TagField は v1 では**式から参照不可**（機械参照が要る集合は boolean 分解が正）。タグの同一性は
   完全文字列一致、catalog タグと自由入力は同一名前空間
10. RelationField の attrs は**スカラー限定**（決定）。「関係＋型付き属性」の複雑形は
    「list 行の兄弟フィールド」を正規イディオムとする（ロイス・Hx・未練・Influence が同型）。
    relation 先シートのフィールド値への live 参照は**非対応**（手動転記。P14 系の将来論点）
11. sheet-engine は数値精度・丸め誤差の仕様（比較・floor/ceil 適用前の epsilon 丸め）を定め、
    小数集計（SR5 エッセンス 0.1 刻み）をテストベクタに含める
12. `max`/`min` は二項関数（可変長は不要。二項ネストが正準形）

## 3. character ドメイン再設計

```ts
class Character {
  characterId: string        // 不変（現行どおり）
  characterName: string
  gameSystemId: string
  discordUserId: string
  discordChannelId?: string
  discordThreadId?: string   // 旧 threadId 重複は E-6a（2026-07-07 実施済み・コミット 04e0b5b）で撤去済み

  sheet: {
    templateId: string
    templateVersion: string  // pin。自動追従しない。migrate は明示操作
    revision: number         // ★楽観ロック。全書き込みで increment（決着 §8-14）
    values: Record<FieldUid, SheetValue> // ★入力値のみの正本。キーは fieldUid
  }
  computedCache: Record<FieldUid, number | string | boolean | DiceExpr>
                             // ★materializer 専有の派生キャッシュ（決着 §8-12）
  palette: PaletteEntry[]    // §4

  // 互換投影（移行期・read-only・materializer 専有）
  status: AttributeSection
  skill: AttributeSection
  parameter: AttributeSection
  item: AttributeSection
  description: AttributeSection
}
```

- **E-6d との整合（v1.2）**: character の公開型は E-6d（実施済み・コミット 199b5e6）で導入された
  **`CharacterEntity`（plain interface）が正本**、@Schema クラスは persistence 専用。Phase 2 の拡張
  （sheet / computedCache / palette）は **CharacterEntity と @Schema の両方**へ追加し、repository 境界の
  plain 化契約（lean / toObject）に従う。上の `class Character` スケッチはフィールド構成の説明であり、
  実装時の型配置は E-6d の様式に従う。
- **三層モデル**（決着 §8-12): (1) `sheet.values` ＝入力の唯一の正本 →
  (2) `computedCache` ＝materializer が保存時に再計算する派生キャッシュ（**クライアント提出の computed 値は常に無視**）→
  (3) projection（旧 5 セクション）＋ palette ＝ UI/Discord 向け materialized view。
- **互換投影の廃止条件**（決着 §8-3）: 期限ではなく**実装ゲート** ——
  (1) Discord 全 consumer（ロール・±・embed・/dice-result）の palette 移行完了、
  (2) 既存キャラの backfill 完了、(3) 実機 E2E 緑。満たすまで生成継続。書き込みは materializer のみ
  （他経路からの直接更新は禁止。repository の projection 更新は S-1 教訓どおり全 `.select(...)`＋spec 同時更新）。
- **検証層**（決着 §8-8）: **Zod を正本**（template / sheet / palette の構造・テンプレート照合・versioned schema）。
  class-validator DTO は HTTP 境界の外形チェックのみに縮退。Zod エラー→HTTP エラーの変換規約を固定する。

## 4. palette（Discord 接続の実体）

```ts
interface PaletteEntry {
  key: string                              // per-character の一意 registry が発行。
                                           //   基本は fieldPath 短縮形、衝突時は suffix 付与（決着 §8-4）
  fieldRef: { uid: string; rowId?: string } // ★書き戻し・再生成用の逆引き（正本）
  label: string                            // "目星 (65)"
  kind: 'roll' | 'resource'                // v1 の既知 kind。予約済み: 'check'（案C1）/ 'declare'（監査 G35・v1.x）
  notation?: string                        // 評価済み bcdice 記法（roll）
  deltas?: number[]                        // resource（± ボタン）
  group: string
}
```

- **kind の拡張規約（v1.2・監査 G35＋Codex レッドチーム）**: kind は拡張前提だが扱いを二分する ——
  **publish/materialize バリデータは既知 kind のみ受理**（作者の書き間違いや未対応 kind が「ボタンが出ると
  思ったのに黙殺」になる事故を防ぐ）。**runtime consumer（Bot）は未知 kind を無視**（新しい kind を持つ
  キャラを古い Bot が読んだときの前方互換）。

- **上限（決着 §8-4）**: soft cap **128** —— 超過分は Discord 側で select menu／ページングへ自動フォールバック
  ＋作者へ警告。hard cap **512** —— 保存時 validate エラー（テンプレート publish 時も静的検査）。
  cap は palette 総数に対して。512 は通常 UX ではなく abuse/肥大化の防波堤（検索・ページング前提）。
- customId v2: `roll_{channelId}_{key}` / `res_{channelId}_{key}_{delta}`。
  **予約プレフィックス（v1.2）**: `chk_`（案C1 の kind:'check' 用）/ `dec_`（kind:'declare' 用・v1.x）。
  機能名でなく action kind 単位で予約する（`c1_` のような機能名プレフィックスは使わない）。
  **パース安全性**: palette key の文字種は registry 発行で `[a-z0-9]` に限定（`_` を含めない）。
  channelId は snowflake（数字のみ）なので `prefix_channelId_key(_delta)` は `_` 区切りで一意にパースできる。
  fieldPath を customId に直接埋めないため、Discord の 100 字制限は key 側で構造的に担保。
  新契約は Factory / Parser / pattern 定数の custom-id モジュールとして新設（文字列直書き禁止を踏襲）。
  旧 `skill_` / `ability_` は legacy テンプレートのキャラ用に registry 併存 → 投影廃止ゲートと同時に段階廃止。
- ± 操作の書き戻し: key → `fieldRef` → `sheet.values[uid].parts.other` へ加算 → materializer 再生成（**単方向**）。

## 5. ドメインと features の配置

- **`src/domains/character-sheet-template/`（新設）**: Controller-Service-Repository ＋ Mongoose ＋ Zod。
  責務 = テンプレート CRUD・publish（**構造完全不変**・説明文/タグ等の表示メタのみ patch 可、決着 §8-5）・
  構文検証（sheet-engine の validate）。依存は character → template の一方向のみ。
  利用数集計等は character 側イベントの購読で解く（逆依存・イベント RPC 禁止）。
- **`src/features/character-sheet/`（新設・決着 §8-13）**: ARCHITECTURE 目標 features 層の**最初の住人**。所有:
  - `CharacterInstantiationService` —— テンプレート解決 → rollOnCreate（**E-6e で `domains/dice-roll` に
    抽出済みの BCDice 実行コア〔dice-execution 系サービス・discord.js 非依存〕を再利用**。二重実装しない）→
    式評価 → `CharacterService.create`（ID は CharacterIdService）→ 初回 materialize
  - `SheetMaterializerService` —— computed 評価・computedCache・projection・palette 生成の**単一書き込み点**。
    `sheet.revision` の楽観ロック＋競合時再試行。Web 保存・Discord ±・migrate のすべてがここを通る（決着 §8-14）
  - テンプレート適用（migrate）ユースケース —— uid ベース自動 mapping。削除フィールドの値は
    「孤児値」として **migration review 専用メタ**に退避（通常 read API には混ぜない・UI で破棄確認）
- 依存方向: `discord/features → features/character-sheet → domains/{character, character-sheet-template} → core → shared`。
  discord 層は palette の**読み取り**を domains/character（projection/palette は character ドキュメント内）から行い、
  **書き戻し・再 materialize** は features/character-sheet の公開 API を DI で呼ぶ。循環ゼロを check:circular でゲート。
- `domains/character` は**保存と不変条件**（characterId 不変・DTO/Zod・projection 整合）に縮退する。

## 6. 命名・identity 規約

- `sectionId` / `fieldId`: `[a-z][a-z0-9_]{0,31}`。予約語: `row` `values` `parts` `base` `other` ＋式関数名。
- `uid`: エディタ発行（短縮 nanoid＋テンプレート内登録簿で一意保証・衝突時再発行）。作者には見せない。
- rename: draft 内はエディタが式ソースを一括リライト。published 間は uid mapping で自動移行。
- customId には palette key のみを埋める（§4）。fieldId 長は customId 制限と独立になった。

## 7. 段階導入（Phase 分割）

| Phase | 内容 | 検証ゲート |
|-------|------|-----------|
| 1 | `domains/character-sheet-template` 新設＋`packages/sheet-engine`＋`features/character-sheet` 骨格（instantiation/materializer）＋schema v3 最小（scalar/computed/roll/tables）＋Web エディタの mock→実 API 置換＋legacy-coc テンプレート定義 | build / check:circular / 新ドメイン・engine spec / エディタ E2E |
| 2 | `character.sheet`＋`computedCache`＋palette 併存＋customId v2＋投影生成＋既存キャラ backfill＋hub メッセージ化（`hubMessageId` 永続化）＋templateVersion バッジ表示（v1.1） | 全 suite（マージ前必須）＋**characterization test: legacy-coc の materialize 出力 ≡ 現行 5 セクション**＋Discord 実機（スレッドロール・±・/dice-result） |
| 3 | track / list / relation / tag＋ブロック UI（Web）＋Discord の track ±・行ロール＋palette/user-dice 名前空間統合（分離表示）＋migrate ウィザード最小（差分・orphan review・hub rebuild、v1.1） | 同上＋列挙: ボタン→select フォールバックの実機確認 |
| 4 | 配布（publish / gallery / fork / import-export）＋未認証閲覧の認可設計＋通報・ライセンス | B3 安全性チェック（サイズ上限・sanitize・publish 静的検査） |

- 各 Phase は「1 slice ずつ独立検証」の既存方針に従い、`/domains` と `/discord` を同時に大きく動かさない。

## 8. 争点決着表

| # | 争点 | 決着 | 出典 |
|---|------|------|------|
| 1 | 式の参照構文 | ソースは canonical path `{sectionId.fieldId}` 保存（flat は UI 補完のみ）＋publish 時に uid へ解決した resolvedRefs を格納し評価は uid で行う二層表現 | R1 反対 → R2(a) 修正受諾 |
| 2 | sheet-engine 共有方式 | pnpm workspace 共有パッケージ。純 TS 限定（bcdice はサーバー adapter） | R1 条件付き → 受諾 |
| 3 | 互換投影の期限 | 期限でなく実装ゲート（全 consumer 移行＋backfill＋E2E 緑）。read-only・materializer 専有 | R1 条件付き → 受諾 |
| 4 | palette の持ち方 | character 内保持＋per-character key registry（衝突 suffix）＋fieldRef 逆引き＋soft 128 / hard 512 | R1 条件付き＋R2(c) 修正受諾 |
| 5 | published 不変性 | 構造（sections/fields/tables/式）完全不変。表示メタのみ patch 可。式修正も新 version | R1 賛成 |
| 6 | parts の適用範囲 | 「mutable な number 値」に許可（computed/roll/text 禁止）。list 行内 number も対象 | R1 対案受諾 |
| 7 | list のネスト | 1 段まで。rowId 必須・index 参照禁止。深い構造は relation/別実体へ | R1 条件付き → 受諾 |
| 8 | 検証層 | Zod が template/sheet/palette の構造正本。DTO は HTTP 外形。境界とエラー変換を固定 | R1 条件付き → 受諾 |
| 9 | GridBlock | v3 スコープ外。grid が独自 value model を持てる拡張点（path/式/palette）を予約 | R1 条件付き → 受諾 |
| 10 | field identity（追加） | 作者可読 id ＋ 不変 uid の二層。values キー・palette 逆引き・migration は uid | R1 欠陥2 → R2(a) |
| 11 | 秘匿の v1 扱い（追加） | publish バリデータが visibleTo != public / secret role を**エラーで拒否**（inert 受理は漏洩）。GM 権限モデル導入時に解禁 | R1 欠陥4 → R2(b) Claude 案受諾 |
| 12 | computed 値の保存（追加） | 三層: values 正本 / computedCache 派生（保存時再計算・クライアント提出無視）/ projection+palette | R2(d) Claude 案受諾 |
| 13 | インスタンス化の置き場（追加） | `src/features/character-sheet/` 新設（features 層の最初の住人）。domain は保存と不変条件に縮退 | R1 欠陥1 → R2(e) 修正受諾 |
| 14 | 同期・並行更新（追加） | materialize を単一サービスに集約＋`sheet.revision` 楽観ロック＋再試行 | R1 欠陥5 → 受諾 |

## 9. 討論記録（Codex ×2 ラウンド・2026-07-06）

- **方式**: Codex CLI（companion スレッド `019f360a-8333-7cf2-a55a-f433fd3bb464`）に本ドラフト・案出し資料・
  実コード（character model / repository / attribute.types / フロント DSL）を読ませ、
  R1＝構造化レビュー、R2＝対立点 (a)〜(e) の収束、の 2 ラウンドで実施。ファイル変更なし（読み取りのみ）。
- **R1 要旨**: 総評は「A2+A4 融合・B1・B4 palette 実体化の大筋は妥当。ただしこのまま確定は不可」。
  修正必須 5 点 —— (1) 式参照の canonical 化 (2) palette key の衝突・逆引きの明文化
  (3) materialize と同期責務の単一化 (4) 秘匿/GM を v1 有効機能から外す (5) 互換投影の廃止条件を実装ゲートで定義。
  加えて「hash8 キーは衝突が即データ破壊」「インスタンス化が character ドメインに寄りすぎ」
  「FieldPath は永続参照の正本として弱い（rename で切れる）」の欠陥指摘。→ **全件受諾**し本版へ反映。
- **R2 判定**: (a) **修正受諾**＝path ソース＋uid resolvedRefs の二層 / (b) **Claude 案受諾**＝publish 拒否
  / (c) **修正受諾**＝soft 128・hard 512（512 は防波堤であり通常 UX にしない）/ (d) **Claude 案受諾**＝三層モデル
  / (e) **修正受諾**＝`src/features/character-sheet/`（`src/application/` 新設は目標構造とズレ、
  domains/character 内は責務肥大のため）。
  暫定回答への異論 2 件 —— 孤児値は通常 read API に混ぜず migration review 専用メタとする /
  `{row.*}` は list 内限定・外部からの個別行参照禁止 —— いずれも受諾。
- **確定宣言**: 残ブロッカー「なし」、判定「**可**」（(a)(e) の反映を条件 → 本版で反映済み）。
- **持ち越し（本設計のスコープ外として README 未決事項へ）**: 公開ギャラリーの未認証 read・通報・license 運用、
  GM/セッション権限モデル、共有シート（P14）、track リセットの発火権限、SW 威力表型 lookup 拡張。

## 10. 改版履歴

- **v1.1（2026-07-07）**: UI 三面設計の討論（[design-v1-ui.md](design-v1-ui.md)）の決着を Phase 表へ反映 ——
  Phase 2 に hub メッセージ化（hubMessageId 永続化）と templateVersion バッジ、Phase 3 に migrate ウィザード最小を追加。
  Discord 投影の共有単位は palette から `DiscordProjectionViewModel`（`packages/sheet-projection`）へ拡張
  （§4 palette はデータ仕様として有効のまま、行分割・embed・警告の算出は projection 側が正本）。
- **v1.2（2026-07-07）**: フィールド型充足性監査（[field-sufficiency-audit.md](field-sufficiency-audit.md)＝
  52 エージェントのストレステスト＋Codex レッドチーム検証）の反映 ——
  (1) §1 TrackField に `min` / `resetTo` と**値域クランプ・reset 意味論**（parts 置換・冪等）を追加（G28/R25）、
  (2) §2.1 に **notation 差し込み文法**（許可トークン・fragment 型によるインジェクション防止・補間後 bcdice 検証、G02）、
  (3) §2.2 に仕様明文化 12 件、(4) §1 FieldBase に `when` を**名前ごと予約**（v1 は publish 拒否・
  ネクロニカ型の状態依存ボタン無効化は v1 非対応と明記、G34）、(5) §4 に kind 拡張規約
  （publish は既知のみ・runtime は未知無視）と `chk_`/`dec_` プレフィックス予約（G35・案C1 整合）、
  (6) E-6 系列（threadId 撤去・CharacterEntity 公開型・BCDice 実行コアの domains 引き上げ）が
  **実施済み**である事実へ記述を更新。エンコード可能と確定した 37 件は [encoding-cookbook.md](encoding-cookbook.md) 参照
  （うち 4 件はレッドチームで反証が破れ、明示 deferral として監査文書に記録）。
