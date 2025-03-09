import { Injectable, OnModuleInit } from '@nestjs/common'
import { Client, GatewayIntentBits, Events } from 'discord.js'
// import { DiscordController } from './discord.controller'
// import { CommandsModule } from './commands/commands.module'
// import { CommandsController } from './commands/commands.controller'
import 'dotenv/config'
import { EventsService } from './events/events.service'
import { CommandsService } from './commands/commands.service'

@Injectable()
export class DiscordService implements OnModuleInit {
  private client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  })

  // eslint-disable-next-line no-unused-vars
  constructor(private eventsService:EventsService, private commandsService: CommandsService) {}

  async onModuleInit(): Promise<void> {
    this.client.once(Events.ClientReady, readyClient => {
      console.log(`Ready! Logged in as ${readyClient.user.tag}`)
    })

    this.client.on(Events.InteractionCreate, async interaction => {
      if (!interaction.isCommand()) return
    })

    this.commandsService.loadClient(this.client)
    this.eventsService.loadClient(this.client)

    this.client.login(process.env.TOKEN)
    // registerCommand(this.client)
    // registerEvents(this.client)
  }
}
