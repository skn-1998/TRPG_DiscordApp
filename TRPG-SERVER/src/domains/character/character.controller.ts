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
  Headers,
  Header
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CharacterService } from './character.service'
import { PartialInputCharacterDto } from './dto/create-character.dto'
import { UpdateCharacterDto } from './dto/update-character.dto'
import { CharacterSummaryDto } from './dto/character-summary.dto'
import { Character } from './models/character.model'
import { AuthGuard } from '@nestjs/passport'
import { AuthService } from '../auth/services/auth.service'

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
   * @param characterData キャラクター作成DTO
   * @param req リクエスト
   * @returns 作成されたキャラクター
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @Header('Content-Type', 'application/json')
  async create(
    @Body() characterData: PartialInputCharacterDto,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @Req() req: any
  ): Promise<Character> {
    console.log('🔍 Server Debug Info:', {
      hasUser: !!req.user,
      userInfo: req.user
    })

    console.log(characterData, req.user)
    if (!req.user || !req.user.discordUserId) {
      throw new UnauthorizedException('認証トークンがありません')
    }

    // JWTAuthGuardで既に認証済みのため、req.userから直接情報を取得
    const validated = req.user

    // 新しいDTOオブジェクトを作成してユーザーIDを設定
    const createCharacterDto: PartialInputCharacterDto = {
      ...characterData,
      discordUserId: validated.discordUserId
    }
    const character = await this.characterService.create(createCharacterDto)
    console.log(character, createCharacterDto)
    return character
  }

  /**
   * 認証されたユーザーが所有するすべてのキャラクターを取得する
   * @param req リクエスト
   * @returns キャラクターの配列
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async findAll(@Req() req: any): Promise<Character[]> {
    if (!req.user || !req.user.discordUserId) {
      throw new UnauthorizedException('認証トークンがありません')
    }

    return this.characterService.findHavingAll(req.user.userId)
  }

  /**
   * 認証されたユーザーが所有するキャラクターの軽量データを取得する（カード表示用）
   * @param req リクエスト
   * @returns キャラクター軽量データの配列
   */
  @Get('summaries')
  @UseGuards(JwtAuthGuard)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async findUserCharacterSummaries(@Req() req: any): Promise<CharacterSummaryDto[]> {
    console.log('findUserCharacterSummaries')
    console.log('🔍 Server Debug Info:', {
      hasUser: !!req.user,
      userInfo: req.user
    })
    if (!req.user || !req.user.discordUserId) {
      throw new UnauthorizedException('認証トークンがありません')
    }

    return this.characterService.findUserCharacterSummaries(req.user.discordUserId)
  }

  /**
   * 特定のキャラクターを取得する
   * @param id キャラクターID
   * @returns キャラクター
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string): Promise<Character> {
    return this.characterService.findOne(id)
  }

  /**
   * キャラクターを更新する
   * @param id キャラクターID
   * @param updateCharacterDto 更新DTO
   * @returns 更新されたキャラクター
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Param('id') id: string, @Body() updateCharacterDto: UpdateCharacterDto): Promise<Character> {
    return this.characterService.update(id, updateCharacterDto)
  }

  /**
   * キャラクターを削除する
   * @param id キャラクターID
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string): Promise<void> {
    return this.characterService.remove(id)
  }
}
