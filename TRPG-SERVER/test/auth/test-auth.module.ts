import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AuthModule } from '../../src/domains/auth/auth.module'
import { UserModule } from '../../src/domains/user/user.module'
import { CookieService } from '../../src/core/http/cookie.service'
import { TestAuthController } from './test-auth.controller'

@Module({
  imports: [ConfigModule, AuthModule, UserModule],
  controllers: [TestAuthController],
  providers: [CookieService]
})
export class TestAuthModule {}
