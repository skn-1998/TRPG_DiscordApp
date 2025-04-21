import { Injectable, OnModuleInit } from '@nestjs/common'
import { Client, GatewayIntentBits, Events } from 'discord.js'
// import { DiscordController } from './discord.controller'
// import { CommandsModule } from './commands/commands.module'
// import { CommandsController } from './commands/commands.controller'
import 'dotenv/config'
import { EventsService } from './events/events.service'
import { CommandsService } from './commands/commands.service'
import { CharacterService } from 'src/domains/character/character.service'
import { AppConfigService } from 'src/config/config.service'

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
  constructor(
    private eventsService: EventsService, 
    private commandsService: CommandsService,
    private characterService: CharacterService,
    private appConfigService: AppConfigService
  ) {}

  async onModuleInit(): Promise<void> {
    this.client.once(Events.ClientReady, readyClient => {
      console.log(`Ready! Logged in as ${readyClient.user.tag}`)
    })

    // 空のインタラクションリスナーを削除（EventManagerServiceが処理するため）
    // this.client.on(Events.InteractionCreate, async interaction => {
    //   if (!interaction.isCommand()) return
    // })

    // CharacterServiceをclientに設定
    this.client['characterService'] = this.characterService;

    this.commandsService.loadClient(this.client)
    this.eventsService.loadClient(this.client)

    // 型安全に設定にアクセス
    const token = this.appConfigService.get('discord.token')
    this.client.login(token)
    // registerCommand(this.client)
    // registerEvents(this.client)
  }
}
