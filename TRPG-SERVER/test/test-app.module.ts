import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AppConfigModule } from '../src/config/config.module'
import { CharacterModule } from '../src/domains/character/character.module'
import { AuthModule } from '../src/domains/auth/auth.module'
import { MockModule } from './mocks/mock.module'
import { TestAuthModule } from './auth/test-auth.module'
/**
 * テスト用のアプリケーションモジュール
 * E2Eテスト用の設定
 */
@Module({
  imports: [
    AppConfigModule,
    CharacterModule,
    MockModule, // CharacterModule後にモックを読み込み、プロバイダを上書き
    AuthModule,
    TestAuthModule
  ]
})
export class TestAppModule {}
