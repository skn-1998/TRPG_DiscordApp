# api-response.util.ts — axios error / ErrorEnvelope の低レベル復号（現況）

`app/lib/api-response.util.ts` の正本ノート。責務は「axios-like error と
`@trpg/api-contract` ErrorEnvelope の低レベル復号」で一貫させる（俯瞰#16 で確認済み・
lib 層のため feature への依存は持たない）。

## 住人（2026-08-04 現在）

| export                             | 役割                                                                                      |
| ---------------------------------- | ----------------------------------------------------------------------------------------- |
| `isErrorEnvelope(data)`            | `{success:false, error:string}` 形の型ガード                                              |
| `getResponseStatus(error)`         | axios-like error から `response.status` を取り出す（#61 で route 2本から1本化）           |
| `errorEnvelopeMessages(data)`      | ErrorEnvelope から表示用メッセージ配列を抽出（issues → cause → details → error の優先順） |
| `ApiResponseUtil.handleError(err)` | ErrorEnvelope の `error`（実詳細）を `message`（ラベル）より優先して1文字列で返す         |

- status 別の許可リスト（403/409/422 等）は **presentation policy として各 route が持つ**。
  ここへは統合しない（#61 裁定・俯瞰#16 で再確認）
- UI 文言への分類（`classifyDicePreviewError` 等）は feature 側の責務。全面統合は
  俯瞰#15 で No-Go 裁定済み
- 既知の残件: `getResponseStatus` は typeof 検査がなく `status: "409"`（文字列）を
  宣言 `number | undefined` のまま返す型穴＋spec 不在＋同義ローカル実装が
  `_user.user.character_.$id.sheet.tsx` に1本残存 — Task #82 で解消予定

## 履歴

旧「統合型定義版」システム（`createApiHandler` / `apiClient.postDomain` / `DomainDataMap` /
`app/types/api.ts` の KnownDomains）は S6a（2026-07）で撤去済み。本ファイルは当時その
資料だったが、存在しない API を現行仕様のように記載していたため俯瞰#16（2026-08-04）で
現況版へ全面縮約した。旧資料は git 履歴 `fa532b8` 以前を参照。
