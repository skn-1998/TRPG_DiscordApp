import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { UserController } from './user.controller'
import { UserService } from './user.service'
import { USER_MODEL, UserSchema } from './models/user.model'
import { UserRepository } from './repositories/user.repository'
import { AuthTokenModule } from '../auth/token/auth-token.module'
import { SharedModule } from '../../core/shared/shared.module'

/**
 * ユーザーモジュール
 *
 * H6 で Auth ⇄ User の循環を解消した。UserModule は AuthModule を import しない。
 * UserController が必要とする JwtAuthGuard / JwtTokenService は、UserService に依存しない
 * 下位の共通モジュール AuthTokenModule から取得する（user domain は認証方式を知らない）。
 */
@Module({
  imports: [MongooseModule.forFeature([{ name: USER_MODEL, schema: UserSchema }]), AuthTokenModule, SharedModule],
  controllers: [UserController],
  providers: [UserService, UserRepository],
  exports: [UserService, UserRepository]
})
export class UserModule {}
