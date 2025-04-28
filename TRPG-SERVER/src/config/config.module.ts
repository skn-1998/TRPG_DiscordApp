import { Global, Module } from '@nestjs/common'
import { ConfigModule as NestConfigModule } from '@nestjs/config'

import { AppConfigService } from './config.service'
import { generateAppConfig } from './configuration'

/**
 * アプリケーション設定モジュール
 *
 * このモジュールはグローバルに登録され、どこからでも設定にアクセスできます。
 * .envファイルは使用せず、generateAppConfig関数を通じて設定を提供します。
 */
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      // .envファイルを読み込まない
      ignoreEnvFile: true,
      // 設定関数を指定
      load: [generateAppConfig],
      // 設定をグローバルに利用可能にする
      isGlobal: true
    })
  ],
  providers: [
    {
      provide: AppConfigService,
      useClass: AppConfigService
    }
  ],
  exports: [AppConfigService]
})
export class AppConfigModule {}
