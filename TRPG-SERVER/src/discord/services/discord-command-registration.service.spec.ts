import { Test } from '@nestjs/testing'
import { DiscordCommandRegistrationService } from './discord-command-registration.service'
import { CommandManagerService } from './command-manager.service'
import { CommandsService } from '../commands/commands.service'
import { AppConfigService } from '../../config/config.service'

/**
 * DiscordCommandRegistrationService は onModuleInit で CommandsService のコマンドを
 * CommandManagerService に登録し、本番環境では Discord API にも登録する委譲サービス。
 * 依存（commandManager / commandsService / appConfig）を mock し、
 * test 環境スキップ分岐・コマンド形式バリデーション分岐・空配列分岐を検証する。
 */
describe('DiscordCommandRegistrationService', () => {
  let service: DiscordCommandRegistrationService
  let commandManager: jest.Mocked<Pick<CommandManagerService, 'registerCommand' | 'registerCommandsToDiscord'>>
  let commandsService: jest.Mocked<Pick<CommandsService, 'getCommands'>>
  let appConfig: jest.Mocked<Pick<AppConfigService, 'get'>>

  // toJSON を持つ正常なコマンドを生成
  const buildCommand = (name: string) =>
    ({
      data: { name, toJSON: jest.fn().mockReturnValue({ name }) },
      execute: jest.fn()
    }) as never

  // config.get の戻り値を制御するヘルパー
  const setConfig = (environment: string, testMockDiscord: boolean) => {
    appConfig.get.mockImplementation((path: string) => {
      if (path === 'app.environment') return environment as never
      if (path === 'discord.testMockDiscord') return testMockDiscord as never
      return undefined as never
    })
  }

  beforeEach(async () => {
    commandManager = {
      registerCommand: jest.fn(),
      registerCommandsToDiscord: jest.fn().mockResolvedValue(undefined)
    }
    commandsService = { getCommands: jest.fn().mockReturnValue([]) }
    appConfig = { get: jest.fn() }

    const moduleRef = await Test.createTestingModule({
      providers: [
        DiscordCommandRegistrationService,
        { provide: CommandManagerService, useValue: commandManager },
        { provide: CommandsService, useValue: commandsService },
        { provide: AppConfigService, useValue: appConfig }
      ]
    }).compile()

    service = moduleRef.get(DiscordCommandRegistrationService)
  })

  describe('onModuleInit', () => {
    it('test 環境ではコマンドをローカル登録するが Discord API 登録はスキップする', async () => {
      // Arrange
      setConfig('test', false)
      commandsService.getCommands.mockReturnValue([buildCommand('dice')])

      // Act
      await service.onModuleInit()

      // Assert
      expect(commandManager.registerCommand).toHaveBeenCalledTimes(1)
      expect(commandManager.registerCommandsToDiscord).not.toHaveBeenCalled()
    })

    it('testMockDiscord フラグが有効でも Discord API 登録はスキップする', async () => {
      // Arrange
      setConfig('development', true)
      commandsService.getCommands.mockReturnValue([buildCommand('dice')])

      // Act
      await service.onModuleInit()

      // Assert
      expect(commandManager.registerCommandsToDiscord).not.toHaveBeenCalled()
    })

    it('本番環境ではローカル登録に加えて Discord API 登録も実行する', async () => {
      // Arrange
      setConfig('production', false)
      commandsService.getCommands.mockReturnValue([buildCommand('dice')])

      // Act
      await service.onModuleInit()

      // Assert
      expect(commandManager.registerCommand).toHaveBeenCalledTimes(1)
      expect(commandManager.registerCommandsToDiscord).toHaveBeenCalledTimes(1)
    })
  })

  describe('registerCommands（onModuleInit 経由）', () => {
    beforeEach(() => setConfig('test', false))

    it('コマンドが空配列の場合は何も登録しない', async () => {
      // Arrange
      commandsService.getCommands.mockReturnValue([])

      // Act
      await service.onModuleInit()

      // Assert
      expect(commandManager.registerCommand).not.toHaveBeenCalled()
    })

    it('data または data.name を欠くコマンドはスキップする', async () => {
      // Arrange: name を欠く不正コマンドと正常コマンドを混在
      const invalid = { data: { toJSON: jest.fn() }, execute: jest.fn() } as never
      commandsService.getCommands.mockReturnValue([invalid, buildCommand('valid')])

      // Act
      await service.onModuleInit()

      // Assert: 正常な 1 件のみ登録される
      expect(commandManager.registerCommand).toHaveBeenCalledTimes(1)
      expect(commandManager.registerCommand).toHaveBeenCalledWith(expect.objectContaining({ name: 'valid' }))
    })

    it('toJSON を持たないコマンドは登録しない', async () => {
      // Arrange: toJSON が無い data
      const noToJson = { data: { name: 'x' }, execute: jest.fn() } as never
      commandsService.getCommands.mockReturnValue([noToJson])

      // Act
      await service.onModuleInit()

      // Assert
      expect(commandManager.registerCommand).not.toHaveBeenCalled()
    })

    it('登録される DiscordCommand は name と一意な id・execute を持つ', async () => {
      // Arrange
      commandsService.getCommands.mockReturnValue([buildCommand('dice')])

      // Act
      await service.onModuleInit()

      // Assert
      const registered = commandManager.registerCommand.mock.calls[0][0]
      expect(registered.name).toBe('dice')
      expect(typeof registered.id).toBe('string')
      expect(registered.id.length).toBeGreaterThan(0)
      expect(typeof registered.execute).toBe('function')
    })

    it('1 コマンドの登録中に例外が発生しても他コマンドの登録を継続する', async () => {
      // Arrange: 1 件目で registerCommand が例外、2 件目は成功
      commandManager.registerCommand
        .mockImplementationOnce(() => {
          throw new Error('register failed')
        })
        .mockImplementationOnce(() => undefined)
      commandsService.getCommands.mockReturnValue([buildCommand('first'), buildCommand('second')])

      // Act & Assert: 例外を握りつぶし最後まで処理
      await expect(service.onModuleInit()).resolves.toBeUndefined()
      expect(commandManager.registerCommand).toHaveBeenCalledTimes(2)
    })
  })
})
