import { Test, TestingModule } from '@nestjs/testing'
import { EventsController } from './events.controller'
import { CharaInfoButtonService } from './button/chara-info-button.service'
import { DiceButtonService } from './button/dice-button.service'
import { AddCharaInfoService } from './button/add-chara-info.service'
import { ChangeCharaInfoService } from './button/change-chara-info.service'
import { CharacterChannelService } from './channel/character-channel.service'
import { CharacterService } from '../DB/character/character.service'

describe('EventsController', () => {
  let controller: EventsController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [
        {
          provide: CharaInfoButtonService,
          useValue: {
            handleCharaInfoButton: jest.fn()
          }
        },
        {
          provide: DiceButtonService,
          useValue: {
            handleDiceButton: jest.fn()
          }
        },
        {
          provide: AddCharaInfoService,
          useValue: {
            handleAddCharaInfo: jest.fn()
          }
        },
        {
          provide: ChangeCharaInfoService,
          useValue: {
            handleChangeCharaInfo: jest.fn()
          }
        },
        {
          provide: CharacterChannelService,
          useValue: {
            handleCharacterChannel: jest.fn()
          }
        },
        {
          provide: CharacterService,
          useValue: {
            findOne: jest.fn(),
            update: jest.fn()
          }
        }
      ]
    }).compile()

    controller = module.get<EventsController>(EventsController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
