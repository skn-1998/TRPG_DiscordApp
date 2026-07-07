import { Test, TestingModule } from '@nestjs/testing'
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter'
import { TypedEventService } from './typed-event.service'

/**
 * TypedEventService の独自 emitter とグローバル EventEmitter2 の「分離」を固定する
 * characterization テスト。
 *
 * 現状（core-events.module.ts）:
 *   - `@OnEvent` が購読するのは EventEmitterModule.forRoot(...) が提供するグローバル EventEmitter2。
 *   - 一方 TypedEventService には 'TYPED_EVENT_EMITTER' として「独立に new した」別の
 *     EventEmitter2 が注入される（core-events.module.ts:29-39）。
 *   - したがって TypedEventService.emit したイベントは、グローバル側の @OnEvent / on リスナーには
 *     届かない（2つの emitter は別インスタンスで完全に独立）。
 *
 * この「届かない」という現挙動を固定しておくことで、forRoot 統合リファクタ後も
 * この分離が維持されている（＝挙動が変わっていない）ことを保証する。
 * 逆に統合の過程で誤って両者を同一インスタンスに繋いでしまった場合、このテストが落ちて気づける。
 */
describe('TypedEventService とグローバル EventEmitter2 の分離', () => {
  let module: TestingModule
  let typedEventService: TypedEventService
  let globalEmitter: EventEmitter2

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        EventEmitterModule.forRoot({
          wildcard: false,
          delimiter: '.',
          newListener: false,
          removeListener: false,
          maxListeners: 20,
          verboseMemoryLeak: true,
          ignoreErrors: false
        })
      ],
      providers: [
        // core-events.module.ts と同じ構成: 独立した EventEmitter2 を TypedEventService に注入する
        {
          provide: 'TYPED_EVENT_EMITTER',
          useFactory: () =>
            new EventEmitter2({
              wildcard: false,
              delimiter: '.',
              newListener: false,
              removeListener: false,
              maxListeners: 10,
              verboseMemoryLeak: false,
              ignoreErrors: false
            })
        },
        {
          provide: TypedEventService,
          useFactory: (emitter: EventEmitter2) => new TypedEventService(emitter),
          inject: ['TYPED_EVENT_EMITTER']
        }
      ]
    }).compile()

    await module.init()

    typedEventService = module.get<TypedEventService>(TypedEventService)
    globalEmitter = module.get<EventEmitter2>(EventEmitter2)
  })

  afterEach(async () => {
    globalEmitter.removeAllListeners()
    await module.close()
  })

  it('注入された emitter とグローバル EventEmitter2 は別インスタンスである', () => {
    // Arrange
    const injectedEmitter = module.get<EventEmitter2>('TYPED_EVENT_EMITTER')

    // Assert
    expect(injectedEmitter).not.toBe(globalEmitter)
  })

  it('TypedEventService.emit したイベントはグローバル EventEmitter2 のリスナーには届かない（独立）', async () => {
    // Arrange: グローバル側に @OnEvent 相当のリスナーを張る
    let globalReceived = false
    globalEmitter.on('character.findById.requested', () => {
      globalReceived = true
    })

    // Act: TypedEventService（独立 emitter）経由で emit する
    // 注: character.findById.requested は E-3/E-4a で契約から削除済みの dead イベント名。
    //     本 spec は「emitter インスタンスの分離」だけを検証するため、契約外名を as any で通す。
    await typedEventService.emit('character.findById.requested' as any, {
      characterId: 'char-1',
      source: 'isolation-test',
      timestamp: new Date()
    })

    // Assert: グローバル側のリスナーは発火しない（別インスタンスのため）
    expect(globalReceived).toBe(false)
  })

  it('TypedEventService に登録した on リスナーには自身の emit が届く（往復は独立 emitter 内で成立）', async () => {
    // Arrange
    let typedReceived = false
    typedEventService.on('character.findById.requested' as any, () => {
      typedReceived = true
    })

    // Act
    await typedEventService.emit('character.findById.requested' as any, {
      characterId: 'char-2',
      source: 'isolation-test',
      timestamp: new Date()
    })

    // Assert: 独立 emitter 内では emit→on の往復が成立する
    expect(typedReceived).toBe(true)
  })
})
