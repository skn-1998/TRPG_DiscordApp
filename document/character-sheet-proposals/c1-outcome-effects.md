# 案C1: 結果連動エフェクト（outcome-linked effects）

> **分類**: C系（design-v1 確定後の拡張案。採用時は design-v1 の **v1.x 改版**として取り込む）
> **ステータス**: ドラフト（Claude × Codex R4 討論・2026-07-07 で骨子合意。ユーザー確定待ち）
> **要望の出所**: 「Thread からの実行で SAN/HP/MP の自動減少を行いたい。成功で1d3・失敗で1d6、成功で3ダメージ・失敗で1ダメージのような結果連動。カスタムダイスのモーダル実行や、GM がその場で指定して振らせる形も。ユーザーがめんどくさくない範囲で自動にしたい」

## 一言でいうと

判定ロール → 成功/失敗/クリティカル/ファンブルの分岐 → リソース（SAN/HP/MP）への増減を自動適用 → 取り消し可能、
を **1 つの実行パイプライン**にする。実装の芯は「SAN チェック機能」ではなく
**構造化ロール結果 → outcome 選択 → resource delta 適用 → undo 可能な履歴**（R4 Codex 総括）。
ここを固定すれば CoC の SAN・固定ダメージ・MP 消費・将来の命中/威力表まで同じ線に乗る。

## コアデータモデル（design-v1 palette / FieldRole.rollable の拡張）

```ts
interface RollAction {
  check: string                    // 判定 notation（例 "1d100<={san}"）。正本は BCDice adapter
  outcomes?: Partial<Record<'critical'|'success'|'failure'|'fumble', OutcomeEffect>>
}

interface OutcomeEffect {
  apply?: {
    target: FieldRef               // v1 は self（自キャラ）のリソースのみ
    amount: string | number        // "1d3"（第2ロール自動実行）| 3（固定値）
    sign: 'loss' | 'gain'          // 表示用。書き込み境界では delta: number に正規化して渡す（R4 修正）
  }
  message?: string                 // 演出文（「正気度を失った…」等）
}
```

- **palette には `kind: 'check'` を新設**（`kind: 'roll'` への optional 添付にしない）。
  単純ロールと副作用付き判定は UI・権限・履歴が違うため、種別を分けた方が事故が少ない（R4 決着）。
- `amount` は内部で必ず `resolvedDelta`（number）へ正規化してから書き込み境界に渡す。
  これで SAN 減少・HP 回復・MP 消費を同じ adapter で扱える。

## 実行パイプライン（3 段・すべてアプリ側で分岐）

1. **判定**: `check` を BCDice adapter で実行し、`success/failure/critical/fumble` を**構造化結果**として得る
2. **効果ロール**: 該当 outcome の `amount` がダイス式なら第 2 ロールを実行
3. **適用**: delta へ正規化 → resource 書き込み境界へ

**bcdice のシステム固有コマンド（CoC7 の `SC1d3/1d6` 等）は正本にしない**（R4 決着）。
出力文字列パースを副作用適用の根拠にすると壊れやすい。汎用 2 段ロールを正とする。

## 書き込み境界（R2 合意の具体化）

```
handler / modal → RollActionExecutor（pure service）
                    → ResourceUpdatePort（interface）
                        → LegacyResourceUpdateAdapter（短期: applyDiscordDelta() = values.other へ加算）
                        → SheetMaterializerService（将来: design-v1 §5。中身だけ差し替え）
```

- handler / modal から `status` を直接更新することは**禁止**
- 現行の `applyDiscordDelta()`（`core/types/attribute.types.ts`）が短期 adapter の着地点
- 「ロール実行」「履歴保存」「効果適用」は executor の戻り値で分離し、**履歴の最終保存責務を一箇所に寄せる**
  （`CustomDiceModalService` が既に履歴保存を持つため、executor 側と二重保存しない）

## UX 既定（「めんどくさくない」原則の適用）

| 起動経路 | 適用の既定 | 理由 |
|---|---|---|
| テンプレ/シート定義済みボタン（SAN チェック等） | **自動適用＋取り消しボタン** | 作者が事前に意図を固定済み。プレイ中の摩擦最小 |
| カスタムダイスモーダル | 確認して適用（[適用][スキップ]） | その場入力はミスが混じる |
| GM ad-hoc | 確認して適用 | 対象が他人になり得るため |

表示例: `SANチェック 1d100<=65 → 42 成功 → 喪失 1d3 → 2 ｜ SAN 65 → 63 ✅（取り消し）`

## 安全装置（最小実装・R4 決着）

- `effectApplicationId` を発行し、**同一 ID は一度しか適用できない**（ボタン連打・二重適用対策）
- 適用イベントを履歴に残す（dice-roll 履歴への `appliedEffect` 添付 or 別レコード）
- **undo = 元値復元ではなく逆向き delta の補償適用**。undo も一度だけ
- 楽観ロックは将来 `sheet.revision`（design-v1 §8-14）。短期は refetch ＋ idempotency で代替

## v1 スコープ（thin slice）

- **やる**: self の SAN/HP/MP 相当（現行 `status` セクションの既知キー）のみ・CoC 限定・スレッドボタン起動
- **やらない**: 他キャラへの適用（攻撃→対象 HP 減少）／secret・visibleTo／GM 専用可視性／
  現行 5 セクション語彙への意味論拡張（保存形式は将来形 RollAction に寄せる）
- R2 合意「現行語彙でゲーム意味論を作らない」との整合: **adapter 境界に閉じたパイロットとして妥当**（R4 決着）。
  境界が上記のとおり厳密であることが条件

## GM ad-hoc（設計のみ・実装は M2 以降）

GM がモーダルで（対象キャラ・判定式・成功/失敗時効果・適用先）を指定 → スレッドに
「⚠ GM からの判定要求 [振る]」ボタンが立ち、対象プレイヤーが押す。ワンショットの RollAction を生成（テンプレ非保存）。
**暫定 GM 判定（スレッド作成者・チャンネル管理権限等）は置かない** — 後で権限モデルを壊すため、
campaign thin binding の `gmDiscordUserId`（ロードマップ M1/M2）が入ってから実装する（R4 決着）。

## 先行スライス「Apply Roll Result」（メッセージ右クリック適用・R5 追加）

> ユーザー発案（2026-07-07）。**c1 の起動経路ではなく、`ResourceUpdatePort` の早期価値検証スライスとして独立に切る**（R5 Codex 決着）。
> 判定分岐が不要（値は既にチャットにある）ため **BCDice adapter を待たずに出せる**。RollAction 完成待ちにしない。

- **UX**: ロール結果メッセージを右クリック →「アプリ」→「リソースに適用」→ ephemeral 応答で
  `HP -4 / MP -4 / SAN -4 / ＋に切替 / 変更…`。**既定は減少（loss）**。単一候補キャラなら 2 タップで完了
- **値の解決**: 投稿時に dice-roll 履歴へ `discordMessageId` を保存し、右クリック時に messageId → 履歴 → 構造化 result で逆引き。
  **テキストパースを正本にしない**（R4 原則）。v1 は自 Bot のロール結果限定・`discordMessageId` なしの履歴は適用対象外
- **messageId 保存方式**: 現行主要経路は「履歴保存 → 投稿」の順のため、**履歴保存 → 投稿 → messageId 追記 update** が安全（R5）。
  罠: `DiceRollTextRepository.update()` は textId 指定 → `createText()` の戻り値の textId を保持する／
  index を張るなら partial unique（旧履歴は null）／保存対象は「右クリックされる公開ロール結果メッセージ」の ID のみ。
  中期は `PostedDiceRollService` 的な単一境界へ `roll → post → persist` を一本化
- **対象キャラ解決の優先順**（findByChannelId 単独では不足・R5）:
  ① messageId → DiceRollText.characterId（そのロールを振ったキャラ）→ ② 履歴の discordChannelId 紐付き候補 →
  ③ スレッドなら親チャンネル → ④ 複数候補は select menu → ⑤ 候補なしは「キャラを選択…」
- **権限（v1）**: `character.discordUserId === interaction.user.id` のキャラのみ適用可。
  例外として Discord の管理権限（ManageChannels 等）を暫定 GM 代行にする場合は UI に明示し、campaign GM 概念で置き換える。
  「誰でも誰にでも＋undo」は不採用（荒れやすく監査未整備）
- **適用機構は c1 と共通**: `ResourceUpdatePort` ＋ `effectApplicationId` ＋ 補償 undo。
  同一メッセージへの複数回適用は許可（各適用は独立イベントとして個別 undo 可能）
- **メッセージコマンド枠**: アプリごと最大 5。既に dice-from-context-menu で 1 枠使用 → 「リソースに適用」1 本に集約して 2/5。
  「ダメージ」「回復」の分割はしない（枠温存・将来の「ログに固定」等の候補のため）

## 実装順（R4 合意 → R5 で改訂）

1. design-v1 v1.x として RollAction / OutcomeEffect を文書化（＝本書の取り込み）
2. `ResourceUpdatePort` ＋ `LegacyResourceUpdateAdapter` を切る（ロードマップ S4 の前提と共通）
3. **Apply Roll Result スライス**（右クリック適用。§先行スライス参照。②の検証を兼ねる）
4. **BCDice adapter を前倒し実装**（M4 繰り上げ）— 比較式・gameSystemId・構造化結果。
   ※現行 `DiceRollLogicService.cleanDiceExpression()` は `<=` を通せないため、adapter なしでは判定式が実行不能（既知ブロッカー）
5. `RollActionExecutor` を pure service として実装（判定→outcome→delta の分岐ロジック。ユニットテスト容易）
6. CoC SAN/HP/MP self-only thin slice をスレッドボタンで実装
7. カスタムダイスモーダルへ outcome 欄追加（modal field contract が散っているため急がない）
8. campaign/session ＋ GM 概念の後に GM ad-hoc
9. design-v1 Phase 2 で palette / customId v2 に統合

## 未決事項

- `kind:'check'` の customId 契約（現行契約での暫定 prefix と v2 での形）
- 適用イベントの保存形（dice-roll 履歴への埋め込み vs 別コレクション）→ 実装時に決定
- クリティカル/ファンブルの判定規則をどこが持つか（BCDice の構造化結果に含まれる範囲で開始し、システム固有規則は拡張時に検討）
- 取り消しの権限（本人のみ / GM も可）→ GM 概念導入時に再訪

## 討論記録（R4/R5・2026-07-07）

- **R4** Codex 総評: **条件付き賛成**。独立機構ではなく design-v1 v1.x 拡張とする。
- 決着: (1) v1.x 扱い・kind:'check' 新設 (2) CoC thin slice は境界厳守を条件に妥当 (3) 汎用 2 段ロール採用・SC コマンド不採用
  (4) 自動適用＋undo は賛成だが effectApplicationId 等の安全装置が先・経路別の既定を分ける (5) GM ad-hoc は M2 以降
  (6) 他キャラ適用は v1 反対 (7) 実装順を 8 段に精緻化。
- Codex 追加修正（受諾）: amount の resolvedDelta 正規化／履歴二重保存の回避（executor 戻り値で責務分離）。
- **R5**（ユーザー発案の右クリック適用）: Codex は採用に賛成、「c1 の第4起動経路ではなく ResourceUpdatePort の早期価値検証スライス」
  として独立化を提案（受諾）。実装順に③として挿入。messageId 保存の罠・キャラ解決優先順・self-only 権限・
  メニュー枠 1 本集約（2/5）を決着。「c1 本体より早く『出目がそのままキャラ状態に反映される』体験を出せるので差別化に直結」と評価。
