 # TRPG-Remix-App 現状まとめ
 
 ## 役割と構成
 - Remix v2 + TypeScript
 - UI: Mantine v7
 - 状態管理: React ローカル state のみ（#64-A3 で characterTemplate の Zustand store を全削除。
   zustand / immer は app 内参照0の宣言残り＝依存整理は #79）
 - API: Axios（`app/lib/api-client.ts`）。かつての統合型定義 `app/types/api.ts`
   （KnownDomains/DomainDataMap）は S6 で契約置換済みで現存しない
 
 ## 最近の変更ポイント
 - mock エディタ / ギャラリーの2ルートは #62 裁定で削除済み（2026-08-04）
   - エディタ / 一覧の正本は V3 server draft（`app/routes/templates.tsx` /
     `app/routes/templates_.$id.edit.tsx` — 俯瞰#14 F-2 で un-nest リネーム。
     `templates_.dice-preview.tsx` も同様に un-nest（B4）
 
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
   UX 改善候補で現状維持。
   **例外（俯瞰#14・2026-08-04）**: UI を持たない resource route（fetcher が叩く action 専用
   route。例 `templates_.dice-preview.tsx`）は redirect せず **401 JSON を返す** —
   redirect すると fetcher が HTML（ログイン画面）を受け取り、呼び出し側の
   エラー分類が network 失敗へ誤分類されるため
 - **jwt の受け渡し不変条件（俯瞰#13 CL-1・2026-08-04）**: `setServerRequestContext` は
   module 単位の可変グローバルで、Remix は同一リクエストで複数 loader を並走させ同じ
   グローバルを set/clear する。`prepareConfig` はこれを同期で読むため、**loader/action 内で
   最初の await をまたいだ2本目以降の API 呼び出しは `jwt` を引数で明示する**こと
   （ambient 依存は最初の呼び出しのみ安全）。現行9サイトはすべてこの規則に従っている
 - `_user.user.tsx` の loader は root.tsx と重複して `/users` を1往復し JWT の有効性を
   再検証する（/user/* 配下で計2往復）。意図的な hard gate であり削減は挙動変更になる
 - テストは jest 7 suites / 137 tests（coverage threshold: global 80%・2026-08-04 #75 時点。
   数は増減するため目安）
 
 ## 次にやるべきこと（フロント）
 - エラーハンドリング統一の方針整理
 - API通信の型/エラー処理改善（AI.mdの高優先度項目）
 - テスト基盤の整備（E2E/コンポーネント）
 
 ## 参照ドキュメント
 - `trpg-remix-app/AI.md`
 - `trpg-remix-app/THEME.md`
