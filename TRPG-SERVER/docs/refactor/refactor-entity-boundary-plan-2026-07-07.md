# Entity/Schema 分離・ドメイン境界是正 計画書（E-6 系列）

**作成日:** 2026-07-07
**ステータス:** 計画のみ（コード変更なし）・**ユーザー承認待ち**（下記「ユーザー判断が必要な3点」）。Codex 設計レビュー済み（High 2/Medium 2/Low 2 をすべて本文へ反映済み。優先度所見: E-6a→b→c→d を C 系列残りより先・E-6e は C-4/C-5 と同格・いずれも C-9 より先）
**位置づけ:** `refactor-event-design-plan-2026-07-06.md` の E-6（中期・別計画書化）を本書として具体化
**診断の記録:** `AI.refactor.md`『2026-07-07 E-6 計画診断』節（Explore 3系統＋司令塔裏取り）
**上位方針:** `src/ARCHITECTURE.md` §9（Domains 方針）/ §12（置き場所決定表）/ §4（依存方向）

---

## 診断サマリ（2026-07-07 実測・司令塔裏取り済み）

### 想定より軽い（旧記録の陳腐化）

- **「Character 型と Entity 型の不一致（TS エラー 22 個）」は陳腐化した記録**。`*.entity.ts` は現存せず、
  E-4a の契約厳密化後、本番コードの Character 絡みキャストは **4 箇所**まで減少。
- **Mongoose Document API 依存は本番 1 箇所のみ**（`character-section-editor.service.ts:304` の toObject ガード）。
  repository の**読み取り系**は `.lean()` で plain を返しており、露出の実態は「@Schema クラスを型として使っている」だけ
  （書き込み系は Document を返す＝E-6d の訂正枠を参照）。
- `CHARACTER_MODEL` トークンの discord 層リークは**ゼロ**（DI 境界は健全）。
- → **全面 DDD 化のような重い分離は不要**。型の付け替え中心の bounded slice で到達できる。

### 実測データ

| 項目                       | 実測                                                                    |
| -------------------------- | ----------------------------------------------------------------------- |
| Character import 元        | 61 ファイル（discord 非 spec 38 / spec 11 / domains 8 / events 契約 1） |
| discord 層のフィールド参照 | 281 回（Top: characterId 75 / characterName 56 / discordChannelId 49）  |
| Document API 依存（本番）  | 1 箇所（toObject ガード）                                               |
| 本番の型キャスト           | 4 箇所（as Character ×2・as any ×2、いずれも event payload 境界）       |

### 確定した問題（本書のスコープ）

1. **`threadId` は deprecated 重複**。正は `discordThreadId`（live 読み出しは全て discordThreadId。
   threadId の参照は `character.creation.completed.ts:147` の OR 条件 1 箇所のみ。書き込みは thread 系 2 サービスの
   二重書きの従属側のみ。フロントは両方未使用。**migration 不要**＝旧データの threadId は参照されなくなるだけ）。
2. **`character.controller.ts` の §9 三重違反**: domains 配下の controller が TypedEventService を直接 inject し
   `discord.thread.create.requested`(:294) / `discord.character.display.requested`(:334) を EVENT_NAMES 直書きで発行。
   しかも **discord 系エンドポイント 3 本（PUT :id/discord/embed・POST :id/discord/thread・POST :id/discord/display）は
   フロント呼び出しゼロ**。thread.create は `character.creation.completed` handler(:148) と発行重複。
3. **ゴースト display 連鎖の残置**（E-3d 申し送り）: `discord.character.display.requested` は購読 2 サービスとも
   「聞くだけで何もしない」ゴースト化済み。emit 元（controller:334 と creation.completed:174）ごと解体可能。
4. **Web/Discord の非対称**: BCDice 実行コアと履歴保存キー解決（`resolveSaveChannelId`）が discord 層にあり、
   Web（REST）から再利用できない。**Web からダイスを振る/履歴を引く API は現状存在しない**。

---

## ユーザー判断が必要な3点（着手前に確認）

1. **E-6b: フロント未使用の discord 系 REST エンドポイント 3 本の削除可否**
   （PUT /character/:id/discord/embed〔コード内に廃止サインあり〕・POST /character/:id/discord/thread・
   POST /character/:id/discord/display）。フロント grep ゼロだが、curl 等の手動運用で叩いていた場合は削除で使えなくなる。
   → 代替: スレッド作成は Discord 側の正規フロー（作成完了時の自動発行）が既に live。
2. **E-6e 後の REST ダイス API 新設（POST /dice/roll・GET /dice/results）をいつやるか**
   — これは**挙動追加＝リファクタではなく機能開発**。本書では「E-6e が enabler になる」ことだけ保証し、
   実装は `document/feature-roadmap-2026-07-06.md` 側の項目として扱う（本書スコープ外）。
3. **E-6f（属性整形 util の domains 引き上げ）の要否** — §12 決定表上は現状の feature 配下が正
   （discord.js の EmbedField 形に依存）。Web 表示の統一が必要になった時点で着手が合理的＝**既定は「やらない」**。

---

## スライス計画（E-6a〜E-6e・リスク昇順）

### 検証ゲート（各 slice 共通）

```
pnpm run build / check:circular（No circular dependency found!）/ pnpm run test（全 suite）
pnpm run start:dev（DI・handler 登録 23・Discord 初期化。DI/provider を触る slice は必須）
＋ slice ごとの Codex スコープレビュー（標準運用）
```

- 削除系（E-6a/b/c）は characterization 前倒し不要の例外規定を適用（削除対象の非到達性を grep で証明・記録）。
- 挙動不変系（E-6d/e）は既存 spec 緑維持＝挙動保証（E-2 系の回帰ガード様式を踏襲）。

### E-6a: `threadId` 重複フィールドの撤去（低リスク）

- `character.creation.completed.ts:146-150` の `threadId || discordChannelId` 条件は **`discordChannelId` 基準へ是正**
  （Codex レビュー High: emit payload の channelId は discordChannelId であり、作成直後は discordThreadId 未設定のため、
  discordThreadId 基準にするとスレッド作成が抑止される。threadId 単独時に channelId 空文字で emit する現挙動は bugfix として削除）。
  **削除系例外は適用せず characterization を1本置く**: `discordChannelId あり → emit / threadId のみ → emit しない` を spec で固定。
- thread-creation / thread-orchestrator の**二重書き**から threadId 側を除去。
- model / CharacterInputDto / UpdateCharacterDto / character.schema.ts（フロント側 schema は要確認）/ spec から `threadId` を撤去。
- **migration 不要の根拠を commit message に記録**（正規 create/update 経路は threadId を書かない・読み出しは上記 1 箇所のみ）。

### E-6b: character.controller の §9 準拠化（中・**ユーザー判断1の後**）

- discord 系エンドポイント 3 本を削除（判断1で否なら: emit を application 層へ移す縮小版に切替）。
  **明示: これは公開 REST 契約の破壊的変更**（フロントは未使用と grep 確認済みだが、curl 等の手動運用・未管理クライアントには破壊的）。
- `TypedEventService` 注入・`EVENT_NAMES` import を controller から撤去 → **domains 層のイベント発行ゼロを達成**（§9 準拠）。
- character.module の依存整理。`handlers.integration.spec` 等は影響なし（HTTP 層のみ）。
- 副産物: `discord.thread.create.requested` の emit 元が creation.completed handler の 1 本に正規化（発行重複の解消）。

### E-6c: ゴースト display 連鎖の解体（低〜中）

- `discord.character.display.requested` の emit（creation.completed:174。controller:334 は E-6b で消滅）と
  購読ゴースト 2 箇所（character-display-handler.service の handler 本体 / character-display.service の購読部）を撤去。
- 契約 11→10 種へ（unified-event-contracts / EVENT_NAMES 追従）。
- **残す**: CharacterDisplayService の live 部分（タブ表示 createCharacterEmbed / buildCharacterEmbed / updateCharacterEmbed の
  直接呼び出し経路）。character-display-handler.service は購読が唯一の存在意義なら**サービスごと削除**（着手時に再 grep）。

### E-6d: CharacterEntity 型の導入（軽量設計・挙動不変）

**方針: 「クラス＝persistence 専用、interface＝公開型」の最小分離。ランタイム変換層（マッパークラス）は作らないが、
repository 境界での plain 化は必要**。

> **⚠ 前提訂正（Codex レビュー High・司令塔裏取り一致）**: repository の全メソッドが lean ではない。
> 読み取り系（findOne/findByChannelId 等）は `.lean()` だが、**create（.save()）・update/updateByChannelId
> （findOneAndUpdate）・remove・findAll・findByUserId は Mongoose Document を返し得る**。
> CharacterEntity を公開契約にするには、**repository 境界でこれらを plain 化**（save 後 toObject() /
> findOneAndUpdate・find 系へ lean 付与）してから discord 層の toObject ガードを撤去する（順序厳守）。
> plain 化は挙動不変（消費側はフィールド読み出しのみ）だが、update.completed payload が Document→plain に
> 変わるため、handler spec の characterization を先に確認する。

> **⚠ 名前衝突（Codex レビュー Medium）**: `domains/character/schemas/character.schema.ts` が既に別形状
> （nested discord.threadId を含む旧 zod 系）の `CharacterEntity` 型を export 済み。E-6d 着手時に
> **旧 zod 側を dead 判定して削除するか、新公開型を `CharacterRecord` 等へ改名**して二重 Entity 名を回避する
> （着手時の最初の判断事項）。

- 新規 `domains/character/models/character.entity.ts`: `CharacterEntity`（現 Character と同形の plain interface・
  **threadId は含めない**〔E-6a 後〕・`createdAt/updatedAt` 含む）。@Schema クラス `Character` は repository 内部専用へ。
- repository / CharacterService / CharacterCreationCoreService の公開シグネチャを `CharacterEntity` へ。
- `unified-event-contracts.ts` の `import type` を entity へ → **event payload 境界の as キャスト 4 箇所が自然解消**。
- discord 層 38 ファイルの import を entity へ機械置換（型注釈のみ＝コンパイル駆動で安全）。
  `character-section-editor.service.ts:304` の toObject ガードを撤去（lean 保証を repository 契約として明記）。
- **検証の肝**: 全 suite 緑＋`Character`（@Schema クラス）の import が domains/character 内部と test 以外でゼロになること。

### E-6e: ダイス共通ロジックの domains 引き上げ（挙動不変・Web への enabler）

- ① **BCDice 実行コア**: `src/discord/services/dice/dice-roll-logic.service.ts:86-125`（※ features/diceRoll ではなく中立 dice 基盤側）の純粋部（式クリーニング→BCDice eval→結果抽出）を
  `domains/dice-roll/services/dice-execution.service.ts`（discord.js 非依存）へ抽出し、discord 側は委譲に差し替え。
  `src/discord/utils/dice.ts`（8 行 wrapper）の置き場所もここへ統合。
- ② **保存キー解決**: `resolveSaveChannelId` を `ChannelContext`（channelId / parentId? / isThread）引数の
  **純関数**として domains/dice-roll へ移設。discord 側は interaction→context 変換だけを持つ
  （2026-06-11 の「スレッド内は実親チャンネル」意味論を単体テストごと移設）。
  **対象範囲の追記（Codex レビュー Medium）**: `CustomDiceModalService.saveRollHistory` の**4段 fallback**
  （threadParent → character.discordChannelId → customId 由来 → interaction.channelId）も同時に対象とし、
  「thread parent 優先」と「modal fallback 優先順位」を別ケースとして純関数化・テスト移設する。
- 既存 spec（dice-roll-logic 24 件ほか）は呼び出し先差し替えのみで**緑のまま**＝挙動不変の証明。
- スコープ外: REST `/dice/roll` `/dice/results` の新設（判断2・roadmap 側）。

### 実施順序と依存

```
E-6a（独立・いつでも）
E-6b（判断1の後）→ E-6c（controller emit 消滅後が最小手順）
E-6d（E-6a 後推奨: entity から threadId を最初から除外できる）
E-6e（独立・いつでも）
E-6f は既定「やらない」（判断3）
```

## スコープ外（本計画ではやらない）

- REST ダイス API の新設・フロント側の表示ロジック統一（機能開発・roadmap 側）。
- キャラクター embed 生成 2〜3 系統の統一・ダイス計算 5 系統の責務再整理（C 計画書の中期項目のまま）。
- User / DiceRoll など他ドメインの entity 化（Character で様式を確立してから判断）。
- 監視系 dead 配線の整理（C-3b′）。
