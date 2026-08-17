import {
  Controller,
  Inject,
  Post,
  Body,
  Param,
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
import { JwtAuthGuard } from '../../domains/auth/guards/jwt-auth.guard'
import { JwtTokenPayload } from '../../domains/auth/models/auth.token.model'
import { CharacterService } from '../../domains/character/character.service'
import { CharacterIdParamDto } from '../../domains/character/dto/create-character.dto'
import {
  CreateCharacterFromTemplateDto,
  RerollSheetFieldDto,
  SaveCharacterSheetDto
} from '../../domains/character/dto/character-sheet.dto'
import { ResponseInterceptor, ResponseMessage } from '../../core/http'
import { CharacterSheetHttpExceptionFilter } from './character-sheet-http-exception.filter'
import type { RollOnCreateResult } from './types/character-sheet.types'

export const CHARACTER_SHEET_OPERATION_USE_CASE = Symbol('CHARACTER_SHEET_OPERATION_USE_CASE')
export const CHARACTER_INSTANTIATION_USE_CASE = Symbol('CHARACTER_INSTANTIATION_USE_CASE')

interface CharacterSheetOperationUseCase {
  saveSheet(input: {
    characterId: string
    baseRevision: number
    changes: SaveCharacterSheetDto['changes']
  }): Promise<unknown>
  rerollCreationRoll(input: {
    characterId: string
    requesterDiscordUserId: string
    fieldUid: string
    baseRevision: number
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
  }): Promise<{
    character: { characterId: string }
    rollOnCreateResults: RollOnCreateResult[]
  }>
}

/**
 * materialized character の Web ユースケース境界。
 * feature module が所有し、domain CRUD controller へ feature provider を逆注入しない。
 */
@ApiTags('キャラクターシート')
@Controller('character')
@ApiBearerAuth()
@UseInterceptors(ResponseInterceptor)
@UseFilters(CharacterSheetHttpExceptionFilter)
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

  /**
   * 所有者確認を use case 側へ寄せる唯一のルート。
   * 振り直しは対象 character を use case 内で読むため、所有者判定もそこに閉じて二重読み取りを避ける。
   * 「見つからない」と「他人のもの」をどちらも 404 に畳む点は saveSheet の findOneForOwner と同じで、
   * 兄弟エンドポイント間で存在の開示規則を変えない。
   */
  @Post(':id/sheet/reroll')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('作成時ロールを振り直しました')
  @ApiOperation({ summary: '作成時ロールを宣言している項目の振り直し' })
  @ApiParam({ name: 'id', description: 'キャラクターID' })
  @ApiResponse({ status: 200, description: '振り直し成功' })
  @ApiResponse({ status: 404, description: 'キャラクター不在または他人のシート' })
  @ApiResponse({ status: 409, description: 'baseRevision の不一致・保存 CAS 敗北・character が materialized でない' })
  @ApiResponse({ status: 422, description: '作成時ロール未宣言・記法の実行失敗' })
  async rerollCreationRoll(
    @Param() params: CharacterIdParamDto,
    @Body() dto: RerollSheetFieldDto,
    @Req() req: Request
  ): Promise<unknown> {
    const user = this.extractAuthenticatedUser(req)

    return this.sheetOperationService.rerollCreationRoll({
      characterId: params.id,
      requesterDiscordUserId: user.discordUserId,
      fieldUid: dto.fieldUid,
      baseRevision: dto.baseRevision
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
  ): Promise<{ characterId: string; rollOnCreateResults: RollOnCreateResult[] }> {
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

    return {
      characterId: result.character.characterId,
      rollOnCreateResults: result.rollOnCreateResults
    }
  }

  private extractAuthenticatedUser(req: Request): JwtTokenPayload {
    const user = req.user as JwtTokenPayload | undefined
    if (!user?.discordUserId) {
      throw new UnauthorizedException('認証トークンがありません')
    }
    return user
  }
}
