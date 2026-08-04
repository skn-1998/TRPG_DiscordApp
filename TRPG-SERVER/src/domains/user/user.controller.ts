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
  HttpCode,
  HttpStatus,
  Req
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger'
import { UserService } from './user.service'
import { DiscordUserIdParamDto, UserCharacterParamDto } from './dto/create-user.dto'
import { UserOutputDto } from './dto/update-user.dto'
import { CreateUserProfileDto, UpdateUserProfileDto } from './dto/user-profile.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { JwtTokenPayload } from '../auth/models/auth.token.model'
import { Request } from 'express'
import { ResponseInterceptor, ApiErrorResponse, ApiError } from '../../core/http'
import { DEFAULT_ERROR_RESPONSE_MESSAGE } from '../../core/dto/api-response.dto'
import { toUserOutput } from './presenters/user-output.presenter'
import type { DiscordGuildsPayloadWire, UserProfileWire } from '@trpg/api-contract'

interface RequestWithUser extends Request {
  user: JwtTokenPayload
}

/**
 * 例外レスポンスの封筒化は GlobalExceptionFilter、
 * 成功レスポンスの封筒化は ResponseInterceptor（@UseInterceptors）へ委譲する。
 * 全エンドポイントは success=200/'成功'。
 * @ApiErrorResponse は現在どの経路からも参照されない無効メタであり、第5群で撤去する。
 * リソース未発見（変換前の ApiResponseUtil.error(res, '...が見つかりません', 404)）は
 * ApiError(404, DEFAULT_ERROR_RESPONSE_MESSAGE, '...') を throw して再現する。
 */
@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
// 未知フィールドは APP_PIPE で 400 にせず strip する。再厳格化は @StrictBody() メタデータ + APP_PIPE の useClass 方式で pipe の責務として実装する。
export class UserController {
  constructor(private readonly userService: UserService) {}

  private extractAuthenticatedDiscordUserId(req: RequestWithUser): string {
    const discordUserId = req.user?.discordUserId
    if (!discordUserId) {
      throw new ApiError(401, DEFAULT_ERROR_RESPONSE_MESSAGE, '認証トークンがありません')
    }
    return discordUserId
  }

  private assertSelf(requestedDiscordUserId: string, authenticatedDiscordUserId: string): void {
    if (requestedDiscordUserId !== authenticatedDiscordUserId) {
      throw new ApiError(404, DEFAULT_ERROR_RESPONSE_MESSAGE, 'ユーザーが見つかりません')
    }
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 200, description: 'The user has been successfully created.', type: UserOutputDto })
  @ApiErrorResponse(500, 'ユーザー作成に失敗しました')
  async create(@Body() profile: CreateUserProfileDto, @Req() req: RequestWithUser): Promise<UserOutputDto> {
    const discordUserId = this.extractAuthenticatedDiscordUserId(req)
    const user = await this.userService.create({
      discordUserId,
      name: profile.name,
      avatarHash: profile.avatarHash,
      characterIds: []
    })
    return toUserOutput(user)
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a user by Discord ID' })
  @ApiResponse({ status: 200, description: 'Return the user.', type: UserOutputDto })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @ApiErrorResponse(500, 'ユーザー取得に失敗しました')
  async findOne(@Req() req: RequestWithUser): Promise<UserProfileWire> {
    const discordUserId = this.extractAuthenticatedDiscordUserId(req)
    const user = await this.userService.findByDiscordId(discordUserId)
    if (!user) {
      // 変換前: ApiResponseUtil.error(res, 'ユーザーが見つかりません', 404)
      throw new ApiError(404, DEFAULT_ERROR_RESPONSE_MESSAGE, 'ユーザーが見つかりません')
    }
    return toUserOutput(user)
  }

  @Get('discord/guilds')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get user Discord guilds' })
  @ApiResponse({ status: 200, description: 'Return the user Discord guilds.' })
  @ApiErrorResponse(500, 'Discord Guild一覧取得に失敗しました')
  async getDiscordGuilds(@Req() req: RequestWithUser): Promise<DiscordGuildsPayloadWire> {
    const discordUserId = this.extractAuthenticatedDiscordUserId(req)
    const guilds = await this.userService.getUserDiscordGuilds(discordUserId)
    return {
      guilds,
      count: guilds.length,
      message: 'Discord Guild一覧を正常に取得しました'
    }
  }

  @Put(':discordUserId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a user' })
  @ApiResponse({ status: 200, description: 'The user has been successfully updated.', type: UserOutputDto })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @ApiErrorResponse(500, 'ユーザー更新に失敗しました')
  async update(
    @Param() params: DiscordUserIdParamDto,
    @Body() updateUserDto: UpdateUserProfileDto,
    @Req() req: RequestWithUser
  ): Promise<UserOutputDto> {
    const { discordUserId } = params
    const authenticatedDiscordUserId = this.extractAuthenticatedDiscordUserId(req)
    this.assertSelf(discordUserId, authenticatedDiscordUserId)
    const profileUpdate: UpdateUserProfileDto = {
      ...(updateUserDto.name !== undefined ? { name: updateUserDto.name } : {}),
      ...(updateUserDto.avatarHash !== undefined ? { avatarHash: updateUserDto.avatarHash } : {})
    }
    const user = await this.userService.update(discordUserId, profileUpdate)
    if (!user) {
      throw new ApiError(404, DEFAULT_ERROR_RESPONSE_MESSAGE, 'ユーザーが見つかりません')
    }
    return toUserOutput(user)
  }

  @Patch(':discordUserId/characters/:characterId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add a character to a user' })
  @ApiResponse({ status: 200, description: 'The character has been added to the user.', type: UserOutputDto })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @ApiErrorResponse(500, 'キャラクター追加に失敗しました')
  async addCharacter(@Param() params: UserCharacterParamDto, @Req() req: RequestWithUser): Promise<UserOutputDto> {
    const { discordUserId, characterId } = params
    const authenticatedDiscordUserId = this.extractAuthenticatedDiscordUserId(req)
    this.assertSelf(discordUserId, authenticatedDiscordUserId)
    const user = await this.userService.addCharacterId(discordUserId, characterId)
    if (!user) {
      throw new ApiError(404, DEFAULT_ERROR_RESPONSE_MESSAGE, 'ユーザーが見つかりません')
    }
    return toUserOutput(user)
  }

  @Delete(':discordUserId/characters/:characterId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a character from a user' })
  @ApiResponse({ status: 200, description: 'The character has been removed from the user.', type: UserOutputDto })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @ApiErrorResponse(500, 'キャラクター削除に失敗しました')
  async removeCharacter(@Param() params: UserCharacterParamDto, @Req() req: RequestWithUser): Promise<UserOutputDto> {
    const { discordUserId, characterId } = params
    const authenticatedDiscordUserId = this.extractAuthenticatedDiscordUserId(req)
    this.assertSelf(discordUserId, authenticatedDiscordUserId)
    const user = await this.userService.removeCharacterId(discordUserId, characterId)
    if (!user) {
      throw new ApiError(404, DEFAULT_ERROR_RESPONSE_MESSAGE, 'ユーザーが見つかりません')
    }
    return toUserOutput(user)
  }

  @Delete(':discordUserId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a user' })
  @ApiResponse({ status: 200, description: 'The user has been successfully deleted.', type: UserOutputDto })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @ApiErrorResponse(500, 'ユーザー削除に失敗しました')
  async remove(@Param() params: DiscordUserIdParamDto, @Req() req: RequestWithUser): Promise<UserOutputDto> {
    const { discordUserId } = params
    const authenticatedDiscordUserId = this.extractAuthenticatedDiscordUserId(req)
    this.assertSelf(discordUserId, authenticatedDiscordUserId)
    const user = await this.userService.remove(discordUserId)
    if (!user) {
      throw new ApiError(404, DEFAULT_ERROR_RESPONSE_MESSAGE, 'ユーザーが見つかりません')
    }
    return toUserOutput(user)
  }
}
