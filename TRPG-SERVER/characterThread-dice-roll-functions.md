# キャラクタースレッド内ダイスロール処理関数一覧

## 📋 概要

`characterThread`フォルダ内で、キャラクタースレッド内部でダイスロールするアクション処理をする関数の一覧です。

---

## 🎯 ダイスロール処理関数一覧

### 1. **UI構築・ボタン作成系**

#### `DiceUIBuilderService` (`services/dice-ui-builder.service.ts`)

##### `createDiceButtons()`

```26:64:TRPG-SERVER/src/discord/features/characterThread/services/dice-ui-builder.service.ts
  async createDiceButtons(thread: ThreadChannel, character: Character): Promise<void> {
    try {
      if (character.discordUserId == null) {
        this.logger.warn(`No discord user ID for character: ${character.characterName}`)
        return
      }

      // スキルロールボタン（上位5件のスキル）
      const skillButtons = this.createSkillButtons(character)

      // 能力値ロールボタン（上位5件の能力値）
      const abilityButtons = this.createAbilityButtons(character)

      // 一般的なダイスロールボタン
      const diceButtons = this.createGeneralDiceButtons()

      // ボタンをスレッドに投稿
      await thread.send({
        content: '**技能ロール**',
        components: [skillButtons]
      })

      await thread.send({
        content: '**能力値ロール**',
        components: [abilityButtons]
      })

      await thread.send({
        content: '**ダイスロール**',
        components: [diceButtons]
      })

      this.logger.debug(`Dice buttons created for character: ${character.characterName}`)
    } catch (error) {
      this.logger.error(`Failed to create dice buttons: ${error}`)
      await thread.send({ content: 'ダイスボタンの作成中にエラーが発生しました' })
      throw error
    }
  }
```

**責務**: スレッドにダイスロールボタンを作成して投稿

##### `createSkillButtons()`

```69:95:TRPG-SERVER/src/discord/features/characterThread/services/dice-ui-builder.service.ts
  private createSkillButtons(character: Character): ActionRowBuilder<ButtonBuilder> {
    const skillButtons = new ActionRowBuilder<ButtonBuilder>()

    if (character.skill && Object.keys(character.skill).length > 0) {
      const skillItems = Object.entries(character.skill)
        .map(([name, value]) => ({ name, value: value }))
        .sort((a, b) => getDisplayNumber(b.value) - getDisplayNumber(a.value)) // 値が大きい順にソート
        .slice(0, 5) // 上位5件を取得

      skillItems.forEach((skill, index) => {
        const skillVal = getDisplayNumber(skill.value)
        if (isNull(skillVal)) return

        if (index < 5) {
          // 最大5つまでボタンを作成
          skillButtons.addComponents(
            new ButtonBuilder()
              .setCustomId(`roll*_${skill.name}-${skillVal}`)
              .setLabel(`${skill.name}(${skillVal}%)`)
              .setStyle(ButtonStyle.Secondary)
          )
        }
      })
    }

    return skillButtons
  }
```

**責務**: スキルロールボタンを作成（カスタムID: `roll*_{skillName}-{skillValue}`）

##### `createAbilityButtons()`

```100:121:TRPG-SERVER/src/discord/features/characterThread/services/dice-ui-builder.service.ts
  private createAbilityButtons(character: Character): ActionRowBuilder<ButtonBuilder> {
    const abilityButtons = new ActionRowBuilder<ButtonBuilder>()

    const abilityItems = Object.entries(character.parameter ?? {})
      .map(([name, value]) => ({ name, value: value }))
      .sort((a, b) => getDisplayNumber(b.value) - getDisplayNumber(a.value))
      .slice(0, 5) // 上位5件を取得

    abilityItems.forEach((ability) => {
      const abilityVal = getDisplayNumber(ability.value)
      if (isNull(abilityVal)) return

      abilityButtons.addComponents(
        new ButtonBuilder()
          .setCustomId(`roll*_${ability.name}-${abilityVal}`)
          .setLabel(`${ability.name}(${abilityVal})`)
          .setStyle(ButtonStyle.Success)
      )
    })

    return abilityButtons
  }
```

**責務**: 能力値ロールボタンを作成（カスタムID: `roll*_{abilityName}-{abilityValue}`）

##### `createGeneralDiceButtons()`

```126:134:TRPG-SERVER/src/discord/features/characterThread/services/dice-ui-builder.service.ts
  private createGeneralDiceButtons(): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('roll*1d100').setLabel('1D100').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('roll*1d20').setLabel('1D20').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('roll*1d6').setLabel('1D6').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('roll*2d6').setLabel('2D6').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('roll*custom').setLabel('カスタム').setStyle(ButtonStyle.Danger)
    )
  }
```

**責務**: 一般的なダイスロールボタンを作成（1d100, 1d20, 1d6, 2d6, カスタム）

##### `parseDiceButtonCustomId()`

```203:227:TRPG-SERVER/src/discord/features/characterThread/services/dice-ui-builder.service.ts
  parseDiceButtonCustomId(customId: string): {
    type: 'skill' | 'ability' | 'general' | 'custom'
    name?: string
    value?: number
    diceExpression?: string
  } {
    if (customId.startsWith('roll*_')) {
      // スキル・能力値ロール
      const parts = customId.replace('roll*_', '').split('-')
      return {
        type: parts[0].match(/\d+/) ? 'ability' : 'skill',
        name: parts[0],
        value: parseInt(parts[1]) || 0
      }
    } else if (customId.startsWith('roll*')) {
      // 一般的なダイスロール
      const diceExpression = customId.replace('roll*', '')
      return {
        type: diceExpression === 'custom' ? 'custom' : 'general',
        diceExpression
      }
    }

    return { type: 'general' }
  }
```

**責務**: ダイスボタンのカスタムIDを解析してタイプを判定

---

#### `ThreadInteractionService` (`services/thread-interaction.service.ts`)

##### `postFlexibleDiceMenu()`

```66:101:TRPG-SERVER/src/discord/features/characterThread/services/thread-interaction.service.ts
  async postFlexibleDiceMenu(thread: ThreadChannel, character: Character): Promise<void> {
    try {
      const diceOptions = [
        { label: '1d6', value: '1d6', description: '6面ダイス1個' },
        { label: '2d6', value: '2d6', description: '6面ダイス2個' },
        { label: '1d10', value: '1d10', description: '10面ダイス1個' },
        { label: '1d20', value: '1d20', description: '20面ダイス1個' },
        { label: '1d100', value: '1d100', description: '100面ダイス1個' },
        { label: 'カスタム', value: 'custom_dice', description: 'カスタムダイス設定' }
      ]

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`flexible_dice_${character.discordChannelId}`)
        .setPlaceholder('ダイスタイプを選択してください')
        .addOptions(
          diceOptions.map((option) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(option.label)
              .setValue(option.value)
              .setDescription(option.description)
          )
        )

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)

      await thread.send({
        content: '**🎲 フレキシブルダイス**\n使用するダイスタイプを選択してください：',
        components: [row]
      })

      this.logger.debug(`Flexible dice menu posted to thread: ${thread.id}`)
    } catch (error) {
      this.logger.error(`Failed to post flexible dice menu: ${thread.id}`, error)
      throw error
    }
  }
```

**責務**: フレキシブルダイス選択メニューを投稿（カスタムID: `flexible_dice_{channelId}`）

##### `postPresetDiceButtons()`

```106:149:TRPG-SERVER/src/discord/features/characterThread/services/thread-interaction.service.ts
  async postPresetDiceButtons(thread: ThreadChannel, character: Character): Promise<void> {
    try {
      const gameSystem = character.gameSystemId?.toLowerCase() || 'generic'
      let presetButtons: ButtonBuilder[] = []

      // ゲームシステム別のプリセット
      switch (gameSystem) {
        case 'coc7':
        case 'call_of_cthulhu':
          presetButtons = this.createCoC7Buttons(character)
          break
        case 'dnd5e':
        case 'dungeons_and_dragons':
          presetButtons = this.createDnD5eButtons(character)
          break
        case 'sw2.5':
        case 'sword_world':
          presetButtons = this.createSW25Buttons(character)
          break
        default:
          presetButtons = this.createGenericButtons(character)
          break
      }

      // ボタンを5個ずつ行に分割
      const rows: ActionRowBuilder<ButtonBuilder>[] = []
      for (let i = 0; i < presetButtons.length; i += 5) {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(presetButtons.slice(i, i + 5))
        rows.push(row)
      }

      if (rows.length > 0) {
        await thread.send({
          content: '**🎯 プリセットダイス**\nゲームシステム用のクイックダイス：',
          components: rows
        })

        this.logger.debug(`Preset dice buttons posted to thread: ${thread.id}`)
      }
    } catch (error) {
      this.logger.error(`Failed to post preset dice buttons: ${thread.id}`, error)
      throw error
    }
  }
```

**責務**: ゲームシステム別のプリセットダイスボタンを投稿

##### `postSkillRollButtons()`

```154:196:TRPG-SERVER/src/discord/features/characterThread/services/thread-interaction.service.ts
  async postSkillRollButtons(thread: ThreadChannel, character: Character): Promise<void> {
    try {
      if (!character.skill || Object.keys(character.skill).length === 0) {
        this.logger.debug(`No skills found for character: ${character.characterId}`)
        return
      }

      const skillEntries = Object.entries(character.skill).slice(0, 20) // 最大20個
      const skillButtons: ButtonBuilder[] = []

      skillEntries.forEach(([skillKey, skillValue], index) => {
        const skillName = skillValue?.name || skillKey
        const skillLevel = this.extractSkillLevel(skillValue)

        const button = new ButtonBuilder()
          .setCustomId(`skill_${character.discordChannelId}_${skillKey}`)
          .setLabel(`${skillName}${skillLevel ? ` (${skillLevel})` : ''}`)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🎯')

        skillButtons.push(button)
      })

      // ボタンを5個ずつ行に分割
      const rows: ActionRowBuilder<ButtonBuilder>[] = []
      for (let i = 0; i < skillButtons.length; i += 5) {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(skillButtons.slice(i, i + 5))
        rows.push(row)
      }

      if (rows.length > 0) {
        await thread.send({
          content: '**🎯 スキルロール**\n使用するスキルを選択してください：',
          components: rows
        })

        this.logger.debug(`Skill roll buttons posted to thread: ${thread.id}`)
      }
    } catch (error) {
      this.logger.error(`Failed to post skill roll buttons: ${thread.id}`, error)
      throw error
    }
  }
```

**責務**: スキルロールボタンを投稿（カスタムID: `skill_{channelId}_{skillKey}`）

##### `createCoC7Buttons()` / `createDnD5eButtons()` / `createSW25Buttons()` / `createGenericButtons()`

```201:321:TRPG-SERVER/src/discord/features/characterThread/services/thread-interaction.service.ts
  private createCoC7Buttons(character: Character): ButtonBuilder[] {
    const channelId = character.discordChannelId || character.characterId

    return [
      new ButtonBuilder()
        .setCustomId(`dice_coc7_1d100_${channelId}`)
        .setLabel('技能判定')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎲'),
      new ButtonBuilder()
        .setCustomId(`dice_coc7_sanity_${channelId}`)
        .setLabel('SAN値判定')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('😱'),
      new ButtonBuilder()
        .setCustomId(`dice_coc7_idea_${channelId}`)
        .setLabel('アイデア')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('💡'),
      new ButtonBuilder()
        .setCustomId(`dice_coc7_luck_${channelId}`)
        .setLabel('幸運')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🍀'),
      new ButtonBuilder()
        .setCustomId(`dice_coc7_damage_${channelId}`)
        .setLabel('ダメージ')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('💥')
    ]
  }
```

**責務**: ゲームシステム別のプリセットダイスボタンを作成

---

#### `ThreadCreationService` (`services/thread-creation.service.ts`)

##### `postFlexibleDiceMenu()`

```343:357:TRPG-SERVER/src/discord/features/characterThread/services/thread-creation.service.ts
  private async postFlexibleDiceMenu(thread: ThreadChannel, character: Character): Promise<void> {
    try {
      const selectMenu = this.createParameterSelectMenu(character)
      if (!selectMenu) {
        this.logger.warn('No parameters found for flexible dice menu')
        return
      }

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)

      await thread.send({
        content: '**🎲 フレキシブルダイス**\n計算に使用するパラメータを選択してください：',
        components: [row]
      })
    } catch (error) {
      this.logger.error('Failed to post flexible dice menu', error)
      throw error
    }
  }
```

**責務**: フレキシブルダイスメニューを投稿（パラメータ選択式）

##### `postPresetDiceButtons()`

```470:489:TRPG-SERVER/src/discord/features/characterThread/services/thread-creation.service.ts
  private async postPresetDiceButtons(thread: ThreadChannel, character: Character): Promise<void> {
    try {
      const gameSystem = character.gameSystemId?.toLowerCase() || 'generic'
      const presetButtons = this.createPresetDiceButtons(character, gameSystem)

      if (presetButtons.length === 0) {
        this.logger.debug('No preset buttons to post')
        return
      }

      // ボタンを5個ずつ行に分割
      const rows: ActionRowBuilder<ButtonBuilder>[] = []
      for (let i = 0; i < presetButtons.length; i += 5) {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(presetButtons.slice(i, i + 5))
        rows.push(row)
      }

      await thread.send({
        content: '**🎯 プリセットダイス**\nゲームシステム用のクイックダイス：',
        components: rows
      })
    } catch (error) {
      this.logger.error('Failed to post preset dice buttons', error)
      throw error
    }
  }
```

**責務**: プリセットダイスボタンを投稿

##### `createParameterSelectMenu()`

```364:473:TRPG-SERVER/src/discord/features/characterThread/services/thread-creation.service.ts
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
          let displayName = key
          let displayValue = ''

          if (typeof value === 'object' && value && 'name' in value && 'value' in value) {
            displayName = (value as any).name || key
            displayValue = String((value as any).value || 0)
          } else {
            displayValue = String(value || 0)
          }

          if (parseInt(displayValue) > 0) {
            options.push(
              new StringSelectMenuOptionBuilder()
                .setLabel(`📊 ${displayName} (${displayValue})`)
                .setValue(`status:${key}:${displayValue}`)
                .setDescription(`ステータス: ${displayName}を使用`)
            )
          }
        }
      }

      // スキルセクション
      if (character.skill && Object.keys(character.skill).length > 0) {
        for (const [key, value] of Object.entries(character.skill)) {
          let displayName = key
          let displayValue = ''

          if (typeof value === 'object' && value && 'name' in value && 'value' in value) {
            displayName = (value as any).name || key
            displayValue = String((value as any).value || 0)
          } else {
            displayValue = String(value || 0)
          }

          if (parseInt(displayValue) > 0) {
            options.push(
              new StringSelectMenuOptionBuilder()
                .setLabel(`⚔️ ${displayName} (${displayValue})`)
                .setValue(`skill:${key}:${displayValue}`)
                .setDescription(`スキル: ${displayName}を使用`)
            )
          }
        }
      }

      // パラメータセクション
      if (character.parameter && Object.keys(character.parameter).length > 0) {
        for (const [key, value] of Object.entries(character.parameter)) {
          let displayName = key
          let displayValue = ''

          if (typeof value === 'object' && value && 'name' in value && 'value' in value) {
            displayName = (value as any).name || key
            displayValue = String((value as any).value || 0)
          } else {
            displayValue = String(value || 0)
          }

          if (parseInt(displayValue) > 0) {
            options.push(
              new StringSelectMenuOptionBuilder()
                .setLabel(`💪 ${displayName} (${displayValue})`)
                .setValue(`parameter:${key}:${displayValue}`)
                .setDescription(`パラメータ: ${displayName}を使用`)
            )
          }
        }
      }

      // Discord制限：最大25個のオプション
      if (options.length > 25) {
        options.slice(0, 25)
      }

      if (options.length === 0) {
        return null
      }

      selectMenu.addOptions(...options)
      return selectMenu
    } catch (error) {
      this.logger.error('Failed to create parameter select menu', error)
      return null
    }
  }
```

**責務**: パラメータ選択メニューを作成（カスタムID: `flexible-dice-param*{characterId}`）

---

#### `CharacterChannelService` (`character-channel.service.ts`)

##### `createDiceButtons()`

```401:512:TRPG-SERVER/src/discord/features/characterThread/character-channel.service.ts
  async createDiceButtons(thread: ThreadChannel, character: Character): Promise<void> {
    try {
      if (character.discordUserId == null) return
      console.log(character.discordUserId)
      // const customId = `character-tab*${character.discordChannelId}*`
      // const basic = `character-tab*${character.discordChannelId}*basic`
      // const status = `character-tab*${character.discordChannelId}*status`
      // const skills = `character-tab*${character.discordChannelId}*skills`
      // const items = `character-tab*${character.discordChannelId}*items`
      // const desc = `character-tab*${character.discordChannelId}*desc`
      // カテゴリボタン（タブボタン）
      // const categoryButtons = new ActionRowBuilder<ButtonBuilder>()
      //   .addComponents(
      //     new ButtonBuilder()
      //       .setCustomId(basic)
      //       .setLabel('基本情報')
      //       .setStyle(ButtonStyle.Primary),
      //     new ButtonBuilder()
      //       .setCustomId(status)
      //       .setLabel('ステータス')
      //       .setStyle(ButtonStyle.Primary),
      //     new ButtonBuilder()
      //       .setCustomId(skills)
      //       .setLabel('スキル')
      //       .setStyle(ButtonStyle.Primary),
      //     new ButtonBuilder()
      //       .setCustomId(items)
      //       .setLabel('アイテム')
      //       .setStyle(ButtonStyle.Primary),
      //     new ButtonBuilder()
      //       .setCustomId(desc)
      //       .setLabel('背景設定')
      //       .setStyle(ButtonStyle.Primary)
      //   );

      // スキルロールボタン（上位5件のスキル）
      const skillButtons = new ActionRowBuilder<ButtonBuilder>()

      if (character.skill && Object.keys(character.skill).length > 0) {
        const skillItems = Object.entries(character.skill)
          .map(([name, value]) => ({ name, value: value }))
          .sort((a, b) => getDisplayNumber(b.value) - getDisplayNumber(a.value)) // 値が大きい順にソート
          .slice(0, 5) // 上位5件を取得

        skillItems.forEach((skill, index) => {
          const skillVal = getDisplayNumber(skill.value)
          if (isNull(skillVal)) return
          if (index < 5) {
            // 最大5つま
            // でボタンを作成
            skillButtons.addComponents(
              new ButtonBuilder()
                .setCustomId(`roll*_${skill.name}-${skillVal}`)
                .setLabel(`${skill.name}(${skillVal}%)`)
                .setStyle(ButtonStyle.Secondary)
            )
          }
        })
      }

      // 能力値ロールボタン
      const abilityButtons = new ActionRowBuilder<ButtonBuilder>()

      const abilityItems = Object.entries(character.parameter ?? {})
        .map(([name, value]) => ({ name, value: value }))
        .sort((a, b) => getDisplayNumber(b.value) - getDisplayNumber(a.value))
        .slice(0, 5) // 上位5件を取得

      abilityItems.forEach((ability) => {
        const abilityVal = getDisplayNumber(ability.value)
        if (isNull(abilityVal)) return
        abilityButtons.addComponents(
          new ButtonBuilder()
            .setCustomId(`roll*_${ability.name}-${abilityVal}`)
            .setLabel(`${ability.name}(${abilityVal})`)
            .setStyle(ButtonStyle.Success)
        )
      })
      // 一般的なダイスロールボタン
      const diceButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('roll*1d100').setLabel('1D100').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('roll*1d20').setLabel('1D20').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('roll*1d6').setLabel('1D6').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('roll*2d6').setLabel('2D6').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('roll*custom').setLabel('カスタム').setStyle(ButtonStyle.Danger)
      )

      // ボタンをスレッドに投稿
      // await thread.send({
      //   content: '**操作メニュー**',
      //   components: [categoryButtons]
      // });

      await thread.send({
        content: '**技能ロール**',
        components: [skillButtons]
      })

      await thread.send({
        content: '**能力値ロール**',
        components: [abilityButtons]
      })

      await thread.send({
        content: '**ダイスロール**',
        components: [diceButtons]
      })
    } catch (error) {
      console.error('ダイスボタン作成エラー:', error)
      thread.send({ content: 'ダイスボタンの作成中にエラーが発生しました' })
    }
  }
```

**責務**: ダイスロールボタンを作成してスレッドに投稿（旧実装）

---

### 2. **ダイスロール実行・処理系**

#### `CharacterDiceOrchestratorService` (`interactions/button/character-dice-orchestrator.service.ts`)

##### `execute()`

```42:80:TRPG-SERVER/src/discord/interactions/button/character-dice-orchestrator.service.ts
  async execute(interaction: ButtonInteraction<CacheType>): Promise<void> {
    try {
      const customId = interaction.customId

      this.logger.debug(`Processing button interaction: ${customId}`)

      // カスタムダイスロールの場合
      if (customId === 'roll*custom') {
        await this.diceButtonUI.execute(interaction)
        return
      }

      // プリセットダイスロールの場合
      if (customId.startsWith('preset-dice*')) {
        await this.dicePresetService.handlePresetDiceRoll(interaction, customId)
        return
      }

      // 操作中を示す
      await interaction.deferUpdate()

      // 通常のスキルロールまたはダイスロールの処理
      const rollInfo = customId.replace('roll*', '')
      await this.handleStandardDiceRoll(interaction, rollInfo)
    } catch (error) {
      this.logger.error('Failed to execute button interaction', error)

      const errorContext = {
        operation: 'CharacterDiceOrchestratorService.execute',
        customId: interaction.customId,
        userId: interaction.user.id,
        channelId: interaction.channelId
      }

      await ErrorHandler.handleDiscordError(error, interaction, errorContext)

      // ErrorHandlerが応答を処理するため、追加の応答は不要
    }
  }
```

**責務**: ボタンインタラクションをルーティングして適切な処理に振り分け

##### `handleStandardDiceRoll()`

```85:127:TRPG-SERVER/src/discord/interactions/button/character-dice-orchestrator.service.ts
  private async handleStandardDiceRoll(interaction: ButtonInteraction, rollInfo: string): Promise<void> {
    try {
      // channelIdを抽出
      const channelId = this.extractChannelId(rollInfo)
      if (!channelId) {
        throw new Error('Channel ID could not be extracted from button interaction')
      }

      // ダイスタイプと理由を分析
      const { diceType, reason } = this.parseDiceRollInfo(rollInfo, channelId)

      // ダイスロールリクエストを作成
      const request: DiceRollRequest = {
        channelId,
        diceType,
        reason,
        userId: interaction.user.id
      }

      // ダイスロール処理を実行
      const result = await this.diceRollLogic.handleDiceRoll(interaction, request)

      if (result.success === false) {
        // エラー結果を表示
        const errorEmbed = this.diceButtonUI.createErrorEmbed(
          result.error || 'ダイスロールに失敗しました',
          `ダイス: ${result.diceType}`
        )

        await interaction.editReply({ embeds: [errorEmbed] })
        return
      }

      // 成功結果を表示
      await this.displayDiceResult(interaction, result, channelId)

      // 履歴を更新（バックグラウンド）
      await this.updateHistoryInBackground(interaction, channelId, result)
    } catch (error) {
      this.logger.error(`Failed to handle standard dice roll: ${rollInfo}`, error)
      throw error
    }
  }
```

**責務**: 標準的なダイスロール処理を実行

##### `handleSkillRoll()`

```241:269:TRPG-SERVER/src/discord/interactions/button/character-dice-orchestrator.service.ts
  async handleSkillRoll(
    interaction: ButtonInteraction,
    channelId: string,
    skillName: string,
    skillValue: number,
    reason?: string
  ): Promise<void> {
    try {
      await interaction.deferUpdate()

      const result = await this.diceRollLogic.handleSkillRoll(interaction, channelId, skillName, skillValue, reason)

      await this.displayDiceResult(interaction, result, channelId)
      await this.updateHistoryInBackground(interaction, channelId, result)
    } catch (error) {
      this.logger.error(`Failed to handle skill roll: ${skillName}`, error)

      const errorEmbed = this.diceButtonUI.createErrorEmbed(
        'スキルロールに失敗しました',
        `スキル: ${skillName}(${skillValue})`
      )

      if (interaction.deferred) {
        await interaction.editReply({ embeds: [errorEmbed] })
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true })
      }
    }
  }
```

**責務**: スキルロール処理を実行

##### `handleCustomDiceRoll()`

```274:313:TRPG-SERVER/src/discord/interactions/button/character-dice-orchestrator.service.ts
  async handleCustomDiceRoll(
    interaction: ButtonInteraction,
    channelId: string,
    diceExpression: string,
    reason?: string
  ): Promise<void> {
    try {
      // ダイス式の妥当性検証
      const validation = this.diceRollLogic.validateDiceExpression(diceExpression)
      if (!validation.isValid) {
        const errorEmbed = this.diceButtonUI.createErrorEmbed(
          validation.error || 'ダイス式が無効です',
          `入力: ${diceExpression}`
        )

        await interaction.reply({ embeds: [errorEmbed], ephemeral: true })
        return
      }

      await interaction.deferUpdate()

      const result = await this.diceRollLogic.handleCustomDiceRoll(interaction, channelId, diceExpression, reason)

      await this.displayDiceResult(interaction, result, channelId)
      await this.updateHistoryInBackground(interaction, channelId, result)
    } catch (error) {
      this.logger.error(`Failed to handle custom dice roll: ${diceExpression}`, error)

      const errorEmbed = this.diceButtonUI.createErrorEmbed(
        'カスタムダイスロールに失敗しました',
        `ダイス: ${diceExpression}`
      )

      if (interaction.deferred) {
        await interaction.editReply({ embeds: [errorEmbed] })
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true })
      }
    }
  }
```

**責務**: カスタムダイスロール処理を実行

---

#### `DiceRollLogicService` (`interactions/button/dice-roll-logic.service.ts`)

##### `handleDiceRoll()`

```35:106:TRPG-SERVER/src/discord/interactions/button/dice-roll-logic.service.ts
  async handleDiceRoll(interaction: ButtonInteraction, req: DiceRollRequest): Promise<DiceRollResult> {
    try {
      this.logger.debug(`Processing dice roll: ${req.diceType} for channel: ${req.channelId}`)

      // キャラクター情報を取得
      const character = await this.characterService.findByChannelId(req.channelId)
      if (!character) {
        throw new Error(`Character not found for channel: ${req.channelId}`)
      }

      // ダイスロールを実行
      const rollResult = await this.executeDiceRoll(req.diceType, req.reason)

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

      // イベントを発行
      await this.typedEventService.emit('diceroll.execute.completed', {
        channelId: req.channelId,
        result: {
          total: rollResult.total,
          details: rollResult.details,
          diceType: req.diceType,
          reason: req.reason
        },
        source: 'dice-roll-logic-service',
        timestamp: new Date()
      })

      const result: DiceRollResult = {
        success: true,
        total: rollResult.total,
        details: rollResult.details,
        diceType: req.diceType,
        reason: req.reason,
        characterName: character.characterName,
        rollId: savedRoll._id?.toString()
      }

      this.logger.debug(`Dice roll completed: ${result.total} (${result.details})`)
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.error(`Dice roll failed: ${errorMessage}`, error)

      // エラーイベントを発行
      await this.typedEventService.emit('diceroll.execute.failed', {
        channelId: req.channelId,
        error: errorMessage,
        source: 'dice-roll-logic-service',
        timestamp: new Date()
      })

      return {
        success: false,
        error: errorMessage,
        diceType: req.diceType,
        reason: req.reason
      }
    }
  }
```

**責務**: ダイスロール処理を実行し、結果をDBに保存

##### `executeDiceRoll()`

```111:134:TRPG-SERVER/src/discord/interactions/button/dice-roll-logic.service.ts
  private async executeDiceRoll(diceExpression: string, reason?: string): Promise<{ total: number; details: string }> {
    try {
      // ダイス式をクリーンアップ
      const cleanExpression = this.cleanDiceExpression(diceExpression)

      // ダイスロールを実行
      const result = await dice(cleanExpression)

      if (!result || !result.text) {
        throw new Error(`Invalid dice roll result for: ${cleanExpression}`)
      }

      // BCDiceの結果形式に合わせて処理
      const total = parseInt(result.text.replace(/.*?(\d+).*/, '$1')) || 0

      return {
        total,
        details: result.text || `${cleanExpression} = ${total}`
      }
    } catch (error) {
      this.logger.error(`Failed to execute dice roll: ${diceExpression}`, error)
      throw new Error(`ダイスロールの実行に失敗しました: ${diceExpression}`)
    }
  }
```

**責務**: 実際のダイスロール計算を実行

##### `handleSkillRoll()`

```163:222:TRPG-SERVER/src/discord/interactions/button/dice-roll-logic.service.ts
  async handleSkillRoll(
    interaction: ButtonInteraction,
    channelId: string,
    skillName: string,
    skillValue: number,
    reason?: string
  ): Promise<DiceRollResult> {
    try {
      // CoC7形式のスキル判定（1d100 <= skillValue）
      const rollResult = await this.executeDiceRoll('1d100')
      const isSuccess = rollResult.total <= skillValue
      const successLevel = this.determineSuccessLevel(rollResult.total, skillValue)

      const enhancedReason = reason ? `${skillName}(${skillValue}) - ${reason}` : `${skillName}(${skillValue})`

      // 結果の詳細を作成
      const details = `${rollResult.details} ≤ ${skillValue} → ${isSuccess ? '成功' : '失敗'} (${successLevel})`

      // キャラクター情報を取得
      const character = await this.characterService.findByChannelId(channelId)
      const characterName = character?.characterName || 'Unknown'

      // データベースに保存
      const diceRollData: DiceRollTextInputDto = {
        channelId,
        userId: interaction.user.id,
        diceExpression: '1d100',
        result: rollResult.total,
        resultDetails: details,
        reason: enhancedReason,
        characterName,
        gameSystem: character?.gameSystemId || 'coc7'
      }

      await this.diceRollService.createText(diceRollData)

      return {
        success: true,
        total: rollResult.total,
        details,
        diceType: '1d100',
        reason: enhancedReason,
        characterName,
        isSkillRoll: true,
        skillSuccess: isSuccess,
        successLevel
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.error(`Skill roll failed: ${errorMessage}`, error)

      return {
        success: false,
        error: errorMessage,
        diceType: '1d100',
        reason: `${skillName}(${skillValue})`,
        isSkillRoll: true
      }
    }
  }
```

**責務**: スキルロール処理を実行（CoC7形式: 1d100 <= skillValue）

##### `handleCustomDiceRoll()`

```244:292:TRPG-SERVER/src/discord/interactions/button/dice-roll-logic.service.ts
  async handleCustomDiceRoll(
    interaction: ButtonInteraction,
    channelId: string,
    diceExpression: string,
    reason?: string
  ): Promise<DiceRollResult> {
    try {
      const rollResult = await this.executeDiceRoll(diceExpression, reason)

      // キャラクター情報を取得
      const character = await this.characterService.findByChannelId(channelId)
      const characterName = character?.characterName || 'Unknown'

      // データベースに保存
      const diceRollData: DiceRollTextInputDto = {
        channelId,
        userId: interaction.user.id,
        diceExpression,
        result: rollResult.total,
        resultDetails: rollResult.details,
        reason,
        characterName,
        gameSystem: character?.gameSystemId || 'custom'
      }

      await this.diceRollService.createText(diceRollData)

      return {
        success: true,
        total: rollResult.total,
        details: rollResult.details,
        diceType: diceExpression,
        reason,
        characterName,
        isCustomRoll: true
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.error(`Custom dice roll failed: ${errorMessage}`, error)

      return {
        success: false,
        error: errorMessage,
        diceType: diceExpression,
        reason,
        isCustomRoll: true
      }
    }
  }
```

**責務**: カスタムダイスロール処理を実行

##### `validateDiceExpression()`

```297:327:TRPG-SERVER/src/discord/interactions/button/dice-roll-logic.service.ts
  validateDiceExpression(expression: string): { isValid: boolean; error?: string } {
    try {
      const cleaned = this.cleanDiceExpression(expression)

      // 基本的なダイス式パターンをチェック
      const basicPattern = /^\d*d\d+([+\-*/]\d+)*$/
      const complexPattern = /^[\d+\-*/()d]+$/

      if (!basicPattern.test(cleaned) && !complexPattern.test(cleaned)) {
        return {
          isValid: false,
          error: 'ダイス式の形式が正しくありません。例: 1d100, 2d6+3'
        }
      }

      // 危険な値をチェック
      if (cleaned.includes('d0') || cleaned.includes('d1000000')) {
        return {
          isValid: false,
          error: 'ダイスの面数が無効です'
        }
      }

      return { isValid: true }
    } catch (error) {
      return {
        isValid: false,
        error: 'ダイス式の解析に失敗しました'
      }
    }
  }
```

**責務**: ダイス式の妥当性を検証

---

## 📊 処理フロー

### ボタンクリック → ダイスロール実行

```
Discord Button Click (roll*...)
  ↓
InteractionsController.handleButtonInteraction()
  ↓
CharacterDiceOrchestratorService.execute()
  ├─ roll*custom → DiceButtonUIService.execute()
  ├─ preset-dice* → DicePresetService.handlePresetDiceRoll()
  └─ roll*... → handleStandardDiceRoll()
      ↓
DiceRollLogicService.handleDiceRoll()
  ├─ executeDiceRoll() → ダイス計算
  ├─ DiceRollService.createText() → DB保存
  └─ TypedEventService.emit() → イベント発行
      ↓
CharacterDiceOrchestratorService.displayDiceResult()
  └─ 結果をEmbedで表示
```

---

## 🎯 カスタムID形式

### ボタンカスタムID一覧

| カスタムID形式                       | 説明                       | 処理先                             |
| ------------------------------------ | -------------------------- | ---------------------------------- |
| `roll*1d100`                         | 1d100ダイスロール          | `CharacterDiceOrchestratorService` |
| `roll*1d20`                          | 1d20ダイスロール           | `CharacterDiceOrchestratorService` |
| `roll*1d6`                           | 1d6ダイスロール            | `CharacterDiceOrchestratorService` |
| `roll*2d6`                           | 2d6ダイスロール            | `CharacterDiceOrchestratorService` |
| `roll*custom`                        | カスタムダイスロール       | `DiceButtonUIService`              |
| `roll*_{skillName}-{skillValue}`     | スキルロール               | `CharacterDiceOrchestratorService` |
| `roll*_{abilityName}-{abilityValue}` | 能力値ロール               | `CharacterDiceOrchestratorService` |
| `preset-dice*...`                    | プリセットダイスロール     | `DicePresetService`                |
| `flexible_dice_{channelId}`          | フレキシブルダイスメニュー | `CharacterThreadSelectService`     |
| `flexible-dice-param*{characterId}`  | パラメータ選択メニュー     | `CharacterThreadSelectService`     |
| `dice_coc7_*`                        | CoC7用プリセット           | `DicePresetService`                |
| `dice_dnd5e_*`                       | D&D 5e用プリセット         | `DicePresetService`                |
| `dice_sw25_*`                        | SW2.5用プリセット          | `DicePresetService`                |
| `skill_{channelId}_{skillKey}`       | スキルロールボタン         | `CharacterDiceButtonsService`      |

---

## 📝 まとめ

### UI構築系関数

- `DiceUIBuilderService.createDiceButtons()` - メインのダイスボタン作成
- `ThreadInteractionService.postFlexibleDiceMenu()` - フレキシブルダイスメニュー
- `ThreadInteractionService.postPresetDiceButtons()` - プリセットダイスボタン
- `ThreadCreationService.postFlexibleDiceMenu()` - パラメータ選択式メニュー

### 実行処理系関数

- `CharacterDiceOrchestratorService.execute()` - ボタンインタラクション統合処理
- `DiceRollLogicService.handleDiceRoll()` - ダイスロール実行
- `DiceRollLogicService.handleSkillRoll()` - スキルロール実行
- `DiceRollLogicService.handleCustomDiceRoll()` - カスタムダイスロール実行

### 特徴

- **モジュラー設計**: UI構築と実行処理が分離
- **ゲームシステム対応**: CoC7, D&D 5e, SW2.5などに対応
- **イベント駆動**: ダイスロール完了時にイベント発行
- **DB保存**: 全ダイスロール結果をDBに保存
