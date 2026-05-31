import { Module } from '@nestjs/common'
import { WinstonModule } from 'nest-winston'

import { AppController } from './app.controller'
import { AppService } from './app.service'
import { SharedModule } from './shared/shared.module'
import { AppConfigModule } from './config/config.module'
import { DatabaseModule } from './core/database/database.module'
import { CharacterModule } from './domains/character/character.module'
import { UserModule } from './domains/user/user.module'
import { AuthModule } from './domains/auth/auth.module'
import { DiceRollModule } from './domains/dice-roll/dice-roll.module'
import { DiscordModule } from './discord/discord.module'
import { EventsModule } from './events/events.module'
import { winstonConfigFactory } from './config/winston.config'
import { AppConfigService } from './config/config.service'
// AI.architecture.md Phase 3: アダプター層統合
// import { AdapterModule } from './adapters/adapter.module' // 一時的にコメントアウト

// プロトタイプモジュールは削除されました

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
    // AI.architecture.md Phase 3: アダプター層を早期に初期化
    // AdapterModule, // 一時的にコメントアウト
    EventsModule, // Events層を先に初期化
    CharacterModule,
    UserModule,
    AuthModule,
    DiceRollModule,
    DiscordModule
  ],
  controllers: [AppController],
  providers: [AppService],
  exports: [AppService]
})
export class AppModule {}
