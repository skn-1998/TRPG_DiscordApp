import { Test, TestingModule } from '@nestjs/testing'
import { SelectGameSystemService } from './select-game-system.service'

describe('SelectGameSystemService', () => {
  let service: SelectGameSystemService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SelectGameSystemService]
    }).compile()

    service = module.get<SelectGameSystemService>(SelectGameSystemService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
