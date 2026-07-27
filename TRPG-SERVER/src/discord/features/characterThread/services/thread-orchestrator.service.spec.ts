import { Test } from '@nestjs/testing'
import { ThreadOrchestratorService } from './thread-orchestrator.service'
import { ThreadManagerService } from './thread-manager.service'
import { CharacterEmbedService } from './character-embed.service'
import { ThreadInteractionService } from './thread-interaction.service'
import { CharacterService } from '../../../../domains/character/character.service'
import { TypedEventService } from '../../../../core/events/typed-event.service'

/**
 * ThreadOrchestratorService は委譲オーケストレーター。
 * 注入された各サービス(ThreadManager/CharacterEmbed/ThreadInteraction/CharacterService)を
 * 協調させてスレッド作成フローを進める。各依存を mock し、
 * 「正しい引数・順序で委譲先が呼ばれるか」「失敗時に再スローするか」「早期 return 分岐が機能するか」を検証する。
 * E-3d: dead だった character-thread.creation.failed emit と TypedEventService 注入は撤去済み。
 * typedEventService mock は「dead emit が再導入されていない」ことの回帰ガードとして残す。
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
    it('legacy-unpinned: スレッド作成→キャラ更新→取得→表示投稿→インタラクティブ要素投稿を順に委譲する', async () => {
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
      // E-6a: deprecated threadId への二重書きは廃止（discordThreadId のみ）
      expect(characterService.update).toHaveBeenCalledWith('char-1', {
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

    it('legacy-pinned: 従来どおり表示投稿と全インタラクティブ要素投稿を委譲する', async () => {
      // Arrange
      const character = buildCharacter({
        templatePin: {
          templateId: 'template-1',
          templateVersion: '1.0.0',
          pinnedBy: 'user-1'
        }
      })
      threadManager.createCharacterThread.mockResolvedValue({
        success: true,
        threadId: 'thread-new'
      } as never)
      const thread = { name: 'スレッド', archived: false } as never
      threadManager.getThreadChannel.mockResolvedValue(thread)

      // Act
      await service.handleThreadCreateRequest(buildPayload({ character }))

      // Assert
      expect(threadManager.getThreadChannel).toHaveBeenCalledWith('thread-new')
      expect(characterEmbed.postCharacterDisplay).toHaveBeenCalledWith(thread, character, 'full')
      expect(threadInteraction.postBasicDiceButtons).toHaveBeenCalledWith(thread, character)
      expect(threadInteraction.postFlexibleDiceMenu).toHaveBeenCalledWith(thread, character)
      expect(threadInteraction.postPresetDiceButtons).toHaveBeenCalledWith(thread, character)
      expect(threadInteraction.postSkillRollButtons).toHaveBeenCalledWith(thread, character)
      expect(threadInteraction.postAbilityRollButtons).toHaveBeenCalledWith(thread, character)
    })

    it('materialized: スレッド作成とID保存後は旧表示投稿群を全てスキップする', async () => {
      // Arrange: 紐付け済み(discordChannelId あり)の materialized はバックストップを通過して作成フローへ進む
      const character = buildCharacter({
        discordChannelId: 'channel-1',
        sheet: {
          templateId: 'template-1',
          templateVersion: '1.0.0',
          revision: 1,
          values: {}
        }
      })
      threadManager.createCharacterThread.mockResolvedValue({
        success: true,
        threadId: 'thread-new'
      } as never)

      // Act
      await service.handleThreadCreateRequest(buildPayload({ character }))

      // Assert
      expect(threadManager.createCharacterThread).toHaveBeenCalled()
      expect(characterService.update).toHaveBeenCalledWith('char-1', {
        discordThreadId: 'thread-new'
      })
      expect(threadManager.getThreadChannel).not.toHaveBeenCalled()
      expect(characterEmbed.postCharacterDisplay).not.toHaveBeenCalled()
      expect(threadInteraction.postBasicDiceButtons).not.toHaveBeenCalled()
      expect(threadInteraction.postFlexibleDiceMenu).not.toHaveBeenCalled()
      expect(threadInteraction.postPresetDiceButtons).not.toHaveBeenCalled()
      expect(threadInteraction.postSkillRollButtons).not.toHaveBeenCalled()
      expect(threadInteraction.postAbilityRollButtons).not.toHaveBeenCalled()
    })

    it('materialized かつ discordChannelId 未紐付けは警告し、manager 作成/update/表示投稿を一切呼ばない', async () => {
      // Arrange: sheet あり(materialized)・discordChannelId 空(未紐付け)
      const warnSpy = jest.spyOn((service as unknown as { logger: { warn: (msg: string) => void } }).logger, 'warn')
      const character = buildCharacter({
        discordChannelId: '',
        sheet: { templateId: 'tpl', templateVersion: '1', revision: 1, values: {} }
      })

      // Act
      await service.handleThreadCreateRequest(buildPayload({ character }))

      // Assert: 最終副作用境界のバックストップが manager 呼び出し前に打ち切る
      expect(threadManager.createCharacterThread).not.toHaveBeenCalled()
      expect(characterService.update).not.toHaveBeenCalled()
      expect(threadManager.getThreadChannel).not.toHaveBeenCalled()
      expect(characterEmbed.postCharacterDisplay).not.toHaveBeenCalled()
      expect(threadInteraction.postBasicDiceButtons).not.toHaveBeenCalled()
      expect(threadInteraction.postFlexibleDiceMenu).not.toHaveBeenCalled()
      expect(threadInteraction.postPresetDiceButtons).not.toHaveBeenCalled()
      expect(threadInteraction.postSkillRollButtons).not.toHaveBeenCalled()
      expect(threadInteraction.postAbilityRollButtons).not.toHaveBeenCalled()
      // 警告は characterId と未紐付け理由(discordChannelId)を含む
      expect(warnSpy).toHaveBeenCalledTimes(1)
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('char-1'))
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('discordChannelId'))
    })

    it('legacy かつ discordChannelId 未紐付けは従来どおりスレッド作成フローを実行する', async () => {
      // Arrange: sheet なし(legacy)・discordChannelId 空 → ガード対象外
      const character = buildCharacter({ discordChannelId: '' })
      threadManager.createCharacterThread.mockResolvedValue({
        success: true,
        threadId: 'thread-new'
      } as never)
      const thread = { name: 'スレッド', archived: false } as never
      threadManager.getThreadChannel.mockResolvedValue(thread)

      // Act
      await service.handleThreadCreateRequest(buildPayload({ character }))

      // Assert: 従来どおり作成 → 更新 → 表示投稿
      expect(threadManager.createCharacterThread).toHaveBeenCalled()
      expect(characterService.update).toHaveBeenCalledWith('char-1', { discordThreadId: 'thread-new' })
      expect(characterEmbed.postCharacterDisplay).toHaveBeenCalledWith(thread, character, 'full')
    })

    it('スレッド作成が success:false の場合、dead な failed イベントは emit せず再スローする（E-3d）', async () => {
      // Arrange
      threadManager.createCharacterThread.mockResolvedValue({
        success: false,
        error: '作成失敗'
      } as never)

      // Act / Assert
      await expect(service.handleThreadCreateRequest(buildPayload())).rejects.toThrow('作成失敗')
      expect(characterService.update).not.toHaveBeenCalled()
      // E-3d: 恒常購読者ゼロの失敗イベントは emit しない
      expect(typedEventService.emit).not.toHaveBeenCalled()
    })

    it('作成成功だが threadId が無い場合も emit せず再スローする（E-3d）', async () => {
      // Arrange
      threadManager.createCharacterThread.mockResolvedValue({ success: true } as never)

      // Act / Assert
      await expect(service.handleThreadCreateRequest(buildPayload())).rejects.toThrow('Thread creation failed')
      expect(typedEventService.emit).not.toHaveBeenCalled()
    })

    it('作成したスレッドが取得できない場合も emit せず再スローする（E-3d）', async () => {
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
      expect(typedEventService.emit).not.toHaveBeenCalled()
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
