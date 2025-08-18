import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  UseGuards,
  Req,
  UnauthorizedException,
  NotFoundException,
  Headers,
  Header,
  Res,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  UsePipes
} from '@nestjs/common'
import { Request, Response } from 'express'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CharacterService } from './character.service'
import { CharacterInputDto, CharacterIdParamDto } from './dto/create-character.dto'
import { UpdateCharacterDto } from './dto/update-character.dto'
import { CharacterSummaryDto } from './dto/character-summary.dto'
import {
  CreateDiscordThreadDto,
  DisplayCharacterOnDiscordDto,
  DiscordOperationResultDto
} from './dto/discord-integration.dto'
import { Character } from './models/character.model'
import { AuthGuard } from '@nestjs/passport'
import { AuthService } from '../auth/services/auth.service'
import { JwtTokenPayload } from '../auth/models/auth.token.model'
import { ApiResponseUtil } from '../../utils/api-response.util'
import { TypedEventService } from '../../shared/application/typed-event.service'

/**
 * キャラクターコントローラー
 * キャラクター情報のCRUD操作とDiscord統合機能のエンドポイントを提供する
 */
@ApiTags('キャラクター管理')
@Controller('character')
@ApiBearerAuth()
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class CharacterController {
  constructor(
    private readonly characterService: CharacterService,
    private readonly authService: AuthService,
    private readonly typedEventService: TypedEventService
  ) {}

  /**
   * 認証されたユーザーを取得するヘルパーメソッド
   */
  private extractAuthenticatedUser(req: Request): JwtTokenPayload {
    const headerRaw = req.headers['user'] as string | undefined
    const headerUser: Partial<JwtTokenPayload> | undefined = headerRaw ? JSON.parse(headerRaw) : undefined
    const user = (req.user as unknown as JwtTokenPayload | undefined) ?? (headerUser as JwtTokenPayload | undefined)

    if (!user || !user.discordUserId) {
      throw new UnauthorizedException('認証トークンがありません')
    }

    return user
  }

  /**
   * 新しいキャラクターを作成する
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'キャラクター作成',
    description: '新しいキャラクターを作成し、必要に応じてDiscord連携を実行します'
  })
  @ApiResponse({ status: 201, description: 'キャラクター作成成功' })
  @ApiResponse({ status: 400, description: 'バリデーションエラー' })
  @ApiResponse({ status: 401, description: '認証エラー' })
  @ApiResponse({ status: 500, description: 'サーバーエラー' })
  async create(@Body() characterData: CharacterInputDto, @Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const user = this.extractAuthenticatedUser(req)

      const createCharacterDto: CharacterInputDto = {
        ...characterData,
        discordUserId: user.discordUserId
      }

      const character = await this.characterService.create(createCharacterDto)

      // キャラクター作成イベントを発行（Discord連携）
      await this.typedEventService.emit('character.created', {
        character: character,
        source: 'character-controller',
        timestamp: new Date()
      })

      ApiResponseUtil.success(res, character, 'character', 201, 'キャラクターを作成しました')
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        ApiResponseUtil.authenticationError(res, error.message)
      } else {
        ApiResponseUtil.internalServerError(res, error)
      }
    }
  }

  /**
   * 認証されたユーザーが所有するすべてのキャラクターを取得する
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'キャラクター一覧取得',
    description: '認証されたユーザーが所有するすべてのキャラクターを取得します'
  })
  @ApiResponse({ status: 200, description: 'キャラクター一覧取得成功' })
  @ApiResponse({ status: 401, description: '認証エラー' })
  @ApiResponse({ status: 500, description: 'サーバーエラー' })
  async findAll(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const user = this.extractAuthenticatedUser(req)
      const characters = await this.characterService.findHavingAll(user.discordUserId)

      const meta = {
        total: characters.length,
        page: 1,
        limit: characters.length,
        hasNext: false,
        hasPrev: false
      }

      ApiResponseUtil.success(res, characters, 'character', 200, 'キャラクター一覧を取得しました', meta)
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        ApiResponseUtil.authenticationError(res, error.message)
      } else {
        ApiResponseUtil.internalServerError(res, error)
      }
    }
  }

  /**
   * 認証されたユーザーが所有するキャラクターの軽量データを取得する（カード表示用）
   */
  @Get('summaries')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'キャラクターサマリー取得',
    description: '認証されたユーザーが所有するキャラクターの軽量データを取得します（カード表示用）'
  })
  @ApiResponse({ status: 200, description: 'キャラクターサマリー取得成功' })
  @ApiResponse({ status: 401, description: '認証エラー' })
  @ApiResponse({ status: 500, description: 'サーバーエラー' })
  async findUserCharacterSummaries(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const user = this.extractAuthenticatedUser(req)
      const summaries = await this.characterService.findUserCharacterSummaries(user.discordUserId)

      const meta = {
        total: summaries.length,
        page: 1,
        limit: summaries.length,
        hasNext: false,
        hasPrev: false
      }

      ApiResponseUtil.success(res, summaries, 'character', 200, 'キャラクターサマリーを取得しました', meta)
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        ApiResponseUtil.authenticationError(res, error.message)
      } else {
        ApiResponseUtil.internalServerError(res, error)
      }
    }
  }

  /**
   * 特定のキャラクターを取得する
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'キャラクター取得', description: '指定されたIDのキャラクターを取得します' })
  @ApiParam({ name: 'id', description: 'キャラクターID' })
  @ApiResponse({ status: 200, description: 'キャラクター取得成功' })
  @ApiResponse({ status: 404, description: 'キャラクターが見つかりません' })
  @ApiResponse({ status: 401, description: '認証エラー' })
  @ApiResponse({ status: 500, description: 'サーバーエラー' })
  async findOne(@Param() params: CharacterIdParamDto, @Res() res: Response): Promise<void> {
    try {
      const { id } = params
      const character = await this.characterService.findOne(id)
      if (!character) {
        ApiResponseUtil.notFoundError(res, 'キャラクター')
        return
      }
      ApiResponseUtil.success(res, character, 'character', 200, 'キャラクターを取得しました')
    } catch (error) {
      ApiResponseUtil.internalServerError(res, error)
    }
  }

  /**
   * キャラクターを更新する
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'キャラクター更新',
    description: '指定されたIDのキャラクターを更新し、イベントを発行します'
  })
  @ApiParam({ name: 'id', description: 'キャラクターID' })
  @ApiResponse({ status: 200, description: 'キャラクター更新成功' })
  @ApiResponse({ status: 404, description: 'キャラクターが見つかりません' })
  @ApiResponse({ status: 401, description: '認証エラー' })
  @ApiResponse({ status: 500, description: 'サーバーエラー' })
  async update(
    @Param() params: CharacterIdParamDto,
    @Body() updateCharacterDto: UpdateCharacterDto,
    @Res() res: Response
  ): Promise<void> {
    try {
      const { id } = params
      const character = await this.characterService.update(id, updateCharacterDto)
      if (!character) {
        ApiResponseUtil.notFoundError(res, 'キャラクター')
        return
      }

      // キャラクター更新イベントを発行
      await this.typedEventService.emit('character.updated', {
        character: character,
        updateType: 'manual_update',
        channelId: character.discordChannelId,
        source: 'character-controller',
        timestamp: new Date()
      })

      ApiResponseUtil.success(res, character, 'character', 200, 'キャラクターを更新しました')
    } catch (error) {
      ApiResponseUtil.internalServerError(res, error)
    }
  }

  /**
   * キャラクターを削除する
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'キャラクター削除',
    description: '指定されたIDのキャラクターを削除し、イベントを発行します'
  })
  @ApiParam({ name: 'id', description: 'キャラクターID' })
  @ApiResponse({ status: 200, description: 'キャラクター削除成功' })
  @ApiResponse({ status: 404, description: 'キャラクターが見つかりません' })
  @ApiResponse({ status: 401, description: '認証エラー' })
  @ApiResponse({ status: 500, description: 'サーバーエラー' })
  async remove(@Param() params: CharacterIdParamDto, @Res() res: Response): Promise<void> {
    try {
      const { id } = params
      const deletedCharacter = await this.characterService.remove(id)
      if (!deletedCharacter) {
        ApiResponseUtil.notFoundError(res, 'キャラクター')
        return
      }

      // キャラクター削除イベントを発行
      await this.typedEventService.emit('character.deleted', {
        character: deletedCharacter,
        source: 'character-controller',
        timestamp: new Date()
      })

      ApiResponseUtil.success(
        res,
        { message: 'キャラクターを削除しました', characterId: id },
        'character',
        200,
        'キャラクターを削除しました'
      )
    } catch (error) {
      ApiResponseUtil.internalServerError(res, error)
    }
  }

  /**
   * キャラクターのDiscord Embed更新
   */
  @Put(':id/discord/embed')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Discord Embed更新', description: 'キャラクターのDiscord Embedを更新します' })
  @ApiParam({ name: 'id', description: 'キャラクターID' })
  @ApiResponse({ status: 200, description: 'Embed更新成功' })
  @ApiResponse({ status: 404, description: 'キャラクターが見つかりません' })
  @ApiResponse({ status: 401, description: '認証エラー' })
  @ApiResponse({ status: 500, description: 'サーバーエラー' })
  async updateDiscordEmbed(
    @Param() params: CharacterIdParamDto,
    @Req() req: Request,
    @Res() res: Response
  ): Promise<void> {
    try {
      const user = this.extractAuthenticatedUser(req)
      const { id } = params

      const character = await this.characterService.findOne(id)
      if (!character) {
        ApiResponseUtil.notFoundError(res, 'キャラクター')
        return
      }

      // 🚨 REMOVED: 冗長なDiscord Embed更新イベント発行を削除
      // File-based Event Handlersが自動的にDiscord UIを更新するため手動発信は不要

      ApiResponseUtil.success(
        res,
        { message: 'キャラクター情報を取得しました' },
        'character',
        200,
        'キャラクター情報の取得が完了しました'
      )
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        ApiResponseUtil.authenticationError(res, error.message)
      } else {
        ApiResponseUtil.internalServerError(res, error)
      }
    }
  }

  /**
   * キャラクターのDiscordスレッド作成
   */
  @Post(':id/discord/thread')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Discordスレッド作成', description: 'キャラクター用のDiscordスレッドを作成します' })
  @ApiParam({ name: 'id', description: 'キャラクターID' })
  @ApiResponse({ status: 201, description: 'スレッド作成成功' })
  @ApiResponse({ status: 404, description: 'キャラクターが見つかりません' })
  @ApiResponse({ status: 401, description: '認証エラー' })
  @ApiResponse({ status: 500, description: 'サーバーエラー' })
  async createDiscordThread(
    @Param() params: CharacterIdParamDto,
    @Body() threadData: CreateDiscordThreadDto,
    @Req() req: Request,
    @Res() res: Response
  ): Promise<void> {
    try {
      const user = this.extractAuthenticatedUser(req)
      const { id } = params

      const character = await this.characterService.findOne(id)
      if (!character) {
        ApiResponseUtil.notFoundError(res, 'キャラクター')
        return
      }

      // Discord スレッド作成イベントを発行
      await this.typedEventService.emit('discord.thread.create.requested', {
        character: character,
        channelId: threadData.channelId,
        guildId: threadData.guildId,
        creatorId: user.discordUserId,
        displayType: 'enhanced',
        source: 'character-controller',
        timestamp: new Date()
      })

      ApiResponseUtil.success(
        res,
        { message: 'Discordスレッド作成を要求しました' },
        'character',
        201,
        'Discordスレッド作成を開始しました'
      )
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        ApiResponseUtil.authenticationError(res, error.message)
      } else {
        ApiResponseUtil.internalServerError(res, error)
      }
    }
  }

  /**
   * キャラクターのDiscord表示
   */
  @Post(':id/discord/display')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Discordキャラクター表示', description: 'キャラクターをDiscordに表示します' })
  @ApiParam({ name: 'id', description: 'キャラクターID' })
  @ApiResponse({ status: 200, description: '表示成功' })
  @ApiResponse({ status: 404, description: 'キャラクターが見つかりません' })
  @ApiResponse({ status: 401, description: '認証エラー' })
  @ApiResponse({ status: 500, description: 'サーバーエラー' })
  async displayCharacterOnDiscord(
    @Param() params: CharacterIdParamDto,
    @Body() displayData: DisplayCharacterOnDiscordDto,
    @Req() req: Request,
    @Res() res: Response
  ): Promise<void> {
    try {
      const user = this.extractAuthenticatedUser(req)
      const { id } = params

      const character = await this.characterService.findOne(id)
      if (!character) {
        ApiResponseUtil.notFoundError(res, 'キャラクター')
        return
      }

      // Discord キャラクター表示イベントを発行
      await this.typedEventService.emit('discord.character.display.requested', {
        character: character,
        channelId: displayData.channelId,
        guildId: displayData.guildId,
        requesterId: user.discordUserId,
        displayType: displayData.displayType || 'enhanced',
        source: 'character-controller',
        timestamp: new Date()
      })

      ApiResponseUtil.success(
        res,
        { message: 'Discordキャラクター表示を要求しました' },
        'character',
        200,
        'Discordキャラクター表示を開始しました'
      )
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        ApiResponseUtil.authenticationError(res, error.message)
      } else {
        ApiResponseUtil.internalServerError(res, error)
      }
    }
  }
}
