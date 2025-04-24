import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { UserModule } from './domains/user/user.module'
import { CharacterModule } from './domains/character/character.module'
import { AuthModule } from './domains/auth/auth.module'
import { CorsMiddleware } from './middleware/cors.middleware'
import { DatabaseModule } from './core/database/database.module'
import { AppConfigModule } from './config/config.module'
import { DiscordModule } from './discord/discord.module'

@Module({
  imports: [AppConfigModule, DatabaseModule, CharacterModule, UserModule, AuthModule, DiscordModule],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorsMiddleware).forRoutes('*')
  }
}
