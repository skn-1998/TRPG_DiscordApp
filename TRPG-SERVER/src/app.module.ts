import { Module } from '@nestjs/common'
import { WinstonModule } from 'nest-winston'

import { AppController } from './app.controller'
import { AppService } from './app.service'
import { CoreEventsModule } from './core/events/core-events.module'
import { AppConfigModule } from './config/config.module'
import { DatabaseModule } from './core/database/database.module'
import { CharacterModule } from './domains/character/character.module'
import { CharacterSheetTemplateModule } from './domains/character-sheet-template/character-sheet-template.module'
import { CharacterSheetModule } from './features/character-sheet/character-sheet.module'
import { UserModule } from './domains/user/user.module'
import { AuthModule } from './domains/auth/auth.module'
import { DiceRollModule } from './domains/dice-roll/dice-roll.module'
import { DiscordModule } from './discord/discord.module'
import { CharacterSheetDiscordFeatureModule } from './discord/features/characterSheet/character-sheet-discord-feature.module'
import { EventsModule } from './events/events.module'
import { winstonConfigFactory } from './config/winston.config'
import { AppConfigService } from './config/config.service'
import { APP_VALIDATION_PIPE_PROVIDER } from './core/http/validation-pipe.provider'
// AI.architecture.md Phase 3: アダプター層統合

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
    CoreEventsModule,
    AppConfigModule,
    DatabaseModule,
    // AI.architecture.md Phase 3: アダプター層を早期に初期化
    EventsModule, // Events層を先に初期化
    CharacterModule,
    CharacterSheetTemplateModule,
    CharacterSheetModule,
    UserModule,
    AuthModule,
    DiceRollModule,
    DiscordModule,
    CharacterSheetDiscordFeatureModule
  ],
  controllers: [AppController],
  providers: [AppService, APP_VALIDATION_PIPE_PROVIDER],
  exports: [AppService]
})
export class AppModule {}
