import { Test, TestingModule } from '@nestjs/testing'
import { CharacterChannelService } from './character-channel.service'

describe('CharacterChannelService', () => {
  let service: CharacterChannelService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CharacterChannelService]
    }).compile()

    service = module.get<CharacterChannelService>(CharacterChannelService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
