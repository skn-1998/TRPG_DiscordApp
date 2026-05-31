import { Test } from '@nestjs/testing'
// 本体ハンドラは barrel（events/index.ts）から GlobalEventBusService を import しており、
// その barrel は EventsModule → CharacterEditModule → character-ui.service と連鎖して
// スコープ外の既存型エラー（character-ui.service の never 推論）を巻き込む。
// jest.mock で barrel を軽量スタブに差し替え、実体読み込みと型診断の連鎖を断つ。
jest.mock('../../../../../events', () => ({
  GlobalEventBusService: class GlobalEventBusService {}
}))
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GlobalEventBusService } = require('../../../../../events')
import { CharacterEditFeatureHandler } from './character-edit-feature.handler'
import { TypedEventService } from '../../../../../shared/application/typed-event.service'

/**
 * CharacterEditFeatureHandler の現状挙動を固定するユニットテスト（T2b 安全網）
 *
 * このハンドラは characterEdit.* を TypedEventService で listen し、Feature 内部イベントと
 * グローバルイベント（GlobalEventBus）の橋渡しを行う。
 *
 * onModuleInit() で typedEventService.on() に登録されるため、モックした on() で
 * イベント名→コールバックをキャプチャし、該当コールバックを直接呼んで挙動を検証する
 * （private を覗かず、どのバスで受けるかに依存しない形）。
 *
 * T2b で「どちらのバスに何を emit するか」が変わったら、この assert を更新して差分を検出する。
 */
describe('CharacterEditFeatureHandler', () => {
  let handler: CharacterEditFeatureHandler
  let typedEventService: { on: jest.Mock; emit: jest.Mock }
  let globalEventBus: { emit: jest.Mock }
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
    globalEventBus = { emit: jest.fn().mockResolvedValue(true) }

    const moduleRef = await Test.createTestingModule({
      providers: [
        CharacterEditFeatureHandler,
        { provide: TypedEventService, useValue: typedEventService },
        { provide: GlobalEventBusService, useValue: globalEventBus }
      ]
    }).compile()

    handler = moduleRef.get(CharacterEditFeatureHandler)
    handler.onModuleInit()
  })

  describe('onModuleInit / ハンドラ登録', () => {
    it('characterEdit.* を TypedEventService に listen 登録する', () => {
      expect(registered.has('characterEdit.modal.submitted')).toBe(true)
      expect(registered.has('characterEdit.embed.refresh.requested')).toBe(true)
      expect(registered.has('characterEdit.validation.completed')).toBe(true)
      expect(registered.has('characterEdit.session.created')).toBe(true)
      expect(registered.has('characterEdit.error.occurred')).toBe(true)
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

    it('GlobalEventBus へ character.update.requested を期待ペイロードで emit する', async () => {
      // Arrange
      const cb = registered.get('characterEdit.modal.submitted')!

      // Act
      await cb(buildEvent())

      // Assert
      expect(globalEventBus.emit).toHaveBeenCalledTimes(1)
      expect(globalEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'character.update.requested',
          characterId: 'char-1',
          source: 'discord',
          userId: 'user-1',
          updateData: { status: { hp: 10 } }
        })
      )
    })

    it('TypedEventService へ characterEdit.embed.refresh.requested を emit する', async () => {
      // Arrange
      const cb = registered.get('characterEdit.modal.submitted')!

      // Act
      await cb(buildEvent())

      // Assert
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

    it('GlobalEventBus.emit が失敗すると characterEdit.error.occurred を発行する', async () => {
      // Arrange
      const cb = registered.get('characterEdit.modal.submitted')!
      globalEventBus.emit.mockRejectedValueOnce(new Error('emit failed'))

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

      // Assert: payload 内容は不変。バスのみ GlobalEventBus → TypedEventService へ repoint
      // （GlobalEventBus へは emit されなくなる）
      expect(globalEventBus.emit).not.toHaveBeenCalled()
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

  describe('characterEdit.validation.completed ハンドラ', () => {
    it('検証成功時はグローバルイベントを発行しない', async () => {
      // Arrange
      const cb = registered.get('characterEdit.validation.completed')!
      const event = {
        type: 'characterEdit.validation.completed',
        characterId: 'char-1',
        userId: 'user-1',
        timestamp: new Date(),
        validation: { sectionType: 'status', fieldKey: 'hp', value: 10, isValid: true }
      }

      // Act
      await cb(event)

      // Assert
      expect(globalEventBus.emit).not.toHaveBeenCalled()
      expect(typedEventService.emit).not.toHaveBeenCalled()
    })

    it('検証失敗時もグローバルイベントは発行しない（現状はログのみ）', async () => {
      // Arrange
      const cb = registered.get('characterEdit.validation.completed')!
      const event = {
        type: 'characterEdit.validation.completed',
        characterId: 'char-1',
        userId: 'user-1',
        timestamp: new Date(),
        validation: {
          sectionType: 'status',
          fieldKey: 'hp',
          value: -1,
          isValid: false,
          errors: ['HPは0以上']
        }
      }

      // Act
      await cb(event)

      // Assert
      expect(globalEventBus.emit).not.toHaveBeenCalled()
    })
  })

  describe('characterEdit.error.occurred ハンドラ', () => {
    it('severity=high のエラーは system.error.occurred を GlobalEventBus へ発行する', async () => {
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

      // Act
      await cb(event)

      // Assert
      expect(globalEventBus.emit).toHaveBeenCalledTimes(1)
      expect(globalEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'system.error.occurred',
          source: 'system',
          error: expect.objectContaining({
            code: 'SOME_ERROR',
            message: 'failure',
            severity: 'high',
            context: expect.objectContaining({ feature: 'characterEdit', characterId: 'char-1' })
          })
        })
      )
    })

    it('severity=medium のエラーはグローバル発行しない', async () => {
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
      expect(globalEventBus.emit).not.toHaveBeenCalled()
    })
  })
})
