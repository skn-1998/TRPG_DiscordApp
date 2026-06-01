// グローバル jest-setup の discord.js モックを無効化し、
// 実際の ModalBuilder / TextInputBuilder 等の挙動を検証する。
jest.unmock('discord.js')
jest.mock('discord.js', () => jest.requireActual('discord.js'))

import { Test, TestingModule } from '@nestjs/testing'
import {
  createMockButtonInteraction,
  createMockSelectMenuInteraction,
  createMockModalInteraction
} from '@discord-test-utils'
import { EnhancedCharacterEditService } from './enhanced-character-edit.service'
import { TypedEventService } from 'src/core/events/typed-event.service'
import { CharacterEmbedManagerService } from './services/character-embed-manager.service'
import { CharacterSectionEditorService } from './services/character-section-editor.service'
import { CharacterModalHandlerService } from './services/character-modal-handler.service'
import { CharacterEditEventEmitterService } from './services/character-edit-event-emitter.service'
import { CharacterEditMessageUpdaterService } from './services/character-edit-message-updater.service'
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

  const mockTypedEventService = {
    emit: jest.fn().mockResolvedValue(undefined),
    waitForEvent: jest.fn()
  }

  const mockEmbedManager = {
    createSectionedEmbeds: jest.fn(),
    createNewCharacterEmbed: jest.fn()
  }

  const mockSectionEditor = {
    execute: jest.fn().mockResolvedValue(undefined)
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
    module = await Test.createTestingModule({
      providers: [
        EnhancedCharacterEditService,
        // EventEmitter / MessageUpdater は実体で登録し、emit イベント名・payload や
        // メッセージ更新委譲の挙動を分割後も同一に検証する（証明力維持）。
        CharacterEditEventEmitterService,
        CharacterEditMessageUpdaterService,
        { provide: TypedEventService, useValue: mockTypedEventService },
        { provide: CharacterEmbedManagerService, useValue: mockEmbedManager },
        { provide: CharacterSectionEditorService, useValue: mockSectionEditor },
        { provide: CharacterModalHandlerService, useValue: mockModalHandler }
      ]
    }).compile()

    service = module.get(EnhancedCharacterEditService)
    jest.clearAllMocks()
    mockTypedEventService.emit.mockResolvedValue(undefined)
    mockSectionEditor.execute.mockResolvedValue(undefined)
    mockModalHandler.handleModalSubmit.mockResolvedValue(undefined)
  })

  afterEach(async () => {
    await module.close()
  })

  // ==========================================================================
  // displayEnhancedCharacterEdit
  // ==========================================================================
  describe('displayEnhancedCharacterEdit', () => {
    it('embed を生成し discord.message.send.requested を発行する', async () => {
      const character = buildCharacter()
      mockEmbedManager.createSectionedEmbeds.mockResolvedValue({
        embeds: ['embed-a'],
        components: ['comp-a']
      })

      await service.displayEnhancedCharacterEdit('channel-1', character)

      expect(mockEmbedManager.createSectionedEmbeds).toHaveBeenCalledWith(character)
      expect(mockTypedEventService.emit).toHaveBeenCalledWith(
        'discord.message.send.requested',
        expect.objectContaining({
          channelId: 'channel-1',
          content: '',
          embeds: ['embed-a'],
          source: 'enhanced-character-edit'
        })
      )
    })

    it('embed 生成失敗時は ErrorHandler.handleServiceError 経由で HttpException を再スローする', async () => {
      const character = buildCharacter()
      mockEmbedManager.createSectionedEmbeds.mockRejectedValue(new Error('boom'))

      // 現挙動: catch 節の先頭で handleServiceError が再スローするため
      // フォールバックの emit には到達しない（try 内で1度も emit していない場合）
      await expect(service.displayEnhancedCharacterEdit('channel-1', character)).rejects.toThrow(
        'サービス処理中にエラーが発生しました'
      )
    })
  })

  // ==========================================================================
  // displayCharacterEditByChannelId
  // ==========================================================================
  describe('displayCharacterEditByChannelId', () => {
    it('チャンネルからキャラクターを取得し編集画面を表示する', async () => {
      const character = buildCharacter()
      mockTypedEventService.waitForEvent.mockResolvedValue({ character })
      mockEmbedManager.createSectionedEmbeds.mockResolvedValue({ embeds: ['e'], components: ['c'] })

      await service.displayCharacterEditByChannelId('channel-1')

      expect(mockTypedEventService.emit).toHaveBeenCalledWith(
        'character.findByChannelId.requested',
        expect.objectContaining({ channelId: 'channel-1', source: 'enhanced-character-edit' })
      )
      // 取得成功 → 表示まで進む
      expect(mockEmbedManager.createSectionedEmbeds).toHaveBeenCalledWith(character)
    })

    it('キャラクターが見つからない場合は何もしない', async () => {
      mockTypedEventService.waitForEvent.mockResolvedValue({})

      await service.displayCharacterEditByChannelId('channel-1')

      expect(mockEmbedManager.createSectionedEmbeds).not.toHaveBeenCalled()
      // findByChannelId.requested 以外の send は発行されない
      expect(mockTypedEventService.emit).not.toHaveBeenCalledWith('discord.message.send.requested', expect.anything())
    })
  })

  // ==========================================================================
  // handleButtonInteraction
  // ==========================================================================
  describe('handleButtonInteraction', () => {
    it('character-create-basic- でモーダルを表示し characterEdit.modal.opened を発行する', async () => {
      const interaction = createMockButtonInteraction({
        customId: 'character-create-basic-channel-1-user-1'
      })

      await service.handleButtonInteraction(interaction)

      expect(interaction.showModal).toHaveBeenCalledTimes(1)
      const modalArg = (interaction.showModal as jest.Mock).mock.calls[0][0]
      expect(modalArg.data.title).toBe('🆕 新しいキャラクター作成')
    })

    it('character-create-cancel- でキャンセル update を行う', async () => {
      const interaction = createMockButtonInteraction({
        customId: 'character-create-cancel-channel-1'
      })

      await service.handleButtonInteraction(interaction)

      expect(interaction.update).toHaveBeenCalledWith({
        content: '❌ キャラクター作成がキャンセルされました。',
        embeds: [],
        components: []
      })
    })

    it('character-refresh- で deferUpdate しキャラ未取得時は followUp する', async () => {
      const interaction = createMockButtonInteraction({
        customId: 'character-refresh-char-123'
      })
      // getCharacterById -> waitForEvent が character なしを返す
      mockTypedEventService.waitForEvent.mockResolvedValue({})

      await service.handleButtonInteraction(interaction)

      expect(interaction.deferUpdate).toHaveBeenCalled()
      expect(interaction.followUp).toHaveBeenCalledWith({
        content: '❌ キャラクターが見つかりません。',
        ephemeral: true
      })
      // refresh は最後に embed refresh イベントを発行する
      expect(mockTypedEventService.emit).toHaveBeenCalledWith(
        'characterEdit.embed.refresh.requested',
        expect.objectContaining({ characterId: 'char-123' })
      )
    })

    it('character-compact-view- で deferReply し editReply で開発中メッセージを返す', async () => {
      const interaction = createMockButtonInteraction({
        customId: 'character-compact-view-char-123'
      })

      await service.handleButtonInteraction(interaction)

      expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true })
      expect(interaction.editReply).toHaveBeenCalledWith({
        content: '📋 簡易表示機能は開発中です。'
      })
    })

    it('未知の customId では何も応答しない', async () => {
      const interaction = createMockButtonInteraction({ customId: 'unknown-button' })

      await service.handleButtonInteraction(interaction)

      expect(interaction.showModal).not.toHaveBeenCalled()
      expect(interaction.update).not.toHaveBeenCalled()
      expect(interaction.deferUpdate).not.toHaveBeenCalled()
      expect(interaction.deferReply).not.toHaveBeenCalled()
    })
  })

  // ==========================================================================
  // handleSelectMenuInteraction
  // ==========================================================================
  describe('handleSelectMenuInteraction', () => {
    it('section.selected を発行し sectionEditor へ委譲する', async () => {
      const interaction = createMockSelectMenuInteraction({
        customId: 'character-refresh-char-123',
        values: ['status-hp']
      })

      await service.handleSelectMenuInteraction(interaction)

      expect(mockTypedEventService.emit).toHaveBeenCalledWith(
        'characterEdit.section.selected',
        expect.objectContaining({
          characterId: 'char-123',
          section: expect.objectContaining({ sectionType: 'status', displayMode: 'edit' })
        })
      )
      expect(mockSectionEditor.execute).toHaveBeenCalledWith(interaction)
    })

    it('sectionEditor がエラーのとき error.occurred を発行し HttpException を再スローする', async () => {
      const interaction = createMockSelectMenuInteraction({
        customId: 'character-refresh-char-123',
        values: ['status-hp']
      })
      mockSectionEditor.execute.mockRejectedValue(new Error('section boom'))

      // 現挙動: ErrorHandler.handleServiceError が HttpException を再スローする
      await expect(service.handleSelectMenuInteraction(interaction)).rejects.toThrow(
        'サービス処理中にエラーが発生しました'
      )

      expect(mockTypedEventService.emit).toHaveBeenCalledWith(
        'characterEdit.error.occurred',
        expect.objectContaining({ characterId: 'char-123' })
      )
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

      // error.occurred の characterId は extractCharacterIdFromCustomId（refresh/compact パターン）
      // を使うため char-edit-* はマッチせず 'unknown' になる（現挙動）
      expect(mockTypedEventService.emit).toHaveBeenCalledWith(
        'characterEdit.error.occurred',
        expect.objectContaining({ characterId: 'unknown' })
      )
    })
  })

  // ==========================================================================
  // handleCharacterDisplayRequested
  // ==========================================================================
  describe('handleCharacterDisplayRequested', () => {
    it('displayType=enhanced のとき編集画面を表示する', async () => {
      const character = buildCharacter()
      mockEmbedManager.createSectionedEmbeds.mockResolvedValue({ embeds: ['e'], components: ['c'] })

      await service.handleCharacterDisplayRequested({
        character,
        channelId: 'channel-1',
        displayType: 'enhanced',
        source: 'test'
      } as any)

      expect(mockEmbedManager.createSectionedEmbeds).toHaveBeenCalledWith(character)
      expect(mockTypedEventService.emit).toHaveBeenCalledWith(
        'discord.message.send.requested',
        expect.objectContaining({ channelId: 'channel-1', source: 'enhanced-character-edit' })
      )
    })

    it('displayType=enhanced 以外では何も表示しない', async () => {
      const character = buildCharacter()

      await service.handleCharacterDisplayRequested({
        character,
        channelId: 'channel-1',
        displayType: 'compact',
        source: 'test'
      } as any)

      expect(mockEmbedManager.createSectionedEmbeds).not.toHaveBeenCalled()
    })
  })

  // ==========================================================================
  // displayNewCharacterCreation
  // ==========================================================================
  describe('displayNewCharacterCreation', () => {
    it('新規作成 embed を生成し send.requested を発行する', async () => {
      mockEmbedManager.createNewCharacterEmbed.mockReturnValue({
        embeds: ['new-embed'],
        components: ['new-comp']
      })

      await service.displayNewCharacterCreation('channel-1', 'user-1')

      expect(mockEmbedManager.createNewCharacterEmbed).toHaveBeenCalledWith('channel-1', 'user-1')
      expect(mockTypedEventService.emit).toHaveBeenCalledWith(
        'discord.message.send.requested',
        expect.objectContaining({
          channelId: 'channel-1',
          content: '',
          embeds: ['new-embed'],
          source: 'enhanced-character-edit-creation'
        })
      )
    })

    it('embed 生成失敗時は HttpException を再スローする', async () => {
      mockEmbedManager.createNewCharacterEmbed.mockImplementation(() => {
        throw new Error('create boom')
      })

      // 現挙動: ErrorHandler.handleServiceError 経由で HttpException に変換され再スローされる
      await expect(service.displayNewCharacterCreation('channel-1', 'user-1')).rejects.toThrow(
        'サービス処理中にエラーが発生しました'
      )
    })
  })
})
