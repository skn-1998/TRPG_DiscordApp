# postFlexibleDiceMenu 実行結果のダイスロール関数追跡

## 📋 概要

`postFlexibleDiceMenu` 関数が実行された結果、どのダイスロール関数が動いているかを追跡した結果です。

---

## 🔍 問題点の発見

### **重要な発見: ハンドラー未実装**

`postFlexibleDiceMenu` は以下のカスタムIDのセレクトメニューを作成します：

```78:78:TRPG-SERVER/src/discord/features/characterThread/services/thread-interaction.service.ts
        .setCustomId(`flexible_dice_${character.discordChannelId}`)
```

しかし、`interactions.controller.ts` の `handleSelectMenuInteraction` を確認すると、**`flexible_dice_` で始まるカスタムIDを処理するハンドラーが見つかりません**。

```198:236:TRPG-SERVER/src/discord/interactions/interactions.controller.ts
  private async handleSelectMenuInteraction(interaction: AnySelectMenuInteraction): Promise<void> {
    const customId = interaction.customId

    // Character Thread Create Select（専用処理）
    if (customId === 'character-thread-create-select') {
      await this.doInteractions(this.characterThreadSelectService, { customId: 'character-thread-create-select' })
      return
    }

    // Enhanced Character Edit Service（統合済み）
    if (
      customId.startsWith('character-edit-') ||
      customId.startsWith('character-section-select-') ||
      customId.startsWith('character-field-')
    ) {
      await this.enhancedCharacterEditService.handleSelectMenuInteraction(interaction as any)
      return
    }

    // 通常のセレクトメニュー処理
    if (customId === 'dice-character-select') {
      await this.doInteractions(this.diceCharacterSelectService, { customId: 'dice-character-select' })
      return
    }

    if (customId === characterThreadIds.selectCharacterChannel.customId) {
      await this.doInteractions(this.characterThreadSelectService, {
        customId: characterThreadIds.selectCharacterChannel.customId
      })
      return
    }

    if (customId === 'dice-page-select') {
      await this.doInteractions(this.dicePageSelectMenuService, { customId: 'dice-page-select' })
      return
    }

    this.logger.warn(`Unknown select menu customId: ${customId}`)
  }
```

**結果**: `flexible_dice_` で始まるカスタムIDは `Unknown select menu customId` として警告されるだけで、処理されません。

---

## 🔄 想定される処理フロー（未実装）

もし実装されていた場合の想定フロー：

### 1. セレクトメニュー選択時

```
ユーザーがセレクトメニューで選択（1d6, 2d6, 1d10, 1d20, 1d100, custom_dice）
  ↓
InteractionsController.handleSelectMenuInteraction()
  ↓
[未実装] flexible_dice_ ハンドラー
  ↓
選択値に応じた処理
  ├─ 1d6, 2d6, 1d10, 1d20, 1d100 → 直接ダイスロール実行
  └─ custom_dice → カスタムダイスモーダル表示
```

### 2. 直接ダイスロールの場合（1d6, 2d6, 1d10, 1d20, 1d100）

想定される処理：

- `DiceRollLogicService.handleDiceRoll()` または
- `DiceRollLogicService.handleCustomDiceRoll()` または
- `DiceOrchestratorService.executeBasicNotation()`

### 3. カスタムダイス（custom_dice）の場合

想定される処理：

- `CustomDiceModalService` のモーダルを表示
- モーダル送信後、`CustomDiceModalService.execute()` が呼ばれる
- `DiceOrchestratorService.executeBasicNotation()` または `DiceOrchestratorService.calculateAndRoll()` が実行される

---

## 🔍 類似機能の実装（参考）

### `flexible-dice-param*` の処理（実装済み）

`ThreadCreationService.postFlexibleDiceMenu()` は別の形式で実装されています：

```367:367:TRPG-SERVER/src/discord/features/characterThread/services/thread-creation.service.ts
        .setCustomId(`flexible-dice-param*${character.characterId}`)
```

このカスタムIDは `CharacterThreadSelectService` で処理されています：

```46:59:TRPG-SERVER/src/discord/interactions/select/character-thread-select.service.ts
      const isFlexibleDiceSelect = customId.startsWith('flexible-dice-param*')

      if (!isLegacySelect && !isThreadSelect && !isCurrentSelect && !isCreateSelect && !isFlexibleDiceSelect) {
        return
      }

      // 選択されたキャラクターID
      const selectedCharacterId = interaction.values[0]

      this.logger.log(`Character selection: ${selectedCharacterId}, mode: ${customId}`)

      if (isFlexibleDiceSelect) {
        // 柔軟ダイス計算のパラメータ選択処理
        await this.handleFlexibleDiceParameterSelection(interaction, selectedCharacterId)
      }
```

この処理では：

1. パラメータ選択メニューを表示
2. パラメータ選択後、モーダルを表示
3. モーダル送信後、`CustomDiceModalService.execute()` が呼ばれる
4. `DiceOrchestratorService.calculateAndRoll()` または `DiceOrchestratorService.executeBasicNotation()` が実行される

---

## 📊 実際に呼ばれる可能性のあるダイスロール関数

### モーダル送信後の処理（実装済み）

`CustomDiceModalService.execute()` が呼ばれた場合：

```22:84:TRPG-SERVER/src/discord/interactions/modal/custom-dice-modal.service.ts
  async execute(interaction: ModalSubmitInteraction<CacheType>): Promise<void> {
    try {
      // CustomIdからcharacterIdを抽出
      const characterId = this.extractCharacterIdFromCustomId(interaction.customId)

      // パラメータベースモーダルかカスタムモーダルかを判定
      const isParameterBased = interaction.customId.startsWith('param-dice-modal*')

      // 入力値を取得（フィールド名が異なる可能性を考慮）
      let diceCommand: string
      if (isParameterBased) {
        diceCommand = interaction.fields.getTextInputValue('dice-formula')
      } else {
        diceCommand = interaction.fields.getTextInputValue('dice-command')
      }

      const comment = interaction.fields.getTextInputValue('dice-comment') || ''

      // パラメータベースかカスタムかで処理分岐
      let multiplier = 1
      let modifier = 0

      if (isParameterBased) {
        // パラメータベースの場合は乗数・修正値フィールドがある
        const multiplierText = interaction.fields.getTextInputValue('multiplier') || ''
        const modifierText = interaction.fields.getTextInputValue('modifier') || ''
        multiplier = this.parseNumberInput(multiplierText, 1)
        modifier = this.parseNumberInput(modifierText, 0)
      }

      // キャラクター情報を取得（必要に応じて）
      let character: Character | undefined = undefined
      if (characterId) {
        try {
          const foundCharacter = await this.characterService.findOne(characterId)
          character = foundCharacter || undefined
        } catch (error) {
          console.warn(`Character not found: ${characterId}`, error)
        }
      }

      // 統一ハンドラーで計算実行
      let resultMessage: string
      let characterName = 'プレイヤー'
      if (character) {
        characterName = character.characterName || characterName
      }

      try {
        let calculationResult: any

        if (isParameterBased) {
          // パラメータベースダイス（キャラクターデータ使用）
          calculationResult = await this.diceOrchestratorService.calculateAndRoll(
            diceCommand,
            multiplier,
            modifier,
            character
          )
        } else {
          // カスタムダイス（ダイス記法専用）
          calculationResult = await this.diceOrchestratorService.executeBasicNotation(diceCommand, characterName)
        }
```

**呼ばれる関数**:

- `DiceOrchestratorService.calculateAndRoll()` - パラメータベースの場合
- `DiceOrchestratorService.executeBasicNotation()` - カスタムダイスの場合

---

## 🎯 結論

### 現在の状態

1. **`postFlexibleDiceMenu` はセレクトメニューを作成するが、ハンドラーが未実装**
   - カスタムID: `flexible_dice_${character.discordChannelId}`
   - 処理: 未実装（警告のみ）

2. **類似機能は実装済み**
   - `flexible-dice-param*` 形式は `CharacterThreadSelectService` で処理
   - モーダル送信後、`CustomDiceModalService.execute()` が呼ばれる
   - `DiceOrchestratorService.calculateAndRoll()` または `DiceOrchestratorService.executeBasicNotation()` が実行される

### 実装が必要な処理

`interactions.controller.ts` の `handleSelectMenuInteraction` に以下を追加する必要があります：

```typescript
// flexible_dice_ で始まるカスタムIDの処理
if (customId.startsWith('flexible_dice_')) {
  // 選択値に応じた処理
  const selectedValue = interaction.values[0]

  if (selectedValue === 'custom_dice') {
    // カスタムダイスモーダルを表示
    await this.showCustomDiceModal(interaction, channelId)
  } else {
    // 直接ダイスロール実行
    await this.executeDirectDiceRoll(interaction, selectedValue, channelId)
  }
  return
}
```

### 想定されるダイスロール関数

実装された場合、以下の関数が呼ばれる可能性があります：

1. **直接ダイスロール（1d6, 2d6, 1d10, 1d20, 1d100）**
   - `DiceRollLogicService.handleDiceRoll()`
   - `DiceRollLogicService.handleCustomDiceRoll()`
   - `DiceOrchestratorService.executeBasicNotation()`

2. **カスタムダイス（custom_dice）**
   - `CustomDiceModalService.execute()` → モーダル表示
   - モーダル送信後: `DiceOrchestratorService.executeBasicNotation()`

---

## 📝 まとめ

| 項目                        | 状態          | 説明                                    |
| --------------------------- | ------------- | --------------------------------------- |
| `postFlexibleDiceMenu` 実行 | ✅ 実装済み   | セレクトメニューを作成                  |
| セレクトメニューハンドラー  | ❌ **未実装** | `flexible_dice_` カスタムIDの処理がない |
| モーダル処理                | ✅ 実装済み   | `CustomDiceModalService.execute()`      |
| ダイスロール実行            | ✅ 実装済み   | `DiceOrchestratorService` 経由          |

**結論**: `postFlexibleDiceMenu` はUIを作成しますが、実際のダイスロール処理は**未実装**です。セレクトメニューを選択しても処理されません。
