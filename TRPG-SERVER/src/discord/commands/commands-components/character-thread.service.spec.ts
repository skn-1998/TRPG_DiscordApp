import { Test, TestingModule } from '@nestjs/testing'
import { CharacterThreadService } from './character-thread.service'

describe('CharacterThreadService', () => {
  let service: CharacterThreadService

  // CharacterChannelService のモック
  const mockCharacterChannelService = {
    getAndSetChannelOption: jest.fn().mockReturnValue({
      setCustomId: jest.fn().mockReturnThis(),
      setPlaceholder: jest.fn().mockReturnThis(),
      addOptions: jest.fn().mockReturnThis()
    })
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: CharacterThreadService,
          useValue: {
            data: {
              setName: jest.fn().mockReturnThis(),
              setDescription: jest.fn().mockReturnThis()
            },
            execute: jest.fn().mockResolvedValue(undefined)
          }
        }
      ]
    }).compile()

    service = module.get<CharacterThreadService>(CharacterThreadService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
