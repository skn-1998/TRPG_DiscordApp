import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { TRPGUserModel } from './models/user.model';
import * as dynamoose from 'dynamoose';
import { getModelToken } from '@nestjs/dynamoose';

describe('UserService', () => {
  let service: UserService;

  const mockUserModel = {
    create: jest.fn(),
    update: jest.fn(),
    get: jest.fn().mockReturnThis(),
    exec: jest.fn()
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getModelToken('User'),
          useValue: mockUserModel
        }
      ]
    }).compile();

    service = module.get<UserService>(UserService);

    // Dynamooseのモック設定
    jest.spyOn(dynamoose, 'model').mockImplementation(() => ({
      get: jest.fn(),
      scan: jest.fn().exec(),
      update: jest.fn(),
      delete: jest.fn(),
      save: jest.fn(),
    }) as any);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a user', async () => {
    const name = 'testUser';
    const discordUserId = 'testDiscordId';
    const mockSave = jest.fn().mockResolvedValue({ name, DiscordUserId: discordUserId });
    (TRPGUserModel as any).mockImplementation(() => ({ save: mockSave }));

    const result = await service.create(name, discordUserId);
    expect(result).toEqual({ name, DiscordUserId: discordUserId });
    expect(mockSave).toHaveBeenCalled();
  });

  it('should find all users', async () => {
    const mockScanExec = jest.fn().mockResolvedValue([{ name: 'testUser1', DiscordUserId: 'testDiscordId1' }]);
    (TRPGUserModel.scan().exec as jest.Mock).mockImplementation(mockScanExec);

    const result = await service.findAll();
    expect(result).toEqual([{ name: 'testUser1', DiscordUserId: 'testDiscordId1' }]);
    expect(mockScanExec).toHaveBeenCalled();
  });

  it('should find one user', async () => {
    const discordUserId = 'testDiscordId';
    const mockGet = jest.fn().mockResolvedValue({ name: 'testUser', DiscordUserId: discordUserId });
    (TRPGUserModel as any).mockImplementation(() => ({ get: mockGet }));

    const result = await service.findOne(discordUserId);
    expect(result).toEqual({ name: 'testUser', DiscordUserId: discordUserId });
    expect(mockGet).toHaveBeenCalledWith({DiscordUserId:discordUserId});
  });

  it('should update a user', async () => {
    const userId = 'testUserId';
    const updateData = { name: 'updatedUser' };
    const mockUpdate = jest.fn().mockResolvedValue({ name: 'updatedUser', DiscordUserId: 'testDiscordId' });
    (TRPGUserModel as any).mockImplementation(() => ({ update: mockUpdate }));

    const result = await service.update(userId, updateData);
    expect(result).toEqual({ name: 'updatedUser', DiscordUserId: 'testDiscordId' });
    expect(mockUpdate).toHaveBeenCalledWith({ userId }, updateData);
  });

  it('should remove a user', async () => {
    const userId = 'testUserId';
    const mockDelete = jest.fn().mockResolvedValue(undefined);
    (TRPGUserModel as any).mockImplementation(() => ({ delete: mockDelete }));

    await service.remove(userId);
    expect(mockDelete).toHaveBeenCalledWith(userId);
  });
});
