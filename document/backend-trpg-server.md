 # TRPG-SERVER 現状まとめ
 
 ## 役割と構成
 - Discord Bot + Web API（NestJS）
 - ドメイン: `auth`, `character`, `user`, `dice-roll`, `discord`
 - TypedEventService を軸にしたイベント駆動設計
 
 ## 主要アーキテクチャの状態
 - Commands層統一、ErrorHandler統一、DTO標準化は完了
 - 循環依存は主要箇所で解消済み
 - Discord Interactionsは **Registry方式** に移行中（詳細: `document/interaction-registry.md`）
 
 ## 最近の変更ポイント（実装観点）
 - `interactions.controller.ts` がRegistryルーティングに移行
 - `interactions.module.ts` でハンドラーを一括登録
 - ダイス履歴ページネーションがキャラクター選択対応（キャッシュ + event-driven fetch）
 - フレキシブルダイス用UIとハンドラーが両系統で存在
   - `flexible-dice-param*`（パラメータ選択 → モーダル）
   - `flexible_dice_`（ダイスタイプ選択 → 即時ロール or モーダル）
 
 ## 既知の注意点
 - `postFlexibleDiceMenu-flow-analysis.md` は **古い分析** になっている  
   - 現在は `FlexibleDiceSelectHandler` が存在し、`flexible_dice_` を処理可能
 - `CharacterThreadSelectService` にデバッグ用 `console.log("test root")` が残存
 - `TRPG-SERVER/src/discord/interactions/README.md` と `MIGRATION_GUIDE.md` が空
 
 ## 次にやるべきこと（サーバー）
 - Registry移行ドキュメントを埋める（空ファイルの補完）
 - debugログ削除、ドキュメントの最新化
 - `adapters` 復旧方針の最終決定とコメントアウト整理
 
 ## 参照ドキュメント
 - `TRPG-SERVER/AI.md`
 - `TRPG-SERVER/AI.development.md`
 - `TRPG-SERVER/src/discord/AI.discord.md`
 - `TRPG-SERVER/characterThread-dice-roll-functions.md`
 - `TRPG-SERVER/characterIds-usage-path.md`
