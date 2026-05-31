import { Controller, Get, Post, Body, Param, Delete, Put, Patch, UseGuards, Headers, Req, Res } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { UserService } from './user.service'
import { CreateUserDto, DiscordUserIdParamDto, CharacterIdParamDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { User } from './models/user.model'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { AuthService } from '../auth/services/auth.service'
import { JwtTokenPayload } from '../auth/models/auth.token.model'
import { ApiResponseUtil } from '../../utils/api-response.util'
import { Response, Request } from 'express'

interface RequestWithUser extends Request {
  user: JwtTokenPayload
}

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'The user has been successfully created.', type: User })
  async create(@Body() createUserDto: CreateUserDto, @Res() res: Response): Promise<void> {
    try {
      const user = await this.userService.create(createUserDto)
      ApiResponseUtil.success(res, user, 'user')
    } catch (error) {
      ApiResponseUtil.error(res, error, 500, 'ユーザー作成に失敗しました')
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get a user by Discord ID' })
  @ApiResponse({ status: 200, description: 'Return the user.', type: User })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @UseGuards(JwtAuthGuard)
  async findOne(@Headers('Authorization') authorization: string, @Res() res: Response): Promise<void> {
    try {
      const token = await this.authService.validateToken(authorization)
      const user = await this.userService.findByDiscordId(token.discordUserId)
      if (!user) {
        ApiResponseUtil.error(res, 'ユーザーが見つかりません', 404)
        return
      }
      ApiResponseUtil.success(res, user, 'user')
    } catch (error) {
      ApiResponseUtil.error(res, error, 500, 'ユーザー取得に失敗しました')
    }
  }

  @Get('discord/guilds')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get user Discord guilds' })
  @ApiResponse({ status: 200, description: 'Return the user Discord guilds.' })
  async getDiscordGuilds(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const user = req.user
      if (!user || !user.discordUserId) {
        ApiResponseUtil.error(res, '認証トークンがありません', 401)
        return
      }
      const guilds = await this.userService.getUserDiscordGuilds(user.discordUserId)
      ApiResponseUtil.success(
        res,
        {
          guilds,
          count: guilds.length,
          message: 'Discord Guild一覧を正常に取得しました'
        },
        'user'
      )
    } catch (error) {
      ApiResponseUtil.error(res, error, 500, 'Discord Guild一覧取得に失敗しました')
    }
  }

  @Put(':discordUserId')
  @ApiOperation({ summary: 'Update a user' })
  @ApiResponse({ status: 200, description: 'The user has been successfully updated.', type: User })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async update(
    @Param() params: DiscordUserIdParamDto,
    @Body() updateUserDto: UpdateUserDto,
    @Res() res: Response
  ): Promise<void> {
    try {
      const { discordUserId } = params
      const user = await this.userService.update(discordUserId, updateUserDto)
      if (!user) {
        ApiResponseUtil.error(res, 'ユーザーが見つかりません', 404)
        return
      }
      ApiResponseUtil.success(res, user, 'user')
    } catch (error) {
      ApiResponseUtil.error(res, error, 500, 'ユーザー更新に失敗しました')
    }
  }

  @Patch(':discordUserId/characters/:characterId')
  @ApiOperation({ summary: 'Add a character to a user' })
  @ApiResponse({ status: 200, description: 'The character has been added to the user.', type: User })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async addCharacter(
    @Param() params: DiscordUserIdParamDto & CharacterIdParamDto,
    @Res() res: Response
  ): Promise<void> {
    try {
      const { discordUserId, characterId } = params
      const user = await this.userService.addCharacterId(discordUserId, characterId)
      if (!user) {
        ApiResponseUtil.error(res, 'ユーザーが見つかりません', 404)
        return
      }
      ApiResponseUtil.success(res, user, 'user')
    } catch (error) {
      ApiResponseUtil.error(res, error, 500, 'キャラクター追加に失敗しました')
    }
  }

  @Delete(':discordUserId/characters/:characterId')
  @ApiOperation({ summary: 'Remove a character from a user' })
  @ApiResponse({ status: 200, description: 'The character has been removed from the user.', type: User })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async removeCharacter(
    @Param() params: DiscordUserIdParamDto & CharacterIdParamDto,
    @Res() res: Response
  ): Promise<void> {
    try {
      const { discordUserId, characterId } = params
      const user = await this.userService.removeCharacterId(discordUserId, characterId)
      if (!user) {
        ApiResponseUtil.error(res, 'ユーザーが見つかりません', 404)
        return
      }
      ApiResponseUtil.success(res, user, 'user')
    } catch (error) {
      ApiResponseUtil.error(res, error, 500, 'キャラクター削除に失敗しました')
    }
  }

  @Delete(':discordUserId')
  @ApiOperation({ summary: 'Delete a user' })
  @ApiResponse({ status: 200, description: 'The user has been successfully deleted.', type: User })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async remove(@Param() params: DiscordUserIdParamDto, @Res() res: Response): Promise<void> {
    try {
      const { discordUserId } = params
      const user = await this.userService.remove(discordUserId)
      if (!user) {
        ApiResponseUtil.error(res, 'ユーザーが見つかりません', 404)
        return
      }
      ApiResponseUtil.success(res, user, 'user')
    } catch (error) {
      ApiResponseUtil.error(res, error, 500, 'ユーザー削除に失敗しました')
    }
  }
}
