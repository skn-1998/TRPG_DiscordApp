/**
 * Thread Creation Service
 *
 * characterEditパターンに基づくシンプルなスレッド作成サービス
 * 過度な抽象化を排除し、実用性を重視
 */

import { Injectable, Logger } from '@nestjs/common'
import {
  Client,
  Guild,
  TextChannel,
  ThreadChannel,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ThreadAutoArchiveDuration,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} from 'discord.js'
import { Character } from '../../../../domains/character/models/character.model'
import { ErrorHandler, ErrorContext } from '../../../../utils/error-handler'
import { DiscordClientService } from '../../../services/discord-client.service'
import { TypedEventService } from '../../../../shared/application/typed-event.service'
import { CharacterService } from '../../../../domains/character/character.service'

/**
 * スレッド作成リクエスト
 */
export interface CreateThreadRequest {
  characterId: string
  characterName: string
  channelId: string
  creatorId: string
  guildId: string
  displayType?: 'basic' | 'enhanced' | 'compact' // 表示タイプ
}

/**
 * スレッド作成結果
 */
export interface CreateThreadResult {
  success: boolean
  threadId?: string
  threadUrl?: string
  error?: string
}

/**
 * スレッド作成サービス
 *
 * Discord APIを直接使用してスレッドを作成し、
 * キャラクター情報を投稿する実用的なサービス
 */
@Injectable()
export class ThreadCreationService {
  private readonly logger = new Logger(ThreadCreationService.name)
  private readonly discordClient: Client

  constructor(
    private readonly discordClientService: DiscordClientService,
    private readonly typedEventService: TypedEventService,
    private readonly characterService: CharacterService
  ) {
    this.discordClient = this.discordClientService.getClient()
    // イベントハンドラー登録は削除 - File-based handlers（EventRegistryService）で一元管理
    this.logger.debug('Thread creation service initialized')
  }

  /**
   * キャラクタースレッドを作成
   */
  async createCharacterThread(request: CreateThreadRequest, character: Character): Promise<CreateThreadResult> {
    this.logger.log(`Creating thread for character: ${request.characterName}`)

    try {
      // ギルドを取得
      const guild = await this.getGuild(request.guildId)
      if (!guild) {
        return {
          success: false,
          error: `Guild not found: ${request.guildId}`
        }
      }

      // チャンネルを取得
      const channel = await this.getTextChannel(guild, request.channelId)
      if (!channel) {
        return {
          success: false,
          error: `Channel not found: ${request.channelId}`
        }
      }

      // スレッドを作成
      const thread = await this.createDiscordThread(channel, request.characterName)

      // character-editチャンネルIDを保存してから、discordChannelIdをスレッドIDに更新
      await this.updateCharacterChannelIds(character.characterId, thread.id, character.discordChannelId)

      // threadIdも保存
      await this.updateCharacterThreadId(character.characterId, thread.id)

      // キャラクター情報を投稿（表示タイプに応じて処理）
      await this.postCharacterDisplay(thread, character, request.displayType || 'basic')

      const threadUrl = `https://discord.com/channels/${request.guildId}/${request.channelId}/${thread.id}`

      this.logger.log(`Thread created successfully: ${thread.id}`)

      return {
        success: true,
        threadId: thread.id,
        threadUrl
      }
    } catch (error) {
      const context: ErrorContext = {
        characterId: request.characterId,
        channelId: request.channelId,
        action: 'thread-creation'
      }

      ErrorHandler.handleServiceError(error, context, 'ThreadCreationService')

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Discordスレッドを作成
   */
  private async createDiscordThread(channel: TextChannel, characterName: string): Promise<ThreadChannel> {
    const timestamp = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    const threadName = `🎭 ${characterName} [${timestamp}]`

    return await channel.threads.create({
      name: threadName,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
      type: ChannelType.PublicThread,
      reason: `Character thread for ${characterName}`
    })
  }

  /**
   * 表示タイプに応じてキャラクター表示を処理
   */
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

  /**
   * Enhanced Character表示（character-thread用：基本表示＋詳細情報）
   */
  private async postEnhancedCharacterInfo(thread: ThreadChannel, character: Character): Promise<void> {
    try {
      this.logger.log(`Posting enhanced character info for: ${character.characterId}`)

      // character-thread用のenhanced表示：基本情報＋詳細表示（編集機能なし）
      await this.postDetailedCharacterInfo(thread, character)

      this.logger.log(`Enhanced character display completed for: ${character.characterId}`)
    } catch (error) {
      this.logger.error('Failed to post enhanced character info', error)
      throw error // Re-throw to trigger fallback in postCharacterDisplay
    }
  }

  /**
   * 詳細キャラクター情報を表示（編集機能なし）
   */
  private async postDetailedCharacterInfo(thread: ThreadChannel, character: Character): Promise<void> {
    // 基本情報Embed
    const basicEmbed = new EmbedBuilder()
      .setTitle(`🎭 ${character.characterName} - 詳細情報`)
      .setColor(0x00ae86)
      .setTimestamp()

    // 基本情報
    if (character.gameSystemId) {
      basicEmbed.addFields({
        name: '🎲 ゲームシステム',
        value: character.gameSystemId,
        inline: true
      })
    }

    basicEmbed.addFields({
      name: '🆔 キャラクターID',
      value: character.characterId,
      inline: true
    })

    // ステータス情報を追加
    if (character.status && Object.keys(character.status).length > 0) {
      const statusText = this.formatCharacterData(character.status)
      if (statusText) {
        basicEmbed.addFields({
          name: '🩸 ステータス',
          value: statusText.substring(0, 1024),
          inline: false
        })
      }
    }

    // パラメータ情報
    if (character.parameter && Object.keys(character.parameter).length > 0) {
      const parameterText = this.formatCharacterData(character.parameter)
      if (parameterText) {
        basicEmbed.addFields({
          name: '📊 パラメータ',
          value: parameterText.substring(0, 1024),
          inline: false
        })
      }
    }

    // スキル情報
    if (character.skill && Object.keys(character.skill).length > 0) {
      const skillText = this.formatCharacterData(character.skill)
      if (skillText) {
        basicEmbed.addFields({
          name: '⚔️ スキル',
          value: skillText.substring(0, 1024),
          inline: false
        })
      }
    }

    // アイテム情報
    if (character.item && Object.keys(character.item).length > 0) {
      const itemText = this.formatCharacterData(character.item)
      if (itemText) {
        basicEmbed.addFields({
          name: '🎒 アイテム',
          value: itemText.substring(0, 1024),
          inline: false
        })
      }
    }

    // 編集URLを追加（Discord チャンネルURL）
    const editUrl = this.generateCharacterEditUrl(character, thread.guild?.id || '')
    if (editUrl) {
      basicEmbed.addFields({
        name: '✏️ キャラクター編集',
        value: `[こちらから詳細な編集ができます](${editUrl})`,
        inline: false
      })
    }

    await thread.send({ embeds: [basicEmbed] })
  }

  /**
   * コンパクト表示（将来の拡張用）
   */
  private async postCompactCharacterInfo(thread: ThreadChannel, character: Character): Promise<void> {
    // 簡単な1行表示など、将来実装
    await this.postCharacterInfo(thread, character)
  }

  /**
   * キャラクター情報Embedを投稿（基本版 + 編集URL）
   */
  private async postCharacterInfo(thread: ThreadChannel, character: Character): Promise<void> {
    const embed = this.createBasicCharacterEmbed(character, thread.guild?.id || '')
    await thread.send({ embeds: [embed] })
  }

  /**
   * 操作ボタンを投稿（ダイスロールボタンのみ - character-editと共有）
   */
  private async postActionButtons(thread: ThreadChannel, channelId: string): Promise<void> {
    // ダイスロールボタン（thread→親チャンネル送信機能付き）
    const diceButtons = [
      new ButtonBuilder().setCustomId('roll*1d100').setLabel('1D100').setStyle(ButtonStyle.Danger).setEmoji('🎲'),

      new ButtonBuilder().setCustomId('roll*1d6').setLabel('1D6').setStyle(ButtonStyle.Secondary).setEmoji('🎲'),

      new ButtonBuilder().setCustomId('roll*2d6').setLabel('2D6').setStyle(ButtonStyle.Secondary).setEmoji('🎲'),

      new ButtonBuilder().setCustomId('roll*custom').setLabel('カスタム').setStyle(ButtonStyle.Secondary).setEmoji('⚙️')
    ]

    const diceRow = new ActionRowBuilder<ButtonBuilder>().addComponents(diceButtons)

    await thread.send({
      content: '🎲 ダイスロール',
      components: [diceRow]
    })
  }

  /**
   * 柔軟ダイス計算用のパラメータ選択メニューを投稿
   */
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

  /**
   * キャラクターデータからパラメータ選択メニューを作成
   */
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
                .setLabel(`⚙️ ${displayName} (${displayValue})`)
                .setValue(`parameter:${key}:${displayValue}`)
                .setDescription(`パラメータ: ${displayName}を使用`)
            )
          }
        }
      }

      // カスタム計算オプション
      options.push(
        new StringSelectMenuOptionBuilder()
          .setLabel('🔧 カスタム計算式')
          .setValue('custom:formula:0')
          .setDescription('自由な計算式を入力')
      )

      if (options.length === 0) {
        return null
      }

      // Discordの制限：最大25オプション
      selectMenu.addOptions(...options.slice(0, 25))
      return selectMenu
    } catch (error) {
      this.logger.error('Failed to create parameter select menu', error)
      return null
    }
  }

  /**
   * よく使用されるパラメータのプリセットボタンを投稿
   */
  private async postPresetDiceButtons(thread: ThreadChannel, character: Character): Promise<void> {
    try {
      const presetButtons = this.createPresetButtons(character)

      if (presetButtons.length > 0) {
        // 5個ずつボタンを配列
        const actionRows: ActionRowBuilder<ButtonBuilder>[] = []
        for (let i = 0; i < presetButtons.length; i += 5) {
          const rowButtons = presetButtons.slice(i, i + 5)
          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(rowButtons)
          actionRows.push(row)
        }

        await thread.send({
          content: '⚡ クイックダイス：よく使用されるパラメータ',
          components: actionRows
        })
      }
    } catch (error) {
      this.logger.error('Failed to post preset dice buttons', error)
    }
  }

  /**
   * プリセットダイスボタンを作成
   */
  private createPresetButtons(character: Character): ButtonBuilder[] {
    const buttons: ButtonBuilder[] = []
    const maxButtons = 10 // 最大ボタン数制限

    // 高い値を持つパラメータを優先的に抽出
    const allParameters: Array<{ key: string; value: number; section: string; emoji: string }> = []

    // ステータスから抽出
    if (character.status && Object.keys(character.status).length > 0) {
      for (const [key, value] of Object.entries(character.status)) {
        const numericValue = this.extractNumericValue(value)
        if (numericValue > 0) {
          allParameters.push({ key, value: numericValue, section: 'status', emoji: '📊' })
        }
      }
    }

    // スキルから抽出
    if (character.skill && Object.keys(character.skill).length > 0) {
      for (const [key, value] of Object.entries(character.skill)) {
        const numericValue = this.extractNumericValue(value)
        if (numericValue > 0) {
          allParameters.push({ key, value: numericValue, section: 'skill', emoji: '⚔️' })
        }
      }
    }

    // パラメータから抽出
    if (character.parameter && Object.keys(character.parameter).length > 0) {
      for (const [key, value] of Object.entries(character.parameter)) {
        const numericValue = this.extractNumericValue(value)
        if (numericValue > 0) {
          allParameters.push({ key, value: numericValue, section: 'parameter', emoji: '⚙️' })
        }
      }
    }

    // 値の高い順にソート
    allParameters.sort((a, b) => b.value - a.value)

    // 上位のパラメータからボタンを作成
    for (let i = 0; i < Math.min(allParameters.length, maxButtons); i++) {
      const param = allParameters[i]

      // よく使用される計算パターンのボタンを作成
      const patterns = [
        { multiplier: 3, label: `×3`, description: `${param.key}×3` },
        { multiplier: 2, label: `×2`, description: `${param.key}×2` }
      ]

      for (const pattern of patterns) {
        if (buttons.length >= maxButtons) break

        const customId = `preset-dice*${character.characterId}*${param.section}*${param.key}*${param.value}*${pattern.multiplier}`

        const button = new ButtonBuilder()
          .setCustomId(customId)
          .setLabel(`${param.emoji} ${param.key}${pattern.label}`)
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⚡')

        buttons.push(button)
      }
    }

    return buttons
  }

  /**
   * 値から数値を抽出
   */
  private extractNumericValue(value: unknown): number {
    if (typeof value === 'number') {
      return value
    }

    if (typeof value === 'object' && value && 'value' in value) {
      return Number((value as any).value) || 0
    }

    return Number(value) || 0
  }

  /**
   * キャラクターのスキルロールボタンを投稿（character-editと共有）
   */
  private async postSkillRollButtons(thread: ThreadChannel, character: Character): Promise<void> {
    if (!character.skill || Object.keys(character.skill).length === 0) {
      return
    }

    const skillButtons: ButtonBuilder[] = []
    const actionRows: ActionRowBuilder<ButtonBuilder>[] = []
    let buttonCount = 0
    const maxButtonsPerRow = 5
    const maxTotalButtons = 20

    for (const [skillKey, skillData] of Object.entries(character.skill)) {
      if (buttonCount >= maxTotalButtons) break

      let skillName: string
      let skillValue: number

      // スキルデータの形式を判定
      if (skillData && typeof skillData === 'object') {
        if ('name' in skillData && 'value' in skillData) {
          skillName = skillData.name as string
          skillValue = Number(skillData.value) || 0
        } else {
          skillName = skillKey
          skillValue = Number(skillData) || 0
        }
      } else {
        skillName = skillKey
        skillValue = Number(skillData) || 0
      }

      // スキル値が0以下の場合はスキップ
      if (skillValue <= 0) continue

      // スキルロールボタンを作成（character-editと共有フォーマット）
      const customId = `roll*_${skillName}-${skillValue}*${character.characterId}`

      const button = new ButtonBuilder()
        .setCustomId(customId)
        .setLabel(`${skillName}(${skillValue})`)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🎯')

      skillButtons.push(button)
      buttonCount++

      // 5個ごとに新しい行を作成
      if (skillButtons.length === maxButtonsPerRow) {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(skillButtons.splice(0, maxButtonsPerRow))
        actionRows.push(row)
      }
    }

    // 残りのボタンがある場合は最後の行に追加
    if (skillButtons.length > 0) {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(skillButtons)
      actionRows.push(row)
    }

    // スキルロールボタンがある場合は投稿
    if (actionRows.length > 0) {
      await thread.send({
        content: '🎯 スキルロール',
        components: actionRows
      })
    }
  }

  /**
   * キャラクター編集URLを生成（DiscordチャンネルURL）
   */
  private generateCharacterEditUrl(character: Character, guildId: string): string | null {
    // 編集は常に元のdiscordChannelIdを使用
    const editChannelId = character.discordChannelId

    if (editChannelId) {
      // Discord チャンネルURLを生成
      return `https://discord.com/channels/${guildId}/${editChannelId}`
    }
    return null
  }

  /**
   * thread用の基本キャラクターEmbedを作成（postCharacterInfoと同じ形式）
   */
  private createBasicCharacterEmbed(character: Character, guildId: string): EmbedBuilder {
    const embed = new EmbedBuilder().setTitle(`🎭 ${character.characterName}`).setColor(0x00ae86).setTimestamp()

    // 基本情報
    if (character.gameSystemId) {
      embed.addFields({
        name: '🎲 ゲームシステム',
        value: character.gameSystemId,
        inline: true
      })
    }

    embed.addFields({
      name: '🆔 キャラクターID',
      value: character.characterId,
      inline: true
    })

    // ステータス情報（簡略化）
    if (character.status) {
      const statusText = this.formatCharacterData(character.status)
      if (statusText) {
        embed.addFields({
          name: '📊 ステータス',
          value: statusText.substring(0, 1024), // Discord field limit
          inline: false
        })
      }
    }

    // パラメータ情報
    if (character.parameter) {
      const parameterText = this.formatCharacterData(character.parameter)
      if (parameterText) {
        embed.addFields({
          name: '⚙️ パラメータ',
          value: parameterText.substring(0, 1024), // Discord field limit
          inline: false
        })
      }
    }

    // キャラクター編集URL（Discord チャンネルURL）
    const editUrl = this.generateCharacterEditUrl(character, guildId)
    if (editUrl) {
      embed.addFields({
        name: '✏️ キャラクター編集',
        value: `[こちらから詳細な編集ができます](${editUrl})`,
        inline: false
      })
    }

    return embed
  }

  /**
   * キャラクターデータをフォーマット
   */
  private formatCharacterData(data: Record<string, unknown>): string {
    if (!data || typeof data !== 'object') {
      return ''
    }

    return Object.entries(data)
      .map(([key, value]) => {
        if (value && typeof value === 'object' && 'name' in value && 'value' in value) {
          const typedValue = value as { name: string; value: string | number }
          return `**${typedValue.name}**: ${typedValue.value}`
        }
        return `**${key}**: ${value}`
      })
      .slice(0, 5) // 最大5項目まで
      .join('\n')
  }

  /**
   * Thread内のキャラクター表示を更新
   */
  private async updateThreadCharacterDisplay(character: Character): Promise<void> {
    try {
      if (!character.threadId) {
        this.logger.warn(`Character ${character.characterId} does not have threadId`)
        return
      }

      this.logger.log(`Updating thread display for character: ${character.characterId}, thread: ${character.threadId}`)

      // ThreadChannelを取得
      const thread = await this.getThreadChannel(character.threadId)
      if (!thread) {
        this.logger.error(`Thread not found: ${character.threadId}`)
        return
      }

      // 既存のキャラクター表示メッセージを検索して更新
      const messages = await thread.messages.fetch({ limit: 50 })
      const botMessages = messages.filter((msg) => msg.author.bot && msg.embeds.length > 0)

      for (const message of botMessages.values()) {
        // キャラクター情報のEmbedを探す
        const hasCharacterEmbed = message.embeds.some(
          (embed) =>
            embed.title?.includes(character.characterName) || embed.description?.includes(character.characterId)
        )

        if (hasCharacterEmbed) {
          this.logger.log(`Found character embed message to update: ${message.id}`)

          // thread用の基本Embed情報を作成（postCharacterInfoと同じ形式）
          const basicEmbed = this.createBasicCharacterEmbed(character, thread.guild?.id || '')

          // メッセージを更新
          await message.edit({ embeds: [basicEmbed] })
          this.logger.log(`Successfully updated character embed message: ${message.id}`)

          // 最初に見つかったメッセージのみ更新
          break
        }
      }
    } catch (error) {
      this.logger.error(`Failed to update thread character display for ${character.characterId}`, error)
      throw error
    }
  }

  /**
   * ThreadChannelを取得
   */
  private async getThreadChannel(threadId: string): Promise<ThreadChannel | null> {
    try {
      const channel = await this.discordClient.channels.fetch(threadId)

      if (channel && channel.type === ChannelType.PublicThread) {
        return channel as ThreadChannel
      }

      return null
    } catch (error) {
      this.logger.error(`Failed to fetch thread ${threadId}:`, error instanceof Error ? error.message : String(error))
      return null
    }
  }

  /**
   * キャラクターのスレッドチャンネルIDを更新（元のdiscordChannelIdはそのまま保持）
   */
  private async updateCharacterChannelIds(
    characterId: string,
    threadId: string,
    editChannelId?: string
  ): Promise<void> {
    try {
      // discordChannelIdは変更せず、discordThreadIdのみを設定
      const updateData: any = {
        discordThreadId: threadId
      }

      await this.characterService.update(characterId, updateData)
      this.logger.log(`Character thread channel ID updated: ${characterId} -> thread: ${threadId}`)
    } catch (error) {
      this.logger.error(`Failed to update character thread channel ID: ${characterId}`, error)
      // エラーが発生してもスレッド作成処理は継続
    }
  }

  /**
   * キャラクターのthreadIdを更新
   */
  private async updateCharacterThreadId(characterId: string, threadId: string): Promise<void> {
    try {
      await this.characterService.update(characterId, { threadId })
      this.logger.log(`Character threadId updated: ${characterId} -> ${threadId}`)
    } catch (error) {
      this.logger.error(`Failed to update character threadId: ${characterId}`, error)
      // エラーが発生してもスレッド作成処理は継続
    }
  }

  /**
   * 旧メソッド（下位互換）
   */
  private async updateCharacterChannelId(characterId: string, threadId: string): Promise<void> {
    await this.updateCharacterChannelIds(characterId, threadId)
  }

  /**
   * ギルドを取得
   */
  private async getGuild(guildId: string): Promise<Guild | null> {
    try {
      return await this.discordClient.guilds.fetch(guildId)
    } catch (error) {
      this.logger.error(`Failed to fetch guild ${guildId}:`, error instanceof Error ? error.message : String(error))
      return null
    }
  }

  /**
   * テキストチャンネルを取得
   */
  private async getTextChannel(guild: Guild, channelId: string): Promise<TextChannel | null> {
    try {
      const channel = await guild.channels.fetch(channelId)

      if (!channel || !(channel instanceof TextChannel)) {
        return null
      }

      return channel
    } catch (error) {
      this.logger.error(`Failed to fetch channel ${channelId}:`, error instanceof Error ? error.message : String(error))
      return null
    }
  }
}
