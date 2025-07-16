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
  Res
} from '@nestjs/common'
import { Request, Response } from 'express'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CharacterService } from './character.service'
import { CharacterInputDto } from './dto/create-character.dto'
import { UpdateCharacterDto } from './dto/update-character.dto'
import { CharacterSummaryDto } from './dto/character-summary.dto'
import { Character } from './models/character.model'
import { AuthGuard } from '@nestjs/passport'
import { AuthService } from '../auth/services/auth.service'
import { CharacterIdParamDto } from './dto/create-character.dto'
import { ApiResponseUtil } from '../../utils/api-response.util'

/**
 * キャラクターコントローラー
 * キャラクター情報のCRUD操作のエンドポイントを提供する
 */
@Controller('character')
export class CharacterController {
  constructor(
    private readonly characterService: CharacterService,
    private readonly authService: AuthService
  ) {}

  /**
   * 新しいキャラクターを作成する
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @Header('Content-Type', 'application/json')
  async create(@Body() characterData: CharacterInputDto, @Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      if (!req.user || !req.user.discordUserId) {
        ApiResponseUtil.error(res, '認証トークンがありません', 401)
        return
      }
      const createCharacterDto: CharacterInputDto = {
        ...characterData,
        discordUserId: req.user.discordUserId
      }
      const character = await this.characterService.create(createCharacterDto)
      ApiResponseUtil.success(res, character)
    } catch (error) {
      ApiResponseUtil.error(res, error, 500, 'キャラクター作成に失敗しました')
    }
  }

  /**
   * 認証されたユーザーが所有するすべてのキャラクターを取得する
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      if (!req.user || !req.user.discordUserId) {
        ApiResponseUtil.error(res, '認証トークンがありません', 401)
        return
      }
      const characters = await this.characterService.findHavingAll(req.user.discordUserId)
      ApiResponseUtil.success(res, characters)
    } catch (error) {
      ApiResponseUtil.error(res, error, 500, 'キャラクター一覧取得に失敗しました')
    }
  }

  /**
   * 認証されたユーザーが所有するキャラクターの軽量データを取得する（カード表示用）
   */
  @Get('summaries')
  @UseGuards(JwtAuthGuard)
  async findUserCharacterSummaries(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      if (!req.user || !req.user.discordUserId) {
        ApiResponseUtil.error(res, '認証トークンがありません', 401)
        return
      }
      const summaries = await this.characterService.findUserCharacterSummaries(req.user.discordUserId)
      ApiResponseUtil.success(res, summaries)
    } catch (error) {
      ApiResponseUtil.error(res, error, 500, 'キャラクターサマリー取得に失敗しました')
    }
  }

  /**
   * 特定のキャラクターを取得する
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param() params: CharacterIdParamDto, @Res() res: Response): Promise<void> {
    try {
      const { id } = params
      const character = await this.characterService.findOne(id)
      if (!character) {
        ApiResponseUtil.error(res, 'キャラクターが見つかりません', 404)
        return
      }
      ApiResponseUtil.success(res, character)
    } catch (error) {
      ApiResponseUtil.error(res, error, 500, 'キャラクター取得に失敗しました')
    }
  }

  /**
   * キャラクターを更新する
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param() params: CharacterIdParamDto,
    @Body() updateCharacterDto: UpdateCharacterDto,
    @Res() res: Response
  ): Promise<void> {
    try {
      const { id } = params
      const character = await this.characterService.update(id, updateCharacterDto)
      if (!character) {
        ApiResponseUtil.error(res, 'キャラクターが見つかりません', 404)
        return
      }
      ApiResponseUtil.success(res, character)
    } catch (error) {
      ApiResponseUtil.error(res, error, 500, 'キャラクター更新に失敗しました')
    }
  }

  /**
   * キャラクターを削除する
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param() params: CharacterIdParamDto, @Res() res: Response): Promise<void> {
    try {
      const { id } = params
      const deletedCharacter = await this.characterService.remove(id)
      if (!deletedCharacter) {
        ApiResponseUtil.error(res, 'キャラクターが見つかりません', 404)
        return
      }
      ApiResponseUtil.success(res, { message: 'キャラクターを削除しました' })
    } catch (error) {
      ApiResponseUtil.error(res, error, 500, 'キャラクター削除に失敗しました')
    }
  }
}
