 # 次にやるべきこと（優先順）
 
 ## 共通
 - `document/` にまとめた情報と既存 `AI*.md` の整合性チェック
 - `TRPG-SERVER/src/discord/interactions/README.md` と `MIGRATION_GUIDE.md` の補完
 
 ## TRPG-SERVER（高優先度）
 - Interactions Registry移行の完成度確認  
   - 旧処理（特例ハンドリング）の整理
   - customId仕様表の一本化
 - debugログの削除  
   - `CharacterThreadSelectService` の `console.log` など
 - Controller層の完全化（`TRPG-SERVER/AI.md` の次期優先）
 
 ## TRPG-SERVER（中優先度）
 - テストカバレッジ向上（43.99% → 60%以上）
 - パフォーマンス最適化（MongoDB/Discord API）
 - セキュリティ強化（JWT/入力値/レート制限）
 
 ## TRPG-SERVER（意思決定が必要）
 - `adapters` モジュールの扱い
   - 復旧しない方針ならコメントアウトや古いドキュメントを整理
   - 復旧する方針なら最小実装から段階的復旧
 
 ## フロント（高優先度）
 - エラーハンドリング統一
 - API通信の型/エラー処理改善
 
 ## フロント（中優先度）
 - テスト基盤の整備（E2E/コンポーネント）
 - Remixローダー/アクションの整理
 
 ## 運用メモ
 - コマンドは `pnpm` を使用（Windows/PowerShell）
