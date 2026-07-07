# 案B2: ドメイン境界設計 — character-sheet ドメイン新設と character 再設計（横断）

> **分類**: B系（横断コンポーネント。A系のどれを選んでも必要）
> **ステータス**: 案出し（未決定）
> **最終更新**: 2026-07-06

## 一言でいうと

テンプレートの正本を新ドメイン **`character-sheet-template`（名称仮）** に置き、
character ドメインは「テンプレートを pin した実データ」の正本であり続けるための境界設計。
依存は一方向（character → character-sheet-template）に固定し、循環ゼロ・イベント RPC 禁止を維持する。

## 新ドメイン: `src/domains/character-sheet-template/`

- 構成は他ドメインと同じ Controller-Service-Repository ＋ Mongoose model ＋ DTO/Zod
- **責務**: テンプレート CRUD・公開状態と版管理（B3）・式/テーブルの構文検証（B1 評価器の検証モード）
- **やらないこと**:
  - discord.js を import しない（UI 生成は discord 層）
  - **character ドメインへ依存しない**（逆依存の禁止が鉄則。「このテンプレートの利用キャラ数」のような
    集計が欲しくなったら、character 側イベントの購読か application 層の合成で解く）
  - ダイス実行・ロール履歴（→ dice 系 / dice-roll ドメイン）
- HTTP: `/sheet-templates` CRUD ＋ `/sheet-templates/:id/publish` 等。
  公開ギャラリーの未認証 read を許すかは要判断（現状 API はほぼ全て JwtAuthGuard 付き）

## character ドメイン再設計（深さは A 案の選択で変わる）

| A案 | character 側の変更 |
|-----|-------------------|
| A1 | `templateId? / templateVersion?` の追加のみ（Phase 0b の既定路線どおり） |
| A2 / A4 | `sheet: { templateId, templateVersion, values }` を**値の正本**とし、**Discord 互換の materialized sections（現行 5 セクション）を保存時に生成して併存**させる 2 段構え |

materialized 併存の意図:

- Discord 経路（`findByChannelId` の projection・`skill_`/`ability_` customId 契約・`applyDiscordDelta`・embed）が
  **移行中も無傷**で動く。S-1 型の projection 事故の再発リスクを最小化する
- 代償は二重表現の同期責務。ルールを固定する:
  - 同期は「sheet.values → sections」の**単方向・保存時のみ**
  - Discord からの増減（±操作）は sections を直接いじらず **sheet.values へ書き戻してから再 materialize**
    （書き戻し先 fieldId の解決は B4 の palette が持つ）

## 守るべき既存不変条件（character ドメイン設計ガイドより）

- `characterId` 不変（update 系の updateData に含めない）
- 新しい書き込み経路は必ず DTO(class-validator) ＋ Zod を通す（DB 層に検証はない）
- **projection 明示列挙の全更新**: モデルに `sheet` 等を足したら、それを返すべき全 `.select(...)` と
  repository spec（select 文字列を exact 固定）を同時更新
- update 2 系統（characterId キー / discordChannelId キー）の意味論を維持
- ドメイン間イベント RPC 禁止（DI 直呼び）。`character.controller.ts` に**新しい discord.\* イベント発行を足さない**
  （Web→Discord 連携トリガーが増えるなら発行箇所は application/feature 層に置く — 既存 2 本は維持するが拡大しない）
- `discordThreadId` / `threadId` の重複疑い 2 フィールドは、この再設計時に統合を検討する好機

## テンプレート→キャラ作成（インスタンス化）のフロー

```
Web (Remix action)
  → POST /character { templateId, templateVersion, 入力値 }
  → application 層（または CharacterService）:
      1. TemplateService から解決済みテンプレートを DI 取得
      2. rollOnCreate をロール（bcdice）
      3. B1 評価器で computed を確定
      4. CharacterService.create（characterId は CharacterIdService が生成）
      5. materialized sections / roll palette（B4）を生成して保存
```

- template ドメインは「解決済みテンプレートを返す」まで。**キャラ作成の知識を持たせない**
- Discord 側からのテンプレート選択作成（将来）は discord/features → 同じ application ユースケースを DI で呼ぶ

## 移行戦略（既存キャラを壊さない）

1. 現行の暗黙 CoC シート構造を「**legacy テンプレート**」として定義し同梱する
2. 既存キャラに `templateId = legacy-coc`（等）を backfill
3. 新規作成をテンプレート経由に切替 → materialized 併存で運用
4. 十分な移行期間の後、sections 正本の廃止可否を**別途判断**（恒久併存も選択肢）

## 決めるべきこと

1. ドメイン名と語彙（character-sheet-template / sheet-template。「テンプレート」「シート」「キャラクター」の用語整理）
2. materialized sections の扱い（恒久 or 期限つき）
3. published テンプレート更新のキャラへの適用 UX（再実体化。自動追従はしない・明示ボタンで migrate、を推奨）
4. `character.controller.ts` の既存 discord.\* emit 2 本を application 層へ移す時期（本再設計に含めるか別タスクか）
