import { forwardRef, Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { PassportModule } from '@nestjs/passport'
import { JwtModule } from '@nestjs/jwt'
import { HttpModule } from '@nestjs/axios'
import { AuthController } from './auth.controller'
import { AuthService } from './services/auth.service'
import { HttpClientService } from './services/http.service'
import { DiscordStrategy } from './discord.strategy'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { UserModule } from '../user/user.module'

/**
 * 認証モジュール
 * 認証と認可に関する機能を提供
 */
@Module({
  imports: [
    PassportModule,
    forwardRef(() => UserModule),
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '1h',
          algorithm: 'HS256'
        },
        verifyOptions: {
          algorithms: ['HS256'] // 使用するアルゴリズムを明示
        }
      })
    }),
    HttpModule
  ],
  controllers: [AuthController],
  providers: [AuthService, HttpClientService, DiscordStrategy, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard]
})
export class AuthModule {}
