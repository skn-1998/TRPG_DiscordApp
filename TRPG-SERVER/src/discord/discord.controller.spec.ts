import { Test, TestingModule } from '@nestjs/testing'
import { DiscordController } from './discord.controller'
import { DiscordService } from './discord.service'

describe('DiscordController', () => {
  let controller: DiscordController
  let service: DiscordService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DiscordController],
      providers: [
        {
          provide: DiscordService,
          useValue: {
            sendMessage: jest.fn(),
            // ... 他の必要なメソッド
          }
        }
      ]
    }).compile()

    controller = module.get<DiscordController>(DiscordController)
    service = module.get<DiscordService>(DiscordService)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
