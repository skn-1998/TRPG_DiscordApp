/// <reference types="jest" />

import { MessageFlags } from 'discord.js'
import { Test, TestingModule } from '@nestjs/testing'
import { Logger } from '@nestjs/common'
import { CommandManagerService } from './command-manager.service'
import { DiscordClientService } from './discord-client.service'
import { CommandsService } from '../commands/commands.service'
import { DiscordCommand } from '../interfaces/discord-interaction-types.interface'
import { AppConfigService } from '../../config/config.service'

// Discord.js のうち、本テストで触れる部分だけをモックする。
// REST はコンストラクタで実体化されるため、put / setToken を jest.fn でスタブする。
const mockRestPut = jest.fn().mockResolvedValue(undefined)
const mockSetToken = jest.fn().mockReturnThis()

jest.mock('discord.js', () => ({
  REST: jest.fn().mockImplementation(() => ({
    setToken: mockSetToken,
    put: mockRestPut
  })),
  Routes: {
    applicationGuildCommands: jest.fn((appId: string, guildId: string) => `guild-route:${appId}:${guildId}`),
    applicationCommands: jest.fn((appId: string) => `global-route:${appId}`)
  },
  // C-6: 非推奨 ephemeral オプション → flags: MessageFlags.Ephemeral 置換に伴い必須（実 discord.js の数値に一致）
  MessageFlags: {
    Ephemeral: 64
  }
}))

/**
 * テスト用の DiscordCommand を生成するファクトリ。
 * data.name はコマンドレジストリのキー、data.toJSON は登録ペイロード変換に使われる。
 */
const createMockCommand = (name: string): DiscordCommand => {
  const json = { name, description: `${name} の説明` }
  return {
    name,
    data: {
      name,
      toJSON: jest.fn().mockReturnValue(json)
    },
    execute: jest.fn().mockResolvedValue(undefined)
  } as unknown as DiscordCommand
}

describe('CommandManagerService', () => {
  let service: CommandManagerService
  let commandsService: jest.Mocked<CommandsService>
  let mockLogger: jest.Mocked<Logger>

  // AppConfigService.get の既定の戻り値。テストごとに上書きできるようにマップで持つ。
  const configValues: Record<string, string | undefined> = {
    'discord.token': 'test-token',
    'discord.applicationId': 'app-123',
    'discord.guildId': undefined
  }

  const createService = async (): Promise<CommandManagerService> => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommandManagerService,
        {
          provide: DiscordClientService,
          useValue: {
            getClient: jest.fn()
          }
        },
        {
          provide: AppConfigService,
          useValue: {
            get: jest.fn((key: string) => configValues[key])
          }
        },
        {
          provide: CommandsService,
          useValue: {
            autocomplete: jest.fn().mockResolvedValue(undefined)
          }
        }
      ]
    }).compile()

    const created = module.get<CommandManagerService>(CommandManagerService)
    commandsService = module.get(CommandsService)

    // Logger 出力はテスト対象の関心事ではないため差し替えて検証可能にする。
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn()
    } as unknown as jest.Mocked<Logger>
    ;(created as any).logger = mockLogger

    return created
  }

  beforeEach(async () => {
    // 既定値に戻す
    configValues['discord.token'] = 'test-token'
    configValues['discord.applicationId'] = 'app-123'
    configValues['discord.guildId'] = undefined

    service = await createService()
  })

  afterEach(() => {
    jest.clearAllMocks()
    jest.restoreAllMocks()
  })

  describe('コンストラクタ', () => {
    it('Discord token を使って REST を初期化する', () => {
      expect(mockSetToken).toHaveBeenCalledWith('test-token')
    })

    it('Discord token が未設定の場合は例外を投げる', async () => {
      configValues['discord.token'] = undefined

      await expect(createService()).rejects.toThrow('Discord token is not configured')
    })
  })

  describe('registerCommand / getCommand', () => {
    it('登録したコマンドを名前で取得できる', () => {
      const command = createMockCommand('roll')

      service.registerCommand(command)

      expect(service.getCommand('roll')).toBe(command)
    })

    it('レジストリのキーは data.name を使う', () => {
      // インスタンスの name と data.name が異なるケースでも data.name で引ける
      const command = createMockCommand('actual-name')
      ;(command as any).name = 'display-name'

      service.registerCommand(command)

      expect(service.getCommand('actual-name')).toBe(command)
      expect(service.getCommand('display-name')).toBeUndefined()
    })

    it('同名コマンドを登録すると後勝ちで上書きされる', () => {
      const first = createMockCommand('dup')
      const second = createMockCommand('dup')

      service.registerCommand(first)
      service.registerCommand(second)

      expect(service.getCommand('dup')).toBe(second)
      expect(service.getCommand('dup')).not.toBe(first)
    })

    it('未登録のコマンド名を取得すると undefined を返す', () => {
      expect(service.getCommand('unknown')).toBeUndefined()
    })

    it('登録時にログを出力する', () => {
      const command = createMockCommand('roll')

      service.registerCommand(command)

      expect(mockLogger.log).toHaveBeenCalledWith('コマンド「roll」を登録しています')
    })
  })

  describe('getCommands', () => {
    it('登録済みのコマンドを配列で返す', () => {
      const a = createMockCommand('a')
      const b = createMockCommand('b')
      service.registerCommand(a)
      service.registerCommand(b)

      const commands = service.getCommands()

      expect(commands).toHaveLength(2)
      expect(commands).toEqual(expect.arrayContaining([a, b]))
    })

    it('未登録の状態では空配列を返す', () => {
      expect(service.getCommands()).toEqual([])
    })

    it('同名で上書きすると重複は1件にまとまる', () => {
      service.registerCommand(createMockCommand('dup'))
      service.registerCommand(createMockCommand('dup'))

      expect(service.getCommands()).toHaveLength(1)
    })
  })

  describe('handleAutocompleteInteraction', () => {
    it('CommandsService.autocomplete に委譲する', async () => {
      const interaction = { commandName: 'roll' } as any

      await service.handleAutocompleteInteraction(interaction)

      expect(commandsService.autocomplete).toHaveBeenCalledWith(interaction)
    })
  })

  describe('handleCommandInteraction', () => {
    it('登録済みコマンドの execute を呼び出す', async () => {
      const command = createMockCommand('roll')
      service.registerCommand(command)

      const interaction = {
        commandName: 'roll',
        replied: false,
        deferred: false,
        reply: jest.fn().mockResolvedValue(undefined),
        followUp: jest.fn().mockResolvedValue(undefined)
      } as any

      await service.handleCommandInteraction(interaction)

      expect(command.execute).toHaveBeenCalledWith(interaction)
      expect(interaction.reply).not.toHaveBeenCalled()
    })

    it('未登録コマンドの場合は警告し ephemeral で返信する', async () => {
      const interaction = {
        commandName: 'unknown',
        replied: false,
        deferred: false,
        reply: jest.fn().mockResolvedValue(undefined),
        followUp: jest.fn().mockResolvedValue(undefined)
      } as any

      await service.handleCommandInteraction(interaction)

      expect(mockLogger.warn).toHaveBeenCalledWith('未登録のコマンド「unknown」が呼び出されました')
      expect(interaction.reply).toHaveBeenCalledWith({
        content: '不明なコマンドです。管理者に問い合わせてください。',
        flags: MessageFlags.Ephemeral
      })
    })

    it('未返信時に execute が失敗したら reply でエラーを返す', async () => {
      const command = createMockCommand('roll')
      ;(command.execute as jest.Mock).mockRejectedValueOnce(new Error('boom'))
      service.registerCommand(command)

      const interaction = {
        commandName: 'roll',
        replied: false,
        deferred: false,
        reply: jest.fn().mockResolvedValue(undefined),
        followUp: jest.fn().mockResolvedValue(undefined)
      } as any

      await service.handleCommandInteraction(interaction)

      expect(interaction.reply).toHaveBeenCalledWith({
        content: 'コマンドの実行中にエラーが発生しました。',
        flags: MessageFlags.Ephemeral
      })
      expect(interaction.followUp).not.toHaveBeenCalled()
      expect(mockLogger.error).toHaveBeenCalledWith('boom')
    })

    it('既に返信済みの場合は followUp でエラーを返す', async () => {
      const command = createMockCommand('roll')
      ;(command.execute as jest.Mock).mockRejectedValueOnce(new Error('boom'))
      service.registerCommand(command)

      const interaction = {
        commandName: 'roll',
        replied: true,
        deferred: false,
        reply: jest.fn().mockResolvedValue(undefined),
        followUp: jest.fn().mockResolvedValue(undefined)
      } as any

      await service.handleCommandInteraction(interaction)

      expect(interaction.followUp).toHaveBeenCalledWith({
        content: 'コマンドの実行中にエラーが発生しました。',
        flags: MessageFlags.Ephemeral
      })
      expect(interaction.reply).not.toHaveBeenCalled()
    })

    it('deferred の場合は editReply で placeholder をエラーへ置換する', async () => {
      const command = createMockCommand('roll')
      ;(command.execute as jest.Mock).mockRejectedValueOnce(new Error('boom'))
      service.registerCommand(command)

      const interaction = {
        commandName: 'roll',
        replied: false,
        deferred: true,
        reply: jest.fn().mockResolvedValue(undefined),
        editReply: jest.fn().mockResolvedValue(undefined),
        followUp: jest.fn().mockResolvedValue(undefined)
      } as any

      await service.handleCommandInteraction(interaction)

      expect(interaction.editReply).toHaveBeenCalledWith({
        content: 'コマンドの実行中にエラーが発生しました。'
      })
      expect(interaction.followUp).not.toHaveBeenCalled()
      expect(interaction.reply).not.toHaveBeenCalled()
    })
  })

  describe('registerCommandsToDiscord', () => {
    it('登録コマンドが無い場合は警告し REST を呼ばない', async () => {
      await service.registerCommandsToDiscord()

      expect(mockLogger.warn).toHaveBeenCalledWith('登録するコマンドがありません')
      expect(mockRestPut).not.toHaveBeenCalled()
    })

    it('guildId が無い場合はグローバルコマンドとして登録する', async () => {
      const command = createMockCommand('roll')
      service.registerCommand(command)

      await service.registerCommandsToDiscord()

      // data.toJSON() の結果が body に渡る
      expect(command.data.toJSON).toHaveBeenCalled()
      expect(mockRestPut).toHaveBeenCalledWith('global-route:app-123', {
        body: [{ name: 'roll', description: 'roll の説明' }]
      })
    })

    it('guildId がある場合はギルド専用コマンドとして登録する', async () => {
      configValues['discord.guildId'] = 'guild-999'
      service = await createService()
      const command = createMockCommand('roll')
      service.registerCommand(command)

      await service.registerCommandsToDiscord()

      expect(mockRestPut).toHaveBeenCalledWith('guild-route:app-123:guild-999', {
        body: [{ name: 'roll', description: 'roll の説明' }]
      })
    })

    it('複数コマンドを toJSON 変換して body にまとめる', async () => {
      service.registerCommand(createMockCommand('a'))
      service.registerCommand(createMockCommand('b'))

      await service.registerCommandsToDiscord()

      const body = mockRestPut.mock.calls[0][1].body
      expect(body).toHaveLength(2)
      expect(body).toEqual(
        expect.arrayContaining([
          { name: 'a', description: 'a の説明' },
          { name: 'b', description: 'b の説明' }
        ])
      )
    })

    it('applicationId が無い場合はエラーを投げ REST を呼ばない', async () => {
      configValues['discord.applicationId'] = undefined
      service = await createService()
      service.registerCommand(createMockCommand('roll'))

      await expect(service.registerCommandsToDiscord()).rejects.toThrow('Discord Application IDが設定されていません')
      expect(mockRestPut).not.toHaveBeenCalled()
    })

    it('REST 登録が失敗したらエラーを再スローしログを出力する', async () => {
      service.registerCommand(createMockCommand('roll'))
      mockRestPut.mockRejectedValueOnce(new Error('rest failed'))

      await expect(service.registerCommandsToDiscord()).rejects.toThrow('rest failed')
      expect(mockLogger.error).toHaveBeenCalledWith('コマンドの登録に失敗しました')
      expect(mockLogger.error).toHaveBeenCalledWith('rest failed')
    })
  })
})
