import { Injectable, Logger } from '@nestjs/common'
import {
  ChannelType,
  EmbedBuilder,
  TextChannel,
  MessageCreateOptions,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  StringSelectMenuInteraction
} from 'discord.js'
import { DiscordClientService } from '../../../services/discord-client.service'
import { SendMessageDto, EmbedDto } from '../../../dto/send-message.dto'
import { CreateChannelDto } from '../../../dto/create-channel.dto'
import { Character } from '../../../../domains/character/models/character.model'

interface GuildInfo {
  id: string
  name: string
  memberCount: number
  channels: Array<{ id: string; name: string; type: string }>
}

interface EmbedData {
  title: string
  description: string
  color: number
  fields: Array<{
    name: string
    value: string
    inline: boolean
  }>
}

/**
 * キャラクター関連のDiscord UI操作サービス
 * キャラクター機能専用のUI操作を担当
 */
@Injectable()
export class CharacterUIService {
  private readonly logger = new Logger(CharacterUIService.name)

  constructor(private readonly discordClientService: DiscordClientService) {}

  /**
   * メッセージを送信
   */
  async sendMessage(sendMessageDto: SendMessageDto): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const client = this.discordClientService.getClient()
      if (!client) {
        return { success: false, error: 'Discord client not available' }
      }

      const channel = await client.channels.fetch(sendMessageDto.channelId)
      if (!channel || !channel.isTextBased()) {
        return { success: false, error: 'Invalid channel' }
      }

      const messageOptions: MessageCreateOptions = {}

      if (sendMessageDto.content) {
        messageOptions.content = sendMessageDto.content
      }

      if (sendMessageDto.embed) {
        messageOptions.embeds = [sendMessageDto.embed]
      }

      const sentMessage = await (channel as TextChannel).send(messageOptions)

      return { success: true, messageId: sentMessage.id }
    } catch (error) {
      this.logger.error('Failed to send message:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  /**
   * チャンネルを作成
   */
  async createChannel(
    createChannelDto: CreateChannelDto
  ): Promise<{ success: boolean; channelId?: string; error?: string }> {
    try {
      const client = this.discordClientService.getClient()
      if (!client) {
        return { success: false, error: 'Discord client not available' }
      }

      const guild = await client.guilds.fetch(createChannelDto.guildId)
      if (!guild) {
        return { success: false, error: 'Guild not found' }
      }

      const channel = await guild.channels.create({
        name: createChannelDto.name,
        type: ChannelType.GuildText, // 固定でGuildTextを使用
        topic: createChannelDto.topic,
        parent: createChannelDto.parentId
      })

      return { success: true, channelId: channel.id }
    } catch (error) {
      this.logger.error('Failed to create channel:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  /**
   * キャラクター情報のEmbedを作成または更新
   */
  async createOrUpdateCharacterEmbed(
    character: Character,
    channelId: string,
    guildInfo: GuildInfo
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const client = this.discordClientService.getClient()
      if (!client) {
        return { success: false, error: 'Discord client not available' }
      }

      const channel = await client.channels.fetch(channelId)
      if (!channel || !channel.isTextBased()) {
        return { success: false, error: 'Invalid channel' }
      }

      // 既存のキャラクターEmbedを検索
      const existingEmbed = await this.findExistingCharacterEmbed(channel as TextChannel)

      const embedData = this.createCharacterEmbedData(character, guildInfo)
      const embed = new EmbedBuilder()
        .setTitle(embedData.title)
        .setDescription(embedData.description)
        .setColor(embedData.color)
        .addFields(embedData.fields)

      if (existingEmbed) {
        // 既存のEmbedを更新
        const updatedMessage = await existingEmbed.edit({ embeds: [embed] })
        return { success: true, messageId: updatedMessage.id }
      } else {
        // 新しいEmbedを作成
        const newMessage = await (channel as TextChannel).send({ embeds: [embed] })
        return { success: true, messageId: newMessage.id }
      }
    } catch (error) {
      this.logger.error('Failed to create or update character embed:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  /**
   * 既存のキャラクターEmbedを検索
   */
  private async findExistingCharacterEmbed(channel: TextChannel) {
    try {
      const messages = await channel.messages.fetch({ limit: 50 })
      const client = this.discordClientService.getClient()

      if (!client?.user) return null

      return (
        messages.find(
          (msg) =>
            msg.author.id === client.user!.id &&
            msg.embeds.length > 0 &&
            msg.embeds[0].title?.includes('キャラクター情報')
        ) || null
      )
    } catch (error) {
      this.logger.error('Failed to find existing character embed:', error)
      return null
    }
  }

  /**
   * テキストチャンネルを取得
   */
  async getTextChannel(channelId: string): Promise<TextChannel | null> {
    try {
      const client = this.discordClientService.getClient()
      if (!client) {
        this.logger.error('Discord client not available')
        return null
      }

      const channel = await client.channels.fetch(channelId)
      if (!channel || !channel.isTextBased() || channel.type !== ChannelType.GuildText) {
        this.logger.warn(`Channel ${channelId} is not a text channel`)
        return null
      }

      return channel as TextChannel
    } catch (error) {
      this.logger.error(`Failed to get text channel ${channelId}:`, error)
      return null
    }
  }

  /**
   * キャラクターEmbedデータを作成
   */
  private createCharacterEmbedData(character: Character, guildInfo: GuildInfo): EmbedData {
    const fields: Array<{ name: string; value: string; inline: boolean }> = []

    // 基本情報
    if (character.characterName) {
      fields.push({ name: 'キャラクター名', value: character.characterName, inline: true })
    }

    // ステータス情報
    if (character.status) {
      try {
        const statusObj = typeof character.status === 'string' ? JSON.parse(character.status) : character.status
        Object.entries(statusObj).forEach(([key, value]) => {
          if (value) {
            fields.push({ name: key, value: String(value), inline: true })
          }
        })
      } catch {
        fields.push({ name: 'ステータス', value: String(character.status), inline: false })
      }
    }

    // スキル情報
    if (character.skill) {
      try {
        const skillObj = typeof character.skill === 'string' ? JSON.parse(character.skill) : character.skill
        const skillText = Object.entries(skillObj)
          .filter(([, value]) => value)
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n')

        if (skillText) {
          fields.push({ name: 'スキル', value: skillText, inline: false })
        }
      } catch {
        fields.push({ name: 'スキル', value: String(character.skill), inline: false })
      }
    }

    return {
      title: `🎭 キャラクター情報 - ${character.characterName || '未設定'}`,
      description: `サーバー: ${guildInfo.name}\nチャンネル: <#${character.discordChannelId}>`,
      color: 0x00ff00,
      fields
    }
  }

  /**
   * キャラクターEmbedの更新
   */
  async updateCharacterEmbed(channelId: string, character: Character): Promise<void> {
    try {
      const client = this.discordClientService.getClient()
      if (!client) {
        throw new Error('Discord client not available')
      }

      const channel = (await client.channels.fetch(channelId)) as TextChannel
      if (!channel || !channel.isTextBased()) {
        throw new Error('Invalid text channel')
      }

      // 既存のEmbedメッセージを検索（ボットが送信したメッセージの中から）
      const messages = await channel.messages.fetch({ limit: 50 })
      const embedMessage = messages.find(
        (msg) =>
          msg.author.id === client.user?.id &&
          msg.embeds.length > 0 &&
          msg.embeds[0].title?.includes('キャラクター情報')
      )

      // 簡易的なguildInfo作成（getGuildInfoメソッドが見つからないため）
      const guildInfo: GuildInfo = {
        id: '',
        name: 'TRPG Server',
        memberCount: 0,
        channels: []
      }
      const embedData = this.createCharacterEmbedData(character, guildInfo)
      const embed = new EmbedBuilder()
        .setTitle(embedData.title)
        .setDescription(embedData.description)
        .setColor(embedData.color)
        .addFields(embedData.fields)
        .setTimestamp()

      if (embedMessage) {
        // 既存のEmbedを更新
        await embedMessage.edit({ embeds: [embed] })
        this.logger.debug('Character embed updated')
      } else {
        // 新しいEmbedメッセージを送信
        await channel.send({ embeds: [embed] })
        this.logger.debug('New character embed created')
      }
    } catch (error) {
      this.logger.error('Failed to update character embed', error)
      throw error
    }
  }

  /**
   * キャラクター更新完了通知の送信
   */
  async sendCharacterUpdateNotification(
    channelId: string,
    character: Character,
    updatedFields: string[],
    userId?: string
  ): Promise<void> {
    const fieldNames = updatedFields
      .map((field) => {
        switch (field) {
          case 'characterName':
            return 'キャラクター名'
          case 'status':
            return 'ステータス'
          case 'skill':
            return 'スキル'
          case 'level':
            return 'レベル'
          case 'hp':
            return 'HP'
          case 'mp':
            return 'MP'
          default:
            return field
        }
      })
      .join(', ')

    const message = userId
      ? `<@${userId}> 「${character.characterName}」の${fieldNames}が更新されました！✨`
      : `「${character.characterName}」の${fieldNames}が更新されました！✨`

    await this.sendMessage({
      channelId,
      content: message
    })
  }

  /**
   * キャラクター削除完了通知の送信
   */
  async sendCharacterDeletionNotification(channelId: string, characterName: string, userId?: string): Promise<void> {
    const message = userId
      ? `<@${userId}> キャラクター「${characterName}」が削除されました。`
      : `キャラクター「${characterName}」が削除されました。`

    await this.sendMessage({
      channelId,
      content: message
    })
  }

  /**
   * キャラクターEmbedメッセージの削除
   */
  async removeCharacterEmbeds(channelId: string): Promise<void> {
    try {
      const client = this.discordClientService.getClient()
      if (!client) {
        throw new Error('Discord client not available')
      }

      const channel = (await client.channels.fetch(channelId)) as TextChannel
      if (!channel || !channel.isTextBased()) {
        throw new Error('Invalid text channel')
      }

      // ボットが送信したEmbedメッセージを検索
      const messages = await channel.messages.fetch({ limit: 100 })
      const embedMessages = messages.filter(
        (msg) =>
          msg.author.id === client.user?.id &&
          msg.embeds.length > 0 &&
          msg.embeds[0].title?.includes('キャラクター情報')
      )

      // Embedメッセージを削除
      for (const message of embedMessages.values()) {
        try {
          await message.delete()
        } catch (error) {
          this.logger.warn(`Failed to delete embed message ${message.id}`, error)
        }
      }

      this.logger.debug(`Removed ${embedMessages.size} character embed messages`)
    } catch (error) {
      this.logger.error('Failed to remove character embeds', error)
      throw error
    }
  }

  /**
   * チャンネルのステータス表示更新
   */
  async updateChannelStatusDisplay(channelId: string, character: Character): Promise<void> {
    // チャンネルトピックにステータス情報を設定
    try {
      const client = this.discordClientService.getClient()
      if (!client) {
        throw new Error('Discord client not available')
      }

      const channel = (await client.channels.fetch(channelId)) as TextChannel
      if (!channel || channel.type !== ChannelType.GuildText) {
        throw new Error('Invalid text channel')
      }

      let statusText = `🎭 ${character.characterName}`

      if (character.status) {
        try {
          const statusObj = typeof character.status === 'string' ? JSON.parse(character.status) : character.status
          if (statusObj.hp) statusText += ` | HP: ${statusObj.hp}`
          if (statusObj.mp) statusText += ` | MP: ${statusObj.mp}`
          if (statusObj.level) statusText += ` | Lv: ${statusObj.level}`
        } catch {
          // JSON parse失敗時は無視
        }
      }

      await channel.setTopic(statusText)
      this.logger.debug('Channel status display updated')
    } catch (error) {
      this.logger.error('Failed to update channel status display', error)
      throw error
    }
  }

  /**
   * チャンネル名の更新
   */
  async updateChannelName(channelId: string, newName: string): Promise<void> {
    try {
      const client = this.discordClientService.getClient()
      if (!client) {
        throw new Error('Discord client not available')
      }

      const channel = (await client.channels.fetch(channelId)) as TextChannel
      if (!channel || channel.type !== ChannelType.GuildText) {
        throw new Error('Invalid text channel')
      }

      await channel.setName(newName)
      this.logger.debug(`Channel name updated to: ${newName}`)
    } catch (error) {
      this.logger.error('Failed to update channel name', error)
      throw error
    }
  }

  /**
   * チャンネルのアーカイブ
   */
  async archiveChannel(channelId: string): Promise<void> {
    try {
      const client = this.discordClientService.getClient()
      if (!client) {
        throw new Error('Discord client not available')
      }

      const channel = (await client.channels.fetch(channelId)) as TextChannel
      if (!channel || channel.type !== ChannelType.GuildText) {
        throw new Error('Invalid text channel')
      }

      // 読み取り専用にすることでアーカイブを模擬
      await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
        SendMessages: false,
        AddReactions: false
      })

      this.logger.debug('Channel archived (read-only)')
    } catch (error) {
      this.logger.error('Failed to archive channel', error)
      throw error
    }
  }

  /**
   * チャンネルにアーカイブ絵文字を追加
   */
  async addChannelArchiveEmoji(channelId: string): Promise<void> {
    try {
      const message = '🗄️ このチャンネルはアーカイブされました'
      await this.sendMessage({
        channelId,
        content: message
      })
      this.logger.debug('Archive emoji added to channel')
    } catch (error) {
      this.logger.error('Failed to add archive emoji', error)
      throw error
    }
  }

  /**
   * セレクトメニュー付きキャラクターEmbedの送信
   */
  async sendCharacterEmbedWithSelectMenu(channelId: string, character: Character, userId?: string): Promise<void> {
    try {
      const client = this.discordClientService.getClient()
      if (!client) {
        throw new Error('Discord client not available')
      }

      const channel = await client.channels.fetch(channelId)
      if (!channel || !channel.isTextBased()) {
        throw new Error('Invalid channel')
      }

      // 既にインポート済みのコンポーネントを使用

      // キャラクター情報Embedを作成
      const guildInfo = {
        id: '',
        name: 'TRPG Server',
        memberCount: 0,
        channels: []
      }
      const embedData = this.createCharacterEmbedData(character, guildInfo)
      const embed = new EmbedBuilder()
        .setTitle(embedData.title)
        .setDescription(embedData.description)
        .setColor(embedData.color)
        .addFields(embedData.fields)
        .setTimestamp()

      // 情報更新セレクトメニューを作成
      const sectionSelectMenu = new StringSelectMenuBuilder()
        .setCustomId(`character-section-select-${character.characterId}`)
        .setPlaceholder('編集するセクションを選択')
        .addOptions([
          {
            label: '📊 ステータス',
            value: 'status',
            description: '基本ステータスを編集'
          },
          {
            label: '⚙️ パラメータ',
            value: 'parameter',
            description: '能力値やパラメータを編集'
          },
          {
            label: '⚔️ スキル',
            value: 'skill',
            description: '技能や特技を編集'
          },
          {
            label: '🎒 アイテム',
            value: 'item',
            description: '装備品やアイテムを編集'
          }
        ])

      const sectionRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(sectionSelectMenu)

      // Embedとセレクトメニューを送信
      await (channel as any).send({
        embeds: [embed],
        components: [sectionRow]
      })

      this.logger.debug(`Character embed with select menu sent to channel: ${channelId}`)
    } catch (error) {
      this.logger.error('Failed to send character embed with select menu', error)
      throw error
    }
  }

  /**
   * キャラクターセクション選択メニューのインタラクション処理
   * Embedは変更せず、セレクトメニューのみ更新
   */
  async handleSectionSelectInteraction(interaction: StringSelectMenuInteraction): Promise<void> {
    try {
      const customId = interaction.customId

      // character-section-select-${characterId} パターンの確認
      if (!customId.startsWith('character-section-select-')) {
        this.logger.warn(`Invalid customId pattern: ${customId}`)
        return
      }

      // characterIdを抽出
      const characterId = customId.replace('character-section-select-', '')
      if (!characterId) {
        await interaction.reply({
          content: 'キャラクター情報の取得に失敗しました。',
          ephemeral: true
        })
        return
      }

      const selectedSection = interaction.values[0]
      this.logger.debug(`Selected section: ${selectedSection} for character: ${characterId}`)

      await interaction.deferUpdate()

      // 現在のEmbedを維持
      const originalEmbeds = interaction.message.embeds

      // 「戻る」が選択された場合は元のメニューに戻す
      if (selectedSection === 'back') {
        const mainSelectMenu = new StringSelectMenuBuilder()
          .setCustomId(`character-section-select-${characterId}`)
          .setPlaceholder('編集するセクションを選択')
          .addOptions([
            {
              label: '📊 ステータス',
              value: 'status',
              description: '基本ステータスを編集'
            },
            {
              label: '⚙️ パラメータ',
              value: 'parameter',
              description: '能力値やパラメータを編集'
            },
            {
              label: '⚔️ スキル',
              value: 'skill',
              description: '技能や特技を編集'
            },
            {
              label: '🎒 アイテム',
              value: 'item',
              description: '装備品やアイテムを編集'
            }
          ])

        const mainRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(mainSelectMenu)

        await interaction.editReply({
          embeds: originalEmbeds,
          components: [mainRow]
        })
        return
      }

      // 選択されたセクションに応じた詳細編集メニューを作成
      const fieldSelectMenu = this.createFieldSelectMenu(selectedSection, characterId)

      // 戻るボタンのセレクトメニューも追加
      const backSelectMenu = new StringSelectMenuBuilder()
        .setCustomId(`character-section-select-${characterId}`)
        .setPlaceholder('別のセクションを選択するか戻る')
        .addOptions([
          {
            label: '⬅️ セクション選択に戻る',
            value: 'back',
            description: 'メインのセクション選択画面に戻ります'
          },
          {
            label: '📊 ステータス',
            value: 'status',
            description: '基本ステータスを編集'
          },
          {
            label: '⚙️ パラメータ',
            value: 'parameter',
            description: '能力値やパラメータを編集'
          },
          {
            label: '⚔️ スキル',
            value: 'skill',
            description: '技能や特技を編集'
          },
          {
            label: '🎒 アイテム',
            value: 'item',
            description: '装備品やアイテムを編集'
          }
        ])

      const components = []

      if (fieldSelectMenu) {
        const fieldRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(fieldSelectMenu)
        components.push(fieldRow)
      }

      const backRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(backSelectMenu)
      components.push(backRow)

      await interaction.editReply({
        embeds: originalEmbeds, // 元のEmbedを維持
        components: components // セレクトメニューのみ更新
      })
    } catch (error) {
      this.logger.error('Failed to handle section select interaction', error)

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'セクション選択の処理中にエラーが発生しました。',
          ephemeral: true
        })
      }
    }
  }

  /**
   * フィールド選択メニューの作成
   */
  private createFieldSelectMenu(sectionType: string, characterId: string): StringSelectMenuBuilder | null {
    const sectionNames: Record<string, string> = {
      status: 'ステータス',
      parameter: 'パラメータ',
      skill: 'スキル',
      item: 'アイテム'
    }

    const sectionName = sectionNames[sectionType]
    if (!sectionName) return null

    return new StringSelectMenuBuilder()
      .setCustomId(`character-field-edit-${sectionType}-${characterId}`)
      .setPlaceholder(`編集する${sectionName}を選択`)
      .addOptions([
        {
          label: `➕ 新しい${sectionName}を追加`,
          value: 'add_new',
          description: `新しい${sectionName}項目を追加します`
        },
        {
          label: '🔧 編集機能準備中',
          value: 'coming_soon',
          description: '詳細な編集機能は準備中です'
        }
      ])
  }
}
