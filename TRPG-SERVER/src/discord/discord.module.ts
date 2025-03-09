import { Module } from '@nestjs/common'
import { DiscordService } from './discord.service'
import { EventsModule } from './events/events.module'
import { CommandsModule } from './commands/commands.module'

@Module({
  controllers: [],
  providers: [DiscordService],
  imports: [EventsModule, CommandsModule]
})
export class DiscordModule {}
