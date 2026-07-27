import {
  Controller,
  Post,
  Body,
  UseGuards,
  UsePipes,
  ValidationPipe,
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
import type { GuildManagePermissionCheckResult } from './discord-facade.service'
import type {
  DiscordCreateChannelResult,
  DiscordSendMessageResult
} from './interfaces/discord-operation-result.interface'
import { GUILD_CATEGORY_TYPE } from './interfaces/guild-channel-type.constant'
import { JwtAuthGuard } from '../domains/auth/guards/jwt-auth.guard'
import { CharacterService } from '../domains/character/character.service'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger'
import { SendMessageDto } from './dto/send-message.dto'
import { CreateChannelDto, CreateChannelType } from './dto/create-channel.dto'
import {
  collectRequestedOverwritePermissionKeys,
  getChannelPermissionOverwritesValidationError,
  isDiscordSnowflake,
  toPermissionOverwriteResolvables
} from './dto/channel-permission-overwrite.validator'
import type { ValidationPipeOptions } from '@nestjs/common'
import type { PermissionsString } from 'discord.js'
import { PostCharacterDto } from './dto/post-character.dto'
import { CharacterEmbedManagerService } from './features/characterEdit/services/character-embed-manager.service'
import { ChannelDetectionService } from './features/characterEdit/services/channel-detection.service'

// 認証されたリクエストの型定義
interface AuthenticatedRequest extends Request {
  user: {
    discordUserId: string
    id: string
    username: string
  }
}

/**
 * Discord REST 経路の ValidationPipe 設定の単一ソース。
 * controller の @UsePipes と各 spec（HTTP 経路相当の pipe 生成・metadata 検証）が同じ値を参照し、
 * 「spec が検証した設定」と「実際に適用される設定」のズレを防ぐ。
 */
export const DISCORD_VALIDATION_PIPE_OPTIONS: ValidationPipeOptions = { transform: true, whitelist: true }

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
// DTO デコレータ検証（send-message / create-channel / post-character）を HTTP 経路で実効化する。
// 他 controller（character 等）と同じ設定に合わせる。
@UsePipes(new ValidationPipe(DISCORD_VALIDATION_PIPE_OPTIONS))
export class DiscordController {
  private readonly logger = new Logger(DiscordController.name)

  constructor(
    private readonly discordFacade: DiscordFacadeService,
    private readonly characterService: CharacterService,
    private readonly characterEmbedManager: CharacterEmbedManagerService,
    private readonly channelDetectionService: ChannelDetectionService
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
  ): Promise<DiscordSendMessageResult> {
    try {
      this.logger.log(`メッセージ送信要求: channelId=${sendMessageDto.channelId}, user=${req.user?.discordUserId}`)

      // 入力値検証
      if (!sendMessageDto.content && !sendMessageDto.embed && !sendMessageDto.embeds?.length) {
        throw new BadRequestException('メッセージ内容またはEmbedのいずれかが必要です')
      }

      // ユーザーのチャンネルアクセス権限を確認
      const hasAccess = await this.discordFacade.verifyChannelAccess(sendMessageDto.channelId, req.user.discordUserId)

      if (!hasAccess) {
        throw new HttpException('このチャンネルへのアクセス権限がありません', HttpStatus.FORBIDDEN)
      }

      const embeds = [...(sendMessageDto.embed ? [sendMessageDto.embed] : []), ...(sendMessageDto.embeds ?? [])]

      // HTTP表現をDiscord操作契約へ正規化してfacadeへ委譲する。
      const result = await this.discordFacade.sendMessage(sendMessageDto.channelId, sendMessageDto.content || '', {
        embeds: embeds.length > 0 ? embeds : undefined,
        components: sendMessageDto.components
      })

      if (result.success) {
        this.logger.log(`メッセージ送信完了: messageId=${result.messageId}`)
      } else {
        this.logger.warn(`メッセージ送信失敗: ${result.error}`)
      }
      return result
    } catch (error) {
      this.rethrowAsHttpError('メッセージ送信', error, 'メッセージ送信中にエラーが発生しました')
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
  ): Promise<DiscordCreateChannelResult> {
    try {
      this.logger.log(`チャンネル作成要求: guildId=${createChannelDto.guildId}, name=${createChannelDto.name}`)

      if (createChannelDto.type === CreateChannelType.THREAD) {
        throw new BadRequestException('スレッドは親チャンネルを指定する専用の作成処理を使用してください')
      }

      // Nest pipe を通らない直接呼び出しにも同じ契約を強制する二重防御。
      // DTO デコレータと同一の共有関数・predicate を使い、判定のズレを防ぐ。
      const permissionsValidationError = getChannelPermissionOverwritesValidationError(createChannelDto.permissions)
      if (permissionsValidationError) {
        throw new BadRequestException(permissionsValidationError)
      }

      if (createChannelDto.parentId !== undefined && !isDiscordSnowflake(createChannelDto.parentId)) {
        // 受信値そのものはメッセージ・ログへ流さない（log injection 防止）
        throw new BadRequestException('親カテゴリーIDは17〜19桁のDiscord Snowflake文字列で指定してください')
      }

      // ユーザーのギルド管理権限を確認。非空 overwrite は Discord ネイティブ意味論に合わせ、
      // ManageRoles と指定キー（allow/deny の和集合）の caller-holds も併せて検査する。
      const permission = await this.verifyGuildManagePermission(
        createChannelDto.guildId,
        req.user.discordUserId,
        createChannelDto.parentId,
        collectRequestedOverwritePermissionKeys(createChannelDto.permissions)
      )
      this.assertGuildManagePermission(permission)

      // HTTP表現をDiscord操作契約へ正規化する（parentId → parent、overwrite type → OverwriteType）。
      const result = await this.discordFacade.createChannel(createChannelDto.guildId, createChannelDto.name, {
        type: createChannelDto.type,
        parent: createChannelDto.parentId,
        topic: createChannelDto.topic,
        permissions: toPermissionOverwriteResolvables(createChannelDto.permissions)
      })

      if (result.success) {
        this.logger.log(`チャンネル作成完了: channelId=${result.channelId}`)
      } else {
        this.logger.warn(`チャンネル作成失敗: ${result.error}`)
      }
      return result
    } catch (error) {
      this.rethrowAsHttpError('チャンネル作成', error, 'チャンネル作成中にエラーが発生しました')
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
      this.rethrowAsHttpError('Bot状態取得', error, 'Bot状態取得中にエラーが発生しました')
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
      if (!(error instanceof HttpException) && (error as Error).message?.includes('ギルドが見つかりません')) {
        this.rethrowAsHttpError(
          'ギルド情報取得',
          new NotFoundException('指定されたギルドが見つかりません'),
          'ギルド情報取得中にエラーが発生しました'
        )
      }

      this.rethrowAsHttpError('ギルド情報取得', error, 'ギルド情報取得中にエラーが発生しました')
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
      if (!(error instanceof HttpException) && (error as Error).message?.includes('チャンネルが見つかりません')) {
        this.rethrowAsHttpError(
          'チャンネル情報取得',
          new NotFoundException('指定されたチャンネルが見つかりません'),
          'チャンネル情報取得中にエラーが発生しました'
        )
      }

      this.rethrowAsHttpError('チャンネル情報取得', error, 'チャンネル情報取得中にエラーが発生しました')
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
      const character = await this.characterService.findOneForOwner(
        postCharacterDto.characterId,
        req.user.discordUserId
      )
      if (!character) {
        throw new NotFoundException('指定されたキャラクターが見つかりません')
      }

      // Why: 後続のカテゴリ権限検査にも包含されるが、getGuildInfo によるチャンネル一覧開示前の
      // 開示ゲートとして意図的に残す。
      const permission = await this.verifyGuildManagePermission(postCharacterDto.guildId, req.user.discordUserId)
      this.assertGuildManagePermission(permission)

      // ギルド情報を取得
      const guildInfo = await this.discordFacade.getGuildInfo(postCharacterDto.guildId)

      // キャラクター投稿用のカテゴリを探す
      const characterCategories = guildInfo.channels.filter(
        (channel) =>
          channel.type === GUILD_CATEGORY_TYPE &&
          (channel.name.toLowerCase().includes('character') || channel.name.toLowerCase().includes('キャラクター'))
      )

      if (characterCategories.length === 0) {
        throw new NotFoundException('キャラクター投稿用のカテゴリが見つかりません')
      }

      // 最初のキャラクターカテゴリを使用
      const targetCategory = characterCategories[0]

      // カテゴリ配下へ作成するため、基底権限に加えカテゴリ overwrite でも管理権限を確認する
      const categoryPermission = await this.verifyGuildManagePermission(
        postCharacterDto.guildId,
        req.user.discordUserId,
        targetCategory.id
      )
      this.assertGuildManagePermission(categoryPermission)

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
      if (!createChannelResult.success) {
        throw new HttpException(createChannelResult.error, HttpStatus.INTERNAL_SERVER_ERROR)
      }

      // Invariant: createChannel の resolve からこのマークまで await を挟まない。channelCreate は
      // create() 解決前に同期 emit されるため、この順序がマイクロタスク保証の根拠となる。
      this.channelDetectionService.markBotManagedChannel(createChannelResult.channelId)

      // 作成したチャンネルIDを await して永続化（完了・エラーを成功応答前に保証）
      const updatedCharacter = await this.characterService.updateForOwner(
        postCharacterDto.characterId,
        req.user.discordUserId,
        {
          discordChannelId: createChannelResult.channelId
        }
      )
      if (!updatedCharacter) {
        throw new NotFoundException('指定されたキャラクターが見つかりません')
      }

      // 完了イベントはスレッド作成等も連鎖するため使わず、既存の表示部品をこのHTTPフロー内で直接投稿する。
      const { embeds, components } = await this.characterEmbedManager.createSectionedEmbeds(updatedCharacter)
      const sendMessageResult = await this.discordFacade.sendMessage(createChannelResult.channelId, '', {
        embeds,
        components
      })
      if (!sendMessageResult.success) {
        throw new HttpException(sendMessageResult.error, HttpStatus.INTERNAL_SERVER_ERROR)
      }

      this.logger.log(
        `キャラクター投稿完了: channelId=${createChannelResult.channelId}, messageId=${sendMessageResult.messageId}`
      )
      return { success: true, messageId: sendMessageResult.messageId }
    } catch (error) {
      this.rethrowAsHttpError('キャラクター投稿', error, 'キャラクター投稿中にエラーが発生しました')
    }
  }

  /**
   * ギルド管理権限を確認する
   * Discord API・通信例外は認可拒否へ変換せず、呼び出し元へ伝播する
   */
  private async verifyGuildManagePermission(
    guildId: string,
    discordUserId: string,
    parentId?: string,
    requestedOverwritePermissionKeys?: readonly PermissionsString[]
  ): Promise<GuildManagePermissionCheckResult> {
    return this.discordFacade.verifyGuildManagePermission(
      guildId,
      discordUserId,
      parentId,
      requestedOverwritePermissionKeys
    )
  }

  /**
   * 権限検査の拒否分類を HTTP 例外へ写像する。
   * parent の not-found / not-category は入力不正（400）、権限系の拒否は 403。
   * 基盤障害は分類結果に含まれず throw で伝播する（catch 側で 500 に写像）。
   */
  private assertGuildManagePermission(result: GuildManagePermissionCheckResult): void {
    // Invariant: fail-closed。明示的な { hasPermission: true } だけを許可とし、
    // false / undefined / {} / 旧 boolean 契約の true など判別型以外はすべて拒否（403）へ倒す。
    if (result?.hasPermission === true) {
      return
    }

    if (result?.hasPermission === false) {
      if (result.denial === 'parent-not-found') {
        throw new BadRequestException('指定された親カテゴリが見つかりません')
      }

      if (result.denial === 'parent-not-category') {
        throw new BadRequestException('指定された親チャンネルはカテゴリではありません')
      }
    }

    throw new HttpException('このギルドでのチャンネル作成権限がありません', HttpStatus.FORBIDDEN)
  }

  /**
   * 既知の拒否（4xx の HttpException）は理由付き warn、予期しない障害だけ error として記録する。
   * HttpException 以外は 500 へラップして投げ直す。
   */
  private rethrowAsHttpError(operation: string, error: unknown, internalErrorMessage: string): never {
    if (error instanceof HttpException) {
      if (error.getStatus() >= Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
        this.logger.error(`${operation}エラー: ${error.message}`, error.stack)
      } else {
        this.logger.warn(`${operation}拒否: status=${error.getStatus()}, reason=${error.message}`)
      }
      throw error
    }

    this.logger.error(`${operation}エラー: ${(error as Error).message}`, (error as Error).stack)
    throw new HttpException(internalErrorMessage, HttpStatus.INTERNAL_SERVER_ERROR)
  }
}
