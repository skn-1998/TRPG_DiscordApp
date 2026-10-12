# 認知負荷レビュー: キャラクターシート描画コンポーネントの構成方針

> **分類**：設計判断、段階的リファクタ方針
>
> **対象**：`trpg-next-app/app/features/characterSheet/TemplateFormRenderer.tsx`
>
> **ステータス**：推奨案、実装未着手
>
> **最終更新**：2026-10-12

## 結論

`character-sheet-data-patterns.md` の D01 から D19 を、そのまま実行時のコンポーネント種別にはしない。

D01 から D19 は、要件の整理、対応状況の確認、表示例、回帰テストの分類に使う。

実行時の描画は、既存 schema v3 の `field.type` と `section.layout.preset` を分岐軸にする。

`TemplateFormRenderer` は作成フォーム、編集画面、テンプレートプレビューが共有する唯一の公開入口として残す。

内部を分割するときは、フィールド型、レイアウト構造、独立した編集状態という実際の変更理由に沿って段階的に切り出す。

判定は **縮小** とする。

D01 から D19 の19コンポーネントを新設する案は採用せず、現在の描画正本を保った内部分割だけを進める。

## 対象の理解（レビュアの前提）

[キャラクターシートのデータ保持パターン](../character-sheet-data-patterns.md)は、紙面の見た目ではなく「何をどう保存するか」を分類した資料である。

同資料も、通常の二列表示やカード表示を値の意味から分離し、座標自体がルールへ影響する D13 だけを別扱いにしている。

現行 schema v3 は、フィールドを `scalar`、`computed`、`roll`、`track`、`list`、`relation`、`tag` の直和で表現する。

現行の表示用レイアウト語彙は、`stack`、`grid`、`table` の3種である。

[UI 設計 v1](design-v1-ui.md)は、`TemplateFormRenderer`を `template`、`values`、`onChange` を受け取る controlled renderer と定義している。

`trpg-next-app/AI.md`は、field描画の正本を`TemplateFormRenderer`とし、第三の描画実装を作らないよう定めている。

- **実行経路**：`CharacterCreationForm`、`CharacterSheetEditClient`、`TemplatePreviewV3`の3箇所から`TemplateFormRenderer`を呼び、`@trpg/sheet-engine`のレイアウト解決と注釈評価を利用する。
- **運用上の役割**：テンプレート作成時のプレビュー、キャラクター作成、保存済みシートの編集で、同じフィールド定義を同じ表示規則へ変換する。
- **実測規模**：`TemplateFormRenderer.tsx`は1,232行、対応specは2,583行である。
- **変更頻度**：2026-08-12から2026-08-29までに12コミットあり、直近6か月の変更回数も12回である。

## 代表変更タスク

代表変更タスクは、チェック箱形式のtrack表示を変更する作業と、listへ新しいセル入力を追加する作業とする。

どちらも2026年8月の実装履歴に同種の変更があり、空想上の拡張ではない。

## Findings

### CL-1 [Medium] D01からD19は排他的な描画キーにならない

- **場所**：`document/character-sheet-data-patterns.md:88-396`、`packages/sheet-engine/src/types.ts:75-148`
- **類型**：extraneous / 概念過多、語彙の不一致
- **読者シミュレーション**：チェック箱形式のリソース表示を安全に変更するには、D番号別構成では次の7項目を同時に把握する必要がある。
  1. D07が表す現在値と上限の意味（`character-sheet-data-patterns.md:192`）
  2. D08が表すチェック箱の意味（`character-sheet-data-patterns.md:211`）
  3. D09が表すリセット契機の意味（`character-sheet-data-patterns.md:221`）
  4. `TrackField.style`の値（`packages/sheet-engine/src/types.ts:107`）
  5. `TrackField.resetOn`の値（`packages/sheet-engine/src/types.ts:120`）
  6. 一つのfieldをD07、D08、D09のどれへdispatchするかという新しい分類規則
  7. 外側の`stack`、`grid`、`table`レイアウト（`packages/sheet-engine/src/types.ts:33`）
- **実測**：一つの`TrackField`が`style`と`resetOn`の組み合わせによってD07、D08、D09を同時に表しうる。D番号はschemaに保存されておらず、runtimeの呼び出し元も存在しない。
- **推奨**：`field.type`でfield rendererを選び、`TrackFieldView`の中で`style`を解釈する。D番号への変換規則とdispatchを追加しないことで、同時保持数を7から4へ減らし、追加のdispatchホップを0に保つ。

### CL-2 [Medium] 現行レンダラには独立して変わる責務が同居している

- **場所**：`trpg-next-app/app/features/characterSheet/TemplateFormRenderer.tsx:92-1231`
- **類型**：extraneous / 非局所、概念過多
- **読者シミュレーション**：track表示を安全に変更するには、現行ファイル内で次の6項目を同時に追う必要がある。
  1. field型のdispatch（`TemplateFormRenderer.tsx:1056`）
  2. 現在値と最大値の表示規則（`TemplateFormRenderer.tsx:1093`）
  3. `gauge`と`checkboxes`の分岐（`TemplateFormRenderer.tsx:1119`）
  4. checkbox表示上限30の退化規則（`TemplateFormRenderer.tsx:1136`）
  5. field制約警告のラップ（`TemplateFormRenderer.tsx:967`）
  6. 作成時ロールの振り直し導線（`TemplateFormRenderer.tsx:1024`）
- **実測**：同じファイルにはsectionとblockの構成、table固有の行構造、parts編集、list行編集、field型dispatch、trackとscalarの具体描画がある。runtimeの直接利用者は3箇所であり、描画正本として変更が集中する。
- **推奨**：`TrackFieldView`へtrack固有の4項目を局所化し、警告と振り直しは`FieldRenderer`側に残す。trackを変更する読者の同時保持数を6から4へ減らす。公開入口は増やさず、消費者からのホップ数は変えない。

### CL-3 [Low] データパターン資料だけではUI仕様を確定できない

- **場所**：`document/character-sheet-data-patterns.md:8`、`document/character-sheet-proposals/design-v1-ui.md:129-149`
- **類型**：extraneous / 暗黙知
- **読者シミュレーション**：D番号からレイアウトを設計するには、次の3項目を別資料または実装から推測する必要がある。
  1. patternが固有UIを必要とするか
  2. 既存の`stack`、`grid`、`table`のどれを使うか
  3. モバイル時の退化規則をどうするか
- **実測**：同資料からリンクされている`character-sheet-data-pattern-wireframes.md`は、2026-10-12時点のリポジトリに存在しない。確定済みのレイアウト契約は`design-v1-ui.md`にある。
- **推奨**：runtime設計の正本は`design-v1-ui.md`と実装に置く。D01からD19については、本資料の対応表とfixtureでUI充足性を確認する。

## intrinsic として除外したもの

- **list編集**：安定した行ID、行全体の保存、セル型、parts制約を扱う必要がある。これらはD11のデータ意味論と保存契約に由来するため、分割しても消えない。
- **parts編集**：`base`、`other`、宣言済みキーの表示と書き込み可否が異なる。既存データとの互換性を守るための本質的な条件である。
- **tableレイアウト**：parts列、行ラベル、複雑fieldの全幅降格が必要であり、`stack`と`grid`とはDOM構造が異なる。
- **D13の二次元配置**：座標がルールへ影響するため、CSS Gridによる表示用`grid`へ統合できない。schemaに明示的な型を追加するときに別設計する。
- **D16からD18**：権限、履歴、別実体参照は、fieldの配置だけでは完結しない。サーバー境界または別featureの責務として扱う。

## 判定（モード B のみ）

**縮小**

| 観点 | 現行のschema軸 | D01からD19別の構成 | 推奨構成 |
|---|---:|---:|---:|
| track変更時の同時保持数 | 6 | 7以上 | 4 |
| runtimeの分類語彙 | field 7種、layout 3種 | 既存語彙にpattern 19種と対応規則を追加 | field 7種、layout 3種 |
| 消費者から描画正本までのホップ数 | 1 | 2以上になりうる | 1 |
| 描画の公開入口 | 1 | pattern別入口へ分裂しうる | 1 |
| 実害記録 | pattern別構成に起因する実害は未実装のため0件 | なし | 既存正本を維持 |
| 変更頻度実測 | 直近6か月で12コミット | なし | 高頻度部分だけを局所化 |

D番号別コンポーネントには、要件名とUI名が一致し、表示例を探しやすくなる利点がある。

その利点は、D番号をfixture名と対応状況表に使えば得られる。

runtimeへ19種の新しい分類と対応規則を持ち込む必要はない。

## 分割に使う二つの軸

### フィールドの意味と操作

入力または表示の意味は、`SheetField`の判別unionを正本にする。

`FieldRenderer`は`field.type`をexhaustiveな`switch`で分岐する。

registry、DI、文字列キーによる動的dispatchは導入しない。

`scalar`の`valueType`や`track`の`style`は、各field rendererの内部で解釈する。

### フィールドの配置

配置は、`resolveSectionLayout`が返す`stack`、`grid`、`table`を正本にする。

`stack`と`grid`は同じfield列を描き、CSSとspanだけが異なるため、一つの共通経路に置く。

`table`はtable要素、parts列、行ラベル、全幅降格を持つため、独立したlayout componentへ切り出す。

D13の意味付き二次元配置はこの`grid`に含めない。

## 推奨ディレクトリ構成

次の構成は最終的な目安であり、空のファイルや委譲だけのcomponentを先に作らない。

```text
trpg-next-app/app/features/characterSheet/
├─ TemplateFormRenderer.tsx
│  └─ 唯一の公開入口。section、block、poolの組み立てを所有する
│
├─ layouts/
│  ├─ FieldLayout.tsx
│  │  └─ stackとgridの共通経路、tableへの分岐、grid spanを所有する
│  └─ TableFieldLayout.tsx
│     └─ table、parts列、行ラベル、複雑fieldの全幅降格を所有する
│
├─ fields/
│  ├─ FieldRenderer.tsx
│  │  └─ field.typeのexhaustive switch、警告、振り直し導線を所有する
│  ├─ ListFieldEditor.tsx
│  │  └─ 行追加、行削除、セル編集、安定rowIdを所有する
│  ├─ TrackFieldView.tsx
│  │  └─ gauge、checkboxes、最大値の評価状態を所有する
│  ├─ PartsEditorPopover.tsx
│  │  └─ section直下scalarの内訳編集を所有する
│  ├─ RelationFieldEditor.tsx        # relationの操作仕様を実装するときに追加
│  └─ TagFieldEditor.tsx             # tagの操作仕様を実装するときに追加
│
├─ annotations/                      # 抽出対象が増えた段階で追加
│  ├─ SectionPools.tsx
│  └─ FieldConstraintMessage.tsx
│
└─ testing/
   └─ data-pattern-fixtures.ts
      └─ D01からD19をschema v3へ写像した表示確認用fixture
```

`TemplateFormRenderer`以外のcomponentは、既存3消費者から直接importしない。

内部componentを外部公開しないことで、作成、編集、プレビューが別々の描画経路へ分かれるのを防ぐ。

## D01からD19の配置先

| Pattern | runtimeでの主な受け皿 | component上の扱い | 現行の成熟度 |
|---|---|---|---|
| D01 単一入力値 | `ScalarField` | `FieldRenderer`内のscalar control | 直接表現可能 |
| D02 選択とフラグ | `ScalarField(select/boolean)` | scalar control | 直接表現可能 |
| D03 内訳を持つ数値 | `ScalarField.parts/partsKeys` | `PartsEditorPopover`、tableのparts列 | 直接表現可能 |
| D04 導出値 | `ComputedField` | 読み取り専用field表示 | 直接表現可能 |
| D05 参照表と条件分岐 | engine評価と`ComputedField` | 専用layoutを作らず評価結果を表示 | 直接表現可能 |
| D06 ダイス記法とロール操作 | `RollField`または`role` | field表示へ操作を付加 | 直接表現可能 |
| D07 上下するリソース | `TrackField` | `TrackFieldView` | 直接表現可能 |
| D08 同種のチェック箱 | `TrackField(style='checkboxes')` | `TrackFieldView`の表示変種 | 規約との組み合わせ |
| D09 リセットされる使用回数 | `TrackField.resetOn/resetTo` | リセット操作のfeature。layoutではない | 規約との組み合わせ |
| D10 状態とタグの集合 | `TagField` | `TagFieldEditor` | 型は存在するがUI成熟度を別途確認 |
| D11 複合行の反復リスト | `ListField` | `ListFieldEditor` | 直接表現可能 |
| D12 意味の異なる固定枠 | 既存fieldの組み合わせ、将来の専用型 | D番号だけを理由にcomponentを作らない | 規約との組み合わせ |
| D13 意味を持つ二次元配置 | 将来の専用型 | 現行`grid`とは別設計 | 基盤外または将来拡張 |
| D14 対象との関係 | `RelationField` | `RelationFieldEditor` | 型は存在するがUI成熟度を別途確認 |
| D15 選択に応じた構成 | 将来の条件付き構成 | renderer wrapperとengineの設計対象 | 基盤外または将来拡張 |
| D16 秘匿と公開遷移 | 権限とAPI投影 | field layoutの外 | 基盤外または将来拡張 |
| D17 成長と変更履歴 | event履歴 | 別featureの履歴表示 | 基盤外または将来拡張 |
| D18 下位シートと共有シート | 別実体への参照 | character domainと共有権限の設計対象 | 基盤外または将来拡張 |
| D19 配分プールと制約 | `section.pools`と`partsKey` | section注釈として表示 | 直接表現可能 |

## 実装規則

### Must

- `TemplateFormRenderer`を唯一の公開描画入口として維持する。
- fieldの分岐は`SheetField['type']`を使い、D番号をruntimeデータへ追加しない。
- layoutの分岐は`resolveSectionLayout`の結果を使い、解決規則をfront側で再実装しない。
- parts keyの提示可否は既存の`parts-key-visibility.ts`を使う。
- listの保存はlist全体1 path、scalarの保存はper-path CASという既存境界を変えない。
- 各抽出フェーズで既存specの期待値を維持し、挙動変更を混ぜない。

### Should

- 一つのcomponentには、同じ理由で変わる描画と操作をまとめる。
- field rendererは、該当field型の値解釈を隠し、呼び出し側へ細かな状態を漏らさない。
- `stack`と`grid`は構造を共有し、見た目だけの差をCSSへ残す。
- D01からD19はfixture名、テスト名、対応状況表で利用する。

### Avoid

- `DataPatternRendererRegistry`のようなD番号別registryを追加しない。
- D01からD19をschemaへ保存しない。
- `StackLayout`と`GridLayout`を委譲だけの別componentにしない。
- 将来利用を理由に、未接続の`RelationFieldEditor`や`TagFieldEditor`を先に作らない。
- D13をCSS Gridの設定追加だけで表現しない。
- component分割とfield挙動の追加を同じ変更に混ぜない。

## 段階的な抽出順序

### Phase 1 ListFieldEditor

`ListFieldEditor`、行セル描画、`RowPartsEditor`、list専用の値更新関数を一つのモジュールへ移す。

行ID、行上限、空セルのキー削除、parts形セルの読み取り専用合計という既存契約を維持する。

完了条件は、既存のlist関連specが期待値変更なしで通ることである。

### Phase 2 TableFieldLayout

table本体、`TableFieldRow`、parts列の構築をlayout moduleへ移す。

単純fieldの列表示、複雑fieldの全幅降格、parts列のラベルと編集可否を維持する。

完了条件は、table、grid、stackの全fixtureでDOM契約が変わらないことである。

### Phase 3 PartsEditorPopover

section直下scalar用のparts editorと、その値読み取り関数を移す。

list行用parts editorとは保存境界が異なるため、無理に一つのcomponentへ統合しない。

完了条件は、`base`、`other`、宣言済みキー、予約キーの既存specが通ることである。

### Phase 4 TrackFieldView

trackの値表示、gauge、checkboxes、最大値の評価状態を移す。

field警告と作成時ロールの振り直しはfield共通の付加要素として外側に残す。

完了条件は、未入力、範囲外、不正raw、max未確定、max評価失敗、checkbox上限30の既存specが通ることである。

### Phase 5 FieldRendererとFieldLayout

前段の抽出後に、field型dispatchとlayout dispatchをそれぞれ一箇所へまとめる。

この段階までは、新しいregistry、context、view modelを追加しない。

完了条件は、3つのruntime消費者が引き続き`TemplateFormRenderer`だけをimportしていることである。

## 検証

各フェーズでは、少なくとも次を実行する。

```powershell
pnpm --filter trpg-next-app test -- app/features/characterSheet/TemplateFormRenderer.spec.tsx --runInBand
pnpm --filter trpg-next-app run typecheck
pnpm --filter trpg-next-app run lint
```

schema、layout resolver、annotation runtimeを変更した場合は、sheet-engineも検証する。

```powershell
pnpm --filter @trpg/sheet-engine test
pnpm --filter @trpg/sheet-engine build
```

最終フェーズでは、作成、編集、プレビューの3消費者を含むfront全体のtestとbuildを実行する。

## 再評価条件

次のいずれかが成立した場合だけ、D番号に対応する専用componentを再検討する。

- schemaへ`fixedSlot`や意味付き`grid`などの排他的なfield型が追加された。
- 一つのpatternに固有の操作状態と保存契約が生まれ、既存field renderer内では隠蔽できなくなった。
- 同じpattern固有UIが3箇所以上へ実際に重複し、共有によって同時保持数または変更箇所数が減ることを実測できた。

再評価しても、D番号そのものをdispatchキーにするとは限らない。

新しいschema型または明示的な操作契約をcomponent境界にする。

## 参照

- [キャラクターシートのデータ保持パターン](../character-sheet-data-patterns.md)
- [UI 設計 v1](design-v1-ui.md)
- [具体設計 v1](design-v1.md)
- [フィールド型充足性監査](field-sufficiency-audit.md)
- [`trpg-next-app/AI.md`](../../trpg-next-app/AI.md)
- [`packages/sheet-engine/src/types.ts`](../../packages/sheet-engine/src/types.ts)
- [`TemplateFormRenderer.tsx`](../../trpg-next-app/app/features/characterSheet/TemplateFormRenderer.tsx)
