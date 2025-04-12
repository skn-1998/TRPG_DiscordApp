import { Test, TestingModule } from '@nestjs/testing';
import { DiscordService } from './discord.service';
import { EventsService } from './events/events.service';
import { CommandsService } from './commands/commands.service';
import { Client, GatewayIntentBits, Events } from 'discord.js';

describe('DiscordService', () => {
  let service: DiscordService;
  let eventsService: EventsService;
  let commandsService: CommandsService;
  let client: Client;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscordService,
        {
          provide: EventsService,
          useValue: {
            loadClient: jest.fn(),
          },
        },
        {
          provide: CommandsService,
          useValue: {
            loadClient: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DiscordService>(DiscordService);
    eventsService = module.get<EventsService>(EventsService);
    commandsService = module.get<CommandsService>(CommandsService);
    client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initialize the client and login', async () => {
    const loginSpy = jest.spyOn(client, 'login').mockResolvedValue('mock_token');
    (service as any).client = client; // Inject the mock client

    await service.onModuleInit();

    expect(loginSpy).toHaveBeenCalledWith(process.env.TOKEN);
    expect(eventsService.loadClient).toHaveBeenCalledWith(client);
    expect(commandsService.loadClient).toHaveBeenCalledWith(client);
  });
});
