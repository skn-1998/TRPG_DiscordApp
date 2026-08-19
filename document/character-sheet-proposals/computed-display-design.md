# web シート画面が computed / roll を表示しない件（調査と設計・2026-08-19）

## 発端

PV-S レーン完了後、ユーザーが実機で「HP / MP / SAN が `-` で表示される」と報告した。
Fable は直前に「ユーザー要求が実データまで通って満たされた」と報告しており、根拠として
HP=12 を挙げていた。その測定は materializer と投影に対するもので、**ユーザーが見ている画面の値ではなかった**。

## 結論（実測）

**PV-S レーンの変更が壊したのではない。web のシート編集画面は computed を一度も表示していない。**

| 実測 | 結果 |
|---|---|
| front が `computedCache` を参照したコミット | **0 件**（`git log -S computedCache -- trpg-next-app`） |
| `—` フォールバックの導入 | `ae9345a7`（キュー #9/#10・U14/U15） |
| コミット `4ec72186` が `TemplateFormRenderer` を触ったか | **触っていない** |

## 機構

`TemplateFormRenderer.tsx:762-771` は computed / roll を読み取り専用の `TextInput` として描き、
`value === undefined` なら `—` を出す。

`CharacterSheetEditClient.tsx:84,87` は `character.sheet!.values`（**保存値**）だけを
`values` state に入れ、それを TFR へ渡す（`:371`）。
一方 server の `SheetMaterializerService.materialize` は
`sheet.values`（保存値）と `computedCache`（評価結果）を**別々のキー**で返す
（`sheet-materializer.service.ts:73-84`）。computed は保存値ではないので `values` に入らない。

したがって computed / roll は常に `undefined` → `—`。

## データはすでに front まで届いている

- `computedCache` は**キャラクター文書に永続化**されている（`character.entity.ts:135`・`character.model.ts:61`）
- 書き込みは作成時（`character-instantiation.service.ts:63`）と保存時（`character-sheet-operation.service.ts:660`）
- repository の select に含まれる（`character.repository.ts:66`）
- wire にも載っている（`CharacterWire.computedCache`・`character.wire.ts:84`）
- シート保存は `revalidatePath` を呼ぶ（`actions.ts:128`）ので、保存のたびに新しい値が props に来る

**不足しているのは画面側の 1 本の配線だけ。**

## 同じ component を使う 2 画面の非対称

`TemplateFormRenderer` の呼び出し元は 2 つある。

| 呼び出し元 | computed の扱い |
|---|---|
| `TemplatePreviewV3`（テンプレートプレビュー） | **ブラウザで `evaluateTemplate` を回し**、評価値を敷いてから編集値で上書き（`:23-29,54-58`）。入力に追従して動く |
| `CharacterSheetEditClient`（実シート編集） | 保存値だけを渡す。computed は `—` |

つまり **engine の評価はブラウザで既に動いており**（`@trpg/sheet-engine` は front バンドルに入っている）、
プレビュー側には「評価値を基底に、編集値で上書きする」という順序の不変条件がコメントで明記されている（`:52-53`）。
実シート編集画面だけがこの仕組みを持っていない。

## roll 型の扱い（2026-08-19 訂正）

**当初この節は「roll 型も同じ穴にある」と書いていたが、それは誤りだった。** 実測による訂正:

`roll` 型は**保存値を持つ**。`rollOnCreateSpec` は roll 型へ無条件で spec を返し
（`packages/sheet-engine/src/roll-on-create.ts:52-54`）、作成時に `values[field.uid]` が書かれる
（`character-instantiation.service.ts:110-122`）。materializer も roll 値を `rollValues` として
`sheet.values` に戻す（`sheet-materializer.service.ts:320,344,385`）。
TFR は key があれば `String(value)` を出すので（`:762-771`）、
**保存値を持つ roll はこの設計の前から表示されていた。**

したがって roll について本設計が変えるのは「**保存値を持たない roll の表示が `—` から
評価値（記法文字列）に変わる**」の 1 点だけ。配布中の `legacy-coc-v2` に roll 型は 0 本なので、
現行の配布データでは観測されない。

`buildComputedCache` が **`computed` 型だけ**を詰める（`sheet-materializer.service.ts:141`）ことは
事実で、案 A の評価根拠としては有効（下記）。

## 選択肢

### A. props の `computedCache` を表示へ配線する

- 変更は front 1 ファイル程度。server・contract は無変更
- 初回表示と保存のたびに**正しい値**（server が評価し、Discord にも出ている値と同一）が出る
- 入力中は追従しない（保存するまで古い値のまま）
- **保存値を持たない roll は `—` のまま残る**（cache に入るのは computed 型だけ）
- 同じ問い（computed をどう出すか）に対して、プレビューの client 評価とは**別の 2 つ目の仕組み**を足すことになる

### B. プレビューと同じ client 評価をシート画面にも持たせる

- 入力に追従して HP が動く。computed が埋まり、**保存値を持たない roll も評価値（記法）で埋まる**
- 2 画面の非対称が消える（1 本化。新しい概念を足すのではなく、既にある仕組みを共有する）
- 評価が例外を投げる経路の扱いが要る（プレビューは try/catch して表示している）
- **中心的な論点**: 画面の値が client 評価、保存・Discord・投影の値が server 評価になる。
  両者が食い違うと画面が嘘をつく。プレビューには server の対応物が無いので divergence が問題にならなかったが、
  実シートでは問題になる

### C. A と B の合成

保存済みの値は `computedCache`（server が正）を出し、未保存の編集がある間だけ client 評価の暫定値を出す。
正しさと追従を両立するが、読み手が「いまどちらを見ているか」を判断する必要が生まれる。

## Fable の推奨

**B を軸に、divergence を検出可能にすることを条件にする。**

理由は 3 つ。

1. **A は roll 型を埋めない。** 同じ `—` が別の理由で残り、次に同じ報告が上がる
2. **A は 2 つ目の仕組みになる。** プレビューは client 評価、シートは server キャッシュという分裂は、
   「computed をどう出すか」という 1 つの知識を 2 箇所に置く。今回の大粒度レビューが
   `TemplateEditorV3` の 35 行複製に対して下した判定と同じ理屈がここにも当たる
3. **入力に追従しないと、ユーザーの元の要求（能力値から HP が導かれる）が画面で確認できない。**
   振り直しボタンを押した直後に HP が動かないのは、この機能の趣旨からして弱い

ただし推奨の前提として、**client 評価と server の `computedCache` が一致することを機械で固定する**必要がある。
具体的には、保存直後（props に新しい `computedCache` が来た時点）で client 評価値と突き合わせ、
食い違ったら開発時に気付ける形にする。一致を仮定して黙って client 値を出す実装は、
`seed-template-needs-runtime-acceptance` と同型の「静かな嘘」を作る。

C は正しさと追従を両立するが、表示の出どころが状態によって変わるぶん読み手の負荷が上がる。
B で divergence を潰せるなら C は要らない。

## 未確認（実装前に測ること）

- `roll` 型フィールドの評価値が TFR の表示に耐える形か（`{type:'dice'}` の `value` が何になるか）
- `toSheetTemplate` が実シート側の entity にもそのまま使えるか（プレビューはテンプレート編集中の entity を渡している）
- 評価が例外を投げる実データが存在するか（非有限値は保存時に 422 で弾かれているはずだが、
  保存を経ずに DB へ入った行は別）
- Discord 側の表示は投影経由なので今回の穴の外にあるはずだが、実機で未確認
