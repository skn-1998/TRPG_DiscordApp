import { Controller, Get, Post, Body, Req, Res, UseGuards, Headers, Param } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { AuthService } from './auth.service'
import { Request, Response } from 'express'
import { User } from 'src/domains/user/models/user.model'
import { UserService } from 'src/domains/user/user.service'
import _ from 'lodash'
import { getErrorMessage } from 'src/utils/error-helpers'

// RequestWithUserインターフェースを定義
interface RequestWithUser extends Request {
  user?: {
    id?: string
    username?: string
  }
}

@Controller('auth')
export class AuthController {
  // eslint-disable-next-line no-unused-vars
  constructor(
    // eslint-disable-next-line no-unused-vars
    private readonly authService: AuthService,
    // eslint-disable-next-line no-unused-vars
    private readonly userService: UserService
  ) {}

  @Get('discord')
  async discordLogin(): Promise<void> {
    // このルートはリダイレクトするために空のままでOK
  }

  @Get('discord/callback')
  @UseGuards(AuthGuard('discord'))
  async discordLoginCallback(@Req() req: RequestWithUser, @Res() res: Response): Promise<void> {
    // Discordから取得したユーザー情報を使用
    const discordUser = req.user

    const customUserInfo: Partial<User> = {
      name: discordUser?.username || '',
      discordUserId: discordUser?.id || '',
      characterIds: []
    }
    const jwt = await this.authService.generateJwt(customUserInfo)
    res.cookie('jwt', jwt, { httpOnly: true, secure: true })
    res.redirect('/') // 認証後のリダイレクト先
  }

  @Get('validate-token')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async validateToken(@Headers('Authorization') authorization: string): Promise<any> {
    // JWTトークンを取得
    try {
      return this.authService.validateToken(authorization)
    } catch (e) {
      throw getErrorMessage(e)
    }
  }

  @Post('login')
  async login(@Body('code') code: string, @Res() res: Response): Promise<void> {
    try {
      const authData = await this.authService.authenticate(code)
      const userInfo = await this.authService.getUserInfo(authData.access_token)
      const customUserInfo: Partial<User> = {
        name: userInfo.username,
        discordUserId: userInfo.id,
        characterIds: []
      }
      this.authService.signInAndRegisterUserInfo(customUserInfo)
      const jwt = await this.authService.generateJwt(customUserInfo)

      console.log(jwt)
      res.cookie('jwt', jwt, {
        httpOnly: true,
        secure: true,
        sameSite: 'none'
      })
      res.status(200).json({
        message: 'Authentication successful',
        discordUserId: customUserInfo.discordUserId,
        userName: customUserInfo.name,
        token: jwt
      })
    } catch (error) {
      throw getErrorMessage(error)
    }
  }
  //auth/{userId}/User
  @Get(':userId/User')
  async GetUser(@Param('userId') discordUserId: string, @Res() res: Response): Promise<void> {
    const userInfo = await this.userService.findOne(discordUserId)
    if (_.isNull(userInfo) || _.isUndefined(userInfo)) {
      res.status(500).send({ message: 'userId is not found' })
    }
    /*
    {
      message:'userInfo',
      user:{
      }    
    }
    */

    res.status(200).json({
      message: 'userInfo',
      user: userInfo
    })
  }
}
