import { Test, TestingModule } from '@nestjs/testing'
import { UserDefinedDiceService } from './user-defined-dice.service'

describe('UserDefinedDiceService', () => {
  let service: UserDefinedDiceService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserDefinedDiceService]
    }).compile()

    service = module.get<UserDefinedDiceService>(UserDefinedDiceService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
