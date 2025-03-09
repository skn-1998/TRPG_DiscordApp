import { Test, TestingModule } from '@nestjs/testing'
import { CharaInfoButtonService } from './chara-info-button.service'

describe('CharaInfoButtonService', () => {
  let service: CharaInfoButtonService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CharaInfoButtonService]
    }).compile()

    service = module.get<CharaInfoButtonService>(CharaInfoButtonService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
