import { Module, forwardRef } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { DiscordService } from './discord.service'
import { EventsModule } from './events/events.module'
import { CommandsModule } from './commands/commands.module'
import { DiscordClientService } from './services/discord-client.service'
import { CommandManagerService } from './services/command-manager.service'
import { DiscordCommandRegistrationService } from './services/discord-command-registration.service'
import { DiscordFacadeService } from './services/discord-facade.service'
import { DiscordUIService } from './services/discord-ui.service'
import { DiscordIntegrationService } from './application/discord-integration.service'
import { CharacterModule } from '../domains/character/character.module'
import { AuthModule } from '../domains/auth/auth.module'
import { DiscordController } from './discord.controller'
import { SharedModule } from '../shared/shared.module'

@Module({
  imports: [
    ConfigModule,
    SharedModule,
    forwardRef(() => EventsModule),
    CommandsModule,
    forwardRef(() => CharacterModule),
    AuthModule
  ],
  controllers: [DiscordController],
  providers: [
    DiscordService,
    DiscordClientService,
    CommandManagerService,
    DiscordCommandRegistrationService,
    DiscordFacadeService,
    DiscordUIService,
    DiscordIntegrationService
  ],
  exports: [
    DiscordService,
    DiscordClientService,
    CommandManagerService,
    DiscordFacadeService,
    DiscordUIService,
    DiscordIntegrationService
  ]
})
export class DiscordModule {}
