# TemplateFormRenderer 段階的リファクタ実装計画

> **分類**：挙動維持リファクタの実行計画
>
> **対象**：`trpg-next-app/app/features/characterSheet/TemplateFormRenderer.tsx`
>
> **設計方針**：[キャラクターシート描画コンポーネントの構成方針](renderer-component-structure.md)
>
> **ステータス**：実装中、P0・P1完了
>
> **最終更新**：2026-10-12

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
| P2 | 未着手 | なし | 未実施 | 未実施 | 0 |
| P3 | 未着手 | なし | 未実施 | 未実施 | 0 |
| P4 | 未着手 | なし | 未実施 | 未実施 | 0 |
| P5 | 未着手 | なし | 未実施 | 未実施 | 0 |
| P6 | 未着手 | なし | 未実施 | 未実施 | 0 |
| P7 | 未着手 | なし | 未実施 | 未実施 | 0 |
| P8 | 未着手 | なし | 未実施 | 未実施 | 0 |
| P9 | 未着手 | なし | 未実施 | 未実施 | 0 |

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

