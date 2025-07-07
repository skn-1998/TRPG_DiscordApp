import { Injectable, Logger } from '@nestjs/common'
import {
  Client,
  Events,
  Interaction,
  InteractionType,
  ButtonInteraction,
  ModalSubmitInteraction,
  AnySelectMenuInteraction,
  CommandInteraction,
  AutocompleteInteraction,
  PermissionsBitField,
  ChannelType,
  TextChannel,
  NewsChannel,
  ThreadChannel
} from 'discord.js'
// import { DiscordController } from './discord.controller'
// import { CommandsModule } from './commands/commands.module'
// import { CommandsController } from './commands/commands.controller'
import 'dotenv/config'
import { EventsService } from './events/events.service'
import { CommandsService } from './commands/commands.service'
import { CharacterService } from '../domains/character/character.service'
import { AppConfigService } from '../config/config.service'
import { DiscordClientService } from './services/discord-client.service'
import { CommandManagerService } from './services/command-manager.service'
import { DiscordButton, DiscordModal, DiscordSelectMenu } from './interfaces/discord-interaction-types.interface'
import { SendMessageDto } from './dto/send-message.dto'
import { CreateChannelDto } from './dto/create-channel.dto'

/**
 * Discord統合サービス
 * Discord BOTのメインエントリーポイント
 * すべてのイベントリスナーを一元管理
 */
@Injectable()
export class DiscordService {
  private readonly logger = new Logger(DiscordService.name)
  private client: Client
  private initialized = false

  // インタラクション登録用のマップ（EventManagerServiceから移行）
  private readonly buttons = new Map<string, DiscordButton>()
  private readonly modals = new Map<string, DiscordModal>()
  private readonly selects = new Map<string, DiscordSelectMenu>()
  // 処理済みインタラクションのIDを記録するSet（重複処理防止用）
  private readonly processedInteractions = new Set<string>()

  constructor(
    private readonly discordClientService: DiscordClientService,
    private readonly eventsService: EventsService,
    private readonly commandsService: CommandsService,
    private readonly characterService: CharacterService,
    private readonly appConfigService: AppConfigService,
    private readonly commandManagerService: CommandManagerService
  ) {
    // クライアントはDiscordClientServiceから取得する
    this.client = this.discordClientService.getClient()
  }

  /**
   * Discordサービスを初期化する
   */
  async initializeDiscord(): Promise<void> {
    if (this.initialized) {
      return
    }

    this.logger.log('Discord初期化を開始します...')

    try {
      // ClientReadyイベントの登録
      this.client.once(Events.ClientReady, (readyClient) => {
        this.logger.log(`Discord BOTが起動しました: ${readyClient.user.tag}`)
      })

      // CharacterServiceをクライアントにアタッチ（型安全）
      ;(this.client as any)['characterService'] = this.characterService

      // イベントハンドリング用の各サービスにクライアントを設定
      this.eventsService.loadClient(this.client)
      this.commandsService.loadClient(this.client)

      // すべてのインタラクションイベントを一元管理
      this.setupInteractionEventHandler()

      // Discord Client初期化を呼び出し
      await this.discordClientService.initializeClient()

      this.initialized = true
      this.logger.log('Discord初期化が完了しました')
    } catch (error) {
      this.logger.error('Discord初期化に失敗しました', error)
      throw error
    }
  }

  /**
   * ボタンを登録する
   * @param button ボタン
   */
  registerButton(button: DiscordButton): void {
    this.logger.log(`ボタン「${button.name}」を登録しています`)
    this.buttons.set(button.id, button)
  }

  /**
   * モーダルを登録する
   * @param modal モーダル
   */
  registerModal(modal: DiscordModal): void {
    this.logger.log(`モーダル「${modal.name}」を登録しています`)
    this.modals.set(modal.id, modal)
  }

  /**
   * セレクトメニューを登録する
   * @param select セレクトメニュー
   */
  registerSelectMenu(select: DiscordSelectMenu): void {
    this.logger.log(`セレクトメニュー「${select.name}」を登録しています`)
    this.selects.set(select.id, select)
  }

  /**
   * ユーザーのチャンネルアクセス権限を確認
   * @param channelId チャンネルID
   * @param discordUserId ユーザーのDiscord ID
   * @returns アクセス権限があるかどうか
   */
  async verifyChannelAccess(channelId: string, discordUserId: string): Promise<boolean> {
    try {
      const channel = await this.client.channels.fetch(channelId)
      if (!channel) {
        return false
      }

      if (!('guild' in channel) || !channel.guild) {
        return false
      }

      const guild = channel.guild
      const member = await guild.members.fetch(discordUserId).catch(() => null)

      if (!member) {
        return false
      }

      // チャンネルの表示権限とメッセージ送信権限をチェック
      const permissions = channel.permissionsFor(member)
      return permissions
        ? permissions.has(PermissionsBitField.Flags.ViewChannel) &&
            permissions.has(PermissionsBitField.Flags.SendMessages)
        : false
    } catch (error) {
      this.logger.error(`チャンネルアクセス権限確認エラー: ${error}`)
      return false
    }
  }

  /**
   * ユーザーのギルドアクセス権限を確認
   * @param guildId ギルドID
   * @param discordUserId ユーザーのDiscord ID
   * @returns アクセス権限があるかどうか
   */
  async verifyGuildAccess(guildId: string, discordUserId: string): Promise<boolean> {
    try {
      const guild = await this.client.guilds.fetch(guildId)
      if (!guild) {
        return false
      }

      const member = await guild.members.fetch(discordUserId).catch(() => null)
      return member !== null
    } catch (error) {
      this.logger.error(`ギルドアクセス権限確認エラー: ${error}`)
      return false
    }
  }

  /**
   * ユーザーのギルド管理権限を確認
   * @param guildId ギルドID
   * @param discordUserId ユーザーのDiscord ID
   * @returns 管理権限があるかどうか
   */
  async verifyGuildManagePermission(guildId: string, discordUserId: string): Promise<boolean> {
    try {
      const guild = await this.client.guilds.fetch(guildId)
      if (!guild) {
        return false
      }

      const member = await guild.members.fetch(discordUserId).catch(() => null)
      if (!member) {
        return false
      }

      // チャンネル管理権限をチェック
      return member.permissions.has(PermissionsBitField.Flags.ManageChannels)
    } catch (error) {
      this.logger.error(`ギルド管理権限確認エラー: ${error}`)
      return false
    }
  }

  /**
   * Discord Bot経由でメッセージを送信する
   * @param sendMessageDto メッセージ送信DTO
   */
  async sendMessage(sendMessageDto: SendMessageDto): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const { channelId, content, embed } = sendMessageDto

      const channel = await this.client.channels.fetch(channelId)
      if (!channel || !channel.isTextBased()) {
        throw new Error('チャンネルが見つからないか、テキストチャンネルではありません')
      }

      const messageOptions: { content?: string; embeds?: any[] } = {}
      if (content) {
        messageOptions.content = content
      }
      if (embed) {
        messageOptions.embeds = [embed]
      }

      const message = await (channel as TextChannel | NewsChannel | ThreadChannel).send(messageOptions)

      return {
        success: true,
        messageId: message.id
      }
    } catch (error) {
      this.logger.error('メッセージ送信に失敗しました', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '不明なエラーが発生しました'
      }
    }
  }

  /**
   * Discord Bot経由でチャンネルを作成する
   * @param createChannelDto チャンネル作成DTO
   */
  async createChannel(
    createChannelDto: CreateChannelDto
  ): Promise<{ success: boolean; channelId?: string; error?: string }> {
    try {
      const { guildId, name, type = 'text', topic, parentId, position, nsfw, rateLimitPerUser } = createChannelDto

      const guild = await this.client.guilds.fetch(guildId)
      if (!guild) {
        throw new Error('ギルドが見つかりません')
      }

      // Discord.js v14の正しいChannelTypeを使用
      let channelType: ChannelType.GuildText | ChannelType.GuildVoice | ChannelType.GuildCategory
      switch (type) {
        case 'voice':
          channelType = ChannelType.GuildVoice
          break
        case 'category':
          channelType = ChannelType.GuildCategory
          break
        case 'text':
        default:
          channelType = ChannelType.GuildText
          break
      }

      const channelOptions: {
        name: string
        type: ChannelType.GuildText | ChannelType.GuildVoice | ChannelType.GuildCategory
        topic?: string
        parent?: string
        position?: number
        nsfw?: boolean
        rateLimitPerUser?: number
      } = {
        name,
        type: channelType,
        topic,
        parent: parentId,
        position,
        nsfw,
        rateLimitPerUser
      }

      const channel = await guild.channels.create(channelOptions)

      return {
        success: true,
        channelId: channel.id
      }
    } catch (error) {
      this.logger.error('チャンネル作成に失敗しました', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '不明なエラーが発生しました'
      }
    }
  }

  /**
   * Discord Bot の現在の状態を取得する
   */
  async getBotStatus(): Promise<{
    online: boolean
    guilds: number
    users: number
    ping: number
    uptime: number
  }> {
    try {
      const guilds = this.client.guilds.cache.size
      const users = this.client.users.cache.size
      const ping = this.client.ws.ping
      const uptime = this.client.uptime || 0

      return {
        online: this.client.isReady(),
        guilds,
        users,
        ping,
        uptime
      }
    } catch (error) {
      this.logger.error('Bot状態取得に失敗しました', error)
      return {
        online: false,
        guilds: 0,
        users: 0,
        ping: 0,
        uptime: 0
      }
    }
  }

  /**
   * 指定されたギルドの情報を取得する
   * @param guildId ギルドID
   */
  async getGuildInfo(guildId: string): Promise<{
    id: string
    name: string
    memberCount: number
    channels: Array<{ id: string; name: string; type: string }>
  }> {
    try {
      const guild = await this.client.guilds.fetch(guildId)
      if (!guild) {
        throw new Error('ギルドが見つかりません')
      }

      const channels = guild.channels.cache.map((channel) => ({
        id: channel.id,
        name: channel.name,
        type: channel.type.toString()
      }))

      return {
        id: guild.id,
        name: guild.name,
        memberCount: guild.memberCount,
        channels
      }
    } catch (error) {
      this.logger.error('ギルド情報取得に失敗しました', error)
      throw error
    }
  }

  /**
   * 指定されたチャンネルの情報を取得する
   * @param channelId チャンネルID
   */
  async getChannelInfo(channelId: string): Promise<{
    id: string
    name: string
    type: string
    guild: { id: string; name: string }
  }> {
    try {
      const channel = await this.client.channels.fetch(channelId)
      if (!channel) {
        throw new Error('チャンネルが見つかりません')
      }

      const guild = 'guild' in channel && channel.guild ? channel.guild : null

      return {
        id: channel.id,
        name: 'name' in channel ? channel.name || '' : '',
        type: channel.type.toString(),
        guild: guild ? { id: guild.id, name: guild.name } : { id: '', name: '' }
      }
    } catch (error) {
      this.logger.error('チャンネル情報取得に失敗しました', error)
      throw error
    }
  }

  /**
   * インタラクションイベントハンドラーを設定する
   * すべてのインタラクションはここで一元管理
   */
  private setupInteractionEventHandler(): void {
    this.client.on(Events.InteractionCreate, async (interaction: Interaction) => {
      try {
        // インタラクションIDを取得
        const interactionId = interaction.id

        // 既に処理済みのインタラクションは無視する（重複処理防止）
        if (this.processedInteractions.has(interactionId)) {
          this.logger.warn(`インタラクション(ID: ${interactionId})は既に処理されています。処理をスキップします。`)
          return
        }

        // インタラクションを処理済みとしてマーク
        this.processedInteractions.add(interactionId)

        // 古いインタラクションIDをクリーンアップ（メモリリーク防止）
        setTimeout(() => {
          this.processedInteractions.delete(interactionId)
        }, 60000) // 60秒後に削除

        // インタラクションタイプをログに出力
        const interactionTypeName = InteractionType[interaction.type] || 'Unknown'
        this.logger.log(`インタラクション受信: Type=${interactionTypeName}, ID=${interactionId}`)

        // インタラクションタイプに応じて処理を分岐
        if (interaction.isCommand()) {
          // スラッシュコマンド
          await this.handleCommandInteraction(interaction)
        } else if (interaction.isAutocomplete()) {
          // オートコンプリート
          await this.handleAutocompleteInteraction(interaction)
        } else if (interaction.isButton() || interaction.isModalSubmit() || interaction.isAnySelectMenu()) {
          // ボタン、モーダル、セレクトメニュー
          await this.processInteraction(interaction)
        } else {
          this.logger.log(`未サポートのインタラクションタイプ: ${interactionTypeName}`)
        }
      } catch (error) {
        this.logger.error('相互作用の処理中にエラーが発生しました')
        if (error instanceof Error) {
          this.logger.error(error.message)
        }
      }
    })
  }

  /**
   * コマンドインタラクションを処理する
   * @param interaction コマンドインタラクション
   */
  private async handleCommandInteraction(interaction: CommandInteraction): Promise<void> {
    this.logger.log(`コマンドインタラクション処理: ${interaction.commandName} (ID: ${interaction.id})`)
    try {
      await this.commandManagerService.handleCommandInteraction(interaction)
    } catch (error) {
      this.logger.error(`コマンド「${interaction.commandName}」の処理中にエラーが発生しました`)
      this.logger.error(error)

      // エラーメッセージを表示（まだ応答していない場合）
      if (!(interaction.replied || interaction.deferred)) {
        try {
          await interaction.reply({
            content: 'コマンド処理中にエラーが発生しました。',
            ephemeral: true
          })
        } catch (replyError) {
          this.logger.error('コマンドエラー応答中にさらにエラーが発生しました')
        }
      }
    }
  }

  /**
   * オートコンプリートインタラクションを処理する
   * @param interaction オートコンプリートインタラクション
   */
  private async handleAutocompleteInteraction(interaction: AutocompleteInteraction): Promise<void> {
    try {
      await this.commandManagerService.handleAutocompleteInteraction(interaction)
    } catch (error) {
      this.logger.error(`オートコンプリート「${interaction.commandName}」の処理中にエラーが発生しました`)
      this.logger.error(error)
      // オートコンプリートの場合、エラー時の特別な応答は必要ない
    }
  }

  /**
   * インタラクションを処理する
   * @param interaction Discord インタラクション
   */
  private async processInteraction(
    interaction: ButtonInteraction | ModalSubmitInteraction | AnySelectMenuInteraction
  ): Promise<void> {
    const interactionTypeName = InteractionType[interaction.type] || 'Unknown'
    this.logger.log(
      `インタラクション処理: Type=${interactionTypeName}, CustomID=${interaction.customId}, ID=${interaction.id}`
    )
    let interactionHandled = false

    try {
      // 応答済みのインタラクションは処理しない
      if (interaction.replied || interaction.deferred) {
        this.logger.warn(`インタラクション(ID: ${interaction.id})は既に応答済みです。処理をスキップします。`)
        return
      }

      // まずEventsServiceに処理を委譲
      interactionHandled = await this.eventsService.handleInteraction(interaction)
    } catch (error) {
      this.logger.error('EventsServiceでの処理中にエラーが発生しました')
      this.logger.error(error)
      interactionHandled = false
    }

    // EventsServiceで処理されなかった場合はフォールバック処理を実行
    if (!interactionHandled && !(interaction.replied || interaction.deferred)) {
      try {
        await this.handleUnprocessedInteraction(interaction)
      } catch (error) {
        this.logger.error('フォールバック処理中にエラーが発生しました')
        this.logger.error(error)

        // まだ応答していない場合のみエラーメッセージを表示
        if (!(interaction.replied || interaction.deferred)) {
          try {
            await interaction.reply({
              content: '処理中にエラーが発生しました。しばらく経ってから再度お試しください。',
              ephemeral: true
            })
          } catch (replyError) {
            this.logger.error('エラー応答中にさらにエラーが発生しました')
            this.logger.error(replyError)
          }
        }
      }
    }
  }

  /**
   * EventsServiceで処理されなかったインタラクションを処理
   * @param interaction Discord インタラクション
   */
  private async handleUnprocessedInteraction(
    interaction: ButtonInteraction | ModalSubmitInteraction | AnySelectMenuInteraction
  ): Promise<void> {
    // 応答済みのインタラクションは処理しない
    if (interaction.replied || interaction.deferred) {
      this.logger.warn(
        `インタラクション(ID: ${interaction.id})は既に応答済みです。フォールバック処理をスキップします。`
      )
      return
    }

    this.logger.log(
      `EventsServiceで処理されなかったインタラクション: ${interaction.type} (ID: ${interaction.customId})`
    )

    if (interaction.isButton()) {
      await this.handleButtonInteraction(interaction)
    } else if (interaction.isModalSubmit()) {
      await this.handleModalInteraction(interaction)
    } else if (interaction.isAnySelectMenu()) {
      await this.handleSelectMenuInteraction(interaction)
    }
  }

  /**
   * ボタン相互作用を処理する
   * @param interaction ボタン相互作用
   */
  private async handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
    // 応答済みのインタラクションは処理しない
    if (interaction.replied || interaction.deferred) {
      return
    }

    const customId = interaction.customId
    // カスタムIDにはプレフィックスやパラメータが含まれていることがあるため、プレフィックス部分を抽出
    const buttonId = customId.split(':')[0]
    const button = this.buttons.get(buttonId)

    if (!button) {
      this.logger.warn(`未登録のボタン「${buttonId}」が押されました`)
      await interaction.reply({
        content: '無効なボタンです。管理者に問い合わせてください。',
        ephemeral: true
      })
      return
    }

    try {
      await button.execute(interaction)
    } catch (error) {
      this.logger.error(`ボタン「${buttonId}」の処理中にエラーが発生しました`)
      if (error instanceof Error) {
        this.logger.error(error.message)
      }

      if (!(interaction.replied || interaction.deferred)) {
        try {
          await interaction.reply({
            content: 'ボタン処理中にエラーが発生しました。',
            ephemeral: true
          })
        } catch (replyError) {
          this.logger.error('ボタンエラー応答中にさらにエラーが発生しました')
        }
      }
    }
  }

  /**
   * モーダル相互作用を処理する
   * @param interaction モーダル相互作用
   */
  private async handleModalInteraction(interaction: ModalSubmitInteraction): Promise<void> {
    // 応答済みのインタラクションは処理しない
    if (interaction.replied || interaction.deferred) {
      return
    }

    const customId = interaction.customId
    // カスタムIDにはプレフィックスやパラメータが含まれていることがあるため、プレフィックス部分を抽出
    const modalId = customId.split(':')[0]
    const modal = this.modals.get(modalId)

    if (!modal) {
      this.logger.warn(`未登録のモーダル「${modalId}」が送信されました`)
      await interaction.reply({
        content: '無効なフォームです。管理者に問い合わせてください。',
        ephemeral: true
      })
      return
    }

    try {
      await modal.execute(interaction)
    } catch (error) {
      this.logger.error(`モーダル「${modalId}」の処理中にエラーが発生しました`)
      if (error instanceof Error) {
        this.logger.error(error.message)
      }

      if (!(interaction.replied || interaction.deferred)) {
        try {
          await interaction.reply({
            content: 'フォーム処理中にエラーが発生しました。',
            ephemeral: true
          })
        } catch (replyError) {
          this.logger.error('モーダルエラー応答中にさらにエラーが発生しました')
        }
      }
    }
  }

  /**
   * セレクトメニュー相互作用を処理する
   * @param interaction セレクトメニュー相互作用
   */
  private async handleSelectMenuInteraction(interaction: AnySelectMenuInteraction): Promise<void> {
    // 応答済みのインタラクションは処理しない
    if (interaction.replied || interaction.deferred) {
      return
    }

    const customId = interaction.customId
    // カスタムIDにはプレフィックスやパラメータが含まれていることがあるため、プレフィックス部分を抽出
    const selectId = customId.split(':')[0]
    const select = this.selects.get(selectId)

    if (!select) {
      this.logger.warn(`未登録のセレクトメニュー「${selectId}」が選択されました`)
      await interaction.reply({
        content: '無効なメニューです。管理者に問い合わせてください。',
        ephemeral: true
      })
      return
    }

    try {
      await select.execute(interaction)
    } catch (error) {
      this.logger.error(`セレクトメニュー「${selectId}」の処理中にエラーが発生しました`)
      if (error instanceof Error) {
        this.logger.error(error.message)
      }

      if (!(interaction.replied || interaction.deferred)) {
        try {
          await interaction.reply({
            content: 'メニュー処理中にエラーが発生しました。',
            ephemeral: true
          })
        } catch (replyError) {
          this.logger.error('セレクトメニューエラー応答中にさらにエラーが発生しました')
        }
      }
    }
  }
}
