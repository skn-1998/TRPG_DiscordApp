import { createMockChatInputInteraction } from '@discord-test-utils'
import type { CommandInteraction, ChatInputCommandInteraction } from 'discord.js'
import { BaseCommandService } from './base-command.service'
import type { TypedEventService } from '../../core/events/typed-event.service'
import { DiscordErrorReporter } from '../utils/discord-error-reporter'

/**
 * BaseCommandService は抽象基底。共通の interaction 前後処理・存在チェック・
 * エラーハンドリング委譲を提供する。テストでは protected メソッドを公開する
 * 最小の具象サブクラスを定義して振る舞いを検証する。
 * 副作用の境界:
 *   - DiscordErrorReporter.handleDiscordCommandError（エラー応答委譲） → jest.spyOn でモック
 *   - logger（出力） → 検証対象外（実装詳細）
 * interaction は @discord-test-utils のファクトリで生成する（手動 as any モック禁止）。
 */
class TestableCommandService extends BaseCommandService {
  constructor(typedEventService: TypedEventService) {
    super(typedEventService, 'TestCommand')
  }

  // protected メソッドをテストから呼べるよう公開ラップ
  public callHandleInteractionError(interaction: CommandInteraction, error: unknown, context: string): Promise<void> {
    return this.handleInteractionError(interaction, error, context)
  }

  public callPreExecute(interaction: CommandInteraction): Promise<boolean> {
    return this.preExecute(interaction)
  }

  public callPostExecute(interaction: CommandInteraction): Promise<void> {
    return this.postExecute(interaction)
  }

  public callValidateChannel(interaction: CommandInteraction): boolean {
    return this.validateChannel(interaction)
  }

  public callValidateGuild(interaction: CommandInteraction): boolean {
    return this.validateGuild(interaction)
  }
}

const asCommandInteraction = (interaction: ChatInputCommandInteraction): CommandInteraction =>
  interaction as unknown as CommandInteraction

describe('BaseCommandService', () => {
  let typedEventService: jest.Mocked<Pick<TypedEventService, 'emit'>>
  let service: TestableCommandService

  beforeEach(() => {
    jest.clearAllMocks()
    typedEventService = { emit: jest.fn() }
    service = new TestableCommandService(typedEventService as unknown as TypedEventService)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('handleInteractionError', () => {
    it('DiscordErrorReporter.handleDiscordCommandError へ error/interaction/コンテキストを委譲する', async () => {
      const spy = jest.spyOn(DiscordErrorReporter, 'handleDiscordCommandError').mockResolvedValue(undefined)
      const interaction = createMockChatInputInteraction({ commandName: 'dice' })
      const error = new Error('boom')

      await service.callHandleInteractionError(asCommandInteraction(interaction), error, 'executeDice')

      expect(spy).toHaveBeenCalledWith(error, interaction, {
        action: 'executeDice',
        additionalData: { commandName: 'dice' }
      })
      expect(spy).toHaveBeenCalledTimes(1)
    })
  })

  describe('preExecute', () => {
    it('ChatInputCommand なら true を返す', async () => {
      const interaction = createMockChatInputInteraction({ commandName: 'dice' })

      const result = await service.callPreExecute(asCommandInteraction(interaction))

      expect(result).toBe(true)
    })

    it('ChatInputCommand でなければ false を返す', async () => {
      const interaction = createMockChatInputInteraction()
      ;(interaction.isChatInputCommand as unknown as jest.Mock).mockReturnValue(false)

      const result = await service.callPreExecute(asCommandInteraction(interaction))

      expect(result).toBe(false)
    })
  })

  describe('postExecute', () => {
    it('例外を投げずに完了する', async () => {
      const interaction = createMockChatInputInteraction({ commandName: 'dice' })

      await expect(service.callPostExecute(asCommandInteraction(interaction))).resolves.toBeUndefined()
    })
  })

  describe('validateChannel', () => {
    it('channel が存在すれば true を返す', () => {
      const interaction = createMockChatInputInteraction()

      expect(service.callValidateChannel(asCommandInteraction(interaction))).toBe(true)
    })

    it('channel が null なら false を返す', () => {
      const interaction = createMockChatInputInteraction({ base: { channel: null } })

      expect(service.callValidateChannel(asCommandInteraction(interaction))).toBe(false)
    })
  })

  describe('validateGuild', () => {
    it('guild が存在すれば true を返す', () => {
      const interaction = createMockChatInputInteraction()

      expect(service.callValidateGuild(asCommandInteraction(interaction))).toBe(true)
    })

    it('guild が null なら false を返す', () => {
      const interaction = createMockChatInputInteraction({ base: { guild: null } })

      expect(service.callValidateGuild(asCommandInteraction(interaction))).toBe(false)
    })
  })
})
