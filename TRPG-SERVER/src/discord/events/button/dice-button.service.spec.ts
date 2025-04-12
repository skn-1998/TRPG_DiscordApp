import { Test, TestingModule } from '@nestjs/testing'
import { DiceButtonService } from './dice-button.service'

describe('DiceButtonService', () => {
  let service: DiceButtonService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DiceButtonService]
    }).compile()

    service = module.get<DiceButtonService>(DiceButtonService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
