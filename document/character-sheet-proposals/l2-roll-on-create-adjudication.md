# L-2 裁定資料: rollOnCreate 契約外による作成時ロール不発（実証済み・ユーザー裁定待ち）

作成: 2026-08-08（design-ledger.md §4 L-2 / §6-1 優先 2 の検証タスク成果物）
状態: **疑い → 実証済み**。修正実装は本資料の裁定後（本タスクでは spec と本資料のみ）。

---

## 1. 実測結果（疑いの確定）

再現 spec: `TRPG-SERVER/src/features/character-sheet/services/character-instantiation.legacy-coc.reproduction.spec.ts`

- **3 red / 1 green**（意図した赤）。赤の内訳: ①bcdice 実行 0 回（期待 8 回）②`rollOnCreateResults` 空 ③`sheet.values` に roll 値なし・parameter 投影に `str_roll` 不在。緑の 1 件は「seed の roll 一覧＝spec の期待一覧」の整合ガード（seed から roll を剥がして緑化する改変の防止）。
- **感度確認済み**: service に (c) 案相当の 1 行（`type === 'roll'` → `notation` を返す）を仮当てすると 4/4 緑 → 即時撤去（`git diff` ゼロ確認済み）。spec は修正を正しく検出する。
- 期待値は design-v1 の意味論（後述 §2）から導出しており、**(a)(b)(c) いずれの修正でも同じ形で緑になる**（観測面のみを固定・機構非依存）。

### 事実チェーン（全て実コードで確認・2026-08-08）

| # | 事実 | 根拠 |
|---|---|---|
| 1 | instantiation は `field.rollOnCreate` truthy でのみ発火（boolean → `field.notation` / string → その値を notation とする） | `character-instantiation.service.ts:111-120` |
| 2 | `rollOnCreate` は engine 契約に存在しない。`RollField = { type, notation, rerollable? }` | `packages/sheet-engine/src/types.ts:58-62` |
| 3 | publish は roll フィールドを `notation`＋`rerollable?` のみ検証し、未知キーは `.passthrough()` で素通し（検証も拒否もしない） | `packages/sheet-engine/src/publish.ts:77` |
| 4 | legacy-coc seed の 8 roll フィールド（3d6\*5 ×5・(2d6+6)\*5 ×3）は `rollOnCreate` を持たない → **作成時ロール発火 0 件** | `seeds/legacy-coc.template.ts:32-39` |
| 5 | roll 値は作成入力として**提出不可**（`inputSchemaFor` が roll に schema を返さず 422「not an input field (roll)」） | `packages/sheet-engine/src/value-input.ts:112-130` |
| 6 | 作成後の書込も**不可**（`assertWritablePath` は track/scalar のみ = design-v1 §8-8「roll 結果は事後編集不可」の実装） | `character-sheet-operation.service.ts:487-499` |
| 7 | ⇒ **作成時ロールが唯一の値供給経路**。不発時は materialize が黙って成功し、roll フィールドは投影から静かに脱落（値なし roll はスキップ）。**修復経路なしの永久欠落** | `sheet-materializer.service.ts:179` |
| 8 | 既存 spec は `rollOnCreate: true` を持つ**合成テンプレのみ**で検証 → 配線ギャップが未検出だった | `character-instantiation.service.spec.ts:30, :275` |
| 9 | `/sheet-rolls`（U2 署名付き roll proof）は未実装 → Web 側から roll 値を入れる代替経路もない | `grep sheet-rolls TRPG-SERVER/src` = 0 件 |
| 10 | characterization spec は scalar のみに値を与え、roll 無値のまま materialize する現行挙動を凍結（本件の修正で期待値は変わらない = 書き換え禁止と両立） | `__characterization__/legacy-coc-materialization.characterization.spec.ts:31-44` |

### 影響範囲の限定

- 本番 DB はシートテンプレ 0 件・materialized キャラ 0 件（台帳 §0）→ **既存データ被害ゼロ**。legacy-coc の DB seeder も未実装（L-13）で実運用発火実績なし。
- ただし Phase 3 の `/create-character`（G3-5: 「既定値＋rollOnCreate（サーバーロール）で即作成」）はこの経路に直結しており、**D-3 受入前に封鎖すべき**という台帳の位置づけどおり。

---

## 2. 設計正本の意味論（裁定の判断材料）

- **design-v1 L76**: `RollField // 作成時ロール（bcdice 記法）。再ロール可否` — schema v3 では **RollField という型そのものが「作成時ロール」**。フィールドプロパティとしての rollOnCreate は採用設計に存在しない。
- **語の系譜**: `rollOnCreate?: string` は棄却・吸収された旧案の語彙（a1 の AttributeValue 拡張・a4 の StatBlock）。design-v1 では**処理工程名**として残存（§5 の instantiation 工程・OP-3 供給側保証「rollOnCreate（server 実行）」）。server 実装の boolean|string ハイブリッドは pre-v3 案の残渣。
- **design-v1 §8-7**: itemFields 内 RollField は publish 拒否（「行追加時に自動ロール」は将来拡張）— top-level RollField が作成時に振られる前提の裏返し。
- **design-v1-ui**: 作成ウィザードは「🎲 振る」＋セクション一括ロール（U2 proof・未実装）、Discord は「既定値＋rollOnCreate（サーバーロール）で即作成」。
- **AI.character.md 追記6**: Phase 1 レビューで「rollOnCreate が『3d6\*5』の ×5 を落とし能力値 1/5 で保存される実バグ」を修正済み — 作成時ロールが機能する前提は当初からあった（が、合成テンプレでのみ検証されていた）。
- **台帳 §2-1**: publish 検証は 1 系統（PORT→SheetEngineTemplateValidationService→publish.ts）。§1-4: field 直下未知キーの単独拒絶は不採用（passthrough 設計）。

---

## 3. 三案比較

| 観点 | (a) rollOnCreate を正式契約へ昇格 | (b) seed に rollOnCreate 付与 | (c) roll 型は常に作成時ロール |
|---|---|---|---|
| 変更箇所 | engine 型＋publish zod＋server＋seed（**a 単独では不発のまま。seed 付与=b を内包**） | seed 1 ファイルのみ | server 1 メソッド＋合成 spec 2 箇所の整理 |
| design-v1 との整合 | ✕ 採用設計に無い概念の新設。「RollField=作成時ロール」と二重帳簿化 | ✕ 契約外依存を「正」として固定 | **◎ 意味論と実装が一致** |
| 「rollOnCreate 無し roll」の扱い | 値供給経路ゼロの永久空フィールドを**仕様として合法化**（L-2 の病巣を温存） | 同左（他テンプレで再発） | 存在しなくなる（「振らない見せ札」は scalar＋rollable role が正イディオム。seed の scalar 側が実例） |
| 一般解性（エディタ産テンプレ） | ○ ただしエディタに rollOnCreate UI 追加が必要（V3EditorFieldType 拡張） | ✕ **エディタ産 roll は引き続き不発**（再発を放置する局所治療） | ◎ 追加 UI なしで全テンプレに効く |
| publish 1 系統不変条件（台帳 §2-1） | 触れる（1 系統内で完結するので違反ではないが、zod・型・spec の増分） | 触れない | **触れない（engine/publish 変更ゼロ）** |
| 型健全性 | ○ 正式型になる | ✕ `SheetField[]` に型エラー → seed に as キャストが要る（型検査から脱落） | ○ 契約外参照そのものを削除 |
| 追加裁定の要否 | boolean/string の二形態・track への波及（TrackField.rollOnCreate?）で契約肥大 | なし | track の作成時ロール廃止の可否（§4） |
| 工数 | 中 | 極小（ただし負債固定） | 小 |

---

## 4. 推奨: (c) を主、(a) は将来需要が実証されたら v1.x で再検討

**理由**: 意味論一致（design-v1 L76 をそのまま実装に写す）・一般解（エディタ産テンプレにも効く）・publish 1 系統と characterization に無風・最小工数。「作成時に振らない roll」の需要が将来実証されたときに opt-out フラグとして (a) を v1.x 拡張する道は塞がれない。

### (c) 採用時の付帯裁定事項（ユーザー確認が必要）

1. **track の作成時ロール廃止の可否**: 現在 `rollOnCreate: true`＋契約外 `notation` を持つ **track** の合成 spec（`character-instantiation.service.spec.ts:257-296`「rollOnCreate 付き track の dice 結果が範囲外なら 422」）だけがこの挙動の存在証明。エディタで作れず・実在テンプレゼロ・engine 契約外なので**実害ゼロで廃止可能**だが、「track 初期値を dice で決める」ユースケース（HP ロール系システム）の将来表現は未決のまま落とすことになる。廃止なら当該 spec は削除（characterization ではないため書き換え可。TrackRangePolicy の提出値レンジ検査は `:298-316` の別 spec が引き続き担保）。
2. **提出値との競合**: 裁定不要の確認事項 — roll 値は提出不可（§1 事実 5）のため「常時ロール」が提出値を上書きする競合は**構造的に発生しない**。
3. **rerollable の扱い**: どの経路にも実装が無く (c) でも不変（Phase 3 UI の領分）。

### 実装スケッチ（裁定後・参考）

- `rollOnCreateNotation` を「`field.type === 'roll'` → `field.notation` を返す。それ以外は undefined」へ置換（契約外 `rollOnCreate` 参照を削除）。
- 合成 spec の整理: `:24-32` の roll フィールドから `rollOnCreate: true` を除去（挙動同一になるため）。`:257-296` は付帯裁定 1 に従い削除 or 残置。
- 再現 spec（本タスク作成分）が 4/4 緑になることを確認。characterization・golden fixture は無変更のまま緑であること。
- design-ledger.md L-2 行を「実証済み・封鎖済み」へ更新。

---

## 5. 検収記録（本タスク時点）

- `pnpm build` / `pnpm run check:circular` は本タスクの検収コマンド実行結果を親セッション報告に記載。
- 再現 spec は**裁定まで意図的に赤**（3 red / 1 green）。CI・マージ判断ではこの赤を「L-2 未裁定」のマーカーとして扱うこと。characterization spec・golden fixture の期待値は一切変更していない。
