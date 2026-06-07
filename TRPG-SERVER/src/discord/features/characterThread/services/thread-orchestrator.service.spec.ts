import { Test } from '@nestjs/testing'
import { ThreadOrchestratorService } from './thread-orchestrator.service'
import { ThreadManagerService } from './thread-manager.service'
import { CharacterEmbedService } from './character-embed.service'
import { ThreadInteractionService } from './thread-interaction.service'
import { CharacterService } from '../../../../domains/character/character.service'
import { TypedEventService } from '../../../../core/events/typed-event.service'

/**
 * ThreadOrchestratorService は委譲オーケストレーター。
 * 注入された各サービス(ThreadManager/CharacterEmbed/ThreadInteraction/CharacterService/TypedEventService)を
 * 協調させてスレッド作成フローを進める。各依存を mock し、
 * 「正しい引数・順序で委譲先が呼ばれるか」「失敗時に failed イベントを emit して再スローするか」
 * 「早期 return 分岐が機能するか」を検証する。
 */
describe('ThreadOrchestratorService', () => {
  let service: ThreadOrchestratorService
  let threadManager: jest.Mocked<
    Pick<ThreadManagerService, 'createCharacterThread' | 'getThreadChannel' | 'archiveThread' | 'unarchiveThread'>
  >
  let characterEmbed: jest.Mocked<Pick<CharacterEmbedService, 'postCharacterDisplay' | 'updateCharacterDisplay'>>
  let threadInteraction: jest.Mocked<
    Pick<
      ThreadInteractionService,
      | 'postBasicDiceButtons'
      | 'postFlexibleDiceMenu'
      | 'postPresetDiceButtons'
      | 'postSkillRollButtons'
      | 'postAbilityRollButtons'
    >
  >
  let characterService: jest.Mocked<Pick<CharacterService, 'update' | 'findOne'>>
  let typedEventService: jest.Mocked<Pick<TypedEventService, 'emit'>>

  const buildCharacter = (overrides: Record<string, unknown> = {}) =>
    ({
      characterId: 'char-1',
      characterName: 'テスト探索者',
      discordThreadId: 'thread-1',
      ...overrides
    }) as never

  const buildPayload = (overrides: Record<string, unknown> = {}) =>
    ({
      character: buildCharacter(),
      channelId: 'channel-1',
      guildId: 'guild-1',
      creatorId: 'creator-1',
      displayType: 'full',
      source: 'test',
      ...overrides
    }) as never

  beforeEach(async () => {
    threadManager = {
      createCharacterThread: jest.fn(),
      getThreadChannel: jest.fn(),
      archiveThread: jest.fn(),
      unarchiveThread: jest.fn()
    }
    characterEmbed = {
      postCharacterDisplay: jest.fn().mockResolvedValue(undefined),
      updateCharacterDisplay: jest.fn().mockResolvedValue(undefined)
    }
    threadInteraction = {
      postBasicDiceButtons: jest.fn().mockResolvedValue(undefined),
      postFlexibleDiceMenu: jest.fn().mockResolvedValue(undefined),
      postPresetDiceButtons: jest.fn().mockResolvedValue(undefined),
      postSkillRollButtons: jest.fn().mockResolvedValue(undefined),
      postAbilityRollButtons: jest.fn().mockResolvedValue(undefined)
    }
    characterService = {
      update: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn()
    }
    typedEventService = {
      emit: jest.fn().mockResolvedValue(undefined)
    }

    const moduleRef = await Test.createTestingModule({
      providers: [
        ThreadOrchestratorService,
        { provide: ThreadManagerService, useValue: threadManager },
        { provide: CharacterEmbedService, useValue: characterEmbed },
        { provide: ThreadInteractionService, useValue: threadInteraction },
        { provide: CharacterService, useValue: characterService },
        { provide: TypedEventService, useValue: typedEventService }
      ]
    }).compile()

    service = moduleRef.get(ThreadOrchestratorService)
  })

  describe('handleThreadCreateRequest', () => {
    it('正常系: スレッド作成→キャラ更新→取得→表示投稿→インタラクティブ要素投稿を順に委譲する', async () => {
      // Arrange
      const character = buildCharacter()
      threadManager.createCharacterThread.mockResolvedValue({
        success: true,
        threadId: 'thread-new'
      } as never)
      const thread = { name: 'スレッド', archived: false } as never
      threadManager.getThreadChannel.mockResolvedValue(thread)

      // Act
      await service.handleThreadCreateRequest(buildPayload({ character }))

      // Assert: 委譲先が正しい引数で呼ばれる
      expect(threadManager.createCharacterThread).toHaveBeenCalledWith(
        {
          characterId: 'char-1',
          characterName: 'テスト探索者',
          channelId: 'channel-1',
          guildId: 'guild-1',
          creatorId: 'creator-1',
          displayType: 'full'
        },
        character
      )
      expect(characterService.update).toHaveBeenCalledWith('char-1', {
        threadId: 'thread-new',
        discordThreadId: 'thread-new'
      })
      expect(threadManager.getThreadChannel).toHaveBeenCalledWith('thread-new')
      expect(characterEmbed.postCharacterDisplay).toHaveBeenCalledWith(thread, character, 'full')
      expect(threadInteraction.postBasicDiceButtons).toHaveBeenCalledWith(thread, character)
      expect(threadInteraction.postFlexibleDiceMenu).toHaveBeenCalledWith(thread, character)
      expect(threadInteraction.postPresetDiceButtons).toHaveBeenCalledWith(thread, character)
      expect(threadInteraction.postSkillRollButtons).toHaveBeenCalledWith(thread, character)
      expect(threadInteraction.postAbilityRollButtons).toHaveBeenCalledWith(thread, character)
      // 失敗イベントは出さない
      expect(typedEventService.emit).not.toHaveBeenCalled()
    })

    it('スレッド作成が success:false の場合、failedイベントを emit して再スローする', async () => {
      // Arrange
      threadManager.createCharacterThread.mockResolvedValue({
        success: false,
        error: '作成失敗'
      } as never)

      // Act / Assert
      await expect(service.handleThreadCreateRequest(buildPayload())).rejects.toThrow('作成失敗')
      expect(characterService.update).not.toHaveBeenCalled()
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'character-thread.creation.failed',
        expect.objectContaining({
          characterId: 'char-1',
          characterName: 'テスト探索者',
          channelId: 'channel-1',
          creatorId: 'creator-1',
          guildId: 'guild-1',
          error: '作成失敗',
          source: 'thread-orchestrator-service'
        })
      )
    })

    it('作成成功だが threadId が無い場合も failedイベントを emit して再スローする', async () => {
      // Arrange
      threadManager.createCharacterThread.mockResolvedValue({ success: true } as never)

      // Act / Assert
      await expect(service.handleThreadCreateRequest(buildPayload())).rejects.toThrow('Thread creation failed')
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'character-thread.creation.failed',
        expect.objectContaining({ error: 'Thread creation failed' })
      )
    })

    it('作成したスレッドが取得できない場合、failedイベントを emit して再スローする', async () => {
      // Arrange
      threadManager.createCharacterThread.mockResolvedValue({
        success: true,
        threadId: 'thread-x'
      } as never)
      threadManager.getThreadChannel.mockResolvedValue(null as never)

      // Act / Assert
      await expect(service.handleThreadCreateRequest(buildPayload())).rejects.toThrow(
        'Created thread not found: thread-x'
      )
      expect(characterEmbed.postCharacterDisplay).not.toHaveBeenCalled()
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'character-thread.creation.failed',
        expect.objectContaining({ error: 'Created thread not found: thread-x' })
      )
    })
  })

  describe('updateCharacterThreadDisplay', () => {
    it('discordThreadId が無ければ早期 return し、何も委譲しない', async () => {
      // Arrange
      const character = buildCharacter({ discordThreadId: undefined })

      // Act
      await service.updateCharacterThreadDisplay(character)

      // Assert
      expect(threadManager.getThreadChannel).not.toHaveBeenCalled()
      expect(characterEmbed.updateCharacterDisplay).not.toHaveBeenCalled()
    })

    it('スレッドが見つからなければ更新せず return する', async () => {
      // Arrange
      threadManager.getThreadChannel.mockResolvedValue(null as never)

      // Act
      await service.updateCharacterThreadDisplay(buildCharacter())

      // Assert
      expect(threadManager.getThreadChannel).toHaveBeenCalledWith('thread-1')
      expect(characterEmbed.updateCharacterDisplay).not.toHaveBeenCalled()
    })

    it('スレッドがあれば updateCharacterDisplay に委譲する', async () => {
      // Arrange
      const character = buildCharacter()
      threadManager.getThreadChannel.mockResolvedValue({ id: 'thread-1' } as never)

      // Act
      await service.updateCharacterThreadDisplay(character)

      // Assert
      expect(characterEmbed.updateCharacterDisplay).toHaveBeenCalledWith(character)
    })

    it('更新中に例外が発生した場合は再スローする', async () => {
      // Arrange
      threadManager.getThreadChannel.mockResolvedValue({ id: 'thread-1' } as never)
      characterEmbed.updateCharacterDisplay.mockRejectedValue(new Error('embed失敗'))

      // Act / Assert
      await expect(service.updateCharacterThreadDisplay(buildCharacter())).rejects.toThrow('embed失敗')
    })
  })

  describe('archiveCharacterThread', () => {
    it('キャラが存在しスレッドがあればアーカイブし結果を返す', async () => {
      // Arrange
      characterService.findOne.mockResolvedValue(buildCharacter())
      threadManager.archiveThread.mockResolvedValue(true)

      // Act
      const result = await service.archiveCharacterThread('char-1')

      // Assert
      expect(threadManager.archiveThread).toHaveBeenCalledWith('thread-1')
      expect(result).toBe(true)
    })

    it('キャラに discordThreadId が無ければ false を返しアーカイブしない', async () => {
      // Arrange
      characterService.findOne.mockResolvedValue(buildCharacter({ discordThreadId: null }))

      // Act
      const result = await service.archiveCharacterThread('char-1')

      // Assert
      expect(result).toBe(false)
      expect(threadManager.archiveThread).not.toHaveBeenCalled()
    })

    it('例外が発生した場合は false を返す(握りつぶす)', async () => {
      // Arrange
      characterService.findOne.mockRejectedValue(new Error('DB失敗'))

      // Act
      const result = await service.archiveCharacterThread('char-1')

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('unarchiveCharacterThread', () => {
    it('キャラが存在しスレッドがあればアンアーカイブし結果を返す', async () => {
      // Arrange
      characterService.findOne.mockResolvedValue(buildCharacter())
      threadManager.unarchiveThread.mockResolvedValue(true)

      // Act
      const result = await service.unarchiveCharacterThread('char-1')

      // Assert
      expect(threadManager.unarchiveThread).toHaveBeenCalledWith('thread-1')
      expect(result).toBe(true)
    })

    it('キャラに discordThreadId が無ければ false を返しアンアーカイブしない', async () => {
      // Arrange
      characterService.findOne.mockResolvedValue(buildCharacter({ discordThreadId: '' }))

      // Act
      const result = await service.unarchiveCharacterThread('char-1')

      // Assert
      expect(result).toBe(false)
      expect(threadManager.unarchiveThread).not.toHaveBeenCalled()
    })

    it('例外が発生した場合は false を返す(握りつぶす)', async () => {
      // Arrange
      characterService.findOne.mockRejectedValue(new Error('DB失敗'))

      // Act
      const result = await service.unarchiveCharacterThread('char-1')

      // Assert
      expect(result).toBe(false)
    })
  })
})
