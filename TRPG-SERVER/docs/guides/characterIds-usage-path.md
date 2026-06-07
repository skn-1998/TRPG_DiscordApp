# characterIds の保存・使用経路

（最終確認: 2026-06-06。保存経路・読み取り経路ともに `characterIds` で現役。
ただし呼び出し元のファイル配置が diceRoll feature 化で移動し、旧 interactions 配下の 3 サービス
（`character-dice-buttons.service.ts` / `diceroll-channel-create.service.ts` /
`components/pagination/dice-roll-pagination.service.ts`）は**削除済み**。本書はそれを反映済み。）

## 🧭 現行経路サマリ（2026-06-06）

- **保存（現役）**: `DiceRollService.createText()` / `createOrGetChannel()` →
  `DiceRollChannelRepository.addCharacterId()` が `characterIds` を `$addToSet` で保存。
- **保存の呼び出し元（現役）**: `DiceRollLogicService`（**現在地**:
  `src/discord/services/dice/dice-roll-logic.service.ts`。旧 `interactions/button/` から移動）。
- **読み取り（現役）**: `DiceRollCharacterProviderService.findCharactersByChannelId()`（**現在地**:
  `src/discord/features/diceRoll/services/pagination/dice-roll-character-provider.service.ts`）が
  `diceRollChannel.characterIds` を読む。`DiceRollPaginationService`（同 pagination 配下）がこれを利用。
- **削除済みの旧経路**: 下記 3.B / 3.C と「読み取り処理」旧節で取り消し線・注記済み。

## 📋 概要

`DiceRollChannel`モデルの`characterIds`フィールドがどこで使用され、どのように保存されているかの経路をまとめます。

---

## 🗄️ データモデル定義

### モデル定義

```18:19:TRPG-SERVER/src/domains/dice-roll/models/dice-roll-channel.model.ts
  @Prop({ type: [String], default: [] })
  characterIds: string[]
```

- **型**: `string[]` (文字列配列)
- **デフォルト値**: `[]` (空配列)
- **MongoDB操作**: `$addToSet`を使用して重複を防ぎながら追加

---

## 💾 保存処理の経路

### 1. **リポジトリ層: 直接保存処理**

#### `DiceRollChannelRepository.addCharacterId()`

```75:79:TRPG-SERVER/src/domains/dice-roll/repositories/dice-roll-channel.repository.ts
  async addCharacterId(channelId: string, characterId: string): Promise<DiceRollChannel | null> {
    return this.diceRollChannelModel
      .findOneAndUpdate({ discordChannelId: channelId }, { $addToSet: { characterIds: characterId } }, { new: true })
      .exec()
  }
```

**処理内容**:

- MongoDBの`$addToSet`演算子を使用して重複を防ぎながら`characterIds`配列に追加
- `{ new: true }`により更新後のドキュメントを返却

---

### 2. **サービス層: ビジネスロジック**

#### `DiceRollService.createText()` - メインの保存経路

```87:90:TRPG-SERVER/src/domains/dice-roll/dice-roll.service.ts
    // キャラクターIDがある場合、チャンネルにキャラクターIDを追加
    if (createDiceRollTextDto.characterId && channelId) {
      await this.diceRollChannelRepository.addCharacterId(channelId, createDiceRollTextDto.characterId)
    }
```

**処理フロー**:

1. `DiceRollText`を作成
2. `characterId`が存在する場合、自動的に`DiceRollChannel`の`characterIds`に追加
3. 重複は`$addToSet`により自動的に防止

#### `DiceRollService.createOrGetChannel()` - 初期作成時

```36:40:TRPG-SERVER/src/domains/dice-roll/dice-roll.service.ts
    const channel: Partial<DiceRollChannel> = {
      discordChannelId,
      characterIds: createDiceRollChannelDto.characterIds || [],
      textIds: createDiceRollChannelDto.textIds || []
    }
```

**処理内容**:

- チャンネル作成時に初期値として`characterIds`を設定
- DTOから渡された値、または空配列を設定

---

### 3. **プレゼンテーション層: 呼び出し元**

#### A. `DiceRollLogicService.handleDiceRoll()` - ダイスロール処理

> 📍 **現在地（2026-06-06）**: このサービスは `src/discord/services/dice/dice-roll-logic.service.ts`
> へ移動済み（旧 `interactions/button/dice-roll-logic.service.ts` は削除）。`createText()` 呼び出しは
> 現役（同ファイル内で 3 箇所）。下記の行番号は移動前スナップショットであり、現行行番号とは一致しない。

```48:60:TRPG-SERVER/src/discord/services/dice/dice-roll-logic.service.ts
      // ダイスロール結果をDBに保存
      const diceRollData: DiceRollTextInputDto = {
        channelId: req.channelId,
        userId: req.userId || interaction.user.id,
        diceExpression: req.diceType,
        result: rollResult.total,
        resultDetails: rollResult.details,
        reason: req.reason,
        characterName: character.characterName,
        gameSystem: character.gameSystemId || 'unknown'
      }

      const savedRoll = await this.diceRollService.createText(diceRollData)
```

**処理フロー**:

1. キャラクター情報を取得
2. ダイスロールを実行
3. `DiceRollTextInputDto`を作成（`characterId`は含まれていないが、`channelId`から推測可能）
4. `createText()`を呼び出し → 内部で`characterId`が追加される

**注意**: このコードでは`characterId`が明示的に設定されていないため、`createText()`内で`characterId`が存在する場合のみ追加される条件分岐に依存しています。

#### B. ~~`CharacterDiceButtonsService.saveRollResult()` - キャラクターダイスボタン処理~~（削除済み）

> 🗑️ **削除済み（2026-06-06 時点で実ファイル無し）**: `src/discord/interactions/button/character-dice-buttons.service.ts`
> は dead サービス撤去（S-5 系）で削除済み。以下は当時のスナップショットで、現行コードには存在しない。
> `characterId` 明示設定での `createText()` 保存という挙動自体は、現役の `DiceRollLogicService`（上記 A）が担う。

```276:293:TRPG-SERVER/src/discord/interactions/button/character-dice-buttons.service.ts（削除済み）
      // ダイスロール結果をDBに保存
      const text: DiceRollTextInputDto = {
        textId: uuidv4(),
        channelId: discordChannelId,
        userId: 'system', // 古いサービスから移行中
        diceExpression: diceCommand,
        result: result,
        resultDetails: resultText,
        characterId: character.characterId,
        characterName: character.characterName,
        // 後方互換性
        text: resultText,
        diceRoll: diceCommand,
        discordChannelId: discordChannelId
      }

      // バックグラウンドで保存処理（非同期）
      this.diceRollService
        .createText(text)
```

**処理フロー**:

1. チャンネルIDからキャラクター情報を取得
2. `DiceRollTextInputDto`に`characterId`を明示的に設定
3. `createText()`を呼び出し → `characterIds`に自動追加

#### C. ~~`DiceRollChannelCreateService.execute()` - チャンネル作成時~~（削除済み）

> 🗑️ **削除済み（2026-06-06 時点で実ファイル無し）**: `src/discord/interactions/channel/diceroll-channel-create.service.ts`
> は削除済み。現状 `createOrGetChannel()` を呼ぶ discord 側経路は無い（`dice-roll.service.ts:51` の呼び出しも
> コメントアウト）。`characterIds` への追加は保存時の `addCharacterId()`（上記 A 経路）が担う。以下は当時のスナップショット。

```29:35:TRPG-SERVER/src/discord/interactions/channel/diceroll-channel-create.service.ts（削除済み）
    const createDiceRollChannelDto: DiceRollChannelInputDto = {
      discordChannelId: channel.id,
      characterIds: [],
      textIds: []
    }

    await this.diceRollService.createOrGetChannel(createDiceRollChannelDto)
```

**処理内容**:

- Discordチャンネル作成時に`DiceRollChannel`を初期化
- `characterIds`は空配列で初期化

---

## 📖 読み取り処理の経路

> 📍 **現在地（2026-06-06）**: 読み取りの正本は `DiceRollCharacterProviderService.findCharactersByChannelId()`
> （`src/discord/features/diceRoll/services/pagination/dice-roll-character-provider.service.ts`）。
> ここで `diceRollChannel.characterIds` を読み、各 ID をキャラクター取得イベントへ渡す。
> 旧 `src/discord/components/pagination/dice-roll-pagination.service.ts` は**削除済み**で、
> `DiceRollPaginationService` は `features/diceRoll/services/pagination/` 配下へ移動済み。
> 同サービスは `characterIds` を直接読まず、上記 provider 経由（`fetchCharacters` → `findCharactersByChannelId`）で取得する。

### 現役の読み取り: `DiceRollCharacterProviderService.findCharactersByChannelId()`

```13:24:TRPG-SERVER/src/discord/features/diceRoll/services/pagination/dice-roll-character-provider.service.ts
  async findCharactersByChannelId(channelId: string): Promise<Character[]> {
    try {
      const diceRollChannel = await this.diceRollService.findChannelByChannelId(channelId)
      if (!diceRollChannel || !diceRollChannel.characterIds || diceRollChannel.characterIds.length === 0) {
        return []
      }
      // 各 characterId をイベント経由でキャラクター取得
```

### ~~（旧）`DiceRollPaginationService.fetchCharacters()` - ページネーション表示~~（ファイル移動・直接 characterIds 読みは provider へ集約）

```480:491:TRPG-SERVER/src/discord/components/pagination/dice-roll-pagination.service.ts（削除済み・以下は当時のスナップショット）
      // DiceRollChannelを取得してcharacterIdsを取得
      const diceRollChannel = await this.diceRollService.findChannelByChannelId(channelId)

      if (!diceRollChannel || !diceRollChannel.characterIds || diceRollChannel.characterIds.length === 0) {
        console.log(`[DiceRollPagination] チャンネルまたはキャラクターIDが見つかりません`)
        return []
      }

      console.log(`[DiceRollPagination] キャラクターID取得: ${diceRollChannel.characterIds.length}件`)

      // 各characterIdに対してキャラクター情報を並列取得
      const characterPromises = diceRollChannel.characterIds.map(async (characterId) => {
```

**処理内容**:

1. `DiceRollChannel`を取得
2. `characterIds`配列を取得
3. 各`characterId`に対してキャラクター情報を並列取得
4. ページネーション表示に使用

---

## 🔄 保存処理の完全なフロー

### パターン1: ダイスロール実行時（自動追加）

```
Discord Interaction
  ↓
DiceRollLogicService.handleDiceRoll()
  ↓
DiceRollService.createText(DiceRollTextInputDto)
  ├─ DiceRollTextを作成
  └─ characterIdが存在する場合
      ↓
DiceRollChannelRepository.addCharacterId(channelId, characterId)
  ↓
MongoDB: $addToSet { characterIds: characterId }
  ↓
DiceRollChannel.characterIds に追加完了
```

### パターン2: ~~キャラクターダイスボタン使用時~~（削除済み・参考）

> 🗑️ `CharacterDiceButtonsService` は削除済み。以下は当時のフロー。

```
Discord Button Interaction
  ↓
CharacterDiceButtonsService.saveRollResult()（削除済み）
  ├─ characterIdを取得
  └─ DiceRollTextInputDtoにcharacterIdを設定
      ↓
DiceRollService.createText(DiceRollTextInputDto)
  ├─ DiceRollTextを作成
  └─ characterIdが存在するため
      ↓
DiceRollChannelRepository.addCharacterId(channelId, characterId)
  ↓
MongoDB: $addToSet { characterIds: characterId }
```

### パターン3: ~~チャンネル初期作成時~~（削除済み・参考）

> 🗑️ `DiceRollChannelCreateService` は削除済み。現状この初期作成経路は配線されていない。以下は当時のフロー。

```
Discord Channel Create Event
  ↓
DiceRollChannelCreateService.execute()（削除済み）
  ↓
DiceRollService.createOrGetChannel(DiceRollChannelInputDto)
  ├─ characterIds: [] で初期化
  └─ DiceRollChannelRepository.create()
      ↓
MongoDB: 新規ドキュメント作成
```

---

## 📊 使用箇所まとめ

### 保存処理

1. ✅ `DiceRollChannelRepository.addCharacterId()` - **直接保存処理**
2. ✅ `DiceRollService.createText()` - **自動追加ロジック**
3. ✅ `DiceRollService.createOrGetChannel()` - **初期値設定**

### 呼び出し元

1. ✅ `DiceRollLogicService.handleDiceRoll()` - ダイスロール実行時（現在地 `src/discord/services/dice/`）
2. 🗑️ ~~`CharacterDiceButtonsService.saveRollResult()`~~ - 削除済み（旧 `interactions/button/`）
3. 🗑️ ~~`DiceRollChannelCreateService.execute()`~~ - 削除済み（旧 `interactions/channel/`）

### 読み取り処理

1. ✅ `DiceRollCharacterProviderService.findCharactersByChannelId()` - `characterIds` 読み取り正本（`features/diceRoll/services/pagination/`）
2. 🗑️ ~~`DiceRollPaginationService.fetchCharacters()` が直接 characterIds を読む~~ - 現在は上記 provider 経由（同サービスは `features/diceRoll/services/pagination/` へ移動）

---

## 🔍 重要なポイント

### 1. 重複防止

- `$addToSet`演算子により、同じ`characterId`が複数回追加されることを防止
- 配列内に既に存在する場合は追加されない

### 2. 自動追加の条件

```typescript
if (createDiceRollTextDto.characterId && channelId) {
  await this.diceRollChannelRepository.addCharacterId(channelId, createDiceRollTextDto.characterId)
}
```

- `characterId`と`channelId`の両方が存在する場合のみ追加
- どちらかが欠けている場合は追加されない

### 3. 初期化

- チャンネル作成時は`characterIds: []`で初期化
- ダイスロール実行時に自動的に追加される

---

## 🎯 まとめ

`characterIds`は以下の経路で保存されます：

1. **直接保存**: `DiceRollChannelRepository.addCharacterId()` → MongoDB `$addToSet`
2. **自動追加**: `DiceRollService.createText()` → ダイスロール保存時に自動追加
3. **初期化**: `DiceRollService.createOrGetChannel()` → チャンネル作成時に空配列で初期化

主な使用箇所は、ダイスロール結果を保存する際にキャラクターIDを自動的に`DiceRollChannel`に記録し、後でページネーション表示などで使用するためのものです。
