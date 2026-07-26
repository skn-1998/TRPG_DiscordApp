import { Test } from '@nestjs/testing'
import { HttpException, Logger } from '@nestjs/common'
import { createMockSelectMenuInteraction } from '@discord-test-utils'
import { CharacterThreadOrchestrator } from './character-thread.orchestrator'
import { ThreadCreationService } from './thread-creation.service'
import { CharacterService } from '../../../../domains/character/character.service'
import { ErrorHandler } from '../../../../core/http/error-handler'

/**
 * CharacterThreadOrchestrator は SelectMenu からのキャラ選択を受け、
 * 所有者検証・チャンネル/ギルド確認を経て ThreadCreationService にスレッド作成を委譲する。
 * 依存(ThreadCreationService/CharacterService)を mock し、interaction は @discord-test-utils で生成。
 * 各分岐(キャラ不在/他人のキャラ/チャンネル無し/成功/失敗/例外)を検証する。
 */
describe('CharacterThreadOrchestrator', () => {
  let service: CharacterThreadOrchestrator
  let threadCreationService: jest.Mocked<Pick<ThreadCreationService, 'createCharacterThread'>>
  let characterService: jest.Mocked<Pick<CharacterService, 'findOne'>>
  let warnSpy: jest.SpyInstance

  // interaction.user.id のデフォルトは DEFAULT_MOCK_USER.id
  const OWNER_ID = '123456789012345678'

  const buildCharacter = (overrides: Record<string, unknown> = {}) =>
    ({
      characterId: 'char-1',
      characterName: 'テスト探索者',
      discordUserId: OWNER_ID,
      ...overrides
    }) as never

  beforeEach(async () => {
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    threadCreationService = {
      createCharacterThread: jest.fn()
    }
    characterService = {
      findOne: jest.fn()
    }

    const moduleRef = await Test.createTestingModule({
      providers: [
        CharacterThreadOrchestrator,
        { provide: ThreadCreationService, useValue: threadCreationService },
        { provide: CharacterService, useValue: characterService }
      ]
    }).compile()

    service = moduleRef.get(CharacterThreadOrchestrator)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('handleSelection', () => {
    it('正常系: 所有者のキャラを選択するとスレッド作成を委譲し成功メッセージを返す', async () => {
      // Arrange
      const character = buildCharacter()
      characterService.findOne.mockResolvedValue(character)
      threadCreationService.createCharacterThread.mockResolvedValue({
        success: true,
        threadUrl: 'https://discord/thread'
      } as never)
      const interaction = createMockSelectMenuInteraction({ values: ['char-1'] })

      // Act
      await service.handleSelection(interaction, 'char-1')

      // Assert
      expect(characterService.findOne).toHaveBeenCalledWith('char-1')
      expect(threadCreationService.createCharacterThread).toHaveBeenCalledWith(
        {
          characterId: 'char-1',
          characterName: 'テスト探索者',
          channelId: interaction.channel?.id,
          creatorId: OWNER_ID,
          guildId: interaction.guild?.id
        },
        character
      )
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('スレッドが作成されました')
        })
      )
    })

    it('キャラクターが見つからない場合、エラー表示して作成を委譲しない', async () => {
      // Arrange
      characterService.findOne.mockResolvedValue(null as never)
      const interaction = createMockSelectMenuInteraction({ values: ['char-x'] })

      // Act
      await service.handleSelection(interaction, 'char-x')

      // Assert
      expect(interaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('見つかりませんでした'),
          components: []
        })
      )
      expect(threadCreationService.createCharacterThread).not.toHaveBeenCalled()
    })

    it('他ユーザーのキャラクターを選択した場合、拒否して作成を委譲しない', async () => {
      // Arrange
      characterService.findOne.mockResolvedValue(buildCharacter({ discordUserId: 'other-user' }))
      const interaction = createMockSelectMenuInteraction({ values: ['char-1'] })

      // Act
      await service.handleSelection(interaction, 'char-1')

      // Assert
      expect(interaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('他のユーザーのキャラクター')
        })
      )
      expect(threadCreationService.createCharacterThread).not.toHaveBeenCalled()
    })

    it('チャンネルまたはギルドが取得できない場合、エラー表示して作成を委譲しない', async () => {
      // Arrange
      characterService.findOne.mockResolvedValue(buildCharacter())
      const interaction = createMockSelectMenuInteraction({
        values: ['char-1'],
        base: { channel: null }
      })

      // Act
      await service.handleSelection(interaction, 'char-1')

      // Assert
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('チャンネルまたはサーバー情報')
        })
      )
      expect(threadCreationService.createCharacterThread).not.toHaveBeenCalled()
    })

    it('スレッド作成が失敗(success:false)した場合、失敗メッセージを返す', async () => {
      // Arrange
      characterService.findOne.mockResolvedValue(buildCharacter())
      threadCreationService.createCharacterThread.mockResolvedValue({
        success: false,
        error: '作成エラー'
      } as never)
      const interaction = createMockSelectMenuInteraction({ values: ['char-1'] })

      // Act
      await service.handleSelection(interaction, 'char-1')

      // Assert
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('作成に失敗しました：作成エラー')
        })
      )
    })

    it('途中で例外が発生した場合、エラーリプライ後に ErrorHandler から再スローする', async () => {
      // Arrange
      const originalError = new Error('DB失敗')
      const spy = jest.spyOn(ErrorHandler, 'handleServiceError')
      characterService.findOne.mockRejectedValue(originalError)
      const interaction = createMockSelectMenuInteraction({ values: ['char-1'] })

      // Act & Assert
      await expect(service.handleSelection(interaction, 'char-1')).rejects.toThrow(
        'サービス処理中にエラーが発生しました'
      )

      expect(spy).toHaveBeenCalledWith(
        originalError,
        { characterId: 'char-1', action: 'character-thread-selection' },
        'CharacterThreadOrchestrator'
      )
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('エラーが発生しました')
        })
      )
      expect((interaction.editReply as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
        spy.mock.invocationCallOrder[0]
      )
    })

    it('エラーリプライも失敗した場合は warn し元の HttpException を伝播する', async () => {
      const originalError = new HttpException('thread failure', 409)
      const replyError = new Error('reply failed')
      characterService.findOne.mockRejectedValue(originalError)
      const interaction = createMockSelectMenuInteraction({ values: ['char-1'] })
      ;(interaction.editReply as jest.Mock).mockRejectedValue(replyError)

      await expect(service.handleSelection(interaction, 'char-1')).rejects.toBe(originalError)

      expect(warnSpy).toHaveBeenCalledWith('Failed to send error reply:', 'reply failed')
      expect(interaction.editReply).toHaveBeenCalledTimes(1)
    })
  })
})
