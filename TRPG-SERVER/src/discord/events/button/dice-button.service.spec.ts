import { Test, TestingModule } from '@nestjs/testing'
import { DiseButtonService } from './dise-button.service'

describe('DiseButtonService', () => {
  let service: DiseButtonService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DiseButtonService]
    }).compile()

    service = module.get<DiseButtonService>(DiseButtonService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
