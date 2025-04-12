import { Test, TestingModule } from '@nestjs/testing';
import { CharacterService } from './character.service';
import { CharacterModel } from './models/character.model';
import * as dynamoose from 'dynamoose';
import { UpdateCharacterDto } from './dto/update-character.dto';

describe('CharacterService', () => {
  let service: CharacterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CharacterService],
    }).compile();

    service = module.get<CharacterService>(CharacterService);

    // Dynamooseのモック設定
    jest.spyOn(dynamoose, 'model').mockImplementation(() => ({
      get: jest.fn(),
      query: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      save: jest.fn(),
    }) as never);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a character', async () => {
    const TRPGName = 'testTRPG';
    const characterName = 'testCharacter';
    const discordUserId = 'testDiscordId';
    const mockSave = jest.fn().mockResolvedValue({ TRPGName, characterName, discordUserId });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (CharacterModel).mockImplementation(() => ({ save: mockSave }));

    const result = await service.create(TRPGName, characterName, discordUserId);
    expect(result).toEqual({ TRPGName, characterName, discordUserId });
    expect(mockSave).toHaveBeenCalled();
  });

  it('should find characters having all', async () => {
    const discordUserId = 'testDiscordId';
    const mockQueryExec = jest.fn().mockResolvedValue([{ characterName: 'testCharacter1', discordUserId: 'testDiscordId' }]);
    (CharacterModel.query("DiscordUserId").eq(discordUserId).exec as jest.Mock).mockImplementation(mockQueryExec);

    const result = await service.findHavingAll(discordUserId);
    expect(result).toEqual([{ characterName: 'testCharacter1', discordUserId: 'testDiscordId' }]);
    expect(mockQueryExec).toHaveBeenCalled();
  });

  it('should find one character', async () => {
    const characterId = 'testCharacterId';
    const mockGet = jest.fn().mockResolvedValue({ characterName: 'testCharacter', characterId: characterId });
    (CharacterModel).mockImplementation(() => ({ get: mockGet }));

    const result = await service.findOne(characterId);
    expect(result).toEqual({ characterName: 'testCharacter', characterId: characterId });
    expect(mockGet).toHaveBeenCalledWith(characterId);
  });

  it('should update a character', async () => {
    const characterId = 'testCharacterId';
    const updateData: UpdateCharacterDto = { characterName: 'updatedCharacter' };
    const mockUpdate = jest.fn().mockResolvedValue({ characterName: 'updatedCharacter', characterId: characterId });
    (CharacterModel).mockImplementation(() => ({ update: mockUpdate }));

    const result = await service.update(characterId, updateData);
    expect(result).toEqual({ characterName: 'updatedCharacter', characterId: characterId });
    expect(mockUpdate).toHaveBeenCalledWith({ characterId }, updateData);
  });

  it('should remove a character', async () => {
    const characterId = 'testCharacterId';
    const mockDelete = jest.fn().mockResolvedValue(undefined);
    (CharacterModel).mockImplementation(() => ({ delete: mockDelete }));

    await service.remove(characterId);
    expect(mockDelete).toHaveBeenCalledWith(characterId);
  });
});
