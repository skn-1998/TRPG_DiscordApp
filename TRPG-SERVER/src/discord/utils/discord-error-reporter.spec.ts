import {
  AutocompleteInteraction,
  ButtonInteraction,
  CommandInteraction,
  MessageContextMenuCommandInteraction,
  MessageFlags,
  ModalSubmitInteraction,
  SelectMenuInteraction
} from 'discord.js'
import { ErrorContext, ErrorHandler } from '../../core/http/error-handler'
import { DiscordErrorReporter } from './discord-error-reporter'

type InteractionMock = {
  user: { id: string }
  guild: { id: string }
  channel: { id: string }
  id: string
  replied: boolean
  deferred: boolean
  isAutocomplete: jest.Mock
  isChatInputCommand: jest.Mock
  respond: jest.Mock
  reply: jest.Mock
  editReply: jest.Mock
  followUp: jest.Mock
}

const createInteraction = (overrides: Partial<InteractionMock> = {}): InteractionMock => ({
  user: { id: 'user-1' },
  guild: { id: 'guild-1' },
  channel: { id: 'channel-1' },
  id: 'interaction-1',
  replied: false,
  deferred: false,
  isAutocomplete: jest.fn().mockReturnValue(false),
  isChatInputCommand: jest.fn().mockReturnValue(true),
  respond: jest.fn().mockResolvedValue(undefined),
  reply: jest.fn().mockResolvedValue(undefined),
  editReply: jest.fn().mockResolvedValue(undefined),
  followUp: jest.fn().mockResolvedValue(undefined),
  ...overrides
})

describe('DiscordErrorReporter', () => {
  const context: ErrorContext = { action: 'test-discord-action' }
  let mockLogger: { error: jest.Mock }

  beforeEach(() => {
    mockLogger = { error: jest.fn() }
    ;(DiscordErrorReporter as any).logger = mockLogger
    jest.spyOn(ErrorHandler, 'logError').mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('handleDiscordError', () => {
    it('未応答 interaction には ephemeral reply を送る', async () => {
      const interaction = createInteraction()

      await DiscordErrorReporter.handleDiscordError(
        new Error('discord failure'),
        interaction as unknown as ButtonInteraction,
        context,
        'user message'
      )

      expect(interaction.reply).toHaveBeenCalledWith({
        content: 'user message',
        flags: MessageFlags.Ephemeral
      })
      expect(interaction.editReply).not.toHaveBeenCalled()
      expect(interaction.followUp).not.toHaveBeenCalled()
    })

    it('deferred interaction では editReply で placeholder を解消する', async () => {
      const interaction = createInteraction({ deferred: true })

      await DiscordErrorReporter.handleDiscordError(
        new Error('discord failure'),
        interaction as unknown as ModalSubmitInteraction,
        context,
        'user message'
      )

      expect(interaction.editReply).toHaveBeenCalledWith({ content: 'user message' })
      expect(interaction.reply).not.toHaveBeenCalled()
      expect(interaction.followUp).not.toHaveBeenCalled()
    })

    it('replied interaction には ephemeral followUp を送る', async () => {
      const interaction = createInteraction({ replied: true, deferred: true })

      await DiscordErrorReporter.handleDiscordError(
        new Error('discord failure'),
        interaction as unknown as SelectMenuInteraction,
        context,
        'user message'
      )

      expect(interaction.followUp).toHaveBeenCalledWith({
        content: 'user message',
        flags: MessageFlags.Ephemeral
      })
      expect(interaction.reply).not.toHaveBeenCalled()
      expect(interaction.editReply).not.toHaveBeenCalled()
    })

    it('通知失敗をログに残し、呼び出し元へ再スローしない', async () => {
      const interaction = createInteraction({
        reply: jest.fn().mockRejectedValue(new Error('reply failed'))
      })

      await expect(
        DiscordErrorReporter.handleDiscordError(
          new Error('discord failure'),
          interaction as unknown as ButtonInteraction,
          context,
          'user message'
        )
      ).resolves.toBeUndefined()

      expect(mockLogger.error).toHaveBeenCalledWith('Discord エラー応答に失敗', {
        originalError: 'discord failure',
        replyError: 'reply failed',
        interactionId: 'interaction-1',
        userId: 'user-1'
      })
    })
  })

  describe('handleDiscordCommandError', () => {
    it('deferred ChatInput interaction では editReply で placeholder を解消する', async () => {
      const interaction = createInteraction({ deferred: true })

      await DiscordErrorReporter.handleDiscordCommandError(
        new Error('command failure'),
        interaction as unknown as CommandInteraction,
        context,
        'user message'
      )

      expect(interaction.editReply).toHaveBeenCalledWith({ content: 'user message' })
      expect(interaction.reply).not.toHaveBeenCalled()
      expect(interaction.followUp).not.toHaveBeenCalled()
    })

    it('未応答 ContextMenu interaction には ephemeral reply を送る', async () => {
      const interaction = createInteraction({
        isChatInputCommand: jest.fn().mockReturnValue(false)
      })

      await DiscordErrorReporter.handleDiscordCommandError(
        new Error('command failure'),
        interaction as unknown as MessageContextMenuCommandInteraction,
        context,
        'user message'
      )

      expect(interaction.reply).toHaveBeenCalledWith({
        content: 'user message',
        flags: MessageFlags.Ephemeral
      })
      expect(interaction.editReply).not.toHaveBeenCalled()
      expect(interaction.followUp).not.toHaveBeenCalled()
    })

    it('replied interaction には ephemeral followUp を送る', async () => {
      const interaction = createInteraction({ replied: true })

      await DiscordErrorReporter.handleDiscordCommandError(
        new Error('command failure'),
        interaction as unknown as CommandInteraction,
        context,
        'user message'
      )

      expect(interaction.followUp).toHaveBeenCalledWith({
        content: 'user message',
        flags: MessageFlags.Ephemeral
      })
      expect(interaction.reply).not.toHaveBeenCalled()
      expect(interaction.editReply).not.toHaveBeenCalled()
    })

    it('autocomplete は空候補で応答し、通常のエラー通知を送らない', async () => {
      const interaction = createInteraction({
        isAutocomplete: jest.fn().mockReturnValue(true)
      })

      await DiscordErrorReporter.handleDiscordCommandError(
        new Error('autocomplete failure'),
        interaction as unknown as AutocompleteInteraction,
        context,
        'user message'
      )

      expect(interaction.respond).toHaveBeenCalledWith([])
      expect(interaction.reply).not.toHaveBeenCalled()
      expect(interaction.editReply).not.toHaveBeenCalled()
      expect(interaction.followUp).not.toHaveBeenCalled()
    })
  })
})
