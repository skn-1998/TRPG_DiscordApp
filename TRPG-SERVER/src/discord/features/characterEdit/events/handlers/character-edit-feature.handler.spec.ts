import { Test } from '@nestjs/testing'
import { CharacterEditFeatureHandler } from './character-edit-feature.handler'
import { TypedEventService } from '../../../../../core/events/typed-event.service'

/**
 * CharacterEditFeatureHandler の現状挙動を固定するユニットテスト（T2c 後）
 *
 * このハンドラは characterEdit.* を TypedEventService で listen し、Feature 内部イベントを処理する。
 *
 * onModuleInit() で typedEventService.on() に登録されるため、モックした on() で
 * イベント名→コールバックをキャプチャし、該当コールバックを直接呼んで挙動を検証する（private を覗かない）。
 *
 * T2c でレガシーバスへの dead emit を撤去した:
 *  - modal.submitted の character.update.requested（レガシーバス行き／dead。実際の modal→更新は
 *    character-modal-handler.service が TypedEventService 経由で別途処理する）
 *  - error.occurred(severity=high) の system.error.occurred（レガシーバス行き／dead）
 * E-3c で emit 元ゼロの dead listener（validation.completed / session.created）を撤去した。
 * 観測可能な挙動（TypedEventService 経由の発行・ログ）は不変であり、本テストはそれを引き続き保証する。
 */
describe('CharacterEditFeatureHandler', () => {
  let handler: CharacterEditFeatureHandler
  let typedEventService: { on: jest.Mock; emit: jest.Mock }
  // イベント名 → 登録されたハンドラコールバック
  let registered: Map<string, (event: any) => Promise<void> | void>

  beforeEach(async () => {
    jest.clearAllMocks()
    registered = new Map()

    typedEventService = {
      on: jest.fn((event: string, cb: (event: any) => Promise<void> | void) => {
        registered.set(event, cb)
      }),
      emit: jest.fn().mockResolvedValue(undefined)
    }

    const moduleRef = await Test.createTestingModule({
      providers: [CharacterEditFeatureHandler, { provide: TypedEventService, useValue: typedEventService }]
    }).compile()

    handler = moduleRef.get(CharacterEditFeatureHandler)
    handler.onModuleInit()
  })

  describe('onModuleInit / ハンドラ登録', () => {
    it('live な characterEdit.* のみ TypedEventService に listen 登録する', () => {
      expect(registered.has('characterEdit.modal.opened')).toBe(true)
      expect(registered.has('characterEdit.modal.submitted')).toBe(true)
      expect(registered.has('characterEdit.embed.refresh.requested')).toBe(true)
      expect(registered.has('characterEdit.error.occurred')).toBe(true)

      // E-3c: emit 元ゼロの dead listener（バリデーション完了 / セッション作成）は撤去済みのため、
      // 登録されるのは上記 live な 4 イベントのみ（全数チェックで再登録を防ぐ）
      expect(typedEventService.on).toHaveBeenCalledTimes(4)
    })
  })

  describe('characterEdit.modal.submitted ハンドラ', () => {
    const buildEvent = () => ({
      type: 'characterEdit.modal.submitted',
      characterId: 'char-1',
      userId: 'user-1',
      timestamp: new Date(),
      modal: {
        sectionType: 'status',
        fieldKey: 'hp',
        newValue: 10,
        oldValue: 5
      }
    })

    it('TypedEventService へ characterEdit.embed.refresh.requested を emit する', async () => {
      // Arrange
      const cb = registered.get('characterEdit.modal.submitted')!

      // Act
      await cb(buildEvent())

      // Assert: dead だった character.update.requested(レガシーバス) は撤去済みのため、
      // emit されるのは embed.refresh.requested の1件のみ
      expect(typedEventService.emit).toHaveBeenCalledTimes(1)
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'characterEdit.embed.refresh.requested',
        expect.objectContaining({
          characterId: 'char-1',
          userId: 'user-1',
          embed: expect.objectContaining({
            embedType: 'enhanced',
            section: 'status'
          })
        })
      )
    })

    it('embed.refresh.requested の emit が失敗すると characterEdit.error.occurred を発行する', async () => {
      // Arrange: refresh の emit を失敗させ、その後の error.occurred emit は成功させる
      const cb = registered.get('characterEdit.modal.submitted')!
      typedEventService.emit.mockRejectedValueOnce(new Error('emit failed')).mockResolvedValue(undefined)

      // Act
      await cb(buildEvent())

      // Assert: エラーイベントが TypedEventService 経由で発行される
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'characterEdit.error.occurred',
        expect.objectContaining({
          characterId: 'char-1',
          error: expect.objectContaining({
            code: 'MODAL_SUBMITTED_HANDLER_ERROR'
          })
        })
      )
    })
  })

  describe('characterEdit.embed.refresh.requested ハンドラ', () => {
    it('TypedEventService へ discord.embed.update.requested を updateMode=refresh で emit する（T2b 移設）', async () => {
      // Arrange
      const cb = registered.get('characterEdit.embed.refresh.requested')!
      const event = {
        type: 'characterEdit.embed.refresh.requested',
        characterId: 'char-1',
        userId: 'user-1',
        timestamp: new Date(),
        embed: {
          channelId: 'ch-1',
          embedType: 'enhanced',
          section: 'status'
        }
      }

      // Act
      await cb(event)

      // Assert
      expect(typedEventService.emit).toHaveBeenCalledTimes(1)
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'discord.embed.update.requested',
        expect.objectContaining({
          source: 'discord',
          channelId: 'ch-1',
          embedData: expect.objectContaining({
            channelId: 'ch-1',
            characterId: 'char-1',
            embedType: 'enhanced',
            updateMode: 'refresh'
          })
        })
      )
    })
  })

  describe('characterEdit.error.occurred ハンドラ', () => {
    it('severity=high のエラーでもレガシーバスへの dead 発行は撤去済みのため何も emit しない（ログのみ）', async () => {
      // Arrange
      const cb = registered.get('characterEdit.error.occurred')!
      const event = {
        type: 'characterEdit.error.occurred',
        characterId: 'char-1',
        userId: 'user-1',
        timestamp: new Date(),
        error: {
          code: 'SOME_ERROR',
          message: 'failure',
          operation: 'update',
          severity: 'high'
        }
      }

      // Act & Assert: 例外なくログ記録のみで完了する（バス再発行なし）
      await expect(cb(event)).resolves.toBeUndefined()
      expect(typedEventService.emit).not.toHaveBeenCalled()
    })

    it('severity=medium のエラーも何も emit しない', async () => {
      // Arrange
      const cb = registered.get('characterEdit.error.occurred')!
      const event = {
        type: 'characterEdit.error.occurred',
        characterId: 'char-1',
        userId: 'user-1',
        timestamp: new Date(),
        error: {
          code: 'SOME_ERROR',
          message: 'minor',
          operation: 'update',
          severity: 'medium'
        }
      }

      // Act
      await cb(event)

      // Assert
      expect(typedEventService.emit).not.toHaveBeenCalled()
    })
  })
})
