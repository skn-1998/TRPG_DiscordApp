import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common'
import { WinstonModule } from 'nest-winston'

import { AppController } from './app.controller'
import { AppService } from './app.service'
import { CorsMiddleware } from './middleware/cors.middleware'
import { SharedModule } from './shared/shared.module'
import { AppConfigModule } from './config/config.module'
import { DatabaseModule } from './core/database/database.module'
import { CharacterModule } from './domains/character/character.module'
import { UserModule } from './domains/user/user.module'
import { AuthModule } from './domains/auth/auth.module'
import { DiceRollModule } from './domains/dice-roll/dice-roll.module'
import { DiscordModule } from './discord/discord.module'
import { winstonConfigFactory } from './config/winston.config'
import { AppConfigService } from './config/config.service'

// プロトタイプモジュール
import { PrototypeModule } from './domains/character/application/prototype/prototype.module'
import { DiscordPrototypeModule } from './discord/application/prototype/discord-prototype.module'

@Module({
  imports: [
    WinstonModule.forRootAsync({
      imports: [AppConfigModule],
      useFactory: (configService: AppConfigService) => {
        return winstonConfigFactory(configService)
      },
      inject: [AppConfigService]
    }),
    SharedModule,
    AppConfigModule,
    DatabaseModule,
    CharacterModule,
    UserModule,
    AuthModule,
    DiceRollModule,
    DiscordModule,
    // プロトタイプモジュール
    PrototypeModule,
    DiscordPrototypeModule
  ],
  controllers: [AppController],
  providers: [AppService],
  exports: [AppService]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorsMiddleware).forRoutes('*')
  }
}
