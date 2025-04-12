import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { CustomHttpService } from './http.service';
import { JwtService } from '@nestjs/jwt';
import { HttpServiceInterface } from './interfaces/http.interface';

describe('AuthService', () => {
  let service: AuthService;
  let httpService: HttpServiceInterface;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: CustomHttpService,
          useValue: {
            post: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    httpService = module.get<CustomHttpService>(CustomHttpService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should authenticate with valid code', async () => {
    const code = 'valid_code';
    const mockResponse = { access_token: 'mock_token', refresh_token: 'mock_refresh_token' };
    (httpService.post as jest.Mock).mockReturnValue(Promise.resolve({ data: mockResponse }));
    (jwtService.sign as jest.Mock).mockReturnValue('mock_jwt');

    const result = await service.authenticate(code);
    expect(result).toEqual(mockResponse);
    expect(httpService.post).toHaveBeenCalled();
  });

  it('should throw error with invalid code', async () => {
    const code = 'invalid_code';
    (httpService.post as jest.Mock).mockReturnValue(Promise.reject(new Error('Authentication failed')));

    await expect(service.authenticate(code)).rejects.toThrowError('Failed to authenticate: Error: Authentication failed');
    expect(httpService.post).toHaveBeenCalled();
  });
});
