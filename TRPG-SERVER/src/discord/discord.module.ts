import { Module, forwardRef } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config';
import { DiscordService } from './discord.service'
import { EventsModule } from './events/events.module'
import { CommandsModule } from './commands/commands.module'
import { DiscordClientService } from './services/discord-client.service';
import { CommandManagerService } from './services/command-manager.service';
import { EventManagerService } from './services/event-manager.service';
import { DiscordCommandRegistrationService } from './services/discord-command-registration.service';
import { DiscordEventRegistrationService } from './services/discord-event-registration.service';
import { CharacterModule } from '../domains/character/character.module';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => EventsModule), 
    CommandsModule,
    CharacterModule
  ],
  controllers: [],
  providers: [
    DiscordService,
    DiscordClientService,
    CommandManagerService,
    EventManagerService,
    DiscordCommandRegistrationService,
    DiscordEventRegistrationService
  ],
  exports: [
    DiscordService,
    DiscordClientService,
    CommandManagerService,
    EventManagerService
  ]
})
export class DiscordModule {}
