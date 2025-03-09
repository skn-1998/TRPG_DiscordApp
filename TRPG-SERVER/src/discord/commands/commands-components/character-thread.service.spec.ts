import { Test, TestingModule } from '@nestjs/testing'
import { CharacterThreadService } from './character-thread.service'

describe('CharacterThreadService', () => {
  let service: CharacterThreadService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CharacterThreadService]
    }).compile()

    service = module.get<CharacterThreadService>(CharacterThreadService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
