# 機能ロードマップ討論 2026-07-06（Claude × Codex 3ラウンド）

> **目的**: 「Discord で TRPG を完結しやすくする機能」と「既存 UI の改善」を、Claude と Codex の
> 3 ラウンド討論（R1=提案出し・R2=争点収束・R3=差別化）で優先度付けした記録。通話しながらのプレイが前提（Discord Activity も視野）。
> **性格**: 案・優先度の合意記録であり実装計画ではない。着手時は各スライスで別途計画する。
> **関連**: [character-sheet-proposals/design-v1.md](character-sheet-proposals/design-v1.md)（確定済みのシートテンプレート基盤。本討論はこれと衝突しない順序で整理した）
> **討論方式**: Codex CLI（session `019f36f6-966e-7853-9d8a-0b7674b1c70b`）。R1=現状調査＋提案出し、R2=争点5件の収束。コード変更なし。

---

## 合意ロードマップ

### 短期（すぐ着手可・低コスト）

| # | 項目 | 備考 |
|---|------|------|
| S1 | **Web キャラ一覧の実データ化＋API パス修正** | 確認済みバグ: `character.service.ts` の get/update/delete が `/characters/:id`（複数形）を叩くがバックエンドは `/character/:id`。一覧 route は `mockCharacters` のまま。→ 別タスク化済み |
| S2 | **自分だけ見えるロール（ephemeral）** | `/d` やカスタムダイスに `private` オプション追加程度。履歴は保存しないか公開履歴に出さない。※「GMだけ見える」は中期（GM概念が前提） |
| S3 | **スレッド UI 再編の前倒し分** | 範囲は「見せ方・選び方」まで: スレッド先頭の固定/ピン留め・お気に入りロール・表示順・20個切り詰め→select/page フォールバック・配置変更。**現行 customId 契約のまま**。ゲーム意味論（SAN減算等）と customId v2 の先取りは禁止（design-v1 Phase 2/3 と衝突するため） |
| S4 | **HP/SAN ±ボタン（条件付き）** | handler が `status.san` を直接知る形は不可。「legacy resource update adapter」の薄い更新口を切ってから実装し、将来 `SheetMaterializerService` 経由（design-v1 §5）へ中身だけ差し替える。境界を切れないなら中期へ送る |
| S5 | **セットアップ Wizard 簡易版** | サーバー選択→カテゴリ/チャンネル作成→キャラ投稿→スレッド作成の一括化。既存 API（guild 一覧・チャンネル作成・キャラ投稿）の組み合わせで実装可能。**R3 改訂: 「サーバーを常設卓化する」導線として設計・命名する**（単発セッション準備ではなくキャンペーン開設の入口） |

### 中期

| # | 項目 | 備考 |
|---|------|------|
| M1 | **キャンペーン thin binding**（R3 で session から改訂） | フルドメイン（シーン/タグ/検索）にしない。design-v1 持ち越しの「GM/セッション権限モデル」未決を解消する足場。単位は `Campaign`（サーバー内常設卓: ロスター・GM・テンプレート・チャンネル群・アーカイブ）→ `Session`（1回分の開催: 日付・ログ・参加キャラ）→ `SceneThread`（後から追加）。モデル/API 案は下記（Campaign に読み替え） |
| M2 | **GM 概念＋GM シークレットロール** | 履歴に `visibility: public/owner/gm`＋`rolledByDiscordUserId`。「プレイヤーが振って GM だけ見る」は ephemeral では不可（実行者向けのため）→ GM 専用スレッド/チャンネルで実現。既存 `DiceRollText.isSecret` は GM 可視性の表現には不足 → 別フィールドとして扱う |
| M3 | **ダイス履歴のセッションスコープ化＋エクスポート** | セッション単位の検索・リプレイ/ログ出力。M1 が前提 |
| M4 | **bcdice adapter 導入** | design-v1 でロール正本は bcdice と確定済み。前倒しで入れると多システム記法が即サポートされ、Phase 2 の下準備にもなる |
| M5 | **汎用手番/スポットライトトラッカー**（R3 で改訂） | Avrae 型の D&D 特化イニシアチブ再現はしない（正面競合で不利）。「次は誰・待機中・対応済み・期限・GMに戻す・次へボタン」の汎用進行トラッカーとして作り、戦闘にも非同期シーン進行にも使う（差別化軸4に乗せる）。campaign の optional module |
| M6 | **Discord Activity: 認証/Proxy 検証＋読み取り専用ダッシュボード MVP** | thin campaign 成立後に価値検証できるため長期から繰り上げ（Codex 提案）。制約は下記 |
| M7 | **非同期プレイ支援**（R3 で新規追加） | 手番/スポットライト通知・シーンスレッド作成・「次に返す人」表示・セッションまとめ/前回のあらすじ・ログ自動アーカイブ。PbP/ゆるオンセは既存 VTT の空白地帯（差別化軸4） |

### 長期

- Activity の操作盤化（ロール実行・±操作）
- design-v1 の schema v3 / sheet-engine / palette 統合（Phase 1〜4 は design-v1 §7 が正本）
- customId v2（`roll_{channelId}_{key}`）への本移行
- SAN 自動減算・命中/威力表などの本格ゲーム意味論（**現行 5 セクション語彙では作らない**。palette＋bcdice 上で実装）
- 公開テンプレート/ギャラリー/権限モデル拡張（design-v1 Phase 4）

---

## セッション thin binding の MVP 形（Codex 案・R2 合意）

モデル: `sessionId / guildId / name / categoryId? / mainTextChannelId? / diceChannelId? / voiceChannelId? / gmDiscordUserId / participantCharacterIds[] / diceScopeChannelIds[] / status(active|archived) / createdByDiscordUserId / createdAt / updatedAt`

API: `POST /sessions`・`GET /sessions?guildId=`・`GET /sessions/by-channel/:channelId`・`GET /sessions/:sessionId`・`PATCH /sessions/:sessionId/channels`・`PUT|DELETE /sessions/:sessionId/characters/:characterId`・`POST /sessions/:sessionId/archive`

権限は最小: GM のみ mutation・参加者 read。`visibleTo` の複雑化はしない（design-v1 §8-11 の解禁条件と整合）。

## Discord Activity の既知制約（R2 で確認）

- 全 traffic が Discord Proxy 経由・外部 URL は URL Mapping 必須・WebRTC 非対応（公式 docs）
- Activity iframe の cookie は `SameSite=None; Partitioned` が必要
- 既存フロントの壊れやすい箇所: `api-client.ts` の `withCredentials: true` 前提／`document.cookie` から JWT を読む実装（そもそも保存側 `auth.service.ts` は `httpOnly: true` なので **ブラウザ JS から読めない＝現状でも潜在的不整合**。Activity 以前に一度整理が必要）
- リアルタイム同期は polling → SSE → WebSocket の順で段階検証。MVP は polling で十分

## 差別化方針（R3 討論で合意）

### ポジショニング

**「Discord-native campaign workspace」— VTT（ココフォリア等）と盤面・BGM・演出では戦わない。
Discord サーバー自体を常設の TRPG 卓にする運営基盤を取りに行く。**

- ココフォリア系は「セッション用の使い捨て部屋」モデル。Discord は「人間関係と会話が残る場所」。この構造差が土台
- 他 VTT との**併用を許容**する（「VTT ではない」と言い切らない）。ただしキャラ・ダイス・ログ・進行管理は Discord 側に残す
- ココフォリアの部屋を置き換えるのではなく、その外側にある「卓の生活空間」を取る

キャッチコピー候補（北極星）:
1. 「Discordサーバーを、そのまま常設TRPG卓に。」
2. 「キャラもダイスもログも、卓はDiscordに残る。」
3. 「テンプレを配れば、卓の操作盤まで届く。」

### 差別化軸の強弱評価（Claude 提示 → Codex 合意）

| 軸 | 評価 | 理由 |
|---|---|---|
| 軸2 常設コミュニティ卓 | **最強** | Discord サーバー構造に乗るため、部屋モデルの VTT が後追いしにくい |
| 軸5 テンプレート＝卓UI配布 | **最強** | design-v1 の palette 実現で「テンプレを入れたら Discord スレッドの操作盤まで生える」。キャラシサイトにも VTT にもない配布物 |
| 軸4 非同期・テキストセッション | 強い | スレッド＋通知に自然に乗る。PbP/ゆるオンセは既存 VTT の空白地帯 |
| 軸6 ログの資産化 | 強い | 会話・ダイス・セッション単位がサーバーに残る。リプレイ出力まで行くと刺さる |
| 軸1 二画面問題の解消 | 中 | 需要は大きいが、ココフォリアが Activity を出せば一部模倣される。単独では防御力が弱い |
| 軸3 三種ツール統合 | 中〜弱 | 「全部入り」を狙うと重い。軸5 と結びついた時だけ強い |

### 差別化観点で「やらないこと」

盤面・BGM・カットイン・重い戦闘自動化・Avrae 型 D&D 特化イニシアチブの再現。

### 競争リスクへの耐性

- **ココフォリアが Activity 版を出す** → 防御力は Activity ではなく「常設サーバー資産」（キャンペーン・ロスター・テンプレート・履歴・シーンスレッド）に置く。Activity は入口にすぎない
- **Discord API/料金政策変更** → Discord 依存を UI/通知/入口に閉じ、正本データは自前 DB。Bot/Activity/Web の 3 入口を維持し、最悪 Web/PWA で読み書きできる状態を保つ
- **BCDice bot で十分という層** → ダイス単体では勝たない（勝つ必要もない）。BCDice は正本エンジンとして採用し、「誰が・どのキャラで・どのシーンで・どのテンプレ由来のボタンを押したか」の文脈化で勝つ
- **Avrae** → D&D 特化では戦わず、日本語・多システム・テンプレート配布・サーバー常設性で戦う

## 討論の経緯（要約）

- **R1（Codex 初回提案）**: セッションハブ／Activity ダッシュボード／スレッド UI 再編／Web 実データ化＋パス不整合（実バグ発見）／履歴のセッションログ化／user-dice Web 編集／プリセット本格化／Wizard の 8 案。
- **R2（争点収束）**: Claude 案に大筋賛成、修正 3 点 — (1) スレッド UI 前倒しは「見せ方・選び方」で止める、(2) HP/SAN± は更新境界（legacy resource update adapter）を先に切る条件付き、(3) Activity 読み取り専用 MVP は長期→中期後半へ繰り上げ。シークレットロールの 2 段階分割（ephemeral 短期／GM visibility 中期）と thin binding 案は Codex も賛成。
- **不採用/保留**: プリセット本格ルールの現行語彙での作り込み（棚卸し#2 の実装候補 2 は design-v1 経由に置き換え）、user-dice Web 編集は palette/user-dice 名前空間統合（design-v1 Phase 3）と合流させるため単独では急がない。
- **R3（差別化）**: ポジショニング「Discord-native campaign workspace」で合意。軸2（常設卓）・軸5（テンプレ配布）を最強と評価。session→campaign thin binding へ改訂、非同期プレイ支援（M7）を新規追加、イニシアチブは汎用手番トラッカーへ一般化、Wizard は「サーバー卓化」導線へ改名。盤面/BGM/カットイン/重い戦闘自動化は明示的に非スコープ化。外部確認: ココフォリア docs / Avrae / BCDice 公式。
- **R4（結果連動エフェクト設計・2026-07-07）**: SAN/HP/MP 自動増減の機構設計を討論し骨子合意 → [character-sheet-proposals/c1-outcome-effects.md](character-sheet-proposals/c1-outcome-effects.md)。S4（±ボタンの adapter 境界）と M4（bcdice adapter）はこの機構の前提として位置づけ直し（実装順は c1 §実装順が正本）。既知ブロッカー: 現行 `cleanDiceExpression()` は `<=` 比較式を通せないため BCDice adapter が先行必須。

## 未決事項

- GM/セッション権限モデルの詳細（M1/M2 の設計時に決める。design-v1 README 未決リストと同期）
- Activity の認証フロー詳細（Embedded App SDK authorize→token と既存 JWT 発行の接続方式）
- 手番トラッカーの発火権限（GM のみか参加者もか）
