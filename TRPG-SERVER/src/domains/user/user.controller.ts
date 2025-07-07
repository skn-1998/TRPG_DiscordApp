import { Controller, Get, Post, Body, Param, Delete, Put, Patch, UseGuards, Headers, Req } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { UserService } from './user.service'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { User } from './models/user.model'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { AuthService } from '../auth/services/auth.service'
import { JwtTokenPayload } from '../auth/models/auth.token.model'

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
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto)
  }

  @Get()
  @ApiOperation({ summary: 'Get a user by Discord ID' })
  @ApiResponse({ status: 200, description: 'Return the user.', type: User })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @UseGuards(JwtAuthGuard)
  async findOne(@Headers('Authorization') authorization: string) {
    const token = await this.authService.validateToken(authorization)
    return await this.userService.findByDiscordId(token.discordUserId)
  }

  @Get('discord/guilds')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get user Discord guilds' })
  @ApiResponse({ status: 200, description: 'Return the user Discord guilds.' })
  async getDiscordGuilds(@Req() req: RequestWithUser) {
    try {
      // JwtAuthGuardによって設定されたユーザー情報から取得
      const user = req.user as unknown as JwtTokenPayload
      const discordUserId = user.discordUserId

      // ユーザーが参加しているDiscordサーバー一覧を取得
      const guilds = await this.userService.getUserDiscordGuilds(discordUserId)

      return {
        guilds,
        count: guilds.length,
        message: 'Discord Guild一覧を正常に取得しました'
      }
    } catch (error) {
      // エラーに応じて適切なレスポンスを返す
      if (error instanceof Error && error.message.includes('アクセストークン')) {
        return {
          guilds: [],
          count: 0,
          message: 'アクセストークンが見つからないか期限切れです。再認証が必要です。',
          error: error.message
        }
      }

      throw error
    }
  }

  @Put(':discordUserId')
  @ApiOperation({ summary: 'Update a user' })
  @ApiResponse({ status: 200, description: 'The user has been successfully updated.', type: User })
  @ApiResponse({ status: 404, description: 'User not found.' })
  update(@Param('discordUserId') discordUserId: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(discordUserId, updateUserDto)
  }

  @Patch(':discordUserId/characters/:characterId')
  @ApiOperation({ summary: 'Add a character to a user' })
  @ApiResponse({ status: 200, description: 'The character has been added to the user.', type: User })
  @ApiResponse({ status: 404, description: 'User not found.' })
  addCharacter(@Param('discordUserId') discordUserId: string, @Param('characterId') characterId: string) {
    return this.userService.addCharacterId(discordUserId, characterId)
  }

  @Delete(':discordUserId/characters/:characterId')
  @ApiOperation({ summary: 'Remove a character from a user' })
  @ApiResponse({ status: 200, description: 'The character has been removed from the user.', type: User })
  @ApiResponse({ status: 404, description: 'User not found.' })
  removeCharacter(@Param('discordUserId') discordUserId: string, @Param('characterId') characterId: string) {
    return this.userService.removeCharacterId(discordUserId, characterId)
  }

  @Delete(':discordUserId')
  @ApiOperation({ summary: 'Delete a user' })
  @ApiResponse({ status: 200, description: 'The user has been successfully deleted.', type: User })
  @ApiResponse({ status: 404, description: 'User not found.' })
  remove(@Param('discordUserId') discordUserId: string) {
    return this.userService.remove(discordUserId)
  }
}
