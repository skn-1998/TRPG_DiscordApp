import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { DiscordModule } from './discord/discord.module'
import { CharacterModule } from './DB/character/character.module';
import { UserModule } from './DB/user/user.module';
import { AuthModule } from './auth/auth.module';
import { CorsMiddleware } from './middleware/cors.middleware';
@Module({
  imports: [DiscordModule, CharacterModule, UserModule, AuthModule],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule implements NestModule {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorsMiddleware).forRoutes('*');
  }
}
