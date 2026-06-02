/// <reference types="jest" />

import { Test, TestingModule } from '@nestjs/testing'
import { DiscordClientService } from './discord-client.service'
import { AppConfigService } from '../../config/config.service'

// discord.js をローカルモック化する。
// - Client は jest.fn() コンストラクタにし、once/on/login を持つスタブインスタンスを生成する。
// - Events は対象コードが参照する固定値を返す。
// - GatewayIntentBits はコンストラクタ内の intents 配列で参照されるため値を用意する。
const mockClientOnce = jest.fn()
const mockClientOn = jest.fn()
const mockClientLogin = jest.fn()

jest.mock('discord.js', () => {
  return {
    // new Client(options) されると once/on/login を持つスタブを返す
    Client: jest.fn().mockImplementation(() => ({
      once: mockClientOnce,
      on: mockClientOn,
      login: mockClientLogin
    })),
    Events: {
      ClientReady: 'ready',
      ChannelCreate: 'channelCreate'
    },
    GatewayIntentBits: {
      Guilds: 1,
      GuildMessages: 512,
      MessageContent: 32768,
      GuildMembers: 2
    }
  }
})

describe('DiscordClientService', () => {
  let service: DiscordClientService
  let configService: jest.Mocked<Pick<AppConfigService, 'get'>>

  const buildService = async (): Promise<DiscordClientService> => {
    configService = { get: jest.fn() }

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [DiscordClientService, { provide: AppConfigService, useValue: configService }]
    }).compile()

    return moduleRef.get(DiscordClientService)
  }

  beforeEach(async () => {
    jest.clearAllMocks()
    mockClientLogin.mockResolvedValue(undefined)
    service = await buildService()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('getClient', () => {
    it('コンストラクタで生成したクライアントインスタンスを返す', () => {
      // Act
      const client = service.getClient()

      // Assert: once/on/login を持つスタブが返る
      expect(client.once).toBe(mockClientOnce)
      expect(client.on).toBe(mockClientOn)
      expect(client.login).toBe(mockClientLogin)
    })
  })

  describe('initialize', () => {
    it('ClientReady と ChannelCreate のイベントハンドラを登録する', async () => {
      // Arrange
      configService.get.mockReturnValue('valid-token')

      // Act
      await service.initialize()

      // Assert: once で ClientReady、on で ChannelCreate を登録している
      expect(mockClientOnce).toHaveBeenCalledWith('ready', expect.any(Function))
      expect(mockClientOn).toHaveBeenCalledWith('channelCreate', expect.any(Function))
    })

    it('トークンが設定されていればそのトークンでloginする', async () => {
      // Arrange
      configService.get.mockReturnValue('valid-token')

      // Act
      await service.initialize()

      // Assert
      expect(configService.get).toHaveBeenCalledWith('discord.token')
      expect(mockClientLogin).toHaveBeenCalledWith('valid-token')
    })

    it('トークンが未設定（falsy）の場合はエラーを投げ、loginしない', async () => {
      // Arrange
      configService.get.mockReturnValue('')

      // Act & Assert
      await expect(service.initialize()).rejects.toThrow('Discord BOTトークンが設定されていません')
      expect(mockClientLogin).not.toHaveBeenCalled()
    })
  })

  describe('initializeClient', () => {
    it('初回呼び出しではinitializeを実行する', async () => {
      // Arrange
      configService.get.mockReturnValue('valid-token')

      // Act
      await service.initializeClient()

      // Assert: initialize 内の login が呼ばれている
      expect(mockClientLogin).toHaveBeenCalledTimes(1)
    })

    it('2回目の呼び出しでは即returnしinitializeを再実行しない', async () => {
      // Arrange
      configService.get.mockReturnValue('valid-token')

      // Act: 1回目で initialized=true になる
      await service.initializeClient()
      await service.initializeClient()

      // Assert: login は初回の1回のみ
      expect(mockClientLogin).toHaveBeenCalledTimes(1)
    })

    it('initializeが失敗した場合は再スローし、その後の再実行を許容する（initializedにしない）', async () => {
      // Arrange: 初回はトークン未設定で失敗させる
      configService.get.mockReturnValueOnce('')

      // Act & Assert: 1回目は再スローされる
      await expect(service.initializeClient()).rejects.toThrow('Discord BOTトークンが設定されていません')

      // Arrange: 2回目はトークンありで成功させる
      configService.get.mockReturnValue('valid-token')

      // Act: initialized=true になっていなければ initialize が再実行される
      await service.initializeClient()

      // Assert: 2回目で login が実行される
      expect(mockClientLogin).toHaveBeenCalledTimes(1)
      expect(mockClientLogin).toHaveBeenCalledWith('valid-token')
    })
  })

  describe('on', () => {
    it('client.onに委譲する', () => {
      // Arrange
      const handler = jest.fn()

      // Act
      service.on('customEvent', handler)

      // Assert
      expect(mockClientOn).toHaveBeenCalledWith('customEvent', handler)
    })
  })

  describe('once', () => {
    it('client.onceに委譲する', () => {
      // Arrange
      const handler = jest.fn()

      // Act
      service.once('customEvent', handler)

      // Assert
      expect(mockClientOnce).toHaveBeenCalledWith('customEvent', handler)
    })
  })
})
