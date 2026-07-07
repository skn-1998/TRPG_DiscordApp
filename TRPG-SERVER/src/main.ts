// ソースマップサポートを最初に読み込む
import 'source-map-support/register'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import cookieParser from 'cookie-parser'
import { AppConfigService } from './config/config.service'
import { Logger } from '@nestjs/common'
import { DiscordFacadeService } from './discord/discord-facade.service'
import { getErrorMessage } from './shared/utils/error-helpers'

async function bootstrap() {
  try {
    // AppModuleを初期化する際に{logger: ['error', 'warn']}を追加して、起動時のログを減らす
    const app = await NestFactory.create(AppModule)

    // ConfigServiceを取得
    const configService = app.get(AppConfigService)

    // 環境変数からポートを取得するか、デフォルト値を使用
    const port = configService.get('app.port') || 3000

    // フロントエンドのURLを設定
    const frontendUrl = configService.get('app.frontendUrl')
    if (!frontendUrl) {
      throw new Error('FRONTEND_URL is required for CORS configuration but is not set')
    }

    // クッキーパーサーを設定
    app.use(cookieParser())

    // CORSを許可する設定
    app.enableCors({
      origin: frontendUrl,
      credentials: true
    })

    Logger.log('Webサーバーを起動します...')
    // 重要: サーバーを起動し、Discordの初期化などの非同期処理の前に完了させる

    // IPv6競合回避のため、環境に応じてバインドアドレスを選択
    // P1-C: process.env 直接参照を AppConfigService 経由へ。app.environment は env.NODE_ENV（configuration.ts）。
    // DOCKER_ENV は typed key ではないため getRaw 経由（AppConfigService が env アクセスを一元化）。
    const isProduction = configService.get('app.environment') === 'production'
    const isDockerEnv = Boolean(configService.getRaw('DOCKER_ENV'))
    const bindAddress = isProduction || isDockerEnv ? '0.0.0.0' : '127.0.0.1'

    await app.listen(port, bindAddress)
    Logger.log(`アプリケーションが起動しました: http://${bindAddress}:${port}`)

    if (bindAddress === '127.0.0.1') {
      Logger.log('IPv4 (127.0.0.1) を使用してIPv6競合を回避')
    } else {
      Logger.log('Docker/本番環境のため 0.0.0.0 でバインド')
    }

    // Webサーバーが起動した後で、Discord初期化を別のプロセスとして実行
    try {
      const discordFacade = app.get(DiscordFacadeService)
      // 非同期で実行してもメインスレッドをブロックしないようにする
      discordFacade.initializeDiscord().catch((err) => {
        Logger.error(`Discordの初期化中にエラーが発生しました: ${err.message}`)
      })
    } catch (discordError: unknown) {
      // Discordの初期化は失敗してもアプリケーションは続行する
      getErrorMessage(discordError)
    }
  } catch (error: unknown) {
    getErrorMessage(error)
    // エラーが発生した場合はプロセスを終了
    process.exit(1)
  }
}
// アプリ起動はトップレベルの fire-and-forget（内部で try/catch・process.exit 済み）
void bootstrap()
