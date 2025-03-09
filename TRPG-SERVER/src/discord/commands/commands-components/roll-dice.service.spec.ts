import { Test, TestingModule } from '@nestjs/testing'
import { RollDiceService } from './roll-dice.service'

describe('RollDiceService', () => {
  let service: RollDiceService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RollDiceService]
    }).compile()

    service = module.get<RollDiceService>(RollDiceService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
