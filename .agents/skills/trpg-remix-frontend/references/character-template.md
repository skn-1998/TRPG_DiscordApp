# Character Template Feature

`trpg-remix-app/app/features/characterTemplate` を触るときに読む。詳細の正本は
同ディレクトリの `AI.feature.md`（現況・構成）と `AI.types.md`（sheet-engine 境界）、
DSL/検証契約は `document/character-sheet-proposals/design-v1.md`、UI は `design-v1-ui.md`、
route/認証規約は `document/frontend-trpg-remix-app.md`。

## 現況（V3・2026-08-04）

- 正本はサーバー draft（`schemaVersion: 3`）。V2（localStorage 正・mock routes）は
  #62/#64/#65 で撤去済み。残る V2 資産は localStorage 取り込み用の `Template` 型と
  移行関数（`isV2LocalTemplate` / `migrateV2TemplateToCreateRequest`）のみ
- routes: `templates.tsx`（一覧・作成）・`templates_.$id.edit.tsx`（編集・un-nest）・
  `templates_.dice-preview.tsx`（action 専用 resource route・未認証は 401 JSON）
- 検証は engine（`@trpg/sheet-engine` の `validatePublishTemplate`＋
  `validateStandaloneRollNotations`・publish 段の静的検査）
- ロール実行は server BCDice（`POST /dice-roll/preview`）。front に乱数実行はない
- notation の契約（NotationFragment ⇄ StandaloneRollExpression の二契約）は
  design-v1.md §2.1 が正本

## 守ること

- engine からの import は公開 root（`@trpg/sheet-engine`）の named import のみ
  （namespace import は eslint で禁止・理由と CJS interop の3設定は `AI.types.md`）
- ID 規則リテラル（`FIELD_ID_PATTERN` / `RESERVED_IDS`）の front 手写しは意図的
  （bundle サイズ実測による裁定・drift は `v3Template.spec.ts` の等価テストが検出）
- barrel（`index.ts`）は明示 named re-export のみ。`export *` を足さない
- ユーザー入力由来の表示（label 等）を HTML として展開しない・`eval` を使わない

旧 V2 設計（mock routes・`[NdM]` roller・依存グラフ・12カラム layout）の全文が必要なら
git 履歴 `dbd45e5` 以前の AI.api/AI.security/AI.ui/AI.feature/AI.types を参照。
