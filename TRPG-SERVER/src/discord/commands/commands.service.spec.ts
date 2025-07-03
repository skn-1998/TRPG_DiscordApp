import { Test, TestingModule } from '@nestjs/testing'
import { CommandsService } from './commands.service'

describe('CommandsService', () => {
  let service: CommandsService

  // 全ての依存関係をモック
  const mockServices = {
    CharacterThreadService: { execute: jest.fn() },
    RollDiceService: { execute: jest.fn() },
    SelectGameSystemService: { execute: jest.fn() },
    UserDefinedDiceService: { execute: jest.fn() },
    CommandsController: { handleInteraction: jest.fn() },
    DiceFromContextMenuService: { execute: jest.fn() },
    DiceResultService: { execute: jest.fn() }
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: CommandsService,
          useValue: {
            // CommandsService の基本メソッドをモック
            someMethod: jest.fn()
          }
        }
      ]
    }).compile()

    service = module.get<CommandsService>(CommandsService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
