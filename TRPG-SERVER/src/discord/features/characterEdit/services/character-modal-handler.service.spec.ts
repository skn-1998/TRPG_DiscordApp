/**
 * Characterization tests for CharacterModalHandlerService
 *
 * 分割リファクタリングの前に現挙動を固定するためのテスト。
 * 「どの依存が・どの引数で呼ばれ・どの reply/update が返るか」を現状のまま記録する。
 */
// グローバルな discord.js モック（test/utils/jest-setup.ts）は EmbedBuilder.setTimestamp 等を
// 持たないため、実際の discord.js を使って EmbedBuilder の挙動（.data.title 等）を検証する。
jest.mock('discord.js', () => jest.requireActual('discord.js'))

import { Test, TestingModule } from '@nestjs/testing'
import { Logger } from '@nestjs/common'
import { createMockModalInteraction } from '@discord-test-utils'
import { CharacterModalHandlerService } from './character-modal-handler.service'
import { CharacterService } from 'src/domains/character/character.service'
import { TypedEventService } from 'src/core/events/typed-event.service'
import { CharacterEmbedManagerService } from './character-embed-manager.service'
import { ModalSessionManagerService } from './modal-session-manager.service'

describe('CharacterModalHandlerService (characterization)', () => {
  let service: CharacterModalHandlerService
  let module: TestingModule

  const mockCharacterService = {
    update: jest.fn(),
    findOne: jest.fn()
  }

  const mockTypedEventService = {
    emit: jest.fn(),
    waitForEvent: jest.fn()
  }

  const mockEmbedManager = {
    createCharacter: jest.fn(),
    createCharacterCreatedEmbed: jest.fn(),
    createSectionedEmbeds: jest.fn()
  }

  const mockModalSessionManager = {
    getSession: jest.fn(),
    removeSession: jest.fn()
  }

  beforeEach(async () => {
    // デバッグ/エラーログの抑制（挙動には影響しない）
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined)
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)

    const moduleRef = await Test.createTestingModule({
      providers: [
        CharacterModalHandlerService,
        { provide: CharacterService, useValue: mockCharacterService },
        { provide: TypedEventService, useValue: mockTypedEventService },
        { provide: CharacterEmbedManagerService, useValue: mockEmbedManager },
        { provide: ModalSessionManagerService, useValue: mockModalSessionManager }
      ]
    }).compile()

    service = moduleRef.get<CharacterModalHandlerService>(CharacterModalHandlerService)
    module = moduleRef

    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(async () => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
    await module.close()
  })

  // ===== キャラクター作成モーダル =====
  describe('handleModalSubmit - character creation', () => {
    it('正常系: 作成成功で editReply のみ・チャンネルへの重複投稿はしない（E-2f）', async () => {
      const createdCharacter = { characterId: 'c1', characterName: 'Hero' }
      mockEmbedManager.createCharacter.mockResolvedValue(createdCharacter)
      mockEmbedManager.createCharacterCreatedEmbed.mockReturnValue({ data: 'success-embed' })
      mockEmbedManager.createSectionedEmbeds.mockResolvedValue({
        embeds: ['e1'],
        components: ['cmp1']
      })

      const channelSend = jest.fn().mockResolvedValue(undefined)
      const interaction = createMockModalInteraction({
        customId: 'character-create-basic-chan123-user456',
        fields: {
          'character-name': 'Hero',
          'game-system': 'coc'
        }
      })
      // channel に send を持たせる（'send' in channel が true になる）
      ;(interaction as unknown as { channel: unknown }).channel = { send: channelSend }

      await service.handleModalSubmit(interaction)

      expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true })
      // createCharacter は (characterData, channelId, userId)
      expect(mockEmbedManager.createCharacter).toHaveBeenCalledWith(
        {
          characterName: 'Hero',
          gameSystemId: 'coc',
          discordUserId: interaction.user.id,
          discordChannelId: interaction.channelId
        },
        'chan123',
        'user456'
      )
      expect(mockEmbedManager.createCharacterCreatedEmbed).toHaveBeenCalledWith(createdCharacter)
      expect(interaction.editReply).toHaveBeenCalledWith({
        embeds: [{ data: 'success-embed' }],
        components: []
      })
      // チャンネルへのセクション Embed は creation.completed 経由（CharacterCreationCompletedHandler）が
      // 送信するため、modal-handler 自身は送らない（送ると二重投稿＝E-2f の characterization）
      expect(channelSend).not.toHaveBeenCalled()
      expect(mockEmbedManager.createSectionedEmbeds).not.toHaveBeenCalled()
    })

    it('作成データ無効(キャラ名空)でエラーレスポンス', async () => {
      const interaction = createMockModalInteraction({
        customId: 'character-create-basic-chan123-user456',
        fields: {
          'character-name': '   ',
          'game-system': 'coc'
        }
      })

      await service.handleModalSubmit(interaction)

      expect(mockEmbedManager.createCharacter).not.toHaveBeenCalled()
      expect(interaction.editReply).toHaveBeenCalledWith({
        embeds: [expect.any(Object)],
        components: []
      })
      // エラーEmbedのタイトル確認
      const arg = (interaction.editReply as jest.Mock).mock.calls[0][0]
      expect(arg.embeds[0].data.title).toBe('❌ エラー')
      expect(arg.embeds[0].data.description).toBe('キャラクター作成データの取得に失敗しました。')
    })

    it('createCharacter が null を返すとエラーレスポンス', async () => {
      mockEmbedManager.createCharacter.mockResolvedValue(null)
      const interaction = createMockModalInteraction({
        customId: 'character-create-basic-chan123-user456',
        fields: { 'character-name': 'Hero', 'game-system': 'coc' }
      })

      await service.handleModalSubmit(interaction)

      expect(mockEmbedManager.createCharacter).toHaveBeenCalled()
      const arg = (interaction.editReply as jest.Mock).mock.calls[0][0]
      expect(arg.embeds[0].data.title).toBe('❌ エラー')
      expect(arg.embeds[0].data.description).toBe('キャラクターの作成に失敗しました。')
    })
  })

  // ===== キャラクター編集モーダル =====
  describe('handleModalSubmit - character edit', () => {
    const character = {
      characterId: 'char-1',
      discordChannelId: 'dch-1',
      discordUserId: 'duser-1',
      status: { hp: { name: 'HP', values: { base: 10 } } }
    }

    function setupSession() {
      mockModalSessionManager.getSession.mockReturnValue({
        characterId: 'char-1',
        sectionType: 'status',
        fieldKey: 'hp'
      })
    }

    it('正常系: フィールド更新成功で embed 更新・deleteReply', async () => {
      setupSession()

      // DI 化: 取得は findOne（初回＋更新後の再取得）、更新は update が直接呼ばれる
      mockCharacterService.findOne.mockResolvedValue(character)
      mockCharacterService.update.mockResolvedValue(character)
      mockTypedEventService.emit.mockResolvedValue(undefined)

      mockEmbedManager.createSectionedEmbeds.mockResolvedValue({ embeds: ['e'], components: ['c'] })

      const interaction = createMockModalInteraction({
        customId: 'char-edit-modal-0001',
        fields: {
          'field-values': '20',
          'field-description': 'desc'
        }
      })
      // channel は messages/send を持たない default -> updateExistingCharacterEditEmbed は早期 return
      ;(interaction as unknown as { channel: unknown }).channel = {}

      const promise = service.handleModalSubmit(interaction)
      // 200ms 待機の setTimeout を進める
      await jest.advanceTimersByTimeAsync(200)
      await promise

      // セッション取得・削除
      expect(mockModalSessionManager.getSession).toHaveBeenCalledWith('0001')
      expect(mockModalSessionManager.removeSession).toHaveBeenCalledWith('0001')

      // 更新は CharacterService.update の直呼び（RPC ではない）
      expect(mockCharacterService.update).toHaveBeenCalledWith('char-1', {
        status: {
          // formData.name が無いため finalName = fieldKey('hp')。
          // 既存 sectionData の hp は AttributeValue で丸ごと置換される（現挙動）
          hp: expect.objectContaining({
            name: 'hp',
            values: { base: 20 },
            description: 'desc',
            dice: null,
            isVisible: true,
            index: null
          })
        }
      })

      // 通知連鎖の characterization: 成功時は completed が本サービスから発行される
      // （CharacterUpdateCompletedHandler の UI 連鎖が生き続ける保証）
      expect(mockTypedEventService.emit).toHaveBeenCalledWith(
        'character.update.completed',
        expect.objectContaining({
          channelId: 'dch-1',
          character,
          source: 'character-modal-handler'
        })
      )

      // 回帰ガード: RPC（waitForEvent / requested イベント）へ戻っていないこと
      expect(mockTypedEventService.waitForEvent).not.toHaveBeenCalled()
      expect(mockTypedEventService.emit.mock.calls.some((c) => c[0] === 'character.update.requested')).toBe(false)
      expect(mockTypedEventService.emit.mock.calls.some((c) => c[0] === 'character.findById.requested')).toBe(false)

      // 取得は findOne 直呼び（初回＋更新後の再取得の2回）
      expect(mockCharacterService.findOne).toHaveBeenCalledTimes(2)
      expect(mockCharacterService.findOne).toHaveBeenCalledWith('char-1')

      // 成功時は deleteReply が呼ばれる
      expect(interaction.deleteReply).toHaveBeenCalled()
    })

    it('セッション無し(customId解析失敗)でエラーレスポンス', async () => {
      mockModalSessionManager.getSession.mockReturnValue(undefined)

      const interaction = createMockModalInteraction({
        customId: 'char-edit-modal-9999',
        fields: { 'field-values': '20' }
      })

      await service.handleModalSubmit(interaction)

      const arg = (interaction.editReply as jest.Mock).mock.calls[0][0]
      expect(arg.embeds[0].data.title).toBe('❌ エラー')
      expect(arg.embeds[0].data.description).toBe('モーダル情報の解析に失敗しました。')
      expect(mockTypedEventService.emit).not.toHaveBeenCalled()
      expect(mockCharacterService.findOne).not.toHaveBeenCalled()
      expect(mockCharacterService.update).not.toHaveBeenCalled()
    })

    it('フォームデータが全て空でエラーレスポンス', async () => {
      setupSession()
      const interaction = createMockModalInteraction({
        customId: 'char-edit-modal-0001',
        fields: {} // 全フィールド '' -> values/dice/description すべて undefined
      })

      await service.handleModalSubmit(interaction)

      const arg = (interaction.editReply as jest.Mock).mock.calls[0][0]
      expect(arg.embeds[0].data.description).toBe('フォームデータの取得に失敗しました。')
    })

    it('キャラクターが見つからない場合エラーレスポンス', async () => {
      setupSession()
      // getCharacter(初回) が null（findOne 直呼びで null）
      mockCharacterService.findOne.mockResolvedValue(null)

      const interaction = createMockModalInteraction({
        customId: 'char-edit-modal-0001',
        fields: { 'field-values': '20' }
      })

      await service.handleModalSubmit(interaction)

      const arg = (interaction.editReply as jest.Mock).mock.calls[0][0]
      expect(arg.embeds[0].data.description).toBe('キャラクターが見つかりません。')
      // 回帰ガード: findById RPC へ戻っていないこと
      expect(mockTypedEventService.emit.mock.calls.some((c) => c[0] === 'character.findById.requested')).toBe(false)
      expect(mockTypedEventService.waitForEvent).not.toHaveBeenCalled()
      expect(mockCharacterService.update).not.toHaveBeenCalled()
    })

    it('更新失敗(update が reject)でエラーレスポンス・completed は発行しない', async () => {
      setupSession()
      mockCharacterService.findOne.mockResolvedValue(character)
      mockCharacterService.update.mockRejectedValue(new Error('update failed'))

      const interaction = createMockModalInteraction({
        customId: 'char-edit-modal-0001',
        fields: { 'field-values': '20' }
      })

      await service.handleModalSubmit(interaction)

      const arg = (interaction.editReply as jest.Mock).mock.calls[0][0]
      expect(arg.embeds[0].data.description).toBe('キャラクター情報の更新に失敗しました。')
      // 通知連鎖の characterization: 失敗時は completed を emit しない
      expect(mockTypedEventService.emit.mock.calls.some((c) => c[0] === 'character.update.completed')).toBe(false)
      // 回帰ガード: update RPC へ戻っていないこと
      expect(mockTypedEventService.emit.mock.calls.some((c) => c[0] === 'character.update.requested')).toBe(false)
      expect(mockTypedEventService.waitForEvent).not.toHaveBeenCalled()
    })

    it('更新失敗(update が null を返す)でエラーレスポンス・completed は発行しない', async () => {
      setupSession()
      mockCharacterService.findOne.mockResolvedValue(character)
      mockCharacterService.update.mockResolvedValue(null)

      const interaction = createMockModalInteraction({
        customId: 'char-edit-modal-0001',
        fields: { 'field-values': '20' }
      })

      await service.handleModalSubmit(interaction)

      const arg = (interaction.editReply as jest.Mock).mock.calls[0][0]
      expect(arg.embeds[0].data.description).toBe('キャラクター情報の更新に失敗しました。')
      expect(mockTypedEventService.emit.mock.calls.some((c) => c[0] === 'character.update.completed')).toBe(false)
    })

    it('レガシー形式 customId を解析できる', async () => {
      // char-edit-{sectionType}-{fieldKey}-{characterId}
      mockCharacterService.findOne.mockResolvedValue(character)
      mockCharacterService.update.mockResolvedValue(character)
      mockTypedEventService.emit.mockResolvedValue(undefined)
      mockEmbedManager.createSectionedEmbeds.mockResolvedValue({ embeds: [], components: [] })

      const interaction = createMockModalInteraction({
        customId: 'char-edit-status-hp-char-1',
        fields: { 'field-values': '20' }
      })
      ;(interaction as unknown as { channel: unknown }).channel = {}

      const promise = service.handleModalSubmit(interaction)
      await jest.advanceTimersByTimeAsync(200)
      await promise

      // レガシー形式ではセッションは使われない
      expect(mockModalSessionManager.getSession).not.toHaveBeenCalled()
      expect(mockCharacterService.update).toHaveBeenCalledWith('char-1', expect.any(Object))
    })
  })

  // ===== 例外時のエラーハンドリング =====
  describe('handleModalSubmit - error handling', () => {
    it('処理中に例外が発生したらエラーレスポンスを送る', async () => {
      mockModalSessionManager.getSession.mockReturnValue({
        characterId: 'char-1',
        sectionType: 'status',
        fieldKey: 'hp'
      })
      // findOne を reject させると getCharacter 内の catch で null になる
      mockCharacterService.findOne.mockRejectedValue(new Error('boom'))

      const interaction = createMockModalInteraction({
        customId: 'char-edit-modal-0001',
        fields: { 'field-values': '20' }
      })

      await service.handleModalSubmit(interaction)

      // getCharacter 内の catch で null → 'キャラクターが見つかりません。'
      const arg = (interaction.editReply as jest.Mock).mock.calls[0][0]
      expect(arg.embeds[0].data.title).toBe('❌ エラー')
    })
  })
})
