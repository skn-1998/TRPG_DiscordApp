import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-discord';
import { AuthService } from './auth.service';
import 'dotenv/config'

@Injectable()
export class DiscordStrategy extends PassportStrategy(Strategy, 'discord') {
  // eslint-disable-next-line no-unused-vars
  constructor(private authService: AuthService) {
    super({
      clientID: process.env.DISCORD_APPLICATIONID,
      clientSecret: process.env.DISCORD_SECRET,
      callbackURL: 'http://localhost:3000/auth/discord/callback',
      scope: ['identify']
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async validate(accessToken: string, refreshToken: string, profile: any, done: VerifyCallback): Promise<any> {
    const user = await this.authService.validateUser(accessToken, refreshToken, profile);
    done(null, user);
  }
}
