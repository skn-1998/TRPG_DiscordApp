import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { AppConfigService } from '../../config/config.service'

/**
 * データベース接続を管理するモジュール
 * テスト時にはモックモジュールと置き換えることができる
 */
@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (appConfigService: AppConfigService) => ({
        uri: appConfigService.get('database.mongoUri')
      })
    })
  ]
})
export class DatabaseModule {}
