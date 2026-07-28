import {
  Controller,
  Inject,
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
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common'
import { Request } from 'express'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger'
import type { CharacterDeleteResultWire } from '@trpg/api-contract'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CharacterService } from './character.service'
import { CharacterInputDto, CharacterIdParamDto } from './dto/create-character.dto'
import { UpdateCharacterDto } from './dto/update-character.dto'
import { CharacterEntity } from './models/character.entity'
import { JwtTokenPayload } from '../auth/models/auth.token.model'
import { ResponseInterceptor, ResponseMessage } from '../../core/http'
import { SuccessResponse } from '../../core/dto/api-response.dto'
import { v4 as uuidv4 } from 'uuid'
import { CreateCharacterFromTemplateDto, SaveCharacterSheetDto } from './dto/character-sheet.dto'
import {
  CharacterHttpExceptionFilter,
  CharacterAuthenticationException,
  CharacterNotFoundException
} from './character-http.exception'
import type { CharacterSummaryDto } from './dto/character-summary.dto'

export const CHARACTER_SHEET_OPERATION_USE_CASE = Symbol('CHARACTER_SHEET_OPERATION_USE_CASE')
export const CHARACTER_INSTANTIATION_USE_CASE = Symbol('CHARACTER_INSTANTIATION_USE_CASE')

interface CharacterSheetOperationUseCase {
  saveSheet(input: {
    characterId: string
    baseRevision: number
    changes: SaveCharacterSheetDto['changes']
  }): Promise<unknown>
}

interface CharacterInstantiationUseCase {
  instantiate(input: {
    templateId: string
    templateVersion: string
    requesterDiscordUserId: string
    characterName: string
    discordUserId: string
    discordChannelId: string
    values?: Record<string, unknown>
  }): Promise<{ character: { characterId: string } }>
}

/**
 * キャラクターコントローラー
 * キャラクター情報のCRUD操作のエンドポイントを提供する
 * （discord 系 REST 3 本は E-6b で削除済み。スレッド作成は character.creation.completed handler の正規フローが担う）
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
@UseInterceptors(ResponseInterceptor)
@UseFilters(CharacterHttpExceptionFilter)
export class CharacterController {
  constructor(private readonly characterService: CharacterService) {}

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
  async create(@Body() characterData: CharacterInputDto, @Req() req: Request): Promise<CharacterEntity> {
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
  async findAll(@Req() req: Request): Promise<SuccessResponse<CharacterEntity[]>> {
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
  async findUserCharacterSummaries(@Req() req: Request): Promise<SuccessResponse<CharacterSummaryDto[]>> {
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
  async findOne(@Param() params: CharacterIdParamDto, @Req() req: Request): Promise<CharacterEntity> {
    const user = this.extractAuthenticatedUser(req)
    const { id } = params
    const character = await this.characterService.findOneForOwner(id, user.discordUserId)
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
    @Body() updateCharacterDto: UpdateCharacterDto,
    @Req() req: Request
  ): Promise<CharacterEntity> {
    const user = this.extractAuthenticatedUser(req)
    const { id } = params
    const character = await this.characterService.updateForOwner(id, user.discordUserId, updateCharacterDto)
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
  async remove(@Param() params: CharacterIdParamDto, @Req() req: Request): Promise<CharacterDeleteResultWire> {
    const user = this.extractAuthenticatedUser(req)
    const { id } = params
    const deletedCharacter = await this.characterService.removeForOwner(id, user.discordUserId)
    if (!deletedCharacter) {
      throw new CharacterNotFoundException('キャラクター')
    }

    return { message: 'キャラクターを削除しました', characterId: id }
  }
}

/**
 * materialized character の Web ユースケース境界。
 * feature module が所有し、domain CRUD controller へ feature provider を逆注入しない。
 */
@ApiTags('キャラクターシート')
@Controller('character')
@ApiBearerAuth()
@UseInterceptors(ResponseInterceptor)
@UseGuards(JwtAuthGuard)
export class CharacterSheetController {
  constructor(
    private readonly characterService: CharacterService,
    @Inject(CHARACTER_SHEET_OPERATION_USE_CASE)
    private readonly sheetOperationService: CharacterSheetOperationUseCase,
    @Inject(CHARACTER_INSTANTIATION_USE_CASE)
    private readonly instantiationService: CharacterInstantiationUseCase
  ) {}

  @Put(':id/sheet')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('キャラクターシートを保存しました')
  @ApiOperation({ summary: 'materialized キャラクターシート保存' })
  @ApiParam({ name: 'id', description: 'キャラクターID' })
  @ApiResponse({ status: 200, description: '保存成功' })
  @ApiResponse({ status: 409, description: '同一値への競合' })
  @ApiResponse({ status: 422, description: 'テンプレート整合検査違反' })
  async saveSheet(
    @Param() params: CharacterIdParamDto,
    @Body() dto: SaveCharacterSheetDto,
    @Req() req: Request
  ): Promise<unknown> {
    const user = this.extractAuthenticatedUser(req)
    const ownedCharacter = await this.characterService.findOneForOwner(params.id, user.discordUserId)
    if (ownedCharacter === null) {
      throw new NotFoundException('character not found')
    }

    return this.sheetOperationService.saveSheet({
      characterId: params.id,
      baseRevision: dto.baseRevision,
      changes: dto.changes
    })
  }

  @Post('from-template')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('キャラクターを作成しました')
  @ApiOperation({ summary: 'published テンプレートから materialized キャラクターを作成' })
  @ApiResponse({ status: 201, description: '作成成功' })
  @ApiResponse({ status: 409, description: 'publish または version の競合' })
  @ApiResponse({ status: 422, description: 'テンプレート整合検査違反' })
  async createFromTemplate(
    @Body() dto: CreateCharacterFromTemplateDto,
    @Req() req: Request
  ): Promise<{ characterId: string }> {
    const user = this.extractAuthenticatedUser(req)
    const result = await this.instantiationService.instantiate({
      templateId: dto.templateId,
      templateVersion: dto.templateVersion,
      requesterDiscordUserId: user.discordUserId,
      characterName: dto.characterName,
      discordUserId: user.discordUserId,
      discordChannelId: '',
      values: dto.values
    })

    return { characterId: result.character.characterId }
  }

  private extractAuthenticatedUser(req: Request): JwtTokenPayload {
    const user = req.user as JwtTokenPayload | undefined
    if (!user?.discordUserId) {
      throw new UnauthorizedException('認証トークンがありません')
    }
    return user
  }
}
