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
import { TypedEventService } from 'src/core/events/typed-event.service'
import { CharacterEmbedManagerService } from './character-embed-manager.service'
import { ModalSessionManagerService } from './modal-session-manager.service'

describe('CharacterModalHandlerService (characterization)', () => {
  let service: CharacterModalHandlerService
  let module: TestingModule

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
    it('正常系: 作成成功で editReply と channel.send が呼ばれる', async () => {
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
      expect(channelSend).toHaveBeenCalledWith({
        content: '🎉 新しいキャラクター **Hero** が作成されました！',
        embeds: ['e1'],
        components: ['cmp1']
      })
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

      // getCharacter (findById) と updateCharacterField の waitForEvent 応答を順に返す
      // 呼び出し順:
      //  1) updateCharacterField -> waitForEvent x2 (race) -> resolve completed
      //  2) getCharacter(再取得) -> waitForEvent x2 (race)
      mockTypedEventService.emit.mockResolvedValue(undefined)
      // findById/update いずれも completed/failed の race 両側に character を返す
      mockTypedEventService.waitForEvent.mockImplementation(() => Promise.resolve({ character }) as never)

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

      // 更新イベント発行: character.update.requested
      const updateEmitCall = mockTypedEventService.emit.mock.calls.find((c) => c[0] === 'character.update.requested')
      expect(updateEmitCall).toBeDefined()
      expect(updateEmitCall[1]).toMatchObject({
        characterId: 'char-1',
        channelId: 'dch-1',
        userId: 'duser-1',
        source: 'character-modal-handler',
        updateData: {
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
        }
      })

      // findById イベントが発行されている
      const findByIdCalls = mockTypedEventService.emit.mock.calls.filter((c) => c[0] === 'character.findById.requested')
      expect(findByIdCalls.length).toBe(2)

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
      mockTypedEventService.emit.mockResolvedValue(undefined)
      // getCharacter(初回) が null 相当（character プロパティ無し）。
      // race の両側に値を返し undefined への in 演算を避ける
      mockTypedEventService.waitForEvent.mockResolvedValue({} as never)

      const interaction = createMockModalInteraction({
        customId: 'char-edit-modal-0001',
        fields: { 'field-values': '20' }
      })

      await service.handleModalSubmit(interaction)

      const arg = (interaction.editReply as jest.Mock).mock.calls[0][0]
      expect(arg.embeds[0].data.description).toBe('キャラクターが見つかりません。')
    })

    it('更新失敗(update.failed)でエラーレスポンス', async () => {
      setupSession()
      mockTypedEventService.emit.mockResolvedValue(undefined)
      // 1) getCharacter(初回): completed/failed の race 両側に character を返す
      // 2) updateCharacterField: update.completed/failed の race 両側に failed(character無し) を返す
      mockTypedEventService.waitForEvent.mockImplementation((event: string) => {
        if (event === 'character.findById.completed' || event === 'character.findById.failed') {
          return Promise.resolve({ character }) as never
        }
        // character.update.completed / character.update.failed
        return Promise.resolve({ error: 'failed' }) as never
      })

      const interaction = createMockModalInteraction({
        customId: 'char-edit-modal-0001',
        fields: { 'field-values': '20' }
      })

      await service.handleModalSubmit(interaction)

      const arg = (interaction.editReply as jest.Mock).mock.calls[0][0]
      expect(arg.embeds[0].data.description).toBe('キャラクター情報の更新に失敗しました。')
    })

    it('レガシー形式 customId を解析できる', async () => {
      // char-edit-{sectionType}-{fieldKey}-{characterId}
      mockTypedEventService.emit.mockResolvedValue(undefined)
      mockTypedEventService.waitForEvent.mockImplementation(() => Promise.resolve({ character }) as never)
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
      const updateEmitCall = mockTypedEventService.emit.mock.calls.find((c) => c[0] === 'character.update.requested')
      expect(updateEmitCall).toBeDefined()
      expect(updateEmitCall[1].characterId).toBe('char-1')
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
      // emit を reject させると getCharacter 内の catch で null になる
      mockTypedEventService.emit.mockRejectedValue(new Error('boom'))
      mockTypedEventService.waitForEvent.mockImplementation(() => new Promise(() => undefined))

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
