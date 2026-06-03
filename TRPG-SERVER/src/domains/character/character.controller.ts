import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  UseGuards,
  UseInterceptors,
  UseFilters,
  Req,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  UsePipes
} from '@nestjs/common'
import { Request } from 'express'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CharacterService } from './character.service'
import { CharacterInputDto, CharacterIdParamDto } from './dto/create-character.dto'
import { UpdateCharacterDto } from './dto/update-character.dto'
import { CreateDiscordThreadDto, DisplayCharacterOnDiscordDto } from './dto/discord-integration.dto'
import { Character } from './models/character.model'
import { AuthService } from '../auth/services/auth.service'
import { JwtTokenPayload } from '../auth/models/auth.token.model'
import { TypedEventService } from '../../core/events/typed-event.service'
import { EVENT_NAMES } from '../../events/contracts'
import { ResponseInterceptor, ResponseMessage } from '../../core/http'
import { SuccessResponse } from '../../core/dto/api-response.dto'
import { v4 as uuidv4 } from 'uuid'
import {
  CharacterHttpExceptionFilter,
  CharacterAuthenticationException,
  CharacterNotFoundException
} from './character-http.exception'

/**
 * キャラクターコントローラー
 * キャラクター情報のCRUD操作とDiscord統合機能のエンドポイントを提供する
 *
 * エラーハンドリングは CharacterHttpExceptionFilter（@UseFilters）、
 * 成功レスポンスの封筒化は ResponseInterceptor（@UseInterceptors）へ委譲する。
 * 各ハンドラはデータを return（成功）/ 例外を throw（異常）するだけにし、
 * status は @HttpCode、success message は @ResponseMessage で宣言的に保持する。
 * meta が必要なエンドポイント（一覧系）は SuccessResponse を直接返して interceptor を素通しする。
 */
@ApiTags('キャラクター管理')
@Controller('character')
@ApiBearerAuth()
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@UseInterceptors(ResponseInterceptor)
@UseFilters(CharacterHttpExceptionFilter)
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
    const user = req.user

    if (!user || !user.discordUserId) {
      // 変換前: UnauthorizedException → catch で ApiResponseUtil.authenticationError(res, message)
      throw new CharacterAuthenticationException('認証トークンがありません')
    }

    return user
  }

  /**
   * 新しいキャラクターを作成する
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('キャラクターを作成しました')
  @ApiOperation({
    summary: 'キャラクター作成',
    description: '新しいキャラクターを作成し、必要に応じてDiscord連携を実行します'
  })
  @ApiResponse({ status: 201, description: 'キャラクター作成成功' })
  @ApiResponse({ status: 400, description: 'バリデーションエラー' })
  @ApiResponse({ status: 401, description: '認証エラー' })
  @ApiResponse({ status: 500, description: 'サーバーエラー' })
  async create(@Body() characterData: CharacterInputDto, @Req() req: Request): Promise<Character> {
    const user = this.extractAuthenticatedUser(req)

    const createCharacterDto: CharacterInputDto = {
      ...characterData,
      discordUserId: user.discordUserId
    }

    // キャラクター作成完了イベントはCharacterCreationRequestedHandlerで発行されるため、
    // ここでは発行しない（重複回避）
    return this.characterService.create(createCharacterDto)
  }

  /**
   * 認証されたユーザーが所有するすべてのキャラクターを取得する
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'キャラクター一覧取得',
    description: '認証されたユーザーが所有するすべてのキャラクターを取得します'
  })
  @ApiResponse({ status: 200, description: 'キャラクター一覧取得成功' })
  @ApiResponse({ status: 401, description: '認証エラー' })
  @ApiResponse({ status: 500, description: 'サーバーエラー' })
  async findAll(@Req() req: Request): Promise<SuccessResponse<Character[]>> {
    const user = this.extractAuthenticatedUser(req)
    const characters = await this.characterService.findHavingAll(user.discordUserId)

    const meta = {
      total: characters.length,
      page: 1,
      limit: characters.length,
      hasNext: false,
      hasPrev: false
    }

    // meta を保持するため SuccessResponse を直接返す（ResponseInterceptor は素通し）
    return new SuccessResponse(characters, 'キャラクター一覧を取得しました', meta, uuidv4())
  }

  /**
   * 認証されたユーザーが所有するキャラクターの軽量データを取得する（カード表示用）
   */
  @Get('summaries')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'キャラクターサマリー取得',
    description: '認証されたユーザーが所有するキャラクターの軽量データを取得します（カード表示用）'
  })
  @ApiResponse({ status: 200, description: 'キャラクターサマリー取得成功' })
  @ApiResponse({ status: 401, description: '認証エラー' })
  @ApiResponse({ status: 500, description: 'サーバーエラー' })
  async findUserCharacterSummaries(@Req() req: Request): Promise<SuccessResponse<unknown>> {
    const user = this.extractAuthenticatedUser(req)
    const summaries = await this.characterService.findUserCharacterSummaries(user.discordUserId)

    const meta = {
      total: summaries.length,
      page: 1,
      limit: summaries.length,
      hasNext: false,
      hasPrev: false
    }

    // meta を保持するため SuccessResponse を直接返す（ResponseInterceptor は素通し）
    return new SuccessResponse(summaries, 'キャラクターサマリーを取得しました', meta, uuidv4())
  }

  /**
   * 特定のキャラクターを取得する
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('キャラクターを取得しました')
  @ApiOperation({ summary: 'キャラクター取得', description: '指定されたIDのキャラクターを取得します' })
  @ApiParam({ name: 'id', description: 'キャラクターID' })
  @ApiResponse({ status: 200, description: 'キャラクター取得成功' })
  @ApiResponse({ status: 404, description: 'キャラクターが見つかりません' })
  @ApiResponse({ status: 401, description: '認証エラー' })
  @ApiResponse({ status: 500, description: 'サーバーエラー' })
  async findOne(@Param() params: CharacterIdParamDto): Promise<Character> {
    const { id } = params
    const character = await this.characterService.findOne(id)
    if (!character) {
      throw new CharacterNotFoundException('キャラクター')
    }
    return character
  }

  /**
   * キャラクターを更新する
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('キャラクターを更新しました')
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
    @Body() updateCharacterDto: UpdateCharacterDto
  ): Promise<Character> {
    const { id } = params
    const character = await this.characterService.update(id, updateCharacterDto)
    if (!character) {
      throw new CharacterNotFoundException('キャラクター')
    }

    return character
  }

  /**
   * キャラクターを削除する
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('キャラクターを削除しました')
  @ApiOperation({
    summary: 'キャラクター削除',
    description: '指定されたIDのキャラクターを削除し、イベントを発行します'
  })
  @ApiParam({ name: 'id', description: 'キャラクターID' })
  @ApiResponse({ status: 200, description: 'キャラクター削除成功' })
  @ApiResponse({ status: 404, description: 'キャラクターが見つかりません' })
  @ApiResponse({ status: 401, description: '認証エラー' })
  @ApiResponse({ status: 500, description: 'サーバーエラー' })
  async remove(@Param() params: CharacterIdParamDto): Promise<{ message: string; characterId: string }> {
    const { id } = params
    const deletedCharacter = await this.characterService.remove(id)
    if (!deletedCharacter) {
      throw new CharacterNotFoundException('キャラクター')
    }

    return { message: 'キャラクターを削除しました', characterId: id }
  }

  /**
   * キャラクターのDiscord Embed更新
   */
  @Put(':id/discord/embed')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('キャラクター情報の取得が完了しました')
  @ApiOperation({ summary: 'Discord Embed更新', description: 'キャラクターのDiscord Embedを更新します' })
  @ApiParam({ name: 'id', description: 'キャラクターID' })
  @ApiResponse({ status: 200, description: 'Embed更新成功' })
  @ApiResponse({ status: 404, description: 'キャラクターが見つかりません' })
  @ApiResponse({ status: 401, description: '認証エラー' })
  @ApiResponse({ status: 500, description: 'サーバーエラー' })
  async updateDiscordEmbed(@Param() params: CharacterIdParamDto, @Req() req: Request): Promise<{ message: string }> {
    this.extractAuthenticatedUser(req)
    const { id } = params

    const character = await this.characterService.findOne(id)
    if (!character) {
      throw new CharacterNotFoundException('キャラクター')
    }

    // 🚨 REMOVED: 冗長なDiscord Embed更新イベント発行を削除
    // File-based Event Handlersが自動的にDiscord UIを更新するため手動発信は不要

    return { message: 'キャラクター情報を取得しました' }
  }

  /**
   * キャラクターのDiscordスレッド作成
   */
  @Post(':id/discord/thread')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Discordスレッド作成を開始しました')
  @ApiOperation({ summary: 'Discordスレッド作成', description: 'キャラクター用のDiscordスレッドを作成します' })
  @ApiParam({ name: 'id', description: 'キャラクターID' })
  @ApiResponse({ status: 201, description: 'スレッド作成成功' })
  @ApiResponse({ status: 404, description: 'キャラクターが見つかりません' })
  @ApiResponse({ status: 401, description: '認証エラー' })
  @ApiResponse({ status: 500, description: 'サーバーエラー' })
  async createDiscordThread(
    @Param() params: CharacterIdParamDto,
    @Body() threadData: CreateDiscordThreadDto,
    @Req() req: Request
  ): Promise<{ message: string }> {
    const user = this.extractAuthenticatedUser(req)
    const { id } = params

    const character = await this.characterService.findOne(id)
    if (!character) {
      throw new CharacterNotFoundException('キャラクター')
    }

    // Discord スレッド作成イベントを発行
    await this.typedEventService.emit(EVENT_NAMES.DISCORD_THREAD_CREATE_REQUESTED, {
      character: character,
      channelId: threadData.channelId,
      guildId: threadData.guildId,
      creatorId: user.discordUserId,
      displayType: 'enhanced',
      source: 'character-controller',
      timestamp: new Date()
    })

    return { message: 'Discordスレッド作成を要求しました' }
  }

  /**
   * キャラクターのDiscord表示
   */
  @Post(':id/discord/display')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Discordキャラクター表示を開始しました')
  @ApiOperation({ summary: 'Discordキャラクター表示', description: 'キャラクターをDiscordに表示します' })
  @ApiParam({ name: 'id', description: 'キャラクターID' })
  @ApiResponse({ status: 200, description: '表示成功' })
  @ApiResponse({ status: 404, description: 'キャラクターが見つかりません' })
  @ApiResponse({ status: 401, description: '認証エラー' })
  @ApiResponse({ status: 500, description: 'サーバーエラー' })
  async displayCharacterOnDiscord(
    @Param() params: CharacterIdParamDto,
    @Body() displayData: DisplayCharacterOnDiscordDto,
    @Req() req: Request
  ): Promise<{ message: string }> {
    const user = this.extractAuthenticatedUser(req)
    const { id } = params

    const character = await this.characterService.findOne(id)
    if (!character) {
      throw new CharacterNotFoundException('キャラクター')
    }

    // Discord キャラクター表示イベントを発行
    await this.typedEventService.emit(EVENT_NAMES.DISCORD_CHARACTER_DISPLAY_REQUESTED, {
      character: character,
      channelId: displayData.channelId,
      guildId: displayData.guildId,
      requesterId: user.discordUserId,
      displayType: displayData.displayType || 'enhanced',
      source: 'character-controller',
      timestamp: new Date()
    })

    return { message: 'Discordキャラクター表示を要求しました' }
  }
}
