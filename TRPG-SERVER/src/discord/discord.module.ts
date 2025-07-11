import { Module, forwardRef } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { DiscordService } from './discord.service'
import { EventsModule } from './events/events.module'
import { CommandsModule } from './commands/commands.module'
import { DiscordClientService } from './services/discord-client.service'
import { CommandManagerService } from './services/command-manager.service'
import { DiscordCommandRegistrationService } from './services/discord-command-registration.service'
import { CharacterModule } from '../domains/character/character.module'
import { AuthModule } from '../domains/auth/auth.module'
import { DiscordController } from './discord.controller'

@Module({
  imports: [ConfigModule, forwardRef(() => EventsModule), CommandsModule, CharacterModule, AuthModule],
  controllers: [DiscordController],
  providers: [DiscordService, DiscordClientService, CommandManagerService, DiscordCommandRegistrationService],
  exports: [DiscordService, DiscordClientService, CommandManagerService]
})
export class DiscordModule {}
