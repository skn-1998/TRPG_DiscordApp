---
name: trpg-domain-character
description: >-
  TRPG-SERVER の character ドメイン（src/domains/character）の設計ガイド。キャラクターの CRUD・
  属性セクション（status/skill/parameter/item/description）・characterId 生成・Character モデル/
  リポジトリ/DTO に関わるコードを追加・変更・レビュー・リファクタするときは必ず使う。
  「キャラクターシートの項目を増やす」「スキルが見つからない不具合」「findByChannelId を変える」
  「Character スキーマにフィールドを足す」など character と明示されない依頼でも、Character モデルや
  CharacterService/CharacterRepository に触るなら必ず参照する。projection の罠（S-1）・characterId 不変・
  イベント RPC 禁止など、下位モデルが踏みやすい設計不備を防ぐための責務・禁止事項を定義する。
---

# character ドメイン 設計ガイド

**対象**: `TRPG-SERVER/src/domains/character/`
**役割**: TRPG キャラクターデータの正本。CRUD、属性セクションの型変換（DTO ⇔ AttributeSection）、
characterId の生成・一意性。**Discord の UI・スレッド・ボタンはここの仕事ではない**（→ discord 層）。

## 構成マップ

| ファイル | 役割 |
| --- | --- |
| `character.module.ts` | MongooseModule（Character）＋ AuthModule ＋ UserModule を import |
| `character.controller.ts` | `/character` CRUD（全て JwtAuthGuard）＋ Discord 連携トリガー2本（後述） |
| `character.service.ts` | CRUD・DTO→AttributeSection 変換 |
| `repositories/character.repository.ts` | findById / findByChannelId / findByUserId / update* / exists* 系 |
| `services/character-id.service.ts` | characterId 生成（短 ID → 衝突時に段階フォールバック） |
| `models/character.model.ts` | Mongoose @Schema（= 現状エンティティ兼永続化モデル） |
| `schemas/character.schema.ts` | Zod ランタイムスキーマ（CharacterEntity 等） |
| `dto/` | Create/Update DTO・`discord-integration.dto.ts`・CharacterSummaryDto |

**Character モデルの要点**: `characterId`（unique・**不変**）、`characterName`、`gameSystemId`
（'coc'/'dnd5e'/'sw2.5' 等。作成時のシステム別バリデーションに使う）、`discordUserId`、`discordChannelId`
（キャラの登録チャンネル＝多くの customId 契約の解決キー）、`discordThreadId?` と `threadId?`（**重複疑いの2フィールド。
片方だけ更新すると不整合になるため、触るときは両方の整合を保つ**）、属性5セクション
（`status / skill / parameter / item / description`、型は `Record<string, AttributeValue>`・DB 上は素の Object）。

## 絶対に守る不変条件

1. **characterId は不変**。update 系の updateData に characterId を含めない。
2. **属性セクションの形**は `core/types/attribute.types.ts` の `AttributeValue`
   （name / index / values: Record<string,number> / description / dice / isVisible）。独自形状を発明しない。
3. **DB レイヤーにはセクションのスキーマ検証がない**（Object 型）。検証は DTO（class-validator）と
   Zod スキーマの層で行われるので、**新しい書き込み経路を作るときは必ず DTO/Zod を通す**。

## projection の罠（S-1 の教訓・最重要）

リポジトリの読み取りは `.select(...)`＋`.lean()` で**フィールドを明示列挙**している。
`findByChannelId` の select に `status skill parameter gameSystemId` が漏れていたせいで、
**本番の skill_ ボタンが常に「スキルが見つからない」になるバグ**（S-1、2026-06-04 修正）が起きた。

- **モデルにフィールドを追加したら、それを返すべき全ての `.select(...)` を必ず更新する**。
- 消費側（discord 層のロールハンドラ等）が新フィールドを読むなら、対応する projection を先に確認する。
- select 内の `attributes` `primaryAttributes` はモデルに存在しない **dead projection**（lean のためエラーにならない）。
  真似して存在しないフィールドを書かない。

## 公開API（他層が使ってよい入口）

- `CharacterService.create / findOne / findByChannelId / findByName / findHavingAll / findUserCharacterSummaries`
- `CharacterService.update / updateByChannelId / updateField(id, field: 'status'|'parameter'|'skill', data) / updateFieldByChannelId`
- `CharacterService.remove / removeByChannelId`
- `CharacterIdService.generateUniqueCharacterId`（ID を手組みしない）

discord 層からは **DI でこれらを直接呼ぶ**。`character.findBy*.requested` イベントを emit して
`waitForEvent` で結果を待つ**イベント RPC は禁止**（correlationId 無しの混線・タイムアウト・リスナー残存の
構造問題が確認済み。`AI.domain.md` の古い「イベント駆動パターン」例は踏襲しない。正:
`src/events/AI.event.md` 冒頭節・`docs/refactor/refactor-event-design-plan-2026-07-06.md`）。

## やること / やらないこと

| やること | やらないこと |
| --- | --- |
| キャラクター CRUD と属性セクション変換 | discord.js の import・Embed/ボタン生成（→ discord 層） |
| characterId 生成と一意性担保 | ダイス計算・ロール実行（→ discord/services/dice） |
| gameSystemId 別の作成時バリデーション | ダイス履歴の保存（→ dice-roll ドメイン） |
| Zod による entity 検証 | 新しいイベントの発行（下記の既存2本以外を controller から増やさない） |

**既存の例外（維持はするが拡大しない）**: `character.controller.ts` は Web からの Discord 連携トリガーとして
`discord.thread.create.requested`（:294）と `discord.character.display.requested`（:334）を emit している。
これは ARCHITECTURE §9（domain は feature 固有イベントを発行しない）との既知の緊張点であり、
**新たな discord.* イベント発行をこの controller に足さない**。新しい Web→Discord 連携が必要なら
発行箇所を feature/application 層に置くことを先に検討する。

## 既知の落とし穴

- **update 系は2系統**（characterId キーと discordChannelId キー）。どちらのキーで解決すべきかを
  呼び出し元の customId 契約（discord 層）と突き合わせてから選ぶ。
- **ID 生成の衝突チェックは非原子的**（exists → insert）。characterId まわりを変えるときは unique index が最後の砦。
- `character.updated` / `character.deleted` は契約に残る **deprecated イベント**（発行者ゼロ）。リスナーを書いても発火しない。

## 検証

`pnpm run build` → `pnpm run check:circular` → character 関連 spec
（repository spec は select 文字列を exact 固定しているので projection 変更時は期待値も更新）→
消費側 spec（discord 層のロールハンドラ・events handlers）。作業終了後は `AI.character.md` / `AI.refactor.md` に記録。

## 正本ドキュメント

`src/ARCHITECTURE.md`（§9 Domains 方針）・`AI.character.md`・`AI.refactor.md`。
Discord 側の消費のしかたは `trpg-domain-discord` スキル、履歴保存は `trpg-domain-dice-roll` スキルを参照。
