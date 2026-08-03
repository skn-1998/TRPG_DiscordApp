---
name: static-structure-audit
description: >-
  ts-morph 製の静的解析コマンド（static:deps / static:independence / static:duplication）で、
  依存関係・関数の独立性・同型ロジックの重複を「実測」するスキル。
  「依存関係を調べて」「この関数は独立してる？」「pure に切り出せる？」「この export 消せる？」
  「死蔵コードを探して」「同じロジックが何箇所にある？」「静的解析して」
  「リファクタ前に構造を測って」「影響範囲を知りたい」といった依頼で使う。
  cognitive-load-review / review-changeability / refactor-for-testability に渡す
  実測根拠を作るのが役目であり、統合すべきか・消すべきかの判断は行わない。
  循環依存（madge の check:circular）とファイルサイズ（refactor:large-files:analyze）は
  別ツールの担当なので扱わない。
---

# Static Structure Audit

`tools/static-analysis/`（ts-morph 28.0.0）の3コマンドで、コード構造の事実を数える。

## 30 秒メンタルモデル

1. **これは測るスキルであって、判断するスキルではない**。「統合すべき」「削除してよい」は出力しない。
   判断は人間と判断系スキル（cognitive-load-review / review-changeability）が行う
2. コマンドは3本。JSON が stdout に出るだけ。**advisory なので exit code は落ちない**
3. **数値を鵜呑みにしない**。3本とも AST ヒューリスティックで、実測済みの誤検出パターンがある
   （下記「誤検出キャリブレーション」は必読）。所見は必ず現物を開いて裏取りする
4. 循環依存とファイルサイズは**このスキルの担当外**。既存ツールがある

## いつ使うか

- リファクタ・レビューの前に、構造の事実（結合度・重複数・独立性）を集めたい
- 「この関数は切り出せるか」の候補を機械的に絞りたい
- 「同じロジックが何箇所に散っているか」を数えたい（**大粒度認知負荷レビューの実測根拠**）
- 死蔵している export を探したい
- 変更の影響範囲（誰がこの export を使っているか）を知りたい

## いつ使わないか

| やりたいこと | 使うもの |
|---|---|
| 循環依存の検出 | `pnpm --filter trpg-server run check:circular`（madge） |
| ファイル/関数が大きすぎないか | `pnpm --filter trpg-server run refactor:large-files:analyze` |
| 認知負荷そのものの判断 | `cognitive-load-review` |
| 変更容易性・再利用漏れの判断 | `review-changeability` |
| テスト追加の可否判断 | `refactor-for-testability` / `test-expansion` |
| 型エラーの検出 | `tsc` / `pnpm --filter trpg-server run typecheck:test` |

## 3つのコマンド

| コマンド | 出るもの | 答えられる問い |
|---|---|---|
| `static:deps` | ファイル単位の fan-in/fan-out、export シンボル単位の被参照、死蔵候補 | この export は誰が使っている？消せる？このファイルは何に依存している？ |
| `static:independence` | 関数ごとの外部依存の実カウントと pure 判定・DI 依存数 | この関数は切り出せる？テストしやすい？何に依存している？ |
| `static:duplication` | AST 構造ハッシュが一致する関数群 | 同じロジックが何箇所にある？名前が違うコピペはどこ？ |

## 実行

```bash
pnpm run static:deps -- --project TRPG-SERVER/tsconfig.json
```

`static:independence` / `static:duplication` も同じ形。共通オプション:

- `--project <tsconfig.json>` 解析対象（既定は cwd の `tsconfig.json`）
- `--include "src/**/*.ts,..."` tsconfig のファイルリストの代わりに glob を使う
- `--out .tmp/<name>.json` ファイルに書き出す（**`.tmp/` 配下限定**。外は拒否される）
- `--include-generated-at` タイムスタンプを入れる（**既定は null**。付けないほうが差分比較しやすい）
- `--help`

固有オプション: `static:deps` は `--precise`（型チェッカ経由の精密参照解決。動的 `import()` を拾えるが約7倍遅い）、
`static:duplication` は `--min-nodes <count>`（既定 20）。

対象はモノレポのどのパッケージでもよい。`--project trpg-remix-app/tsconfig.json`、
`--project packages/sheet-engine/tsconfig.json` のように差し替える。**リポジトリルートを cwd に保つこと**
（レポート内のパスが cwd 相対のため）。

### 対象 tsconfig の選び方（重要な罠）

`TRPG-SERVER/tsconfig.json` は `src/**/*.spec.ts` を **exclude** している。この tsconfig で死蔵 export を
探すと、**テストからのみ使われる export が死蔵に見える**。

実測（TRPG-SERVER）:

| 対象 | 解析ファイル数 | `reason: null` | 真の死蔵 | export 外しだけ |
|---|---|---|---|---|
| `tsconfig.json` | 364 | 227 | 95 | 132 |
| `tsconfig.spec.json` | 593 | 140 | **61** | 79 |

`tsconfig.json` の「真の死蔵 95件」のうち **34件はテストからのみ使われている**
（spec 側の 61件は prod 側 95件の真部分集合）。grep 裏取りでも、prod 側の上位5件のうち
3件がテスト専用の誤検出だった。

→ **死蔵 export を精査するときは必ず `tsconfig.spec.json` を使う**。
逆に「本番コードだけの結合度」を見たいときは `tsconfig.json` を使う。

## レポートの読み方

### static:deps — `kind: "dependency-static-analysis"`

サマリ: `analyzedFileCount` / `internalEdgeCount` / `externalImportCount` / `exportCount` /
`unusedExportCount` ⊃ `likelyUnusedExportCount`（`reason: null`）⊃ `likelyUnreferencedExportCount`
（`reason: null` かつ同一ファイル内の参照も 0 ＝ **真の死蔵**）。後ろほど強い条件の真部分集合。

`files[]`（ファイル単位）:

- `fanOut` / `fanIn` — リポジトリ内モジュールへの依存数 / 被依存数。`fanOutTypeOnly` / `fanInTypeOnly`
  で型のみの依存を分離できる。**型だけの依存は実行時結合ではない**ので、結合度を語るときは差し引く
- `imports[]` / `importedBy[]` — 相手の実リスト。影響範囲の起点に使う

`exports[]`（シンボル単位）:

- `referenceCount` — **他ファイルからの**参照数。`valueReferenceCount` / `typeOnlyReferenceCount` /
  `namespaceReferenceCount` に分解される
- `sameFileReferenceCount` — 同一ファイル内の参照数（宣言自身を除く）
- `referencedBy[]` — 参照元ファイルの実リスト。**認知負荷レビューのホップ数の根拠**になる
- `typeOnlyUsage` — 値として使われず型位置でのみ使われている

`unusedExports[]`（死蔵候補）— **`reason` の読み分けが要**:

| `reason` | 意味 | 扱い |
|---|---|---|
| `null` | 誤検出源に当たらない | **有力候補**。ただし下記の2種類に分かれる |
| `re-exported-by-another-module` | barrel 経由で転送されている | 転送先を追う必要がある |
| `referenced-only-from-tests` | テストからのみ使われる | 消すとテストが壊れる |
| `framework-decorated` | NestJS デコレータ経由で使われる | DI コンテナが使うので消せない |
| `declared-in-entry-point` | エントリポイントの宣言 | 消せない |

`reason: null` はさらに `sameFileReferenceCount` で二分する:

- `sameFileReferenceCount === 0` → **真の死蔵**。削除候補
- `sameFileReferenceCount >= 1` → 同一ファイル内でのみ使われている。**`export` を外せるだけで、
  削除したら壊れる**

### static:independence — `kind: "function-independence-static-analysis"`

サマリ: `analyzedFunctionCount` / `byIndependence: {pure, near-pure, impure}` /
`byTestabilityGrade: {green, yellow, red}`。

`functions[]` の各エントリは、関数が**自分の引数とローカル以外に触っているもの**を実カウントで持つ:

| フィールド | 意味 |
|---|---|
| `thisAccessCount` | `this.` 参照の回数 |
| `injectedDependencies[]` | 触っている DI 依存の名前（コンストラクタのパラメータプロパティ。基底クラス分も含む） |
| `freeVariableWrites` | 引数・ローカル以外への**書き込み** |
| `capturedVariableReads` | 外側関数スコープの変数、およびモジュールスコープの `let`/`var` の**読み取り** |
| `moduleConstantReads` | モジュールスコープの `const`/`enum`/import の読み取り（**pure を壊さない**扱い） |
| `nondeterministicCalls` | `Date.now()` / 引数なし `new Date()` / `Math.random()` など |
| `ioIndicators` | `console.*` / `process.*` / `fs.*` / `await` など |
| `globalAccess` | `globalThis` / `window` / `document` / `process.env` |
| `importedCallCount` | import したシンボルの呼び出し回数 |

`evidence` に**カテゴリごとの行番号と式テキストが最大3件**入る。所見を書くときは必ずここを引用して、
読み手が現物へ飛べるようにする。

判定3種（すべて advisory）:

- `independence`: `pure`（上記がすべて 0）/ `near-pure`（外部依存が import 呼び出しのみ）/ `impure`
- `extractable`: メソッドが `this` を一切使わない → クラス外の自由関数へ抽出できる
- `testabilityGrade`: `green`（pure / near-pure）/ `yellow`（impure だが DI 依存 2 個以下で
  グローバル・自由変数書き込みなし）/ `red`（それ以外）。`refactor-for-testability` の緑黄赤に対応する

### static:duplication — `kind: "structural-duplication-static-analysis"`

サマリ: `analyzedFunctionCount` / `skippedSmallFunctionCount` / `duplicateGroupCount` /
`duplicatedFunctionCount` / `minNodes`。

`duplicateGroups[]`（`distinctFileCount` 降順 → `occurrenceCount` 降順 → `nodeCount` 降順）:

| フィールド | 読み方 |
|---|---|
| `distinctFileCount` | **何ファイルに散っているか。これが最重要**。同一ファイル内の重複より、複数ファイルに散った重複のほうが問題 |
| `occurrenceCount` | 複製数 |
| `nodeCount` | 本体の AST ノード数。**大きいほど統合価値が高い** |
| `signatureMatch` | 引数型・戻り型の注釈も一致するか。`false` は「構造は同じでも別物」の警告灯 |
| `identicalText` | 空白正規化後のテキストが完全一致（＝素のコピペ） |
| `members[]` | 各複製の `filePath` / `symbolName` / `startLine` / `endLine` |

`symbolName` は3ツール共通の規則で付く（クラスメンバは `Class.method`、`it(...)` のようなコールバックは
呼び出し名 + `(...)`、空白は正規化、120字で切り詰め）。したがって
**`filePath` + `startLine` + `endLine` をキーに independence レポートと結合できる**
（「この重複グループの各メンバーは pure か」を突き合わせられる）。

構造ハッシュは**識別子名とリテラル値を落として**計算されるので、変数名を変えただけのコピペも一致する。
一方で木構造と演算子は残すので、`a + b` と `a - b` は別グループになる。

## 誤検出キャリブレーション（必読）

3本とも実測で誤検出パターンが確認されている。**所見を報告する前に、必ずここを通す**。

### 依存解析

- `reason: null` でも `sameFileReferenceCount >= 1` なら削除できない（`export` を外せるだけ）。
  実例: `core/dto/api-response.dto.ts` の `BaseApiResponse` は同一ファイルの `SuccessResponse` /
  `ErrorResponse` が継承している（`sameFileReferenceCount: 2`）
- `sameFileReferenceCount` は**過大に数える側へ意図的に倒してある**（シャドウされた同名ローカルも数える）。
  「使われている」と誤って言うほうが、使用中の宣言を削除させるより害が小さいため。
  型チェッカとの全件突合せで、危険側（過小カウント）による死蔵の誤判定は 0 件と実測済み
- 既定モードは import 宣言ベースなので、**動的 `import()` 経由の参照が見えない**。
  実例: `src/scripts/backfill-template-pin.ts` の動的 import。疑わしいときは `--precise` を併用する
- リフレクション・文字列経由の参照（NestJS の一部、テンプレート、設定ファイル駆動）は原理的に見えない

### 独立性

| 誤検出 | 実測 | 内容 |
|---|---|---|
| `super` 経由の依存が見えない | pure 11件 | `super.method()` は `this` でも自由変数でもないため全カウンタに掛からない。`extractable` 4件も同じ理由で誤り |
| 中身が変わる module const | pure 3件 | `export const xs: any[] = []` を読む関数。束縛は `const` なので `moduleConstantReads` に落ちるが、他所が `push` している |
| 引数の破壊的変更を見ない | — | `f(acc) { acc.total += 1 }` は pure と出る |
| 同一ファイル内の関数呼び出しを数えない | — | `importedCallCount` は import のみ。同ファイルの impure なヘルパに委譲していても pure と出る |
| `near-pure` は呼び先を追っていない | — | 「import 先が pure なら pure」という条件付きの意味 |

→ **`pure` を「テストが書ける」と読み替えてはいけない**。読書リストを絞る道具として使い、
最終判断は現物を開いて行う。

### 重複

**構造が同型でも統合してはいけないものがある**。実測例（TRPG-SERVER・最大グループ）:

21件が `logger.debug(...)` + `await this.<各Service>.handle(interaction)` の2文だけで一致したが、
委譲先は21個の別サービスで、Registry として意図的に分離されたものだった。
`signatureMatch: false`（引数型が `ButtonInteraction` / `CommandInteraction` などバラバラ）が識別の手がかり。

逆に**真の重複の実例**: `discord/features/diceRoll/adapters/dice-page-{first,last,next,prev}-button.adapter.ts`
の 40 行 `execute` が4ファイルで同型（`nodeCount: 168`, `signatureMatch: true`）。
実差分は `'first'|'next'` のリテラルとエラー文言のみで、変数名も型も同じため **grep では拾えない**。

判定の目安:

- `nodeCount` が大きく `signatureMatch: true` かつ `distinctFileCount >= 3` → 統合価値が高い
- `nodeCount` が小さく `signatureMatch: false` → 定型の薄い委譲。**意図的な分離を疑う**
- `identicalText: true` → 素のコピペ。統合の第一候補

`--min-nodes` の既定 20 は実測に基づく（5〜9 帯は定数を返す getter が数十件一致してノイズ、
40 では真の所見を取りこぼす）。ノイズを減らしたい二次スイープでは 30 を使う。

その他の限界: 関数単位のみ（関数内の一部ブロックは見ない）、完全一致のみ（`if` が1個多いコピペ亜種は
一致しない）、tsconfig をまたげない（server と front に同じヘルパをコピーしていても検出しない）。

## レシピ

### 死蔵コードを探す

```bash
pnpm run static:deps -- --project TRPG-SERVER/tsconfig.spec.json --out .tmp/deps.json
```

`unusedExports[]` から `reason === null && sameFileReferenceCount === 0` を抽出（＝サマリの
`likelyUnreferencedExportCount`。TRPG-SERVER の spec 込みで **61件**）→ **grep で裏取り** →
残ったものが削除候補。

実例: `core/dto/base.dto.ts` の `IdentifiableDto` はリポジトリ全体で定義以外の参照がゼロだった
（AI.md には「基底クラス体系の確立 ✅」として `BaseDto ├── IdentifiableDto` の階層が記載されているが、
実際には誰も継承していない）。

### pure に切り出せる関数を探す

```bash
pnpm run static:independence -- --project TRPG-SERVER/tsconfig.json --out .tmp/ind.json
```

`extractable: true` かつ `testabilityGrade: green` を抽出 → `evidence` で依存を確認 →
`super` を使っていないか目視 → `refactor-for-testability` へ渡す。

### 同一ロジックの複製を探す（大粒度認知負荷レビュー用）

```bash
pnpm run static:duplication -- --project TRPG-SERVER/tsconfig.json --out .tmp/dup.json
```

`distinctFileCount >= 3` かつ `signatureMatch: true` を上から確認 → 各メンバーのソースを開いて
本当に同型か目視 → 統合フェーズの候補にする。`review-changeability` の grep ベース重複スイープと
**両方の指摘が一致した重複は統合確度が高い**。

重複グループのメンバーが pure かどうかも知りたいときは、`filePath` + `startLine` + `endLine` で
independence レポートと結合する（`symbolName` の命名規則は3ツール共通）。

### 変更の影響範囲を測る

`static:deps` の `exports[]` から対象シンボルを引き、`referencedBy[]` を見る。
これが認知負荷レビューのホップ数、変更容易性レビューの波及範囲の実測根拠になる。

## 他の手段との役割分担

| 手段 | 担当 | このスキルとの関係 |
|---|---|---|
| `check:circular`（madge） | ファイル間の循環依存 | **重複しない**。循環はこのスキルでは検出しない |
| `refactor:large-files:analyze` | ファイル/関数のサイズ | **重複しない**。サイズは扱わない |
| `cognitive-load-review` | 認知負荷の判断 | fan-in/fan-out・DI 依存数・重複数を**実測値として供給する** |
| `review-changeability` | 変更容易性・再利用漏れの判断 | 構造ハッシュ重複が grep スイープを**補強する**（名前が違う同型を拾う） |
| `refactor-for-testability` | pure 抽出の設計判断 | `extractable` / `testabilityGrade` が**候補リストを供給する** |
| `test-expansion` | テスト拡充の優先順位 | 緑黄赤の機械判定を供給する |

## やらないこと

- 「統合すべき」「削除してよい」という判断の出力。**候補を出すところまでが役目**
- 循環依存の検出、ファイルサイズ警告（既存ツールの担当）
- レイヤー境界ルールの違反判定（実測値を出すだけ）
- 自動リファクタ・コード修正の適用
- 閾値超過でのビルド失敗（advisory に徹する。CI ゲート化はしていない）
- 裏取りなしでの所見報告。**ヒューリスティックの出力をそのまま結論にしない**
