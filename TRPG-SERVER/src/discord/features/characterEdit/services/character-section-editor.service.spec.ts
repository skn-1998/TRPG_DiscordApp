/**
 * CharacterSectionEditorService characterization tests
 *
 * 手順0: リファクタ前の現挙動を固定する characterization テスト。
 * section / field 専用入口の外部挙動（どの interaction メソッドを呼ぶか、
 * どの依存をどう呼ぶか）を、依存を最小モックして記録する。
 * リファクタ後もこれらが緑であることで挙動不変を証明する。
 *
 * 注: discord.js builder はグローバル jest.mock（test/utils/jest-setup.ts）で
 * モック化されており .data などの内部構造を持たない。そのため modal の中身
 * （fieldName / values / dice / description の 3 分岐振り分け）は本テストでは検証せず、
 * 抽出した Pure 関数 extractFieldEditValues の単体テスト（同ディレクトリ）で固定する。
 * ここでは「どの interaction メソッドが呼ばれたか」「依存への引数」を固定する。
 */

import { Test, TestingModule } from '@nestjs/testing'
import { HttpException, Logger } from '@nestjs/common'
import { MessageFlags } from 'discord.js'
import { CharacterSectionEditorService } from './character-section-editor.service'
import { CharacterService } from '../../../../domains/character/character.service'
import { TypedEventService } from '../../../../core/events/typed-event.service'
import { CharacterEmbedManagerService } from './character-embed-manager.service'
import { ModalSessionManagerService } from './modal-session-manager.service'
import { ErrorHandler } from '../../../../core/http/error-handler'

type AnyInteraction = Record<string, unknown>

describe('CharacterSectionEditorService', () => {
  let service: CharacterSectionEditorService
  let characterService: { findOne: jest.Mock }
  let typedEventService: { emit: jest.Mock; waitForEvent: jest.Mock }
  let embedManager: {
    createFieldSelectMenu: jest.Mock
    createSectionedEmbeds: jest.Mock
  }
  let modalSessionManager: { createSession: jest.Mock }
  let warnSpy: jest.SpyInstance

  const buildCharacter = (overrides: Record<string, unknown> = {}) => ({
    characterId: 'abc123', // 短いID (<=8) -> 直接 customId
    characterName: 'テスト太郎',
    status: {},
    parameter: {},
    skill: {},
    item: {},
    ...overrides
  })

  /** getCharacter（CharacterService.findOne の DI 直呼び・E-2b）を成功させるモック設定 */
  const mockCharacterFound = (character: unknown) => {
    characterService.findOne.mockResolvedValue(character)
  }

  const mockCharacterNotFound = () => {
    characterService.findOne.mockResolvedValue(null)
  }

  /**
   * interaction モック。Discord の応答メソッドに合わせて deferred / replied を遷移させる。
   */
  const buildInteraction = (customId: string, values: string[] = []): AnyInteraction => {
    const interaction: AnyInteraction = {
      customId,
      values,
      user: { id: 'user-1' },
      deferred: false,
      replied: false,
      message: { embeds: [{ title: 'original-embed' }] },
      showModal: jest.fn().mockResolvedValue(undefined)
    }
    interaction.deferUpdate = jest.fn().mockImplementation(() => {
      interaction.deferred = true
      return Promise.resolve(undefined)
    })
    interaction.editReply = jest.fn().mockImplementation(() => {
      interaction.replied = true
      return Promise.resolve(undefined)
    })
    interaction.reply = jest.fn().mockImplementation(() => {
      interaction.replied = true
      return Promise.resolve(undefined)
    })
    interaction.followUp = jest.fn().mockImplementation(() => {
      interaction.replied = true
      return Promise.resolve(undefined)
    })
    return interaction
  }

  beforeEach(async () => {
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    characterService = { findOne: jest.fn() }
    // 注入されない前提だが、旧イベント RPC（emit + waitForEvent）へ戻った場合に検知できるよう残置（E-2b 回帰ガード）
    typedEventService = { emit: jest.fn(), waitForEvent: jest.fn() }
    embedManager = {
      createFieldSelectMenu: jest.fn(),
      createSectionedEmbeds: jest.fn()
    }
    modalSessionManager = { createSession: jest.fn() }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CharacterSectionEditorService,
        { provide: CharacterService, useValue: characterService },
        { provide: TypedEventService, useValue: typedEventService },
        { provide: CharacterEmbedManagerService, useValue: embedManager },
        { provide: ModalSessionManagerService, useValue: modalSessionManager }
      ]
    }).compile()

    service = module.get(CharacterSectionEditorService)
  })

  afterEach(() => jest.restoreAllMocks())

  describe('defer 分岐 (characterization)', () => {
    it('フィールド操作以外 (section選択) は deferUpdate する', async () => {
      mockCharacterFound(buildCharacter())
      embedManager.createFieldSelectMenu.mockReturnValue(undefined) // 失敗で早期 return
      const interaction = buildInteraction('character-edit-section-abc123', ['status'])

      await service.handleSectionSelectInteraction(interaction as never)

      expect(interaction.deferUpdate).toHaveBeenCalledTimes(1)
      expect((interaction.deferUpdate as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
        characterService.findOne.mock.invocationCallOrder[0]
      )
    })

    it('フィールド編集 (character-field-edit) は deferUpdate せず showModal する', async () => {
      mockCharacterFound(buildCharacter())
      const interaction = buildInteraction('character-field-edit-status-abc123', ['hp'])

      await service.handleFieldSelectInteraction(interaction as never)

      expect(interaction.deferUpdate).not.toHaveBeenCalled()
      expect(interaction.showModal).toHaveBeenCalledTimes(1)
      // 旧イベント RPC（emit + waitForEvent）へ戻っていないことを固定（E-2b の回帰ガード）
      expect(typedEventService.waitForEvent).not.toHaveBeenCalled()
      expect(typedEventService.emit).not.toHaveBeenCalledWith('character.findById.requested', expect.anything())
    })

    it('フィールド追加 (character-field-add) は deferUpdate せず showModal する', async () => {
      mockCharacterFound(buildCharacter())
      const interaction = buildInteraction('character-field-add-status-abc123', ['add_new'])

      await service.handleFieldSelectInteraction(interaction as never)

      expect(interaction.deferUpdate).not.toHaveBeenCalled()
      expect(interaction.showModal).toHaveBeenCalledTimes(1)
    })

    it('field pattern の契約外 customId は defer 後に warn し ephemeral followUp する', async () => {
      const interaction = buildInteraction('character-field-delete-status-abc123', ['hp'])

      await service.handleFieldSelectInteraction(interaction as never)

      expect(interaction.deferUpdate).toHaveBeenCalledTimes(1)
      expect(warnSpy).toHaveBeenCalledWith('Unsupported character field customId: character-field-delete-status-abc123')
      expect(interaction.followUp).toHaveBeenCalledWith({
        content: '⚠️ このインタラクションは現在処理できません。',
        flags: MessageFlags.Ephemeral
      })
      expect((interaction.deferUpdate as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
        warnSpy.mock.invocationCallOrder[0]
      )
      expect(warnSpy.mock.invocationCallOrder[0]).toBeLessThan(
        (interaction.followUp as jest.Mock).mock.invocationCallOrder[0]
      )
      expect(characterService.findOne).not.toHaveBeenCalled()
    })
  })

  describe('characterId 抽出失敗 (characterization)', () => {
    it('抽出できない customId はエラーメッセージを followUp する (deferUpdate 済み)', async () => {
      const interaction = buildInteraction('totally-unknown-id', ['x'])

      await service.handleSectionSelectInteraction(interaction as never)

      expect(interaction.deferUpdate).toHaveBeenCalledTimes(1)
      expect(interaction.followUp).toHaveBeenCalledWith({
        content: 'キャラクター情報の取得に失敗しました。',
        flags: MessageFlags.Ephemeral
      })
      expect(interaction.editReply).not.toHaveBeenCalled()
      expect(interaction.showModal).not.toHaveBeenCalled()
    })
  })

  describe('character 取得失敗 (characterization)', () => {
    it('キャラクターが見つからない場合は followUp でエラー', async () => {
      mockCharacterNotFound()
      const interaction = buildInteraction('character-edit-section-abc123', ['status'])

      await service.handleSectionSelectInteraction(interaction as never)

      expect(interaction.followUp).toHaveBeenCalledTimes(1)
      expect(interaction.editReply).not.toHaveBeenCalled()
      expect(interaction.showModal).not.toHaveBeenCalled()
    })

    it('findOne が reject しても catch→null 契約で followUp エラーになる', async () => {
      characterService.findOne.mockRejectedValue(new Error('DB error'))
      const interaction = buildInteraction('character-edit-section-abc123', ['status'])

      await service.handleSectionSelectInteraction(interaction as never)

      expect(interaction.followUp).toHaveBeenCalledTimes(1)
      expect(interaction.editReply).not.toHaveBeenCalled()
      expect(interaction.showModal).not.toHaveBeenCalled()
    })
  })

  describe('セクション選択 (characterization)', () => {
    it('section選択で createFieldSelectMenu を正しい引数で呼び editReply する', async () => {
      mockCharacterFound(buildCharacter())
      embedManager.createFieldSelectMenu.mockReturnValue({ __fieldMenu: true })
      const interaction = buildInteraction('character-edit-section-abc123', ['status'])

      await service.handleSectionSelectInteraction(interaction as never)

      expect(embedManager.createFieldSelectMenu).toHaveBeenCalledWith(
        expect.objectContaining({ characterId: 'abc123' }),
        'status',
        'abc123'
      )
      expect(interaction.editReply).toHaveBeenCalledTimes(1)
      const arg = (interaction.editReply as jest.Mock).mock.calls[0][0]
      // 元 embed を保持し、2 行 (field + back) を返す
      expect(arg.embeds).toEqual([{ title: 'original-embed' }])
      expect(arg.components).toHaveLength(2)
      // キャラクター取得は CharacterService.findOne の直呼び（E-2b）
      expect(characterService.findOne).toHaveBeenCalledWith('abc123')
      // 旧イベント RPC（emit + waitForEvent）へ戻っていないことを固定（E-2b の回帰ガード）
      expect(typedEventService.waitForEvent).not.toHaveBeenCalled()
      expect(typedEventService.emit).not.toHaveBeenCalledWith('character.findById.requested', expect.anything())
    })

    it('findOne の戻り値（plain な CharacterEntity）をそのまま createFieldSelectMenu へ渡す（E-6d: repository 境界の plain 化保証により toObject ガードは撤去済み）', async () => {
      const plain = buildCharacter()
      mockCharacterFound(plain)
      embedManager.createFieldSelectMenu.mockReturnValue({ __fieldMenu: true })
      const interaction = buildInteraction('character-edit-section-abc123', ['status'])

      await service.handleSectionSelectInteraction(interaction as never)

      expect(embedManager.createFieldSelectMenu).toHaveBeenCalledWith(plain, 'status', 'abc123')
    })

    it('character-section-select でも section選択として扱う', async () => {
      mockCharacterFound(buildCharacter())
      embedManager.createFieldSelectMenu.mockReturnValue({ __fieldMenu: true })
      const interaction = buildInteraction('character-section-select-abc123', ['skill'])

      await service.handleSectionSelectInteraction(interaction as never)

      expect(embedManager.createFieldSelectMenu).toHaveBeenCalledWith(expect.anything(), 'skill', 'abc123')
      expect(interaction.editReply).toHaveBeenCalledTimes(1)
    })

    it('back 選択は main section menu (createSectionedEmbeds) を editReply', async () => {
      mockCharacterFound(buildCharacter())
      embedManager.createSectionedEmbeds.mockResolvedValue({
        embeds: [{ title: 'main' }],
        components: [{ __row: true }]
      })
      const interaction = buildInteraction('character-edit-section-abc123', ['back'])

      await service.handleSectionSelectInteraction(interaction as never)

      expect(embedManager.createSectionedEmbeds).toHaveBeenCalledTimes(1)
      expect(interaction.editReply).toHaveBeenCalledWith({
        embeds: [{ title: 'main' }],
        components: [{ __row: true }]
      })
    })

    it('createFieldSelectMenu が falsy なら followUp でエラー (showModal せず)', async () => {
      mockCharacterFound(buildCharacter())
      embedManager.createFieldSelectMenu.mockReturnValue(undefined)
      const interaction = buildInteraction('character-edit-section-abc123', ['status'])

      await service.handleSectionSelectInteraction(interaction as never)

      expect(interaction.followUp).toHaveBeenCalledTimes(1)
      expect(interaction.editReply).not.toHaveBeenCalled()
      expect(interaction.showModal).not.toHaveBeenCalled()
    })
  })

  describe('フィールド選択 modal 生成 (characterization)', () => {
    it('短いID + 既存 AttributeValue 形式でも showModal が 1 回呼ばれる', async () => {
      const character = buildCharacter({
        status: { hp: { name: 'HP', values: { base: 10, buff: 5 }, dice: '3d6', description: '生命力' } }
      })
      mockCharacterFound(character)
      const interaction = buildInteraction('character-field-edit-status-abc123', ['hp'])

      await service.handleFieldSelectInteraction(interaction as never)

      expect(interaction.showModal).toHaveBeenCalledTimes(1)
      // session 採番は短いIDでは使われない
      expect(modalSessionManager.createSession).not.toHaveBeenCalled()
    })

    it('長いID (>8) は session 採番 (createSession) を使う', async () => {
      const character = buildCharacter({ characterId: 'a-very-long-character-id-1234567890' })
      mockCharacterFound(character)
      modalSessionManager.createSession.mockReturnValue('SESSION99')
      const interaction = buildInteraction('character-field-add-status-a-very-long-character-id-1234567890', [
        'add_new'
      ])

      await service.handleFieldSelectInteraction(interaction as never)

      expect(modalSessionManager.createSession).toHaveBeenCalledWith(
        'a-very-long-character-id-1234567890',
        'status',
        'add_new'
      )
      expect(interaction.showModal).toHaveBeenCalledTimes(1)
    })
  })

  describe('例外処理 (characterization)', () => {
    it('deferUpdate 済みでは ephemeral followUp してから元例外を ErrorHandler へ渡す', async () => {
      const originalError = new Error('boom')
      const handleServiceError = jest.spyOn(ErrorHandler, 'handleServiceError')
      mockCharacterFound(buildCharacter())
      embedManager.createFieldSelectMenu.mockImplementation(() => {
        throw originalError
      })
      const interaction = buildInteraction('character-edit-section-abc123', ['status'])

      await expect(service.handleSectionSelectInteraction(interaction as never)).rejects.toThrow(
        'サービス処理中にエラーが発生しました'
      )

      expect(handleServiceError).toHaveBeenCalledWith(
        originalError,
        { customId: 'character-edit-section-abc123', userId: 'user-1' },
        'CharacterSectionEditorService'
      )
      expect(interaction.followUp).toHaveBeenCalledWith({
        content: 'エラーが発生しました。もう一度お試しください。',
        flags: MessageFlags.Ephemeral
      })
      expect(interaction.editReply).not.toHaveBeenCalled()
      expect((interaction.followUp as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
        handleServiceError.mock.invocationCallOrder[0]
      )
    })

    it('未応答のフィールド操作ではエラー通知に reply を使う', async () => {
      mockCharacterFound(buildCharacter())
      const interaction = buildInteraction('character-field-edit-status-abc123', ['hp'])
      ;(interaction.showModal as jest.Mock).mockRejectedValue(new Error('showModal failed'))

      await expect(service.handleFieldSelectInteraction(interaction as never)).rejects.toThrow(
        'サービス処理中にエラーが発生しました'
      )

      expect(interaction.reply).toHaveBeenCalledTimes(1)
      expect(interaction.reply).toHaveBeenCalledWith({
        content: 'エラーが発生しました。もう一度お試しください。',
        flags: MessageFlags.Ephemeral
      })
      expect(interaction.editReply).not.toHaveBeenCalled()
      expect(interaction.followUp).not.toHaveBeenCalled()
    })

    it('応答済みのフィールド操作ではエラー通知に followUp を使う', async () => {
      mockCharacterFound(buildCharacter())
      const interaction = buildInteraction('character-field-edit-status-abc123', ['hp'])
      interaction.replied = true
      ;(interaction.showModal as jest.Mock).mockRejectedValue(new Error('showModal failed'))

      await expect(service.handleFieldSelectInteraction(interaction as never)).rejects.toThrow(
        'サービス処理中にエラーが発生しました'
      )

      expect(interaction.followUp).toHaveBeenCalledTimes(1)
      expect(interaction.followUp).toHaveBeenCalledWith({
        content: 'エラーが発生しました。もう一度お試しください。',
        flags: MessageFlags.Ephemeral
      })
      expect(interaction.editReply).not.toHaveBeenCalled()
      expect(interaction.reply).not.toHaveBeenCalled()
    })

    it('エラー通知自体が失敗しても元の HttpException を伝播する', async () => {
      const originalError = new HttpException('original section failure', 409)
      const handleServiceError = jest.spyOn(ErrorHandler, 'handleServiceError')
      mockCharacterFound(buildCharacter())
      embedManager.createFieldSelectMenu.mockImplementation(() => {
        throw originalError
      })
      const interaction = buildInteraction('character-edit-section-abc123', ['status'])
      const notificationError = new Error('notification failed')
      ;(interaction.followUp as jest.Mock).mockRejectedValue(notificationError)

      await expect(service.handleSectionSelectInteraction(interaction as never)).rejects.toBe(originalError)

      expect(interaction.followUp).toHaveBeenCalledTimes(1)
      expect(warnSpy).toHaveBeenCalledWith('Failed to send character section editor error response', notificationError)
      expect(handleServiceError).toHaveBeenCalledWith(
        originalError,
        { customId: 'character-edit-section-abc123', userId: 'user-1' },
        'CharacterSectionEditorService'
      )
      expect((interaction.followUp as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
        handleServiceError.mock.invocationCallOrder[0]
      )
    })
  })
})
