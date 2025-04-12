import { Test, TestingModule } from '@nestjs/testing';
import { CharacterController } from './character.controller';
import { CharacterService } from './character.service';
import { AuthService } from '../../auth/auth.service';

describe('CharacterController', () => {
  let controller: CharacterController;
  let characterService: CharacterService;
  let authService: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CharacterController],
      providers: [
        {
          provide: CharacterService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn()
          }
        },
        {
          provide: AuthService,
          useValue: {
            validateToken: jest.fn()
          }
        }
      ]
    }).compile();

    controller = module.get<CharacterController>(CharacterController);
    characterService = module.get<CharacterService>(CharacterService);
    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
