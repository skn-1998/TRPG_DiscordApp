---
name: trpg-domain-dice-roll
description: >-
  TRPG-SERVER の dice-roll ドメイン（src/domains/dice-roll）の設計ガイド。ダイスロール履歴
  （DiceRollText）とダイスチャンネル（DiceRollChannel）の保存・取得・DiceRollService・
  そのリポジトリ/モデル/DTO に関わるコードを追加・変更・レビュー・リファクタするときは必ず使う。
  「/dice-result に履歴が出ない」「ロール履歴の保存を変える」「履歴の保存キー・channelId まわり」など
  dice-roll と明示されない依頼でも、DiceRollService やロール履歴の永続化に触るなら必ず参照する。
  このドメインは履歴の保管庫であり、ダイス計算はしない——その境界と保存キーの意味論、
  legacy フィールド重複の扱いを定義する。
---

# dice-roll ドメイン 設計ガイド

**対象**: `TRPG-SERVER/src/domains/dice-roll/`
**役割**: ダイスロール**履歴**（DiceRollText）とチャンネルメタ（DiceRollChannel）の永続化・取得。
**このドメインはダイスを振らない・計算しない**。計算・解析は `discord/services/dice`
（DiceOrchestratorService / DiceCalculationService / DiceParserService）の仕事で、
このドメインは「振った結果を渡されて保存し、後で検索できるようにする」だけ。

## 構成マップ

| ファイル | 役割 |
| --- | --- |
| `dice-roll.module.ts` | MongooseModule（2モデル）。**controller なし**＝消費者は discord 層のみ |
| `dice-roll.service.ts` | createOrGetChannel / createText / findTextsByChannelId 等 |
| `repositories/dice-roll-channel.repository.ts` | channel CRUD。textIds/characterIds は `$addToSet` |
| `repositories/dice-roll-text.repository.ts` | text CRUD＋**チャンネル単位のインメモリキャッシュ（TTL 60秒）**＋ deleteOldRolls |
| `models/dice-roll-channel.model.ts` | discordChannelId（unique）・characterIds[]・textIds[]・embedId・gameSystemId |
| `models/dice-roll-text.model.ts` | textId（unique）・discordChannelId・result・diceRoll・text ＋ 新系フィールド |
| `dto/` | Create/Update DTO（**新旧フィールド名が併存**、後述） |

## 保存キーの意味論（最重要・2026-06-11 の修正で確定）

`DiceRollText.discordChannelId` は「どこで `/dice-result` すると出てくるか」を決めるキー。

- **スレッド内のロールは、スレッド ID ではなく実親チャンネル ID で保存する**。
  キーの解決は discord 層の `DiceRollLogicService.resolveSaveChannelId(interaction, lookupChannelId)` が行う
  （スレッド内なら `channel.parentId`、スレッド外・parentId 欠落時は lookup キー）。
- 一方、**キャラクター解決のキーは customId に埋め込まれた `character.discordChannelId`** であり、保存キーとは別物。
  「保存キーとキャラ解決キーの分離」を崩すと `/dice-result` に履歴が出ない既知バグが再発する。
- このドメイン自身はキー解決をしない。**渡された channelId をそのまま保存する**。キー解決ロジックを
  このドメインに持ち込まない（discord 層の責務）。

## legacy フィールド重複の扱い

`DiceRollTextInputDto` と `createText()` には新旧フィールドが併存する：

| 新（優先） | 旧（後方互換） |
| --- | --- |
| `channelId` | `discordChannelId` |
| `diceExpression` | `diceRoll` |
| `resultDetails` | `text` |

`createText` は「新 || 旧 || デフォルト」で解決する。**新規コードは新フィールド名だけを渡す**。
両方渡すと新側が勝つ（サイレント）。旧フィールドを増やさない・旧名の新規利用を書かない。

## 公開API（他層が使ってよい入口）

- `DiceRollService.createText`（履歴保存の唯一の入口。**履歴保存の失敗はユーザーへの結果返信を妨げない**
  ——呼び出し側で Logger.error に留める、が確立済みの UX 方針）
- `DiceRollService.createOrGetChannel / findChannelByChannelId / updateChannel / updateEmbed`
- `DiceRollService.findTextsByChannelId / findTextsByCharacterId / findTextById`
- `DiceRollService.deleteOldRolls(channelId, keepCount)` — 履歴の間引き

Repository を discord 層から直接使わない（キャッシュの無効化が Service/Repository 内に閉じているため）。

## やること / やらないこと

| やること | やらないこと |
| --- | --- |
| ロール履歴・チャンネルメタの永続化と検索 | ダイス計算・記法パース・bcdice（→ discord/services/dice） |
| textIds/characterIds の原子的追加（$addToSet） | 保存キー（スレッド→親）の解決（→ discord 層 resolveSaveChannelId） |
| チャンネル単位キャッシュの管理と無効化 | discord.js の import・Embed 生成 |
| 古い履歴の削除（deleteOldRolls） | イベントの発行・購読（このドメインは TypedEventService を使わない） |

## 既知の落とし穴

- **キャッシュ**: `findByChannelId` はチャンネル単位 TTL 60 秒のインメモリキャッシュを持つ。書き込み系は
  リポジトリ内で無効化されるが、**リポジトリを迂回して Model を直接触ると stale が出る**（迂回禁止の理由）。
  水平スケール時はプロセス間で無効化されない前提も知っておく。
- **トランザクションなし**: `createText` 後の `addTextId` → `addCharacterId` は非原子的。途中失敗で
  channel 側の配列が部分更新になり得る。整合性が重要な変更では 1 回の update にまとめることを検討。
- **過去データの保存キー**: 2026-06-11 以前の履歴はキャラ登録チャンネルキーのまま残っている（migration なし）。
  「古い履歴だけ出ない」報告はこれが原因の可能性がある。
- `diceroll.execute.completed/failed` イベントは discord 層が emit しているが**購読者ゼロの dead emit**
  （撤去計画 E-3）。このドメインの動作はイベントに依存していない。

## 検証

`pnpm run build` → `pnpm run check:circular` → dice-roll 関連 spec ＋ 消費側
（discord/features/diceRoll・characterThread のロールハンドラ・pagination）spec。
作業終了後は `AI.refactor.md` / `AI.discord.md` に記録。

## 正本ドキュメント

`src/ARCHITECTURE.md`・`AI.discord.md`（保存キー修正の経緯: 2026-06-10/06-11 節）・
`document/dice-roll-flow.md`。計算側・UI 側は `trpg-domain-discord` スキルを参照。
