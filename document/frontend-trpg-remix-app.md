 # TRPG-Remix-App 現状まとめ
 
 ## 役割と構成
 - Remix v2 + TypeScript
 - UI: Mantine v7
 - 状態管理: Zustand + Immer
 - API: Axios + 統合型定義（`app/types/api.ts`）
 
 ## 最近の変更ポイント
 - テンプレートエディタ画面のUI追加  
   - `app/routes/mock.template-editor.tsx`
   - `Editor` と `Preview` をタブ切り替えで表示
 
 ## 設計メモ
 - Feature-based 構成（`features/`）が中心
 - `app/lib/api-client.ts` と `app/lib/api-response.util.ts` が型安全APIの中核
 - テストは未実装・計画段階
 
 ## 次にやるべきこと（フロント）
 - エラーハンドリング統一の方針整理
 - API通信の型/エラー処理改善（AI.mdの高優先度項目）
 - テスト基盤の整備（E2E/コンポーネント）
 
 ## 参照ドキュメント
 - `trpg-remix-app/AI.md`
 - `trpg-remix-app/THEME.md`
