# TemplateFormRenderer 段階的リファクタ実装計画

> **分類**：挙動維持リファクタの実行計画
>
> **対象**：`trpg-next-app/app/features/characterSheet/TemplateFormRenderer.tsx`
>
> **設計方針**：[キャラクターシート描画コンポーネントの構成方針](renderer-component-structure.md)
>
> **ステータス**：実装完了、P0からP9完了
>
> **最終更新**：2026-11-01

## 実施判断

実装は一括で行わず、事前条件1件、コード抽出8件、完了処理1件へ分割する。

一括変更では、1,232行の実装と2,583行のspecを同時に読みながら、list、parts、track、table、field dispatch、layout dispatchの境界を検証する必要がある。

段階的な抽出では、各フェーズで変更理由を一つに限定し、公開入口を通る既存specを毎回再実行できる。

実装開始の判定は**条件付きGo**とする。

P0で現行のfocused specを緑にできない場合は、P1以降へ進まない。

## 目的と非目的

### 目的

- `TemplateFormRenderer`を、section、block、poolを組み立てる公開入口へ縮小する。
- field型、layout構造、独立した編集状態という変更理由に沿って、内部componentを分離する。
- list、parts、track、tableの変更時に読む範囲を局所化する。
- 作成、編集、プレビューの3画面が、引き続き同じ描画正本を利用する状態を保つ。

### 非目的

- D01からD19をruntimeのdispatchキーまたはcomponent名へ変換しない。
- schema、engine評価、保存API、CAS、list全体保存の契約を変更しない。
- UI、文言、DOM順、ARIA、data属性、レスポンシブ挙動を変更しない。
- `relation`または`tag`の編集UIを追加しない。
- `TemplateFormRenderer.spec.tsx`自体の分割を同時に行わない。
- 新しいregistry、context、view model、barrel、依存パッケージを追加しない。
- CSS Moduleをcomponentごとに分割しない。

## 現行基線

2026-10-12時点の実測値は次のとおりである。

| 項目 | 実測 |
|---|---:|
| `TemplateFormRenderer.tsx` | 1,232行 |
| `TemplateFormRenderer.spec.tsx` | 2,583行 |
| spec内の`it`または`test`宣言 | 112件 |
| runtimeからの直接import | 3箇所 |
| 公開描画入口 | 1件 |

runtimeの直接利用者は次の3箇所である。

- `CharacterCreationForm.tsx`
- `TemplatePreviewV3.tsx`
- `CharacterSheetEditClient.tsx`

large-file解析の既定閾値（file 800行、function 200行）を手作業で照合すると、実装とspecはfile警告の対象になる。

一方、実装内で最大の関数は`ListFieldEditor`の112行と`TableFieldRow`の111行であり、200行以上の関数はない。

P0では、欠損していたworkspace依存リンクをlockfile変更なしで復旧した。

focused specは1 suite、150 tests、1 snapshotが成功し、typecheckとlintも終了コード0で成功した。

P1後の専用解析コマンドも成功し、`TemplateFormRenderer.tsx`は1,205行、`renderer-value.ts`は33行と記録された。

既知の警告は、前者が800行のlarge-file閾値を超える1件だけである。

P8後の`TemplateFormRenderer.tsx`は304行、`FieldLayout.tsx`は74行である。

layout dispatch、grid span、field wrapperのproduction所有者は`FieldLayout.tsx`の1箇所になった。

計画作成へ着手した時点のworking treeはcleanである。

## 維持する外部挙動

次の項目を各フェーズの**安全境界**とする。

- `TemplateFormRenderer`のimport pathとpropsを維持する。
- `CreationRollReroll`のexport pathを維持する。
- section、block、fieldの宣言順と見出し階層を維持する。
- `stack`、`grid`、`table`のDOM構造、data属性、grid span、mobile collapseを維持する。
- tableのparts列、first-seen union、全幅降格、行ラベルを維持する。
- partsの`base`、`other`、宣言済みキー、予約キー、unsafe keyの扱いを維持する。
- listのrowId、行上限、空セルのキー削除、whole-field changeを維持する。
- trackの未入力値、不正raw、max評価状態、gauge、checkbox上限30を維持する。
- field constraint、pool、block capの`ok`、`indeterminate`、`error`表示を維持する。
- 作成時ロールの対象判定を`rollOnCreateSpec`へ一本化した状態を維持する。
- `renderField` overrideがtableのparts専用行を経由しない既存例外を維持する。

## 目標依存構造

依存は公開入口から具体描画へ一方向にする。

```text
TemplateFormRenderer
└─ FieldLayout
   ├─ TableFieldLayout
   │  ├─ FieldRenderer
   │  └─ PartsEditorPopover
   └─ FieldRenderer
      ├─ PartsEditorPopover
      ├─ ListFieldEditor
      │  └─ ListRowPartsEditor
      └─ TrackFieldView

PartsEditorPopover ───┐
ListRowPartsEditor ───┤
ListFieldEditor ──────┤
TrackFieldView ───────┼─> renderer-value
FieldRenderer ────────┘
```

`renderer-value.ts`は、`unknown`で届く保存値を表示境界で安全に読む純粋関数だけを所有する。

componentの再export用barrelは作らず、所有者を直接importする。

`TemplateFormRenderer.module.css`は既存の1ファイルを共有する。

CSS Moduleを増やすと、推移importする複数specのmock更新が抽出と同時に必要になるためである。

## フェーズ共通ルール

### 変更してよい範囲

- `trpg-next-app/app/features/characterSheet/TemplateFormRenderer.tsx`
- `trpg-next-app/app/features/characterSheet/TemplateFormRenderer.spec.tsx`
- `trpg-next-app/app/features/characterSheet/TemplateFormRenderer.module.css`
- `trpg-next-app/app/features/characterSheet/fields/`配下の新規内部module
- `trpg-next-app/app/features/characterSheet/layouts/`配下の新規内部module
- 本計画、構成方針、`trpg-next-app/AI.md`、完了時の状況文書

`TemplateFormRenderer.module.css`はimport先として利用してよいが、視覚仕様の変更は許可しない。

### 変更しない範囲

- `packages/sheet-engine/`
- `TRPG-SERVER/`
- 3つのruntime消費者
- `parts-key-visibility.ts`
- `form-values.ts`
- package manifest、lockfile、依存バージョン
- schema、fixtureの意味、保存payload、ユーザー向け文言

範囲外の変更が必要になった場合は、現在のフェーズを停止し、別タスクとして理由と影響を整理する。

### 実装規律

- 一度に進めるのは1フェーズだけとする。
- 既存ロジックを移動してからimportを切り替え、同じ責務の二重実装を残さない。
- 新しい内部componentを3つのruntime消費者から直接importしない。
- 関数の移動と挙動変更を同じフェーズへ混ぜない。
- 1フェーズの目安は、移動による削除を除く実質差分300行以下とする。
- テスト期待値の変更が必要になった場合は、挙動変更の可能性があるため停止する。
- rollbackは現在フェーズの差分だけを手作業で戻し、`git reset --hard`または`git checkout --`を使わない。

## タスク一覧

| ID | タスク | 主な成果物 | 依存 | 完了判定 |
|---|---|---|---|---|
| P0 | 基線を再取得する | テスト結果、環境メモ | なし | focused specが緑 |
| P1 | 保存値の読み取りを分離する | `fields/renderer-value.ts` | P0 | DOM差分なし |
| P2 | section用parts editorを抽出する | `fields/PartsEditorPopover.tsx` | P1 | parts関連specが緑 |
| P3 | list行用parts editorを抽出する | `fields/ListRowPartsEditor.tsx` | P2 | list parts関連specが緑 |
| P4 | list editorを抽出する | `fields/ListFieldEditor.tsx` | P3 | list関連specが緑 |
| P5 | track表示を抽出する | `fields/TrackFieldView.tsx` | P1 | track関連specが緑 |
| P6 | field dispatchを抽出する | `fields/FieldRenderer.tsx` | P2、P4、P5 | field関連specが緑 |
| P7 | table layoutを抽出する | `layouts/TableFieldLayout.tsx` | P6 | table関連specが緑 |
| P8 | layout dispatchを抽出する | `layouts/FieldLayout.tsx` | P7 | runtime importが3箇所のまま |
| P9 | 全体検証と文書を閉じる | 検証記録、AI文書更新 | P8 | 全ゲートが緑、H/M所見0件 |

## フェーズ詳細

### P0 基線を再取得する

**目的**：リファクタ前の挙動を、実行可能なテスト結果として固定する。

**変更範囲**：production codeは変更しない。

**作業**：必要ならリポジトリルートで`pnpm install --frozen-lockfile`を実行し、既存lockfileを変えずに依存環境を復旧する。

復旧後にfocused spec、typecheck、lintを実行する。

**証跡**：suite数、test数、終了コード、既存失敗の有無を本計画の台帳へ記録する。

**停止条件**：focused specが赤い、lockfile変更が必要になる、または現行コード由来の型エラーを検出した場合はP1へ進まない。

### P1 保存値の読み取りを分離する

**目的**：後続componentが親ファイルのlocal helperへ依存しないようにする。

**許可ファイル**：`TemplateFormRenderer.tsx`、新規`fields/renderer-value.ts`、必要な場合だけ既存spec。

**移動対象**：`isRecord`、`isFiniteNumberInput`、`numberDisplayValue`、`readPartValue`、`hasPartKey`。

**不変条件**：非有限値、配列、`null`、parts形、flat numberの退化規則を変えない。

**完了条件**：helperの実装が1箇所だけになり、focused specが期待値変更なしで通る。

### P2 section用parts editorを抽出する

**目的**：section直下scalarのPopover状態、提示キー、per-key callbackを局所化する。

**許可ファイル**：`TemplateFormRenderer.tsx`、`renderer-value.ts`、新規`fields/PartsEditorPopover.tsx`、既存spec。

**移動対象**：`PartsEditorPopover`、`buildPopoverPartRows`、`handleTriggerKeyDown`、`isNumberScalar`、`isPartsScalarField`。

**不変条件**：`base`常設、`other`読み取り専用、宣言モードとfreeformモード、`width="target"`、キーボード操作を維持する。

**テスト補正**：Popoverのsourceを直接読む既存テストは、新しい所有ファイルを読むようにpathだけを変更する。

**完了条件**：parts関連specが通り、tableとfield rendererは同じ`isPartsScalarField`を利用する。

### P3 list行用parts editorを抽出する

**目的**：list行だけが持つwhole-cell保存境界を、section用parts editorから分離したまま局所化する。

**許可ファイル**：`TemplateFormRenderer.tsx`、`renderer-value.ts`、`PartsEditorPopover.tsx`、新規`fields/ListRowPartsEditor.tsx`、既存spec。

**移動対象**：`RowPartsEditor`と、そのcommit処理。

**不変条件**：宣言済み提示可能キーだけを保存し、`base`と`other`を保存せず、空の内訳を`undefined`へ戻す。

**完了条件**：list parts、focus、Enter、Space、Escapeの既存specが通る。

### P4 list editorを抽出する

**目的**：行追加、行削除、セル編集、rowId、行上限を一つのcomponentへ閉じ込める。

**許可ファイル**：`TemplateFormRenderer.tsx`、`renderer-value.ts`、`ListRowPartsEditor.tsx`、新規`fields/ListFieldEditor.tsx`、既存spec。

**移動対象**：`ListFieldEditor`、`renderListItemField`、`commitListNumberInput`、`replaceListRowValue`。

**不変条件**：list全体1 path、itemFieldのuidキー、空セルのキー削除、stable rowId、`LIST_ROW_LIMIT`、非配列の空表示を維持する。

**完了条件**：list関連specが通り、`TemplateFormRenderer.tsx`からlist編集ロジックがなくなる。

### P5 track表示を抽出する

**目的**：trackの値解釈と表示退化を一つのcomponentへ局所化する。

**許可ファイル**：`TemplateFormRenderer.tsx`、`renderer-value.ts`、新規`fields/TrackFieldView.tsx`、既存spec。

**移動対象**：`MAX_TRACK_CHECKBOX_MARKS`、`renderTrackField`、`renderTrackCheckboxes`、`toTrackProgress`。

**不変条件**：未入力は0、不正rawは`—`、maxの3状態、絶対比率、checkbox上限30、装飾Checkboxのtab除外を維持する。

**完了条件**：track関連specが期待値変更なしで通る。

### P6 field dispatchを抽出する

**目的**：field型の分岐、共通警告、振り直し導線、scalar controlを一箇所へ集約する。

**許可ファイル**：`TemplateFormRenderer.tsx`、P1からP5の成果物、新規`fields/FieldRenderer.tsx`、既存spec。

**移動対象**：`renderFieldWithWarning`、`renderCreationRollReroll`、`renderFieldWarning`、`renderDefaultField`、`renderScalarField`、`getFieldLabelProps`。

**不変条件**：`CreationRollReroll`の公開exportは元ファイルに残し、`renderField` override、read-only field、placeholderを維持する。

**分岐規則**：`field.type`を正本にし、registryまたは文字列keyを追加しない。

**完了条件**：field関連specが通り、field固有componentへの依存が`FieldRenderer`から下向きになる。

### P7 table layoutを抽出する

**目的**：通常field列とはDOM構造が異なるtable描画を独立させる。

**許可ファイル**：`TemplateFormRenderer.tsx`、`FieldRenderer.tsx`、`PartsEditorPopover.tsx`、新規`layouts/TableFieldLayout.tsx`、既存spec、既存CSS Moduleのimport。

**移動対象**：table本体、`TableFieldRow`、`buildTablePartColumns`。

**不変条件**：first-seen union、parts:trueの列除外、複雑fieldの全幅降格、行見出し、`labelledBy`、table parts行のoverride例外を維持する。

**完了条件**：table関連specが通り、table描画に一時的なrender callback境界を追加していない。

### P8 layout dispatchを抽出する

**目的**：`stack`と`grid`の共通構造、および`table`への分岐を一箇所へ置く。

**許可ファイル**：`TemplateFormRenderer.tsx`、`TableFieldLayout.tsx`、`FieldRenderer.tsx`、新規`layouts/FieldLayout.tsx`、既存spec、既存CSS Moduleのimport。

**移動対象**：`renderFieldContainer`と、`resolveGridSpan`を使うfield wrapper。

**不変条件**：layoutは`resolveSectionLayout`の結果だけを解釈し、stackとgridを委譲だけの別componentへ分けない。

**完了条件**：`TemplateFormRenderer.tsx`には公開props、section、block、pool、annotation entry構築が残り、runtime importは既存3箇所だけである。

### P9 全体検証と文書を閉じる

**目的**：局所テストだけでは見つからない消費者回帰、重複責務、依存逆転を確認する。

**許可ファイル**：検証で必要と判明した現在フェーズの内部module、本計画、構成方針、`trpg-next-app/AI.md`、状況文書。

**作業**：focused spec、3消費者のspec、front全体のtest、typecheck、lint、buildを実行する。

**構造確認**：同じ述語、値解釈、警告生成、Popover操作が複数moduleへ複製されていないかを検索する。

**完了条件**：HighまたはMediumの未解消所見が0件で、全ゲートが緑になり、台帳とAI文書が実績へ更新される。

## 検証コマンド

各コードフェーズの完了前に次を実行する。

```powershell
pnpm --filter trpg-next-app test -- app/features/characterSheet/TemplateFormRenderer.spec.tsx --runInBand
pnpm --filter trpg-next-app run typecheck
pnpm --filter trpg-next-app run lint
```

P9では3消費者のspecを追加で実行する。

```powershell
pnpm --filter trpg-next-app test -- app/features/characterTemplate/components/CharacterCreationForm.spec.tsx app/features/characterTemplate/components/TemplatePreviewV3.spec.tsx app/features/character/components/CharacterSheetEditClient.spec.tsx --runInBand
```

最後にfront全体を検証する。

```powershell
pnpm --filter trpg-next-app test -- --runInBand
pnpm --filter trpg-next-app run build
```

schema、engine、保存境界は変更禁止範囲である。

それらの変更が必要になった場合は本計画を停止し、sheet-engineのtestとbuildを含む別計画へ切り替える。

## レビューゲート

各フェーズでは、テスト後に次の順で差分を確認する。

1. **挙動維持**：期待値変更、DOM変更、callback payload変更がないか。
2. **認知負荷**：新しい概念、別名、indirection、非局所依存が増えていないか。
3. **局所可読性**：新しいcomponentが一つの変更理由を隠蔽できているか。
4. **変更容易性**：list、parts、track、tableの代表変更が所有module内で完結するか。
5. **リポジトリ整合性**：第三の描画実装、barrel、重複helper、逆向きfeature依存がないか。

P3、P6、P9では、直近の複数フェーズをまとめた大粒度レビューを行う。

大粒度レビューでは、同じ述語と同じ値解釈の実装数を`rg`で数え、意図しない複製があれば次フェーズへ進まない。

## 計画レビュー記録

計画の自己レビューで見つかったMedium所見は3件あり、すべて本文へ反映した。

| ID | 所見 | 対応 |
|---|---|---|
| M-PLAN-1 | tableをpartsとfield dispatchより先に抽出すると、一時的なrender callback境界が必要になる | P2、P6の後へP7を移動した |
| M-PLAN-2 | CSS Moduleを分割すると、複数featureのspec mock変更が抽出へ混ざる | 既存CSS Moduleの共有を明記した |
| M-PLAN-3 | list全体の一括移動はレビュー対象が大きい | 行用parts editorをP3として先に分けた |

残存するHigh所見は0件、Medium所見は0件である。

現セッションでは独立レビュアーを使用していないため、実装時は各フェーズの差分を新しい証跡として再レビューする。

## 進捗台帳

| ID | 状態 | 変更概要 | 検証 | レビュー | 未解消H/M |
|---|---|---|---|---|---:|
| P0 | 完了 | workspace依存リンクをlockfile変更なしで復旧 | focused 1 suite / 150 tests / 1 snapshot、typecheck、lint成功 | 現行挙動を基線化 | 0 |
| P1 | 完了 | 5つの保存値readerを`fields/renderer-value.ts`へ移動 | focused 1 suite / 150 tests / 1 snapshot、typecheck、lint、large-file解析成功 | 挙動差分・重複実装・逆向き依存なし | 0 |
| P2 | 完了 | section用parts editorと4 helperを`fields/PartsEditorPopover.tsx`へ移動 | focused 1 suite / 150 tests / 1 snapshot、typecheck、lint、`git diff --check`成功 | 独立レビュー承認、挙動差分・重複実装・死蔵exportなし | 0 |
| P3 | 完了 | list行用parts editorとwhole-cell commitを`fields/ListRowPartsEditor.tsx`へ移動 | focused 1 suite / 150 tests / 1 snapshot、typecheck、lint、`git diff --check`成功 | 差分・P1〜P3大粒度レビュー承認、挙動差分・重複責務なし | 0 |
| P4 | 完了 | list editorと3 helperを`fields/ListFieldEditor.tsx`へ移動 | focused 1 suite / 150 tests / 1 snapshot、typecheck、lint、`git diff --check`成功 | 独立レビュー承認、挙動差分・重複責務・逆向き依存なし | 0 |
| P5 | 完了 | track表示と3 helperを`fields/TrackFieldView.tsx`へ移動 | focused 1 suite / 150 tests / 1 snapshot、typecheck、lint、`git diff --check`成功 | 独立レビュー承認、挙動差分・重複責務・逆向き依存なし | 0 |
| P6 | 完了 | field dispatch、共通警告、振り直し、scalar controlを`fields/FieldRenderer.tsx`へ移動 | focused 1 suite / 150 tests / 1 snapshot、typecheck、lint、`git diff --check`成功 | 差分・P4〜P6大粒度レビュー承認、挙動差分・重複責務・逆向き依存なし | 0 |
| P7 | 完了 | table本体、行分岐、parts列構築を`layouts/TableFieldLayout.tsx`へ移動 | focused 1 suite / 150 tests / 1 snapshot、typecheck、lint、`git diff --check`成功 | 独立レビュー承認、挙動差分・重複責務・一時callbackなし | 0 |
| P8 | 完了 | layout dispatch、grid span、field wrapperを`layouts/FieldLayout.tsx`へ移動 | focused 1 suite / 150 tests / 1 snapshot、typecheck、lint、`git diff --check`成功 | 独立レビュー承認、挙動差分・重複責務・逆向き依存なし | 0 |
| P9 | 完了 | 全体検証、構造検索、正本文書とhandoffを最終実績へ同期 | focused 150 tests、3消費者90 tests、front全体37 suites / 673 tests / 1 snapshot、typecheck、lint、build、`git diff --check`成功 | 独立2系統の大粒度レビュー承認、文書同期Mを解消 | 0 |

状態は`未着手`、`進行中`、`検証中`、`完了`、`停止`のいずれかで記録する。

各フェーズの完了時に、変更ファイル、実行コマンド、結果、レビュー所見、rollback要否を同じ行または直下の補足へ追記する。

### P0・P1 実施記録（2026-10-12）

- P0では`pnpm install --force --offline --prod=false --frozen-lockfile --optimistic-repeat-install=false`で欠損リンクを再構築した。
- `pnpm-lock.yaml`、package manifest、production codeにP0の差分はない。
- P1では`TemplateFormRenderer.tsx`から`isRecord`、`isFiniteNumberInput`、`numberDisplayValue`、`readPartValue`、`hasPartKey`を移動した。
- 5関数の定義は`fields/renderer-value.ts`の1箇所だけであり、同moduleは外部moduleへ依存しない。
- 公開入口、3つのruntime消費者、props、DOM、ARIA、callback payload、spec期待値は変更していない。
- `pnpm --filter trpg-next-app test -- app/features/characterSheet/TemplateFormRenderer.spec.tsx --runInBand`はP0とP1後の両方で成功した。
- `pnpm --filter trpg-next-app run typecheck`と`pnpm --filter trpg-next-app run lint`もP0とP1後の両方で成功した。
- large-file解析は2ファイルを解析し、既知のfile-size警告1件以外に新しい警告を検出しなかった。
- 認知負荷レビューでは、1回の内部import hopを追加する一方、後続componentが親ファイルのlocal helperを参照する非局所依存を解消した。
- 新しい概念は「表示境界の値reader」1件に限定され、5関数は同じ変更理由を持つため、HighまたはMediumの所見はない。
- rollbackは不要であり、次の実装対象はP2である。

### P2 実施記録（2026-11-01）

- `PartsEditorPopover`、`buildPopoverPartRows`、`handleTriggerKeyDown`、`isNumberScalar`、`isPartsScalarField`を`fields/PartsEditorPopover.tsx`へ移動した。
- `TemplateFormRenderer`の公開props、3つのruntime消費者、DOM、ARIA、data属性、callback payload、spec期待値は変更していない。
- `handleTriggerKeyDown`はP3で同一のEnter・Space・Escape契約を再利用する名前付きexportとし、保存処理やPopover全体は共通化していない。
- sourceを直接確認する既存specは`width="target"`の所有fileだけを読み替えた。
- root独立実行のfocused specは1 suite、150 tests、1 snapshotが成功し、typecheck、lint、`git diff --check`も成功した。
- 独立レビューはapprovedで、High、Medium、Lowの未解消所見は0件だった。
- 対象5定義は新規moduleの各1箇所だけであり、親fileに旧実装、barrel、第三の描画経路、死蔵exportを残していない。
- 認知負荷は、section/table parts変更時の同時保持数が7から5、追跡ホップが4から3へ減少したと判定した。
- rollbackは不要であり、次の実装対象はP3である。

### P3 実施記録（2026-11-01）

- `RowPartsEditor`と内側のwhole-cell `commitPart`を`fields/ListRowPartsEditor.tsx`へ移動し、component名を計画の目標構造に合わせて`ListRowPartsEditor`とした。
- 宣言済み提示可能キーだけを保存し、`base`、`other`、unsafe key、負数を保存せず、空の内訳を`undefined`へ戻す契約を維持した。
- DOM、ARIA、data属性、`width="target"`、`min={0}`、focus、Enter、Space、Escapeの挙動とspec期待値は変更していない。
- P2の`handleTriggerKeyDown`だけを再利用し、section用per-key callback、Popover本体、commit処理は共通化していない。
- `ListFieldEditor`、`renderListItemField`、`commitListNumberInput`、`replaceListRowValue`はP4対象として親fileに残した。
- root独立実行のfocused specは1 suite、150 tests、1 snapshotが成功し、typecheck、lint、`git diff --check`も成功した。
- P3差分レビューとP1〜P3大粒度レビューはいずれもapprovedで、High、Medium、Lowの未解消所見は0件だった。
- 大粒度検索では保存値reader、parts述語、parts提示可否、keyboard handler、list whole-cell commitが各1定義で、内部componentのruntime直接import、barrel、第三の描画経路、死蔵export、逆向き依存は0件だった。
- 認知負荷はlist行parts変更時の同時保持数が10から6へ減少した。追跡ホップは2から3へ増えるが、約80行の状態・DOM・保存契約を隠す判断を持つ境界であり、全体ではreducedと判定した。
- Claude Code CLIが環境に存在せずFableモデルを選択・検証できなかったため、規約上のClaude/Fable二重レビューは未実施である。代わりに実装担当とは別のCodexレビュアー2系統でP3差分とP1〜P3大粒度を独立検収した。
- rollbackは不要である。次の計画フェーズはP4だが、今回の依頼範囲はP2、P3までなので着手しない。

### P4 実施記録（2026-11-01）

- `ListFieldEditor`、`renderListItemField`、`commitListNumberInput`、`replaceListRowValue`を`fields/ListFieldEditor.tsx`へ移動した。
- scalarとtrackだけを列へ出す規則、itemFieldのuidを保存キーにする規則、非配列と非record行の退化、stable rowId、list全体1 pathの通知、空セルのキー削除を維持した。
- number、text、select、boolean、parts形numberの入力契約、DOM、ARIA、data属性、文言、既存CSS Module、spec期待値は変更していない。
- 新規moduleは親の`TemplateFormRendererProps`をimportせず、callback型を局所定義した。barrel、第三のruntime入口、P5のtrack変更は追加していない。
- root独立実行のfocused specは1 suite、150 tests、1 snapshotが成功し、typecheck、lint、`git diff --check`も成功した。
- 独立レビューはapprovedで、High、Medium、Lowの未解消所見は0件だった。対象4定義は新規moduleに各1件、runtime利用は親のfield dispatch 1件だけである。
- 認知負荷はlist変更時の同時保持数が10から9へ減少した。runtimeの追跡ホップは1増えるが、約212行の行編集と保存契約を一つの所有moduleへ局所化する判断を持ち、全体ではreducedと判定した。
- rollbackは不要である。次の実装対象はP5である。

### P5 実施記録（2026-11-01）

- `MAX_TRACK_CHECKBOX_MARKS`、`renderTrackField`、`renderTrackCheckboxes`、`toTrackProgress`を`fields/TrackFieldView.tsx`へ移動し、公開component名を`TrackFieldView`とした。
- 未入力rawだけを0へ退化させ、`null`、非有限flat値、壊れたpartsを`—`にする規則と、maxの`ok`、`indeterminate`、`error`の3状態表示を維持した。
- gaugeの絶対比率と0〜100 clamp、checkboxesの整数max 1〜30、checked数のclamp、負値と超過値の数値表示、装飾Checkboxのtab除外を維持した。
- DOM、ARIA、data属性、文言、既存コメント、spec期待値は変更していない。max未指定時のfallbackと外側のwarning、振り直し、layoutは親に残した。
- root独立実行のfocused specは1 suite、150 tests、1 snapshotが成功し、typecheck、lint、`git diff --check`も成功した。
- P5差分レビューとP4・P5大粒度レビューはいずれもコードapprovedで、High、Medium、Lowの未解消コード所見は0件だった。
- 大粒度検索ではP4・P5のcomponent、helper、定数は各1定義、runtime利用は親のfield dispatch各1件である。barrel、第三の描画入口、親propsへの逆依存、死蔵export、P1からP3の責務複製は0件だった。
- 認知負荷はtrack変更時の同時保持数が6から4へ減少した。親は1,023行から727行となり、listとtrackの所有moduleを合わせた境界導入コストは18行で、総合判定はreducedだった。
- Claude/Opus実行環境がないため規約上のCodex＋Opus二重レビューは実施できず、実装担当とは別のCodexレビュアー2系統によるP5差分レビューとP4・P5大粒度レビューで代替した。
- rollbackは不要である。今回の依頼範囲P4、P5は完了し、P6以降へは進まない。

### P6 実施記録（2026-11-01）

- `renderFieldWithWarning`、`renderCreationRollReroll`、`renderFieldWarning`、`renderDefaultField`、`renderScalarField`、`getFieldLabelProps`を`fields/FieldRenderer.tsx`へ移動し、公開component名を`FieldRenderer`とした。
- `field.type`の7種を明示したexhaustive switchへ整理し、parts editor、既定control、`renderField` override、振り直し、field警告の合成順を維持した。
- `CreationRollReroll`の宣言は新規moduleへ移したが、`TemplateFormRenderer.tsx`から同名でtype re-exportし、既存の公開import pathを維持した。
- DOM、ARIA、data属性、callback payload、read-only field、placeholder、spec期待値は変更していない。内部componentのruntime直接import、registry、barrel、第三の描画入口も追加していない。
- root独立実行のfocused specは1 suite、150 tests、1 snapshotが成功し、typecheck、lint、`git diff --check`も成功した。
- P6差分レビューとP4〜P6大粒度レビューはいずれもapprovedで、High、Mediumの未解消所見は0件だった。
- 大粒度検索ではfield dispatch、警告DOM、parts判定、保存値reader、list、track、振り直し表示の所有者は各1箇所で、内部componentのfeature外直接import、barrel、第三の描画入口、親TS moduleへの逆向き依存は0件だった。
- 認知負荷はfield描画の本質的な6項目を`FieldRenderer`へ局所化し、親のsection、block、pool、table、layout責務を同時に読む必要を除いた。runtimeの追跡hopは1増えるが、約200行の判断を隠す境界であり、総合判定はreducedだった。
- Low所見としてP6時点では`FieldRendererProps`の外部参照が0件だったため、P7で`TableFieldLayout`の型契約として利用し、死蔵exportにしないことを確認する。
- Claude/Opus実行環境がないため規約上のCodex＋Opus二重レビューは実施できず、実装担当とは別のCodexレビュアー2系統によるP6差分レビューとP4〜P6大粒度レビューで代替した。
- rollbackは不要であり、次の実装対象はP7である。

### P7 実施記録（2026-11-01）

- table本体、`TableFieldRow`、`buildTablePartColumns`を`layouts/TableFieldLayout.tsx`へ移動した。
- first-seen union、`parts:true`の列除外、提示不可キー除外、最初の宣言ラベル、parts、parts-total、columns、full-widthの行分岐を維持した。
- 行見出しの`useId`、`scope="row"`、単純fieldだけに渡す`labelledBy`、複雑fieldの全幅降格、parts専用行が`renderField` overrideを経由しない例外を維持した。
- tableの外側にある`fieldContainer`、`data-layout-mode`、`data-grid-columns`はP8対象として親に残し、既存CSS Moduleを共有した。新規CSS Module、registry、barrel、一時的なfield描画callback、第三の描画入口は追加していない。
- P6のLow確認事項だった`FieldRendererProps`は`TableFieldLayout`のcallback型契約として利用し、死蔵exportを解消した。
- DOM、ARIA、data属性、callback payload、spec期待値、3つのruntime消費者は変更していない。
- root独立実行のfocused specは1 suite、150 tests、1 snapshotが成功し、typecheck、lint、`git diff --check`も成功した。
- P7差分レビューとP6・P7全体レビューはいずれもapprovedで、High、Medium、Lowの未解消コード所見は0件だった。
- 検索では`TableFieldLayout`、`TableFieldRow`、`buildTablePartColumns`は各1定義、親からのruntime importは1件、内部componentのfeature外直接import、親TS moduleへの逆向き依存、一時callback、競合するtable実装は0件だった。
- 認知負荷はtable変更時の8つの本質的保持事項を1 moduleへ局所化し、親のsection、block、pool、stack、grid責務を同時に読む必要を除いた。runtimeの追跡hopは1増えるが、214行の列・行判断を隠す境界であり、総合判定はreducedだった。
- rollbackは不要である。今回の依頼範囲P6、P7は完了し、次の計画フェーズP8は未着手である。

### P8 実施記録（2026-11-01）

- `renderFieldContainer`と`resolveGridSpan`を使うfield wrapperを`layouts/FieldLayout.tsx`へ移動した。
- outer container、`data-layout-mode`、`data-grid-columns`、field key、`data-field-uid`、`data-grid-span`、既存CSS Module、table/fieldへのprops転送を維持した。
- `stack`と`grid`を委譲だけの別componentへ分けず、`FieldLayout`が共通経路、table分岐、grid spanを所有する構成にした。
- `TemplateFormRenderer`には公開props、section、block、pool、annotation entry構築を残し、3つのruntime消費者と`CreationRollReroll`の公開import pathは変更していない。
- root独立実行のfocused specは1 suite、150 tests、1 snapshotが成功し、typecheck、lint、`git diff --check`も成功した。
- P8差分の独立レビューはapprovedで、High、Medium、Lowの未解消所見は0件だった。
- 検索ではlayout dispatch、`resolveGridSpan`、layout container data属性のproduction所有者は各1箇所で、旧helper、内部componentのfeature外直接import、barrel、registry、親TS moduleへの逆向き依存は0件だった。
- 認知負荷はgrid wrapper変更時の同時保持数が6から4へ減少した。runtimeの追跡hopは1増えるが、layout分岐、span解決、DOM wrapperを隠す判断を持つ境界であり、総合判定はreducedだった。
- Claude/Opus実行環境がないため規約上のCodex＋Opus二重レビューは未実施である。実装担当とは別のCodexレビュアーで事前Mode Bと実装後Mode Aを検収した。
- rollbackは不要である。次の実装対象はP9の全体検証と文書完了である。

### P9 実施記録（2026-11-01）

- focused specは1 suite、150 tests、1 snapshot、3つのruntime消費者specは3 suites、90 testsが成功した。
- front全体は37 suites、673 tests、1 snapshot、typecheck、lint、Next production buildが成功した。
- 構造検索ではlayout dispatch、field dispatch、parts述語、parts提示可否、保存値reader、keyboard操作、field警告、constraint message構築の所有者が各1箇所だった。
- `TemplateFormRenderer`のruntime直接importは既存3件、feature外から内部field/layout componentへの直接importは0件、barrel、registry、第三の描画入口、親TS moduleへの逆向き依存、死蔵exportは0件だった。
- 小粒度・大粒度の独立Codexレビュー2系統はコードと構造をapprovedとした。初回レビューで検出した文書同期Medium 1件は、本計画、構成方針、`trpg-next-app/AI.md`、`document/SESSION_HANDOFF.md`を最終実績へ更新して解消した。
- Claude/Opus実行環境がないため規約上のCodex＋Opus二重レビューは実施できず、独立Codexレビュアー2系統で認知負荷と挙動・契約・文書整合を分担して代替した。
- 公開入口、3つのruntime消費者、props、DOM、ARIA、data属性、callback payload、spec期待値、schema、保存契約は変更していない。
- HighまたはMediumの未解消所見は0件であり、rollbackは不要である。P0からP9の段階的リファクタを完了とする。

## GoとNo-Goの条件

次の条件をすべて満たした場合だけ、次フェーズへ進む。

- current phaseのfocused spec、typecheck、lintが緑である。
- テスト期待値を変更していない。
- 許可ファイル以外に差分がない。
- 同じ責務の旧実装が残っていない。
- HighまたはMediumの未解消所見が0件である。

次のいずれかに該当した場合はNo-Goとして停止する。

- 公開propsまたは3消費者の変更が必要になる。
- schemaまたは保存契約の変更が必要になる。
- DOM、ARIA、data属性、文言の変更なしにテストを通せない。
- 新しい循環依存または第三の描画経路が生じる。
- 前フェーズの回帰原因を説明できない。

## 完了の定義

完了は、ファイルが分かれたことだけでは判定しない。

次の状態をすべて満たしたときに、このリファクタを完了とする。

- `TemplateFormRenderer`が唯一の公開描画入口である。
- 3つのruntime消費者に変更がない。
- list、parts、track、table、field dispatch、layout dispatchの所有者が一意である。
- 既存の112テスト宣言を含むfocused specが期待値変更なしで通る。
- front全体のtest、typecheck、lint、buildが通る。
- HighまたはMediumの認知負荷所見が0件である。
- `trpg-next-app/AI.md`と本台帳が実装結果へ更新されている。

