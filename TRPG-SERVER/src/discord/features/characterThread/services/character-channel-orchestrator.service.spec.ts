// 本サービスは constructor / data getter / getAndSetChannelOption で実 discord.js の
// StringSelectMenuBuilder / StringSelectMenuOptionBuilder を new するため、
// グローバル jest-setup の discord.js モックを無効化し実挙動を使う。
jest.unmock('discord.js')
jest.mock('discord.js', () => jest.requireActual('discord.js'))

import { Test } from '@nestjs/testing'
import { StringSelectMenuOptionBuilder } from 'discord.js'
import { createMockSelectMenuInteraction, createMockChatInputInteraction } from '@discord-test-utils'
import { CharacterChannelOrchestratorService } from './character-channel-orchestrator.service'
import { ChannelManagerService } from './channel-manager.service'
import { CharacterEmbedService } from './character-embed.service'
import { DiceUIBuilderService } from './dice-ui-builder.service'
import { TypedEventService } from '../../../../core/events/typed-event.service'
import { ErrorHandler } from '../../../../utils/error-handler'

/**
 * CharacterChannelOrchestratorService は SelectMenu/CommandInteraction を受けて
 * ChannelManager/CharacterEmbed/DiceUIBuilder/TypedEventService を協調させる委譲オーケストレーター。
 * 依存を mock し、interaction は @discord-test-utils で生成。
 * execute(Phase3移行)/createCharacterThread/getAndSetChannelOption/getServiceStats 等の分岐を検証する。
 */
describe('CharacterChannelOrchestratorService', () => {
  let service: CharacterChannelOrchestratorService
  let channelManager: jest.Mocked<
    Pick<
      ChannelManagerService,
      'validateCharacterCategory' | 'validateTextChannel' | 'createCharacterThread' | 'getCharacterChannelOptions'
    >
  >
  let characterEmbed: jest.Mocked<Pick<CharacterEmbedService, 'postCharacterInfo'>>
  let diceUIBuilder: jest.Mocked<Pick<DiceUIBuilderService, 'createDiceButtons'>>
  let eventEmitter: jest.Mocked<Pick<TypedEventService, 'emit'>>

  const buildCharacter = (overrides: Record<string, unknown> = {}) =>
    ({
      characterId: 'char-1',
      characterName: 'テスト探索者',
      discordChannelId: 'channel-1',
      ...overrides
    }) as never

  beforeEach(async () => {
    channelManager = {
      validateCharacterCategory: jest.fn(),
      validateTextChannel: jest.fn(),
      createCharacterThread: jest.fn(),
      getCharacterChannelOptions: jest.fn()
    }
    characterEmbed = {
      postCharacterInfo: jest.fn().mockResolvedValue(undefined)
    }
    diceUIBuilder = {
      createDiceButtons: jest.fn().mockResolvedValue(undefined)
    }
    eventEmitter = {
      emit: jest.fn().mockResolvedValue(undefined)
    }

    const moduleRef = await Test.createTestingModule({
      providers: [
        CharacterChannelOrchestratorService,
        { provide: ChannelManagerService, useValue: channelManager },
        { provide: CharacterEmbedService, useValue: characterEmbed },
        { provide: DiceUIBuilderService, useValue: diceUIBuilder },
        { provide: TypedEventService, useValue: eventEmitter }
      ]
    }).compile()

    service = moduleRef.get(CharacterChannelOrchestratorService)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('execute', () => {
    it('正常系: カテゴリ検証を通ると検索イベントを emit しメンテナンス案内を返す', async () => {
      // Arrange
      channelManager.validateCharacterCategory.mockReturnValue({
        isValid: true,
        categoryChannel: {}
      })
      const interaction = createMockSelectMenuInteraction({ values: ['discord-ch-1'] })

      // Act
      await service.execute(interaction)

      // Assert
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'character.findByChannelId.requested',
        expect.objectContaining({
          channelId: 'discord-ch-1',
          source: 'character-channel-orchestrator-service'
        })
      )
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('メンテナンス中'),
          ephemeral: true
        })
      )
    })

    it('ギルドが無い場合、サーバー内専用メッセージを返しカテゴリ検証しない', async () => {
      // Arrange
      const interaction = createMockSelectMenuInteraction({
        values: ['discord-ch-1'],
        base: { guild: null }
      })

      // Act
      await service.execute(interaction)

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('サーバー内でのみ') })
      )
      expect(channelManager.validateCharacterCategory).not.toHaveBeenCalled()
      expect(eventEmitter.emit).not.toHaveBeenCalled()
    })

    it('カテゴリが無効な場合、カテゴリ未検出メッセージを返しイベントを emit しない', async () => {
      // Arrange
      channelManager.validateCharacterCategory.mockReturnValue({
        isValid: false,
        categoryChannel: null
      })
      const interaction = createMockSelectMenuInteraction({ values: ['discord-ch-1'] })

      // Act
      await service.execute(interaction)

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('カテゴリが見つかりません') })
      )
      expect(eventEmitter.emit).not.toHaveBeenCalled()
    })

    it('例外が発生した場合、ErrorHandler.handleDiscordError に委譲する', async () => {
      // Arrange
      const spy = jest.spyOn(ErrorHandler, 'handleDiscordError').mockResolvedValue(undefined as never)
      channelManager.validateCharacterCategory.mockImplementation(() => {
        throw new Error('検証失敗')
      })
      const interaction = createMockSelectMenuInteraction({ values: ['discord-ch-1'] })

      // Act
      await service.execute(interaction)

      // Assert
      expect(spy).toHaveBeenCalledWith(
        expect.any(Error),
        interaction,
        expect.objectContaining({ operation: 'CharacterChannelOrchestratorService.execute' })
      )
    })
  })

  describe('createCharacterThread', () => {
    it('正常系: チャンネル検証を通るとスレッド作成・情報投稿・ダイスボタン生成を委譲する', async () => {
      // Arrange
      const character = buildCharacter()
      const targetChannel = { id: 'channel-1' }
      channelManager.validateTextChannel.mockResolvedValue(targetChannel as never)
      const thread = { id: 'thread-1' }
      channelManager.createCharacterThread.mockResolvedValue(thread as never)
      const interaction = createMockChatInputInteraction()

      // Act
      await service.createCharacterThread(interaction, character)

      // Assert
      expect(channelManager.validateTextChannel).toHaveBeenCalledWith(interaction.guild, 'channel-1')
      expect(channelManager.createCharacterThread).toHaveBeenCalledWith(interaction.guild, 'channel-1', character)
      expect(characterEmbed.postCharacterInfo).toHaveBeenCalledWith(thread, character, interaction.user.displayName)
      expect(diceUIBuilder.createDiceButtons).toHaveBeenCalledWith(thread, character)
    })

    it('ギルドが無い場合、サーバー内専用メッセージを返し作成しない', async () => {
      // Arrange
      const interaction = createMockChatInputInteraction({ base: { guild: null } })

      // Act
      await service.createCharacterThread(interaction, buildCharacter())

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('サーバー内でのみ') })
      )
      expect(channelManager.createCharacterThread).not.toHaveBeenCalled()
    })

    it('キャラにチャンネルが未設定なら未設定メッセージを返し作成しない', async () => {
      // Arrange
      const interaction = createMockChatInputInteraction()

      // Act
      await service.createCharacterThread(interaction, buildCharacter({ discordChannelId: null }))

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('チャンネルが設定されていません') })
      )
      expect(channelManager.createCharacterThread).not.toHaveBeenCalled()
    })

    it('対象チャンネルが見つからない場合、未検出メッセージを返し作成しない', async () => {
      // Arrange
      channelManager.validateTextChannel.mockResolvedValue(null)
      const interaction = createMockChatInputInteraction()

      // Act
      await service.createCharacterThread(interaction, buildCharacter())

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('チャンネルが見つかりません') })
      )
      expect(channelManager.createCharacterThread).not.toHaveBeenCalled()
    })

    it('途中で例外が発生した場合、未応答ならエラー応答し再スローする', async () => {
      // Arrange
      channelManager.validateTextChannel.mockResolvedValue({ id: 'channel-1' } as never)
      channelManager.createCharacterThread.mockRejectedValue(new Error('作成失敗'))
      const interaction = createMockChatInputInteraction({ base: { replied: false } })

      // Act / Assert
      await expect(service.createCharacterThread(interaction, buildCharacter())).rejects.toThrow('作成失敗')
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('エラーが発生しました') })
      )
    })
  })

  describe('getAndSetChannelOption', () => {
    it('ギルドがあればチャンネルオプションを取得して反映する', () => {
      // Arrange: 実 Builder で生成したオプションを返す(data getter で addOptions される)
      const options = [
        new StringSelectMenuOptionBuilder().setLabel('チャンネルA').setValue('opt-1'),
        new StringSelectMenuOptionBuilder().setLabel('チャンネルB').setValue('opt-2')
      ]
      channelManager.getCharacterChannelOptions.mockReturnValue(options)
      const interaction = createMockChatInputInteraction()

      // Act
      const result = service.getAndSetChannelOption(interaction)

      // Assert
      expect(channelManager.getCharacterChannelOptions).toHaveBeenCalledWith(interaction.guild)
      expect(service.channelOptions).toBe(options)
      expect(result).toBeDefined()
    })

    it('ギルドが無ければ no-guild オプションを設定し取得を呼ばない', () => {
      // Arrange
      const interaction = createMockChatInputInteraction({ base: { guild: null } })

      // Act
      service.getAndSetChannelOption(interaction)

      // Assert
      expect(channelManager.getCharacterChannelOptions).not.toHaveBeenCalled()
      expect(service.channelOptions[0].data.value).toBe('no-guild')
    })

    it('取得中に例外が発生した場合は error オプションを設定する', () => {
      // Arrange
      channelManager.getCharacterChannelOptions.mockImplementation(() => {
        throw new Error('取得失敗')
      })
      const interaction = createMockChatInputInteraction()

      // Act
      service.getAndSetChannelOption(interaction)

      // Assert
      expect(service.channelOptions[0].data.value).toBe('error')
    })
  })

  describe('deleteSelectMenu', () => {
    it('interaction.deleteReply に委譲する', async () => {
      // Arrange
      const interaction = createMockSelectMenuInteraction()

      // Act
      await service.deleteSelectMenu(interaction)

      // Assert
      expect(interaction.deleteReply).toHaveBeenCalled()
    })

    it('deleteReply が失敗しても例外を投げず握りつぶす', async () => {
      // Arrange
      const interaction = createMockSelectMenuInteraction()
      ;(interaction.deleteReply as jest.Mock).mockRejectedValue(new Error('削除失敗'))

      // Act / Assert
      await expect(service.deleteSelectMenu(interaction)).resolves.toBeUndefined()
    })
  })

  describe('getServiceStats', () => {
    it('初期状態(defaultオプションのみ)では isReady:false を返す', () => {
      // Act
      const stats = service.getServiceStats()

      // Assert: 初期は default 値のため未準備
      expect(stats.channelOptionsCount).toBe(1)
      expect(stats.isReady).toBe(false)
    })

    it('default 以外のオプションが設定されると isReady:true を返す', () => {
      // Arrange
      const options = [new StringSelectMenuOptionBuilder().setLabel('実チャンネル').setValue('real-channel')]
      channelManager.getCharacterChannelOptions.mockReturnValue(options)
      service.getAndSetChannelOption(createMockChatInputInteraction())

      // Act
      const stats = service.getServiceStats()

      // Assert
      expect(stats.channelOptionsCount).toBe(1)
      expect(stats.isReady).toBe(true)
    })
  })
})
