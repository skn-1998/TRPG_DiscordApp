// グローバル jest-setup の discord.js モックを無効化し、
// 実際の ModalBuilder / TextInputBuilder 等の挙動を検証する。
jest.unmock('discord.js')
jest.mock('discord.js', () => jest.requireActual('discord.js'))

import { MessageFlags } from 'discord.js'
import { Test, TestingModule } from '@nestjs/testing'
import { HttpException, Logger } from '@nestjs/common'
import {
  createMockButtonInteraction,
  createMockSelectMenuInteraction,
  createMockModalInteraction
} from '@discord-test-utils'
import { EnhancedCharacterEditService } from './enhanced-character-edit.service'
import { ErrorHandler } from 'src/core/http/error-handler'
import { TypedEventService } from 'src/core/events/typed-event.service'
import { CharacterService } from 'src/domains/character/character.service'
import { CharacterEmbedManagerService } from './services/character-embed-manager.service'
import { CharacterSectionEditorService } from './services/character-section-editor.service'
import { CharacterModalHandlerService } from './services/character-modal-handler.service'
import { CharacterEditEventEmitterService } from './services/character-edit-event-emitter.service'
import { CharacterEditMessageUpdaterService } from './services/character-edit-message-updater.service'
import { ModalSessionManagerService } from './services/modal-session-manager.service'
import { Character } from 'src/domains/character/models/character.model'

/**
 * Characterization tests for EnhancedCharacterEditService.
 *
 * 目的: 分割リファクタ前の公開メソッド挙動（どの依存メソッドがどの引数で呼ばれるか /
 * interaction への reply・update・deferUpdate 内容 / TypedEventService への emit 内容）を
 * 「現状のまま」固定する安全網。内部実装には密結合せず、公開メソッドの観測可能な副作用を検証する。
 */
describe('EnhancedCharacterEditService (characterization)', () => {
  let service: EnhancedCharacterEditService
  let module: TestingModule
  let messageUpdater: CharacterEditMessageUpdaterService
  let warnSpy: jest.SpyInstance

  const mockTypedEventService = {
    emit: jest.fn().mockResolvedValue(undefined),
    waitForEvent: jest.fn()
  }

  // E-2c: キャラクター取得はイベント RPC ではなく CharacterService の DI 直呼び
  const mockCharacterService = {
    findOne: jest.fn()
  }

  const mockEmbedManager = {
    createSectionedEmbeds: jest.fn(),
    createFieldSelectMenu: jest.fn()
  }

  const mockSectionEditor = {
    handleSectionSelectInteraction: jest.fn().mockResolvedValue(undefined),
    handleFieldSelectInteraction: jest.fn().mockResolvedValue(undefined)
  }

  const mockModalHandler = {
    handleModalSubmit: jest.fn().mockResolvedValue(undefined)
  }

  const buildCharacter = (overrides: Partial<Character> = {}): Character =>
    ({
      characterId: 'char-123',
      characterName: 'テストキャラ',
      discordChannelId: 'channel-999',
      ...overrides
    }) as unknown as Character

  beforeEach(async () => {
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    module = await Test.createTestingModule({
      providers: [
        EnhancedCharacterEditService,
        // EventEmitter / MessageUpdater は実体で登録し、emit イベント名・payload や
        // メッセージ更新委譲の挙動を分割後も同一に検証する（証明力維持）。
        CharacterEditEventEmitterService,
        CharacterEditMessageUpdaterService,
        { provide: TypedEventService, useValue: mockTypedEventService },
        { provide: CharacterService, useValue: mockCharacterService },
        { provide: CharacterEmbedManagerService, useValue: mockEmbedManager },
        { provide: CharacterSectionEditorService, useValue: mockSectionEditor },
        { provide: CharacterModalHandlerService, useValue: mockModalHandler }
      ]
    }).compile()

    service = module.get(EnhancedCharacterEditService)
    messageUpdater = module.get(CharacterEditMessageUpdaterService)
    jest.clearAllMocks()
    mockTypedEventService.emit.mockResolvedValue(undefined)
    mockSectionEditor.handleSectionSelectInteraction.mockResolvedValue(undefined)
    mockSectionEditor.handleFieldSelectInteraction.mockResolvedValue(undefined)
    mockModalHandler.handleModalSubmit.mockResolvedValue(undefined)
  })

  afterEach(async () => {
    await module.close()
    jest.restoreAllMocks()
  })

  describe('handleCreate', () => {
    it('character-create-basic- でモーダルを表示し characterEdit.modal.opened を発行する', async () => {
      const interaction = createMockButtonInteraction({
        customId: 'character-create-basic-channel-1-user-1'
      })

      await service.handleCreate(interaction)

      expect(interaction.showModal).toHaveBeenCalledTimes(1)
      const modalArg = (interaction.showModal as jest.Mock).mock.calls[0][0]
      expect(modalArg.data.title).toBe('🆕 新しいキャラクター作成')
    })

    it('character-create-cancel- でキャンセル update を行う', async () => {
      const interaction = createMockButtonInteraction({
        customId: 'character-create-cancel-channel-1'
      })

      await service.handleCreate(interaction)

      expect(interaction.update).toHaveBeenCalledWith({
        content: '❌ キャラクター作成がキャンセルされました。',
        embeds: [],
        components: []
      })
    })

    it('作成 handler の契約外 customId は warn し ephemeral 応答する', async () => {
      const interaction = createMockButtonInteraction({ customId: 'character-create-unsupported-channel-1' })

      await service.handleCreate(interaction)

      expect(warnSpy).toHaveBeenCalledWith(
        'Unsupported character create customId: character-create-unsupported-channel-1'
      )
      expect(interaction.reply).toHaveBeenCalledWith({
        content: '⚠️ この作成ボタンは現在処理できません。（作成操作の customId 形式が不正です）',
        flags: MessageFlags.Ephemeral
      })
    })
  })

  describe('handleRefresh', () => {
    it('character-refresh- で deferUpdate しキャラ未取得時は followUp する', async () => {
      const interaction = createMockButtonInteraction({
        customId: 'character-refresh-char-123'
      })
      // getCharacterById -> CharacterService.findOne が null を返す（E-2c: イベント RPC 廃止）
      mockCharacterService.findOne.mockResolvedValue(null)

      await service.handleRefresh(interaction)

      expect(interaction.deferUpdate).toHaveBeenCalled()
      expect(mockCharacterService.findOne).toHaveBeenCalledWith('char-123')
      expect(interaction.followUp).toHaveBeenCalledWith({
        content: '❌ キャラクターが見つかりません。',
        flags: MessageFlags.Ephemeral
      })
      // refresh は最後に embed refresh イベントを発行する
      expect(mockTypedEventService.emit).toHaveBeenCalledWith(
        'characterEdit.embed.refresh.requested',
        expect.objectContaining({ characterId: 'char-123' })
      )
      expect((interaction.deferUpdate as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
        mockTypedEventService.emit.mock.invocationCallOrder[0]
      )
      // Assert: 旧イベント RPC（emit + waitForEvent）へ戻っていないことを固定（E-2c の回帰ガード）
      expect(mockTypedEventService.waitForEvent).not.toHaveBeenCalled()
      expect(mockTypedEventService.emit).not.toHaveBeenCalledWith('character.findById.requested', expect.anything())
    })

    it('refresh 処理の最終更新が完了してから embed refresh イベントを発行する', async () => {
      const completionOrder: string[] = []
      const character = buildCharacter()
      const interaction = createMockButtonInteraction({
        customId: 'character-refresh-char-123'
      })
      mockCharacterService.findOne.mockResolvedValue(character)
      jest.spyOn(messageUpdater, 'updateExistingCharacterEditEmbed').mockImplementation(async () => {
        await Promise.resolve()
        completionOrder.push('refresh-complete')
      })
      mockTypedEventService.emit.mockImplementation(async () => {
        completionOrder.push('emit')
      })

      await service.handleRefresh(interaction)

      expect(messageUpdater.updateExistingCharacterEditEmbed).toHaveBeenCalledWith(character, interaction)
      expect(mockTypedEventService.emit).toHaveBeenCalledWith(
        'characterEdit.embed.refresh.requested',
        expect.objectContaining({ characterId: 'char-123' })
      )
      expect(completionOrder).toEqual(['refresh-complete', 'emit'])
    })

    it('refresh の共有 embed 復旧が失敗したら ephemeral followUp 後に元例外を伝播する', async () => {
      const originalError = new HttpException('refresh failed', 409)
      const character = buildCharacter()
      const interaction = createMockButtonInteraction({
        customId: 'character-refresh-char-123'
      })
      mockCharacterService.findOne.mockResolvedValue(character)
      jest.spyOn(messageUpdater, 'updateExistingCharacterEditEmbed').mockRejectedValue(originalError)

      await expect(service.handleRefresh(interaction)).rejects.toBe(originalError)

      expect(interaction.followUp).toHaveBeenCalledWith({
        content: 'エラーが発生しました。もう一度お試しください。',
        flags: MessageFlags.Ephemeral
      })
      expect(interaction.followUp).toHaveBeenCalledTimes(1)
      expect(interaction.reply).not.toHaveBeenCalled()
      expect(interaction.editReply).not.toHaveBeenCalled()
    })

    it('refresh の最終 followUp も失敗したら warn し元例外を伝播する', async () => {
      const originalError = new HttpException('refresh failed', 409)
      const notificationError = new Error('followUp failed')
      const character = buildCharacter()
      const interaction = createMockButtonInteraction({
        customId: 'character-refresh-char-123'
      })
      mockCharacterService.findOne.mockResolvedValue(character)
      jest.spyOn(messageUpdater, 'updateExistingCharacterEditEmbed').mockRejectedValue(originalError)
      ;(interaction.followUp as jest.Mock).mockRejectedValue(notificationError)

      await expect(service.handleRefresh(interaction)).rejects.toBe(originalError)

      expect(warnSpy).toHaveBeenCalledWith('Failed to send final character refresh error response', notificationError)
      expect(interaction.followUp).toHaveBeenCalledTimes(1)
    })
  })

  describe('handleCompact', () => {
    it('character-compact-view- で deferReply し editReply で開発中メッセージを返す', async () => {
      const interaction = createMockButtonInteraction({
        customId: 'character-compact-view-char-123'
      })

      await service.handleCompact(interaction)

      expect(interaction.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral })
      expect(interaction.editReply).toHaveBeenCalledWith({
        content: '📋 簡易表示機能は開発中です。'
      })
    })
  })

  // ==========================================================================
  // select menu entry points
  // ==========================================================================
  describe('select menu entry points', () => {
    it('section select を sectionEditor の専用入口へ委譲する（dead な section.selected emit は E-3c で撤去済み）', async () => {
      const interaction = createMockSelectMenuInteraction({
        customId: 'character-edit-section-char-123',
        values: ['status']
      })

      await service.handleSectionSelect(interaction)

      // E-3c: 恒常購読者ゼロだったセクション選択/フィールド選択イベントは emit しない
      expect(mockTypedEventService.emit).not.toHaveBeenCalled()
      expect(mockSectionEditor.handleSectionSelectInteraction).toHaveBeenCalledWith(interaction)
    })

    it('field select の委譲先がエラーのとき共通ラップで error.occurred を発行し HttpException を再スローする', async () => {
      const interaction = createMockSelectMenuInteraction({
        customId: 'character-field-edit-status-char-123',
        values: ['hp']
      })
      mockSectionEditor.handleFieldSelectInteraction.mockRejectedValue(new Error('section boom'))

      // 現挙動: ErrorHandler.handleServiceError が HttpException を再スローする
      await expect(service.handleFieldSelect(interaction)).rejects.toThrow('サービス処理中にエラーが発生しました')

      expect(mockTypedEventService.emit).toHaveBeenCalledWith(
        'characterEdit.error.occurred',
        expect.objectContaining({ characterId: 'char-123' })
      )
    })

    it('実物 sectionEditor の section select エラーを外層だけでイベント発行・ログ・500 変換する', async () => {
      const composedModule = await Test.createTestingModule({
        providers: [
          EnhancedCharacterEditService,
          CharacterSectionEditorService,
          CharacterEditEventEmitterService,
          CharacterEditMessageUpdaterService,
          { provide: TypedEventService, useValue: mockTypedEventService },
          { provide: CharacterService, useValue: mockCharacterService },
          { provide: CharacterEmbedManagerService, useValue: mockEmbedManager },
          { provide: ModalSessionManagerService, useValue: { createSession: jest.fn() } },
          { provide: CharacterModalHandlerService, useValue: mockModalHandler }
        ]
      }).compile()

      try {
        const composedService = composedModule.get(EnhancedCharacterEditService)
        const eventEmitter = composedModule.get(CharacterEditEventEmitterService)
        const originalError = new Error('field select menu generation failed')
        const interaction = createMockSelectMenuInteraction({
          customId: 'character-edit-section-abc123',
          values: ['status']
        })
        ;(interaction.deferUpdate as jest.Mock).mockImplementation(async () => {
          ;(interaction as unknown as { deferred: boolean }).deferred = true
        })
        mockCharacterService.findOne.mockResolvedValue(buildCharacter({ characterId: 'abc123' }))
        mockEmbedManager.createFieldSelectMenu.mockImplementationOnce(() => {
          throw originalError
        })
        const emitErrorSpy = jest.spyOn(eventEmitter, 'emitError')
        const logErrorSpy = jest.spyOn(ErrorHandler, 'logError').mockImplementation(() => undefined)

        let thrownError: unknown
        try {
          await composedService.handleSectionSelect(interaction)
        } catch (error) {
          thrownError = error
        }

        expect(thrownError).toBeInstanceOf(HttpException)
        expect((thrownError as HttpException).getStatus()).toBe(500)
        expect((thrownError as HttpException).message).toBe('サービス処理中にエラーが発生しました')
        expect(emitErrorSpy).toHaveBeenCalledTimes(1)
        expect(emitErrorSpy).toHaveBeenCalledWith(originalError, interaction.customId, interaction.user.id)
        expect(mockTypedEventService.emit).toHaveBeenCalledTimes(1)
        expect(mockTypedEventService.emit).toHaveBeenCalledWith(
          'characterEdit.error.occurred',
          expect.objectContaining({
            error: expect.objectContaining({ message: originalError.message })
          })
        )
        expect(logErrorSpy).toHaveBeenCalledTimes(1)
        expect(logErrorSpy).toHaveBeenCalledWith(
          originalError,
          { customId: interaction.customId, userId: interaction.user.id },
          'SERVICE_ENHANCEDCHARACTEREDITSERVICE'
        )
        expect(interaction.followUp).toHaveBeenCalledTimes(1)
        expect(interaction.followUp).toHaveBeenCalledWith({
          content: 'エラーが発生しました。もう一度お試しください。',
          flags: MessageFlags.Ephemeral
        })
      } finally {
        await composedModule.close()
      }
    })
  })

  // ==========================================================================
  // handleModalSubmitInteraction
  // ==========================================================================
  describe('handleModalSubmitInteraction', () => {
    it('modal.submitted を発行し modalHandler へ委譲する', async () => {
      const interaction = createMockModalInteraction({
        customId: 'char-edit-status-hp-char-123',
        fields: { 'status-hp': '42' }
      })

      await service.handleModalSubmitInteraction(interaction)

      // 現挙動: customId を '-' で split し最後の要素を characterId とする
      // ('char-edit-status-hp-char-123' → ['char','edit','status','hp','char','123'] → '123')
      // sectionType=parts[2]='status', fieldKey=parts[3]='hp'
      expect(mockTypedEventService.emit).toHaveBeenCalledWith(
        'characterEdit.modal.submitted',
        expect.objectContaining({
          characterId: '123',
          modal: expect.objectContaining({
            sectionType: 'status',
            fieldKey: 'hp',
            newValue: expect.objectContaining({ name: '42' })
          })
        })
      )
      expect(mockModalHandler.handleModalSubmit).toHaveBeenCalledWith(interaction)
    })

    it('modalHandler がエラーのとき error.occurred を発行し HttpException を再スローする', async () => {
      const interaction = createMockModalInteraction({
        customId: 'char-edit-status-hp-char-123',
        fields: { 'status-hp': '42' }
      })
      mockModalHandler.handleModalSubmit.mockRejectedValue(new Error('modal boom'))

      // 現挙動: ErrorHandler.handleServiceError が HttpException を再スローする
      await expect(service.handleModalSubmitInteraction(interaction)).rejects.toThrow(
        'サービス処理中にエラーが発生しました'
      )

      // error.occurred の characterId 抽出は modal（char-edit-*）を対象にしないため、
      // modal 経路では引き続き 'unknown' になる。
      expect(mockTypedEventService.emit).toHaveBeenCalledWith(
        'characterEdit.error.occurred',
        expect.objectContaining({ characterId: 'unknown' })
      )
    })
  })
})
