 # ダイスロール関連フローまとめ
 
 ## 主要コンポーネント
 - UI作成
   - `DiceUIBuilderService`（スキル/能力/一般ダイスボタン）
   - `ThreadInteractionService`（flexible_dice_ と preset/skill メニュー）
   - `ThreadCreationService`（flexible-dice-param* のパラメータメニュー）
 - 実行ロジック
   - `CharacterDiceOrchestratorService`（ボタンのルーティング）
   - `DiceRollLogicService`（計算 + DB保存 + イベント発行）
   - `DiceOrchestratorService`（モーダル送信後の計算系）
 
 ## メニュー/ボタンの種類
 - `roll*...` 系  
   - スキル/能力/一般ダイスを `CharacterDiceOrchestratorService` が処理
 - `flexible-dice-param*{characterId}`  
   - パラメータ選択 → モーダル → 計算・保存
 - `flexible_dice_{channelId}`  
   - ダイスタイプ選択 → 即時ロール or カスタムモーダル
 
 ## 保存フロー（characterIds）
 - `DiceRollService.createText()` で `DiceRollChannel.characterIds` を `$addToSet` で追加
 - 履歴表示時は `DiceRollChannel.characterIds` を参照し、キャラクター一覧を取得
 
 ## 注意点
 - `flexible_dice_` と `flexible-dice-param*` の2系統が共存
 - UI/ハンドラの対応関係は `document/interaction-registry.md` と併記すると把握しやすい
