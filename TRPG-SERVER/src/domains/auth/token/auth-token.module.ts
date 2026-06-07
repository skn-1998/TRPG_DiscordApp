import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { JwtTokenService } from './jwt-token.service'
import { JwtAuthGuard } from '../guards/jwt-auth.guard'
import { AppConfigModule } from '../../../config/config.module'
import { AppConfigService } from '../../../config/config.service'

/**
 * 認証トークンモジュール（下位の共通モジュール）
 *
 * JWT 検証プリミティブ（JwtTokenService）と JWT 認証ガード（JwtAuthGuard）を提供する。
 * AuthModule / UserModule / CharacterModule / DiscordModule など、トークン検証や
 * JwtAuthGuard を使うモジュールから import できる。
 *
 * UserService 等のドメインサービスに依存しないため、このモジュールを共有しても
 * Auth ⇄ User の循環は発生しない。@Global は使わず明示 import で配線する。
 *
 * JwtModule の登録設定は従来 AuthModule にあったものをそのまま移設している。
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (appConfigService: AppConfigService) => {
        const secret = appConfigService.get('auth.jwtSecret')
        if (!secret) {
          throw new Error('JWT_SECRET is required but not configured')
        }

        return {
          secret,
          signOptions: {
            expiresIn: appConfigService.get('auth.jwtExpiresIn') || '1h',
            algorithm: 'HS256' as const
          },
          verifyOptions: {
            algorithms: ['HS256' as const] // 使用するアルゴリズムを明示
          }
        }
      }
    })
  ],
  providers: [JwtTokenService, JwtAuthGuard],
  exports: [JwtTokenService, JwtAuthGuard, JwtModule]
})
export class AuthTokenModule {}
