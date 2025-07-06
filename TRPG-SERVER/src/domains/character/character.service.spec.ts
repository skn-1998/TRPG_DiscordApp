/// <reference types="jest" />

import { Test, TestingModule } from '@nestjs/testing'
import { CharacterService } from './character.service'
import { CharacterRepository } from './repositories/character.repository'
import { Character } from './models/character.model'
import { PartialInputCharacterDto } from './dto/create-character.dto'
import { UserService } from '../user/user.service'

describe('CharacterService', () => {
  let service: CharacterService
  let repository: jest.Mocked<CharacterRepository>
  let userService: jest.Mocked<UserService>

  const mockCharacterDto: PartialInputCharacterDto = {
    characterId: 'test-character-001',
    characterName: 'テストキャラクター',
    gameSystemId: 'test-system',
    discordUserId: 'test-discord-user',
    discordChannelId: 'test-channel-123',
    status: { HP: 100, MP: 50 },
    skill: { 魔法: 80, 剣術: 70 },
    parameter: { STR: 15, DEX: 12 },
    item: { 魔法の剣: '1d8+2ダメージ' },
    description: { 年齢: 25, 職業: '冒険者' }
  }

  const mockCharacter: Character = {
    characterId: 'test-character-001',
    characterName: 'テストキャラクター',
    gameSystemId: 'test-system',
    discordUserId: 'test-discord-user',
    discordChannelId: 'test-channel-123',
    status: { HP: 100, MP: 50 },
    skill: { 魔法: 80, 剣術: 70 },
    parameter: { STR: 15, DEX: 12 },
    item: { 魔法の剣: '1d8+2ダメージ' },
    description: { 年齢: 25, 職業: '冒険者' }
  }

  beforeEach(async () => {
    // CharacterRepository用のモックを作成
    const characterRepositoryMock = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      findByChannelId: jest.fn(),
      removeByChannelId: jest.fn(),
      findByUserId: jest.fn(),
      search: jest.fn()
    }

    // UserService用のモックを作成
    const userServiceMock = {
      addCharacterId: jest.fn(),
      removeCharacterId: jest.fn(),
      create: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      findAll: jest.fn()
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CharacterService,
        {
          provide: CharacterRepository,
          useValue: characterRepositoryMock
        },
        {
          provide: UserService,
          useValue: userServiceMock
        }
      ]
    }).compile()

    service = module.get<CharacterService>(CharacterService)
    repository = module.get(CharacterRepository) as jest.Mocked<CharacterRepository>
    userService = module.get(UserService) as jest.Mocked<UserService>
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should create a character', async () => {
    repository.create.mockResolvedValue(mockCharacter)

    const result = await service.create(mockCharacterDto)

    expect(repository.create).toHaveBeenCalled()
    expect(result).toEqual(mockCharacter)
  })

  it('should find character by channel ID', async () => {
    repository.findByChannelId.mockResolvedValue(mockCharacter)

    const result = await service.findByChannelId('test-channel-123')

    expect(repository.findByChannelId).toHaveBeenCalledWith('test-channel-123')
    expect(result).toEqual(mockCharacter)
  })
})
