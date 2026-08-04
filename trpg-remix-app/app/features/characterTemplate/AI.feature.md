# キャラクターシートテンプレート機能 — 現況（V3）

正本: DSL/検証契約は `document/character-sheet-proposals/design-v1.md`（RollExpression の二契約を含む）・
UI は `design-v1-ui.md`・route/認証規約は `document/frontend-trpg-remix-app.md`。
型と engine 境界の設計判断は `AI.types.md`。

## 構成（2026-08-04 時点・実装12ファイル）

- **components**: `TemplateEditorV3`（編集・検証ボタン = engine の
  `validatePublishTemplate`＋`validateStandaloneRollNotations`）・`TemplatePreviewV3`
  （プレビュー・ロールは `useFetcher` → `/templates/dice-preview` → server BCDice）・
  `TemplateListV3`（一覧・V2 localStorage テンプレートの取り込み導線）
- **routes**（feature 外）: `templates.tsx`（一覧・作成）・`templates_.$id.edit.tsx`（編集・
  un-nest。親 `templates.tsx` は Outlet を持たないため）・`templates_.dice-preview.tsx`
  （action 専用 resource route・401 は JSON）
- **api**: `sheetTemplateApi.ts`（型は `types/v3.ts` の手書き定義。`@trpg/api-contract` を
  使うのは dice-preview 系のみ — template API の契約化は未着手）
- **barrel**: `index.ts`（明示 named re-export のみ・`export *` 禁止）
- **utils**: `v3Template.ts`（`toSheetTemplate`・ID 規則・`normalizeTemplateReferences`・
  V2→V3 移行 `isV2LocalTemplate`/`migrateV2TemplateToCreateRequest`）・
  `dicePreview.ts`（ロールの request 組み立て・エラー分類。action エラー形
  `DicePreviewActionError` の生成者は resource route のみ）
- **types**: `v3.ts`（現行型）・`index.ts`（V2 localStorage 形の `Template` — 移行経路専用）

## V2 の撤去記録

V2 式言語スタックは #62/#64/#65 で完全撤去した（2026-08-04・純減で
`60f2379`＝A2 1,534行・`dbd45e5`＝A3 552行（うち死蔵島436行）・B4 411行）。
残る V2 資産は localStorage 取り込み用の `Template` 型と移行関数のみ。
旧設計の全文が必要なら git 履歴（`dbd45e5` 以前の AI.api/AI.security/AI.ui/AI.feature/AI.types）を参照。
