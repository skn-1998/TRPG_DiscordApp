# flexible-dice-param\* メニュー・ボタンの存在確認

## 📋 調査結果

### ✅ **存在します**

`flexible-dice-param*` カスタムIDを持つセレクトメニューは**存在します**。

---

## 🎯 メニューの作成場所

### `ThreadCreationService.postFlexibleDiceMenu()`

```343:359:TRPG-SERVER/src/discord/features/characterThread/services/thread-creation.service.ts
  private async postFlexibleDiceMenu(thread: ThreadChannel, character: Character): Promise<void> {
    try {
      // パラメータ選択セレクトメニューを作成
      const parameterSelectMenu = this.createParameterSelectMenu(character)

      if (parameterSelectMenu) {
        const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(parameterSelectMenu)

        await thread.send({
          content: '🎯 柔軟ダイス計算：パラメータを選択してください',
          components: [selectRow]
        })
      }
    } catch (error) {
      this.logger.error('Failed to post flexible dice menu', error)
    }
  }
```

### `createParameterSelectMenu()` - メニュー作成

```364:465:TRPG-SERVER/src/discord/features/characterThread/services/thread-creation.service.ts
  private createParameterSelectMenu(character: Character): StringSelectMenuBuilder | null {
    try {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`flexible-dice-param*${character.characterId}`)
        .setPlaceholder('計算に使用するパラメータを選択...')
        .setMinValues(1)
        .setMaxValues(1)

      const options: StringSelectMenuOptionBuilder[] = []

      // ステータスセクション
      if (character.status && Object.keys(character.status).length > 0) {
        for (const [key, value] of Object.entries(character.status)) {
          // ... ステータスオプションを追加
          options.push(
            new StringSelectMenuOptionBuilder()
              .setLabel(`📊 ${displayName} (${displayValue})`)
              .setValue(`status:${key}:${displayValue}`)
              .setDescription(`ステータス: ${displayName}を使用`)
          )
        }
      }

      // スキルセクション
      if (character.skill && Object.keys(character.skill).length > 0) {
        // ... スキルオプションを追加
        options.push(
          new StringSelectMenuOptionBuilder()
            .setLabel(`⚔️ ${displayName} (${displayValue})`)
            .setValue(`skill:${key}:${displayValue}`)
            .setDescription(`スキル: ${displayName}を使用`)
        )
      }

      // パラメータセクション
      if (character.parameter && Object.keys(character.parameter).length > 0) {
        // ... パラメータオプションを追加
        options.push(
          new StringSelectMenuOptionBuilder()
            .setLabel(`⚙️ ${displayName} (${displayValue})`)
            .setValue(`parameter:${key}:${displayValue}`)
            .setDescription(`パラメータ: ${displayName}を使用`)
        )
      }

      // カスタム計算オプション
      options.push(
        new StringSelectMenuOptionBuilder()
          .setLabel('🔧 カスタム計算式')
          .setValue('custom:formula:0')
          .setDescription('自由な計算式を入力')
      )

      // Discordの制限：最大25オプション
      selectMenu.addOptions(...options.slice(0, 25))
      return selectMenu
    } catch (error) {
      this.logger.error('Failed to create parameter select menu', error)
      return null
    }
  }
```

**カスタムID**: `flexible-dice-param*${character.characterId}`

---

## 📍 呼び出し箇所

### 1. `ThreadCreationService.postCharacterDisplay()`

キャラクタースレッド作成時に、表示タイプに関わらず**すべてのケース**で呼ばれます：

```152:196:TRPG-SERVER/src/discord/features/characterThread/services/thread-creation.service.ts
  private async postCharacterDisplay(
    thread: ThreadChannel,
    character: Character,
    displayType: 'basic' | 'enhanced' | 'compact'
  ): Promise<void> {
    try {
      if (displayType === 'enhanced') {
        await this.postEnhancedCharacterInfo(thread, character)
        // Enhanced表示でもダイスロールボタンを表示
        await this.postActionButtons(thread, thread.id)
        await this.postSkillRollButtons(thread, character)
        // 柔軟ダイス計算メニューを追加
        await this.postFlexibleDiceMenu(thread, character)
        // プリセットボタンを追加
        await this.postPresetDiceButtons(thread, character)
      } else if (displayType === 'compact') {
        await this.postCompactCharacterInfo(thread, character)
        // Compact表示でもダイスロールボタンを表示
        await this.postActionButtons(thread, thread.id)
        await this.postSkillRollButtons(thread, character)
        // 柔軟ダイス計算メニューを追加
        await this.postFlexibleDiceMenu(thread, character)
        // プリセットボタンを追加
        await this.postPresetDiceButtons(thread, character)
      } else {
        // basic display
        await this.postCharacterInfo(thread, character)
        await this.postActionButtons(thread, thread.id)
        await this.postSkillRollButtons(thread, character)
        // 柔軟ダイス計算メニューを追加
        await this.postFlexibleDiceMenu(thread, character)
        // プリセットボタンを追加
        await this.postPresetDiceButtons(thread, character)
      }
    } catch (error) {
      this.logger.error(`Failed to post character display (${displayType}), falling back to basic`, error)

      // フォールバック: 基本表示
      await this.postCharacterInfo(thread, character)
      await this.postActionButtons(thread, thread.id)
      await this.postSkillRollButtons(thread, character)
      // 柔軟ダイス計算メニューを追加
      await this.postFlexibleDiceMenu(thread, character)
    }
  }
```

**呼び出しタイミング**:

- `displayType === 'enhanced'` の場合
- `displayType === 'compact'` の場合
- `displayType === 'basic'` の場合
- エラー時のフォールバック処理

### 2. `ThreadOrchestratorService`

```80:80:TRPG-SERVER/src/discord/features/characterThread/services/thread-orchestrator.service.ts
      await this.threadInteraction.postFlexibleDiceMenu(thread, character)
```

**注意**: これは `ThreadInteractionService.postFlexibleDiceMenu()` を呼び出していますが、こちらは**別の実装**（`flexible_dice_${channelId}` カスタムID）です。

---

## 🎨 メニューの内容

### オプション構成

1. **ステータスセクション** (`status:key:value`)
   - 例: `status:HP:100`, `status:MP:50`, `status:SAN:60`
   - ラベル: `📊 {表示名} ({値})`

2. **スキルセクション** (`skill:key:value`)
   - 例: `skill:回避:50`, `skill:隠密:60`
   - ラベル: `⚔️ {表示名} ({値})`

3. **パラメータセクション** (`parameter:key:value`)
   - 例: `parameter:STR:50`, `parameter:DEX:60`
   - ラベル: `⚙️ {表示名} ({値})`

4. **カスタム計算式** (`custom:formula:0`)
   - ラベル: `🔧 カスタム計算式`
   - 説明: 自由な計算式を入力

### 制限

- **最大25オプション**（Discordの制限）
- 値が0より大きいもののみ表示

---

## 🔄 処理フロー

```
キャラクタースレッド作成
  ↓
ThreadCreationService.createCharacterThread()
  ↓
ThreadCreationService.postCharacterDisplay()
  ↓
ThreadCreationService.postFlexibleDiceMenu()
  ↓
ThreadCreationService.createParameterSelectMenu()
  ↓
セレクトメニュー作成（カスタムID: flexible-dice-param*{characterId}）
  ↓
スレッドに投稿
  ↓
ユーザーがメニューを選択
  ↓
CharacterThreadSelectService.execute()
  ↓
CharacterThreadSelectService.handleFlexibleDiceParameterSelection()
  ↓
モーダル表示
  ↓
モーダル送信
  ↓
CustomDiceModalService.execute()
  ↓
DiceOrchestratorService.calculateAndRoll() または executeBasicNotation()
```

---

## 📊 まとめ

| 項目                   | 状態                                                 | 説明                                           |
| ---------------------- | ---------------------------------------------------- | ---------------------------------------------- |
| **メニューの存在**     | ✅ **存在**                                          | `flexible-dice-param*{characterId}` カスタムID |
| **作成場所**           | `ThreadCreationService.createParameterSelectMenu()`  | パラメータ選択メニューを作成                   |
| **投稿場所**           | `ThreadCreationService.postFlexibleDiceMenu()`       | スレッドにメニューを投稿                       |
| **呼び出しタイミング** | キャラクタースレッド作成時                           | すべての表示タイプで呼ばれる                   |
| **ハンドラー**         | ✅ **実装済み**                                      | `CharacterThreadSelectService` で処理          |
| **処理先**             | `CustomDiceModalService` → `DiceOrchestratorService` | モーダル表示 → ダイスロール実行                |

---

## ✅ 結論

**`flexible-dice-param*` メニューは存在し、キャラクタースレッド作成時に自動的に投稿されます。**

- **カスタムID**: `flexible-dice-param*{characterId}`
- **表示内容**: ステータス、スキル、パラメータ、カスタム計算式の選択メニュー
- **処理**: `CharacterThreadSelectService` で処理され、モーダル表示 → ダイスロール実行のフローが実装済み
