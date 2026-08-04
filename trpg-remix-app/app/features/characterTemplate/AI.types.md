# キャラクターシートテンプレート機能 — 型/DSL 設計

> **正本注記（2026-08-04 更新）**: V3 の DSL/notation 正本は
> `document/character-sheet-proposals/design-v1.md`（RollExpression の二契約を含む）。
> V2 世代の型/DSL 記述は #62-A2〜B4 で撤去済み（全文は git 履歴 `dbd45e5` 以前を参照）。
> 本ファイルは **sheet-engine との境界に関する設計判断の正本**のみを保持する。

## sheet-engine との境界 — ID 規則の複製方針と CJS interop（2026-08-03 / Task#48）

front は `@trpg/sheet-engine`（`type: commonjs`・workspace パッケージ）を**公開 root から
直接 named import** する。**production の**値 consumer は `TemplatePreviewV3`（`evaluateTemplate`）・
`TemplateEditorV3`（`validatePublishTemplate`・`validateStandaloneRollNotations`）・
`utils/dicePreview.ts`（`interpolateNotation`）の3件（2026-08-04 更新・#65 で dicePreview が追加）。
テストは `utils/v3Template.spec.ts` が engine の `SHEET_RESERVED_ID_VALUES` と
front の `RESERVED_IDS` を import するが、bundle には載らない（下記の drift 検出用）。

### ID 規則のリテラルを front に残しているのは意図的

`utils/v3Template.ts` の `FIELD_ID_PATTERN` と `RESERVED_IDS` は engine の規則と同じ内容を
手写ししている。**engine から import する形は実測で却下した**:

- front production が engine の runtime 値を import すると、`TemplateListV3` 経由で
  **テンプレート一覧ルート**が読む共有 chunk に engine と zod が丸ごと載る。
  2026-08-03 の実測で共有 chunk `v3Template-*.js` が gzip **2.4KB → 72.8KB**
  （一覧ルートの実増分 **約 +70KB**）。再測するには front production 側から
  engine の runtime 値を import して `pnpm run build` し、一覧ルートが読む chunk を比べる
- engine の dist は CommonJS なので **tree-shake が効かず**、「定数だけ持ってくる」ができない

DRY の見た目より、一覧ページの初期 JS を優先している。

### drift は等価テストで機械検出する

`utils/v3Template.spec.ts` が、front の `validateLocalTemplate` と engine の
`validatePublishTemplate` が**同じ id 集合に同じ受理/拒絶を返すこと**を検証する。
jest は node 解決で dist を読むため、このテストは**バンドルに一切載らない**。

検出は2段構え:

1. **集合等価 assert** — front の `RESERVED_IDS` と engine の `SHEET_RESERVED_ID_VALUES` を
   sort 済み配列で比較する。予約語集合の差 — engine の増減・front 単独の増減・同数入れ替え —
   を**すべて**捕捉する（変異実測: 4方向とも赤・2026-08-04）
2. **等価テスト** — コーパス「固定標本 ∪ engine 予約語」× section/field で、front と engine が
   同じ id に同じ受理/拒絶を返すことを検証する。集合が一致していても
   **検査の掛け方が壊れる退行**（`FIELD_ID_PATTERN` の緩和など）はこちらだけが検出する

かつて受容していた限界「front だけが予約語を追加する方向は検出できない」は、
**Task #56（集合等価化・2026-08-04）で解消した**。engine 側は予約語の正本が内部 Set
`RESERVED_IDS` に一本化され、公開配列はそこからの導出（`Object.freeze([...RESERVED_IDS])`）。
公開配列の engine 内 runtime 参照は 0 だが、この spec が唯一の consumer なので削除不可
（`publish.ts` の定義直上に導線コメントあり）。

**検証範囲は top-level のみ**。`list.itemFields` / `relation.attrs` のネスト id は
front が検査しておらず engine とは等価でない（**Task #50**）。

### CJS interop の3設定（`vite.config.mjs`）

pnpm の junction が実体パス `packages/sheet-engine/dist` へ解決され、そのパスが
`node_modules` を含まないため Vite の既定変換対象から外れる。この1つの原因に対して
build / dev SSR / client dev の**3パイプラインそれぞれに設定が要る**（1つずつ外して実測済み）。

これを欠くと **committed HEAD に実在した production 欠陥**が再発する。失敗署名（すべて実測）:

- dev SSR: `ReferenceError: exports is not defined`
- build（namespace import 時）: Rollup が `MISSING_EXPORT` warning を出すが **EXIT=0** で成功する。
  production SSR bundle では engine 参照が tree-shake され `void 0`、
  production client chunk には生 CJS が残りブラウザ読込時に `exports is not defined`
- build（named import 時）: `MISSING_EXPORT` エラーで **EXIT=1** — 退行を止められるのはこの経路だけ

**jest（node 解決で dist を読む）・tsc（`.d.ts` を読む）・build（警告どまりで成功）の
3層すべてが構造的に見逃す**ため、CI が全緑のまま出荷される。

`@trpg/*` からの値 namespace import は eslint で禁止している。
設定が退行したとき、named import なら build が止まるが namespace import は止まらないため。
