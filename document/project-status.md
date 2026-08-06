 # 全体状況サマリ
 
 ## プロジェクト構成
 - **バックエンド**: `TRPG-SERVER`（NestJS + Discord Bot + API）
 - **フロントエンド**: `trpg-next-app`（Next.js 16 App Router + React 19 + Mantine 9。
   旧 `trpg-remix-app` は 2026-08 の Next 移行で撤去・経緯は `document/NEXT_MIGRATION_PLAN.md`）
 
 ## 直近の完了・安定状況（サーバー）
 - TypeScript型安全性 100% 達成（`TRPG-SERVER/AI.md`）
 - イベント駆動アーキテクチャ移行（Phase 3）完了
 - Commands層の統一（BaseCommandService、ErrorHandler、TypedEventService）
 - 循環依存の解消（Events/Discord/Character など）
 - Dice系のUI/履歴ページネーション強化
 
 ## 直近の完了・安定状況（フロント）
 - 統合型定義システム（`app/types/api.ts`）の導入完了
 - APIクライアント/レスポンスの型安全化
 - mock エディタ / ギャラリーの2ルートは #62 裁定で削除済み（2026-08-04）。エディタ / 一覧の正本は V3 server draft（`app/routes/templates.tsx` / `app/routes/templates.$id.edit.tsx`）
 
 ## 進行中の設計変更・移行
 - **Discord Interactions のRegistry方式移行**
   - `interactions.controller.ts` のif分岐を廃止し、`InteractionRegistryService` へ委譲
   - `handlers/` と `registry/` が新設
   - モジュール初期化時にハンドラーを一括登録
 
 ## 注意点（意思決定が必要）
 - `adapters` モジュール復旧の扱い
   - `コメントアウト箇所管理.md` は「復旧計画あり」
   - `adapters復旧必要性分析.md` は「復旧不要」の結論
   - 現在は「代替実装で十分」という評価が優勢
 
 ## 詳細参照先
 - サーバー全体: `TRPG-SERVER/AI.md`
 - サーバー運用/改善: `TRPG-SERVER/AI.development.md`
 - フロント全体: `trpg-next-app/AI.md`
 - インタラクションRegistry: `document/interaction-registry.md`
