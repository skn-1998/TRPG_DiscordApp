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
  Header
} from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { CharacterService } from './character.service'
import { PartialInputCharacterDto } from './dto/create-character.dto'
import { UpdateCharacterDto } from './dto/update-character.dto'
import { Character } from './models/character.model'
import { AuthGuard } from '@nestjs/passport'

/**
 * キャラクターコントローラー
 * キャラクター情報のCRUD操作のエンドポイントを提供する
 */
@Controller('character')
export class CharacterController {
  constructor(private readonly characterService: CharacterService) {}

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
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedException('認証トークンがありません')
    }

    console.log(characterData)

    // 新しいDTOオブジェクトを作成してユーザーIDを設定
    const createCharacterDto: PartialInputCharacterDto = {
      ...characterData,
      discordUserId: req.user.userId
    }
    const character = await this.characterService.create(createCharacterDto)
    console.log(character)
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
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedException('認証トークンがありません')
    }

    return this.characterService.findHavingAll(req.user.userId)
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
