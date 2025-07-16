import { forwardRef, Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { PassportModule } from '@nestjs/passport'
import { JwtModule } from '@nestjs/jwt'
import { AuthController } from './auth.controller'
import { AuthService } from './services/auth.service'
import { DiscordStrategy } from './discord.strategy'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { UserModule } from '../user/user.module'
import { SharedModule } from '../../core/shared/shared.module'
import { CookieService } from '../../utils/cookie.service'

/**
 * 認証モジュール
 * 認証と認可に関する機能を提供
 */
@Module({
  imports: [
    PassportModule,
    forwardRef(() => UserModule),
    ConfigModule,
    SharedModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET')
        if (!secret) {
          throw new Error('JWT_SECRET is required but not configured')
        }

        return {
          secret,
          signOptions: {
            expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '1h',
            algorithm: 'HS256' as const
          },
          verifyOptions: {
            algorithms: ['HS256' as const] // 使用するアルゴリズムを明示
          }
        }
      }
    })
  ],
  controllers: [AuthController],
  providers: [AuthService, DiscordStrategy, JwtAuthGuard, ConfigService, CookieService],
  exports: [AuthService]
})
export class AuthModule {}
