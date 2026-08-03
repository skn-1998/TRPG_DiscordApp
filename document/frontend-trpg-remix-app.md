 # TRPG-Remix-App 現状まとめ
 
 ## 役割と構成
 - Remix v2 + TypeScript
 - UI: Mantine v7
 - 状態管理: Zustand（characterTemplate の store で使用。immer は #70 以降 app 内参照0＝依存整理候補）
 - API: Axios + 統合型定義（`app/types/api.ts`）
 
 ## 最近の変更ポイント
 - mock エディタ / ギャラリーの2ルートは #62 裁定で削除済み（2026-08-04）
   - エディタ / 一覧の正本は V3 server draft（`app/routes/templates.tsx` / `app/routes/templates.$id.edit.tsx`）
 
 ## 設計メモ
 - Feature-based 構成（`features/`）が中心
 - `app/lib/api-client.ts` と `app/lib/api-response.util.ts` が型安全APIの中核
 - **認証ガード規約（#72 裁定・2026-08-04）**: ログイン必須ルートは**各 loader/action での
   インライン検査**（`getJwtFromRequest` → 不在なら `redirect('/login')`・API を叩くなら
   `setServerRequestContext`/`clearServerRequestContext` を try/finally で配線）が正本。
   Remix v2 は client-side transition で子 loader を単独実行するため、親 layout のガードは
   子を守れない（親と子の両方に検査があるのは冗長ではなく必要）。共有 helper は置かない
   （旧 `app/utils/auth-guards.ts` は #60/#72 で削除済み）。
   `_user.user.character.tsx` の soft degrade（redirect せず未認証状態を返す）は既知の
   UX 改善候補で現状維持
 - テストは jest 6 suites / 161 tests（coverage threshold: global 80%）
 
 ## 次にやるべきこと（フロント）
 - エラーハンドリング統一の方針整理
 - API通信の型/エラー処理改善（AI.mdの高優先度項目）
 - テスト基盤の整備（E2E/コンポーネント）
 
 ## 参照ドキュメント
 - `trpg-remix-app/AI.md`
 - `trpg-remix-app/THEME.md`
