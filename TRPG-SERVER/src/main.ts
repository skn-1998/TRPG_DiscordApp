// ソースマップサポートを最初に読み込む
import 'source-map-support/register'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import cors from 'cors'
import { AppConfigService } from './config/config.service'
import { Logger } from '@nestjs/common'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // ConfigServiceを取得
  const configService = app.get(AppConfigService)

  // 環境変数からポートを取得するか、デフォルト値を使用
  const port = configService.get('app.port') || 3000

  // フロントエンドのURLを設定
  const frontendUrl = configService.get('app.frontendUrl')

  // CORSを許可する設定
  app.enableCors({
    origin: frontendUrl,
    credentials: true
  })

  await app.listen(port)
  Logger.log(`アプリケーションが起動しました: http://localhost:${port}`)
}
bootstrap()
