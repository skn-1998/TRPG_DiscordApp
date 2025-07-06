import { Test, TestingModule } from '@nestjs/testing'
import { CommandsController } from './commands.controller'
import { CharacterThreadService } from './commands-components/character-thread.service'
import { RollDiceService } from './commands-components/roll-dice.service'
import { SelectGameSystemService } from './commands-components/select-game-system.service'
import { UserDefinedDiceService } from './commands-components/user-defined-dice.service'
import { DiceFromContextMenuService } from './commands-components/dice-from-context-menu.service'
import { DiceResultService } from './commands-components/dice-result.service'

describe('CommandsController', () => {
  let controller: CommandsController
  let characterThreadService: CharacterThreadService
  let rollDiceService: RollDiceService
  let selectGameSystemService: SelectGameSystemService
  let userDefinedDiceService: UserDefinedDiceService
  let diceFromContextMenuService: DiceFromContextMenuService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommandsController],
      providers: [
        {
          provide: CharacterThreadService,
          useValue: {
            createThread: jest.fn()
          }
        },
        {
          provide: RollDiceService,
          useValue: {
            rollDice: jest.fn()
          }
        },
        {
          provide: SelectGameSystemService,
          useValue: {
            selectGameSystem: jest.fn()
          }
        },
        {
          provide: UserDefinedDiceService,
          useValue: {
            userDefinedDice: jest.fn()
          }
        },
        {
          provide: DiceFromContextMenuService,
          useValue: {
            diceFromContextMenu: jest.fn()
          }
        },
        {
          provide: DiceResultService,
          useValue: {
            execute: jest.fn().mockResolvedValue(undefined)
          }
        }
      ]
    }).compile()

    controller = module.get<CommandsController>(CommandsController)
    characterThreadService = module.get<CharacterThreadService>(CharacterThreadService)
    rollDiceService = module.get<RollDiceService>(RollDiceService)
    selectGameSystemService = module.get<SelectGameSystemService>(SelectGameSystemService)
    userDefinedDiceService = module.get<UserDefinedDiceService>(UserDefinedDiceService)
    diceFromContextMenuService = module.get<DiceFromContextMenuService>(DiceFromContextMenuService)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
