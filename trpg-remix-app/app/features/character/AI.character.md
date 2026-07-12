# character feature（front）設計メモ

> **最終更新**: 2026-07-12（初版。Phase 0 再レビュー D-5 で作成）

## 正本ドキュメント

- サーバー側モデル・正準形契約: `TRPG-SERVER/AI.character.md`（AttributeValue 正準形の契約 2026-07-12）
- テンプレート基盤の確定設計: `document/character-sheet-proposals/design-v1.md`（v1.2）・`design-v1-ui.md`
- Phase 2 の操作契約・実施計画: `document/character-sheet-proposals/phase2-*.md`
- 旧 Phase 0 の処置: `document/phase0-character-sheet-review.md`

## 現状と方針（2026-07-12 ユーザー決定）

- **legacy Web 作成（CharacterCreate 経由）は廃止**（U-1）。壊れていた（characterId 未発行で
  HTTP create が拒否）ため修復せず撤去し、作成導線はテンプレ経由（Phase 2 PH-5b:
  /templates → 作成 → OP-3 `createMaterializedCharacter`）へ再設計する。
- **/character と /user/character の二重導線は解消**（U-2）。/user/character（実 API 一覧）を正とする。
- 一覧・編集の型は `@trpg/sheet-engine` 共有型と summary API（templateVersion / hub.status 付き）に追従する。
