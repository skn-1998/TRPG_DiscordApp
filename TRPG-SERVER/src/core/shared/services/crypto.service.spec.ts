import { Test, TestingModule } from '@nestjs/testing'
import { CryptoService } from './crypto.service'
import { AppConfigService } from '../../../config/config.service'

const TEST_KEY = 'test-encryption-key-of-32-characters!!'

describe('CryptoService', () => {
  let service: CryptoService
  let appConfigGet: jest.Mock

  beforeEach(async () => {
    appConfigGet = jest.fn().mockReturnValue(TEST_KEY)

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CryptoService,
        {
          provide: AppConfigService,
          useValue: { get: appConfigGet }
        }
      ]
    }).compile()

    service = module.get<CryptoService>(CryptoService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should round trip encrypt/decrypt', () => {
    const text = 'discord-access-token-12345'
    const encrypted = service.encrypt(text)

    expect(encrypted).not.toBe(text)
    expect(service.decrypt(encrypted)).toBe(text)
    expect(appConfigGet).toHaveBeenCalledWith('security.discordTokenEncryptionKey')
  })

  it('should validate encrypted token', () => {
    const encrypted = service.encrypt('valid-token')

    expect(service.isValidEncryptedToken(encrypted)).toBe(true)
    expect(service.isValidEncryptedToken('invalid-token')).toBe(false)
  })

  it('should throw when encryption key is not configured', () => {
    appConfigGet.mockReturnValue('')

    expect(() => service.encrypt('text')).toThrow('DISCORD_TOKEN_ENCRYPTION_KEY environment variable is required')
  })
})
