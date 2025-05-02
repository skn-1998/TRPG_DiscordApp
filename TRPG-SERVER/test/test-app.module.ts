import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { CharacterModule } from '../src/domains/character/character.module'
import { AuthModule } from '../src/auth/auth.module'
import { MockModule } from './mocks/mock.module'
import { AppModule } from '../src/app.module'
/**
 * テスト用のアプリケーションモジュール
 * E2Eテスト用の設定
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    MockModule, // モックを先にインポート
    CharacterModule,
    AuthModule,
    AppModule
  ]
})
export class TestAppModule {}
