import { Body, Controller, Headers, Logger, Post, Res, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Response } from 'express'
import { AuthService } from '../../src/domains/auth/services/auth.service'
import { UserService } from '../../src/domains/user/user.service'
import { User } from '../../src/domains/user/models/user.model'
import { CookieService } from '../../src/core/http/cookie.service'
import { v4 as uuidv4 } from 'uuid'

interface TestLoginDto {
  discordUserId: string
  username: string
  avatarHash?: string
}

@Controller('auth/test')
export class TestAuthController {
  private readonly logger = new Logger(TestAuthController.name)

  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
    private readonly configService: ConfigService,
    private readonly cookieService: CookieService
  ) {}

  @Post('login')
  async loginWithTestUser(
    @Headers('x-test-auth-secret') testAuthSecret: string | undefined,
    @Body() body: TestLoginDto,
    @Res() res: Response
  ): Promise<void> {
    this.assertTestSecret(testAuthSecret)

    const discordUserId = body.discordUserId?.trim()
    const username = body.username?.trim()
    const avatarHash = body.avatarHash?.trim()

    if (!discordUserId || !username) {
      const requestId = uuidv4()
      res.status(400).json({
        success: false,
        message: 'エラーが発生しました',
        timestamp: Date.now(),
        requestId,
        error: 'discordUserId と username は必須です'
      })
      return
    }

    const existingUser = await this.userService.findOne(discordUserId)
    const userData: Partial<User> = {
      discordUserId,
      name: username,
      avatarHash,
      characterIds: existingUser?.characterIds ?? []
    }

    if (!existingUser) {
      await this.userService.create({
        discordUserId,
        name: username,
        avatarHash,
        characterIds: []
      })
      this.logger.log(`Created test user: ${discordUserId}`)
    } else {
      await this.userService.update(discordUserId, {
        name: username,
        avatarHash
      })
      this.logger.log(`Updated test user: ${discordUserId}`)
    }

    const jwt = await this.authService.generateJwt(userData)
    this.cookieService.setJwtCookie(res, jwt, false)

    const requestId = uuidv4()
    res.status(200).json({
      success: true,
      message: '成功',
      timestamp: Date.now(),
      requestId,
      data: {
        token: jwt,
        user: {
          id: discordUserId,
          username,
          avatar: avatarHash
        }
      }
    })
  }

  private assertTestSecret(testAuthSecret: string | undefined): void {
    if (process.env.NODE_ENV !== 'test') {
      throw new UnauthorizedException('Test auth endpoint is disabled')
    }

    const expectedSecret = this.configService.get<string>('TEST_AUTH_SECRET')

    if (!expectedSecret) {
      throw new UnauthorizedException('TEST_AUTH_SECRET is not configured')
    }

    if (!testAuthSecret || testAuthSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid test auth secret')
    }
  }
}
