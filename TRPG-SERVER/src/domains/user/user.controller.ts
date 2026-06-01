import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Patch,
  UseGuards,
  UseInterceptors,
  UseFilters,
  HttpCode,
  HttpStatus,
  Headers,
  Req
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { UserService } from './user.service'
import { CreateUserDto, DiscordUserIdParamDto, CharacterIdParamDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { User } from './models/user.model'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { JwtTokenService } from '../auth/token/jwt-token.service'
import { JwtTokenPayload } from '../auth/models/auth.token.model'
import { Request } from 'express'
import { ResponseInterceptor, HttpExceptionFilter, ApiErrorResponse, ApiError } from '../../core/http'

interface RequestWithUser extends Request {
  user: JwtTokenPayload
}

/**
 * エラーハンドリングは HttpExceptionFilter、成功封筒化は ResponseInterceptor へ委譲。
 * 全エンドポイントは success=200/'成功'、各 error label は @ApiErrorResponse で保持する。
 * リソース未発見（変換前の ApiResponseUtil.error(res, '...が見つかりません', 404)）は
 * ApiError(404, 'エラーが発生しました', '...') を throw して再現する。
 */
@ApiTags('users')
@Controller('users')
@UseInterceptors(ResponseInterceptor)
@UseFilters(HttpExceptionFilter)
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly jwtTokenService: JwtTokenService
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'The user has been successfully created.', type: User })
  @ApiErrorResponse(500, 'ユーザー作成に失敗しました')
  async create(@Body() createUserDto: CreateUserDto): Promise<User> {
    return this.userService.create(createUserDto)
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a user by Discord ID' })
  @ApiResponse({ status: 200, description: 'Return the user.', type: User })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @UseGuards(JwtAuthGuard)
  @ApiErrorResponse(500, 'ユーザー取得に失敗しました')
  async findOne(@Headers('Authorization') authorization: string): Promise<User> {
    const token = await this.jwtTokenService.validateToken(authorization)
    const user = await this.userService.findByDiscordId(token.discordUserId)
    if (!user) {
      // 変換前: ApiResponseUtil.error(res, 'ユーザーが見つかりません', 404)
      throw new ApiError(404, 'エラーが発生しました', 'ユーザーが見つかりません')
    }
    return user
  }

  @Get('discord/guilds')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get user Discord guilds' })
  @ApiResponse({ status: 200, description: 'Return the user Discord guilds.' })
  @ApiErrorResponse(500, 'Discord Guild一覧取得に失敗しました')
  async getDiscordGuilds(@Req() req: RequestWithUser): Promise<{ guilds: unknown[]; count: number; message: string }> {
    const user = req.user
    if (!user || !user.discordUserId) {
      // 変換前: ApiResponseUtil.error(res, '認証トークンがありません', 401)
      throw new ApiError(401, 'エラーが発生しました', '認証トークンがありません')
    }
    const guilds = await this.userService.getUserDiscordGuilds(user.discordUserId)
    return {
      guilds,
      count: guilds.length,
      message: 'Discord Guild一覧を正常に取得しました'
    }
  }

  @Put(':discordUserId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a user' })
  @ApiResponse({ status: 200, description: 'The user has been successfully updated.', type: User })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @ApiErrorResponse(500, 'ユーザー更新に失敗しました')
  async update(@Param() params: DiscordUserIdParamDto, @Body() updateUserDto: UpdateUserDto): Promise<User> {
    const { discordUserId } = params
    const user = await this.userService.update(discordUserId, updateUserDto)
    if (!user) {
      throw new ApiError(404, 'エラーが発生しました', 'ユーザーが見つかりません')
    }
    return user
  }

  @Patch(':discordUserId/characters/:characterId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add a character to a user' })
  @ApiResponse({ status: 200, description: 'The character has been added to the user.', type: User })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @ApiErrorResponse(500, 'キャラクター追加に失敗しました')
  async addCharacter(@Param() params: DiscordUserIdParamDto & CharacterIdParamDto): Promise<User> {
    const { discordUserId, characterId } = params
    const user = await this.userService.addCharacterId(discordUserId, characterId)
    if (!user) {
      throw new ApiError(404, 'エラーが発生しました', 'ユーザーが見つかりません')
    }
    return user
  }

  @Delete(':discordUserId/characters/:characterId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a character from a user' })
  @ApiResponse({ status: 200, description: 'The character has been removed from the user.', type: User })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @ApiErrorResponse(500, 'キャラクター削除に失敗しました')
  async removeCharacter(@Param() params: DiscordUserIdParamDto & CharacterIdParamDto): Promise<User> {
    const { discordUserId, characterId } = params
    const user = await this.userService.removeCharacterId(discordUserId, characterId)
    if (!user) {
      throw new ApiError(404, 'エラーが発生しました', 'ユーザーが見つかりません')
    }
    return user
  }

  @Delete(':discordUserId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a user' })
  @ApiResponse({ status: 200, description: 'The user has been successfully deleted.', type: User })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @ApiErrorResponse(500, 'ユーザー削除に失敗しました')
  async remove(@Param() params: DiscordUserIdParamDto): Promise<User> {
    const { discordUserId } = params
    const user = await this.userService.remove(discordUserId)
    if (!user) {
      throw new ApiError(404, 'エラーが発生しました', 'ユーザーが見つかりません')
    }
    return user
  }
}
