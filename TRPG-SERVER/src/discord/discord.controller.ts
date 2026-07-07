import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Param,
  Req,
  HttpException,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  Logger
} from '@nestjs/common'
import { Request } from 'express'
import { DiscordFacadeService } from './discord-facade.service'
import { JwtAuthGuard } from '../domains/auth/guards/jwt-auth.guard'
import { CharacterService } from '../domains/character/character.service'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger'
import { SendMessageDto } from './dto/send-message.dto'
import { CreateChannelDto, CreateChannelType } from './dto/create-channel.dto'
import { PostCharacterDto } from './dto/post-character.dto'

// 認証されたリクエストの型定義
interface AuthenticatedRequest extends Request {
  user: {
    discordUserId: string
    id: string
    username: string
  }
}

/**
 * Discordコントローラー
 * Discord Bot操作用のHTTP APIエンドポイントを提供
 *
 * 責務:
 * - HTTP リクエストの受信とレスポンス
 * - 認証・認可の確認
 * - 入力値バリデーション
 * - エラーハンドリング
 */
@Controller('discord')
@ApiTags('Discord Bot')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class DiscordController {
  private readonly logger = new Logger(DiscordController.name)

  constructor(
    private readonly discordFacade: DiscordFacadeService,
    private readonly characterService: CharacterService
  ) {}

  /**
   * Discord Bot経由でメッセージを送信する
   * @param sendMessageDto メッセージ送信DTO
   * @param req リクエスト（ユーザー情報含む）
   */
  @Post('send-message')
  @ApiOperation({ summary: 'Discord Bot経由でメッセージを送信' })
  @ApiResponse({ status: 200, description: 'メッセージ送信成功' })
  @ApiResponse({ status: 400, description: 'バリデーションエラー' })
  @ApiResponse({ status: 401, description: '認証エラー' })
  @ApiResponse({ status: 403, description: '権限不足' })
  @ApiResponse({ status: 404, description: 'チャンネルが見つかりません' })
  async sendMessage(
    @Body() sendMessageDto: SendMessageDto,
    @Req() req: AuthenticatedRequest
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      this.logger.log(`メッセージ送信要求: channelId=${sendMessageDto.channelId}, user=${req.user?.discordUserId}`)

      // 入力値検証
      if (!sendMessageDto.content && !sendMessageDto.embed) {
        throw new BadRequestException('メッセージ内容またはEmbedのいずれかが必要です')
      }

      // ユーザーのチャンネルアクセス権限を確認
      const hasAccess = await this.discordFacade.verifyChannelAccess(sendMessageDto.channelId, req.user.discordUserId)

      if (!hasAccess) {
        throw new HttpException('このチャンネルへのアクセス権限がありません', HttpStatus.FORBIDDEN)
      }

      // 旧 deprecated ラッパーの sendMessage 相当: DTO を facade 引数へ展開（挙動不変）
      const result = await this.discordFacade.sendMessage(sendMessageDto.channelId, sendMessageDto.content || '', {
        embeds: sendMessageDto.embeds,
        components: sendMessageDto.components
      })

      this.logger.log(`メッセージ送信完了: success=${result.success}, messageId=${result.messageId}`)
      return result
    } catch (error) {
      this.logger.error(`メッセージ送信エラー: ${(error as Error).message}`, (error as Error).stack)

      if (error instanceof HttpException) {
        throw error
      }

      throw new HttpException('メッセージ送信中にエラーが発生しました', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * Discord Bot経由でチャンネルを作成する
   * @param createChannelDto チャンネル作成DTO
   * @param req リクエスト（ユーザー情報含む）
   */
  @Post('create-channel')
  @ApiOperation({ summary: 'Discord Bot経由でチャンネルを作成' })
  @ApiResponse({ status: 200, description: 'チャンネル作成成功' })
  @ApiResponse({ status: 400, description: 'バリデーションエラー' })
  @ApiResponse({ status: 401, description: '認証エラー' })
  @ApiResponse({ status: 403, description: '権限不足' })
  @ApiResponse({ status: 404, description: 'ギルドが見つかりません' })
  async createChannel(
    @Body() createChannelDto: CreateChannelDto,
    @Req() req: AuthenticatedRequest
  ): Promise<{ success: boolean; channelId?: string; error?: string }> {
    try {
      this.logger.log(`チャンネル作成要求: guildId=${createChannelDto.guildId}, name=${createChannelDto.name}`)

      // ユーザーのギルド管理権限を確認
      const hasPermission = await this.verifyGuildManagePermission(createChannelDto.guildId, req.user.discordUserId)

      if (!hasPermission) {
        throw new HttpException('このギルドでのチャンネル作成権限がありません', HttpStatus.FORBIDDEN)
      }

      // 旧 deprecated ラッパーの createChannel 相当: DTO を facade 引数へ展開（parentId → parent、挙動不変）
      const result = await this.discordFacade.createChannel(createChannelDto.guildId, createChannelDto.name, {
        type: createChannelDto.type,
        parent: createChannelDto.parentId,
        topic: createChannelDto.topic,
        permissions: createChannelDto.permissions
      })

      this.logger.log(`チャンネル作成完了: success=${result.success}, channelId=${result.channelId}`)
      return result
    } catch (error) {
      this.logger.error(`チャンネル作成エラー: ${(error as Error).message}`, (error as Error).stack)

      if (error instanceof HttpException) {
        throw error
      }

      throw new HttpException('チャンネル作成中にエラーが発生しました', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * Discord Bot の現在の状態を取得する
   */
  @Get('status')
  @ApiOperation({ summary: 'Discord Bot の現在の状態を取得' })
  @ApiResponse({ status: 200, description: 'Bot状態取得成功' })
  async getBotStatus(): Promise<{
    online: boolean
    guilds: number
    users: number
    ping: number
    uptime: number
  }> {
    try {
      this.logger.log('Bot状態取得要求')

      // 旧 deprecated ラッパーの getBotStatus 相当: health/client 情報を集約（挙動不変）
      const health = this.discordFacade.getHealthStatus()
      const client = this.discordFacade.getClient()
      const status = {
        online: health.services.client,
        guilds: client.guilds.cache.size,
        users: client.users.cache.size,
        ping: client.ws.ping,
        uptime: client.uptime || 0
      }

      this.logger.log(`Bot状態取得完了: online=${status.online}`)
      return status
    } catch (error) {
      this.logger.error(`Bot状態取得エラー: ${(error as Error).message}`, (error as Error).stack)

      throw new HttpException('Bot状態取得中にエラーが発生しました', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * 指定されたギルドの情報を取得する
   * @param guildId ギルドID
   * @param req リクエスト（ユーザー情報含む）
   */
  @Get('guild/:guildId')
  @ApiOperation({ summary: '指定されたギルドの情報を取得' })
  @ApiResponse({ status: 200, description: 'ギルド情報取得成功' })
  @ApiResponse({ status: 403, description: '権限不足' })
  @ApiResponse({ status: 404, description: 'ギルドが見つかりません' })
  async getGuildInfo(
    @Param('guildId') guildId: string,
    @Req() req: AuthenticatedRequest
  ): Promise<{
    id: string
    name: string
    memberCount: number
    channels: Array<{ id: string; name: string; type: string }>
  }> {
    try {
      this.logger.log(`ギルド情報取得要求: guildId=${guildId}`)

      // 入力値検証
      if (!guildId || typeof guildId !== 'string') {
        throw new BadRequestException('有効なギルドIDが必要です')
      }

      // ユーザーのギルドアクセス権限を確認
      const hasAccess = await this.discordFacade.verifyGuildAccess(guildId, req.user.discordUserId)

      if (!hasAccess) {
        throw new HttpException('このギルドへのアクセス権限がありません', HttpStatus.FORBIDDEN)
      }

      const guildInfo = await this.discordFacade.getGuildInfo(guildId)

      this.logger.log(`ギルド情報取得完了: name=${guildInfo.name}`)
      return guildInfo
    } catch (error) {
      this.logger.error(`ギルド情報取得エラー: ${(error as Error).message}`, (error as Error).stack)

      if (error instanceof HttpException) {
        throw error
      }

      if ((error as Error).message.includes('ギルドが見つかりません')) {
        throw new NotFoundException('指定されたギルドが見つかりません')
      }

      throw new HttpException('ギルド情報取得中にエラーが発生しました', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * 指定されたチャンネルの情報を取得する
   * @param channelId チャンネルID
   * @param req リクエスト（ユーザー情報含む）
   */
  @Get('channel/:channelId')
  @ApiOperation({ summary: '指定されたチャンネルの情報を取得' })
  @ApiResponse({ status: 200, description: 'チャンネル情報取得成功' })
  @ApiResponse({ status: 403, description: '権限不足' })
  @ApiResponse({ status: 404, description: 'チャンネルが見つかりません' })
  async getChannelInfo(
    @Param('channelId') channelId: string,
    @Req() req: AuthenticatedRequest
  ): Promise<{
    id: string
    name: string
    type: string
    guild: { id: string; name: string }
  }> {
    try {
      this.logger.log(`チャンネル情報取得要求: channelId=${channelId}`)

      // 入力値検証
      if (!channelId || typeof channelId !== 'string') {
        throw new BadRequestException('有効なチャンネルIDが必要です')
      }

      // ユーザーのチャンネルアクセス権限を確認
      const hasAccess = await this.discordFacade.verifyChannelAccess(channelId, req.user.discordUserId)

      if (!hasAccess) {
        throw new HttpException('このチャンネルへのアクセス権限がありません', HttpStatus.FORBIDDEN)
      }

      const channelInfo = await this.discordFacade.getChannelInfo(channelId)

      // 旧 deprecated ラッパーの getChannelInfo 相当: null は Error として catch で 500 へ変換（挙動不変）
      if (!channelInfo) {
        throw new Error(`Channel not found: ${channelId}`)
      }

      this.logger.log(`チャンネル情報取得完了: name=${channelInfo.name}`)
      return channelInfo
    } catch (error) {
      this.logger.error(`チャンネル情報取得エラー: ${(error as Error).message}`, (error as Error).stack)

      if (error instanceof HttpException) {
        throw error
      }

      if ((error as Error).message.includes('チャンネルが見つかりません')) {
        throw new NotFoundException('指定されたチャンネルが見つかりません')
      }

      throw new HttpException('チャンネル情報取得中にエラーが発生しました', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * キャラクター情報をDiscordサーバーに投稿する
   * @param postCharacterDto キャラクター投稿DTO
   * @param req リクエスト（ユーザー情報含む）
   */
  @Post('post-character')
  @ApiOperation({ summary: 'キャラクター情報をDiscordサーバーに投稿' })
  @ApiResponse({ status: 200, description: 'キャラクター投稿成功' })
  @ApiResponse({ status: 400, description: 'バリデーションエラー' })
  @ApiResponse({ status: 401, description: '認証エラー' })
  @ApiResponse({ status: 403, description: '権限不足' })
  @ApiResponse({ status: 404, description: 'キャラクターまたはギルドが見つかりません' })
  async postCharacter(
    @Body() postCharacterDto: PostCharacterDto,
    @Req() req: AuthenticatedRequest
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      this.logger.log(
        `キャラクター投稿要求: characterId=${postCharacterDto.characterId}, guildId=${postCharacterDto.guildId}`
      )

      // キャラクター情報を取得
      const character = await this.characterService.findOne(postCharacterDto.characterId)
      if (!character) {
        throw new NotFoundException('指定されたキャラクターが見つかりません')
      }

      // ユーザーのギルドアクセス権限を確認
      const hasAccess = await this.discordFacade.verifyGuildAccess(postCharacterDto.guildId, req.user.discordUserId)
      if (!hasAccess) {
        throw new HttpException('このギルドへのアクセス権限がありません', HttpStatus.FORBIDDEN)
      }

      // ギルド情報を取得
      const guildInfo = await this.discordFacade.getGuildInfo(postCharacterDto.guildId)

      // キャラクター投稿用のカテゴリを探す
      const characterCategories = guildInfo.channels.filter(
        (channel) =>
          channel.type === '4' && // カテゴリタイプ（ChannelType.GuildCategory = 4）
          (channel.name.toLowerCase().includes('character') || channel.name.toLowerCase().includes('キャラクター'))
      )

      if (characterCategories.length === 0) {
        throw new NotFoundException('キャラクター投稿用のカテゴリが見つかりません')
      }

      // 最初のキャラクターカテゴリを使用
      const targetCategory = characterCategories[0]

      // カテゴリ内にキャラクター名でチャンネルを作成
      const channelName = character.characterName
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]/g, '')
      const createChannelResult = await this.discordFacade.createChannel(postCharacterDto.guildId, channelName, {
        type: CreateChannelType.TEXT,
        parent: targetCategory.id,
        topic: `${character.characterName}のキャラクター情報`
      })

      // チャンネル作成の成否を先に判定（失敗時は永続化せず 500）
      if (!createChannelResult.success || !createChannelResult.channelId) {
        throw new HttpException(
          createChannelResult.error || 'チャンネル作成に失敗しました',
          HttpStatus.INTERNAL_SERVER_ERROR
        )
      }

      // 作成したチャンネルIDを await して永続化（完了・エラーを成功応答前に保証）
      await this.characterService.update(postCharacterDto.characterId, {
        discordChannelId: createChannelResult.channelId
      })

      const targetChannel = { id: createChannelResult.channelId }

      // 🚨 REMOVED: 冗長なキャラクターEmbed直接作成を削除
      // File-based Event Handlersがcharacter.creation.completedイベントを自動処理するため不要

      this.logger.log(
        `キャラクター投稿完了: channelId=${targetChannel.id}（File-based Event Handlers経由で自動Embed作成）`
      )
      return { success: true, messageId: 'auto-handled-by-file-based-handlers' }
    } catch (error) {
      this.logger.error(`キャラクター投稿エラー: ${(error as Error).message}`, (error as Error).stack)

      if (error instanceof HttpException) {
        throw error
      }

      throw new HttpException('キャラクター投稿中にエラーが発生しました', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * ギルド管理権限を確認する
   * 旧 deprecated ラッパーの verifyGuildManagePermission 相当（検証中のエラーは権限なし扱い＝挙動不変）
   */
  private async verifyGuildManagePermission(guildId: string, discordUserId: string): Promise<boolean> {
    try {
      return await this.discordFacade.verifyGuildAccess(guildId, discordUserId)
    } catch (error) {
      this.logger.error('Error verifying guild permission:', error)
      return false
    }
  }
}
