import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { PassportModule } from '@nestjs/passport'
import { AuthController } from './auth.controller'
import { AuthService } from './services/auth.service'
import { DiscordStrategy } from './discord.strategy'
import { UserModule } from '../user/user.module'
import { AuthTokenModule } from './token/auth-token.module'
import { SharedModule } from '../../core/shared/shared.module'
import { CookieService } from '../../utils/cookie.service'

/**
 * 認証モジュール
 * 認証と認可に関する機能を提供
 *
 * auth -> user は許容方向。H6 で Auth ⇄ User の循環を解消したため、
 * UserModule は forwardRef ではなく通常 import で参照する。
 *
 * JWT 検証プリミティブ（JwtTokenService）と JwtAuthGuard、JwtModule の登録は
 * 下位の共通モジュール AuthTokenModule に切り出した。AuthModule はそれを import し、
 * 従来 AuthModule から JwtAuthGuard を解決していた下流モジュール（Character / Discord）の
 * 互換性のために re-export する。
 */
@Module({
  imports: [PassportModule, UserModule, ConfigModule, SharedModule, AuthTokenModule],
  controllers: [AuthController],
  providers: [AuthService, DiscordStrategy, ConfigService, CookieService],
  exports: [AuthService, AuthTokenModule]
})
export class AuthModule {}
