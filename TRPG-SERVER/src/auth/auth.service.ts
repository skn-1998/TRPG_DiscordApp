import { HttpService } from '@nestjs/axios';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { firstValueFrom, lastValueFrom } from 'rxjs';
import { redirect_url } from 'src/auth.config';
import { URLSearchParams } from 'url';

import { UserService } from 'src/DB/user/user.service';
import { TRPGUser } from 'src/DB/user/models/user.model';
import _ from 'lodash';
import { JWTTokenModel } from './auth.token.model';


@Injectable()
export class AuthService {
  // eslint-disable-next-line no-unused-vars
  constructor(private readonly jwtService: JwtService,private readonly httpService: HttpService,readonly userService:UserService) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async validateUser(accessToken: string, refreshToken: string, profile: any): Promise<any> {
    return profile;
  }

  async validateToken(authorization:string): Promise<JWTTokenModel>
  {
    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Invalid or missing Authorization header');
    }
    const jwt = authorization.replace('Bearer ', '');
    try {
      // トークンの検証と解析
      const token = await this.parseJwt(jwt);
      return token; 
    } catch (error) {
      console.error('JWT verification failed:', error.message);
      throw new UnauthorizedException('Invalid token');
    }
  }


  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async generateJwt(user: TRPGUser): Promise<string> {
    const payload:JWTTokenModel = { username: user.name, DiscordUserId: user.DiscordUserId };
    return this.jwtService.sign(payload);
  }

  async parseJwt(token:string):Promise<JWTTokenModel> {
    try{
      const jwt = this.jwtService.verify<JWTTokenModel>(token)
      console.log('jwt: ', jwt)
      return jwt
    }catch (error){
      console.error('JWT verification error: ', error.message);
      console.error('Token: ', token);
      throw new UnauthorizedException("Invalid token")
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async signInAndRegisterUserInfo(user:TRPGUser):Promise<any>{
    //ユーザーID検証 
    // 1.User.DiscordUserIdで情報検索
    // 2.存在しない場合 新しく登録
    // 3.存在する場合スキップ
    console.log(user);
    if(_.isNull(user.DiscordUserId) || _.isUndefined(user.DiscordUserId))
    {
      console.log("discordId is Null")
    }

    try
    {
      const userInfo = await this.userService.findOne(user.DiscordUserId)

      if(_.isNil(userInfo))
      {
        console.log("ユーザー作成")
        const userData = await this.userService.create(user.name,user.DiscordUserId)
        console.log(userData)
      }

    }
    catch(error)
    {
      console.log("Error is occurred\n" + error.message)
      console.log(error)
    }
    
  }


  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getUserInfo(token:string):Promise<any> {
    const url = 'https://discordapp.com/api/users/@me';
    const headers = {
      Authorization: `Bearer ${token}`,
    };
    const res = await firstValueFrom(
      this.httpService.get(url, { headers })
    )
    return res.data

  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async authenticate(code:string):Promise<any> {
    const url = 'https://discordapp.com/api/oauth2/token';
    const params = new URLSearchParams();
    console.log(process.env.DISCORD_APPLICATIONID+":"+process.env.DISCORD_SECRET+code+"authorization_code"+redirect_url)
    params.append('client_id', process.env.DISCORD_APPLICATIONID)
    params.append('client_secret', process.env.DISCORD_SECRET)
    params.append('grant_type', 'authorization_code')
    params.append('code', code)
    params.append('redirect_uri', redirect_url)

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
    }
    try {
      const res = await lastValueFrom(

        this.httpService.post(url, params, { headers })
      
      );
      console.log(res.data)
      return res.data;
    } catch (error) {
      console.log(error)
      throw new Error(`Failed to authenticate: ${error}`);
    }
  }
}
