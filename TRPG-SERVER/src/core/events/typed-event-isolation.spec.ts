import { Test, TestingModule } from '@nestjs/testing'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { CoreEventsModule } from './core-events.module'
import { TypedEventService } from './typed-event.service'

/**
 * CoreEventsModule の「バス 1 インスタンス」構成を固定する characterization テスト（E-4c）。
 *
 * 現状（core-events.module.ts）:
 *   - バスは EventEmitterModule.forRoot(...) が提供する EventEmitter2 の 1 インスタンスのみ。
 *   - 'TYPED_EVENT_EMITTER' はその alias（useExisting: EventEmitter2）。
 *   - したがって TypedEventService.emit したイベントは、@OnEvent / グローバル emitter の
 *     リスナーにも届く（同一インスタンスのため）。typed イベント 11 契約と @OnEvent 監視
 *     イベント（system.health.status 等）はイベント名が重複しないため相互干渉はない。
 *
 * 本ファイルは旧「2 インスタンス分離」を固定する characterization テストだったが、
 * E-4c の 1 バス化（意図的な統合）に伴い本内容へ置き換えた（ファイル名は歴史的経緯）。
 * 誤って 'TYPED_EVENT_EMITTER' を別インスタンスに戻した場合、このテストが落ちて気づける。
 */
describe('CoreEventsModule のバス 1 インスタンス化', () => {
  let module: TestingModule
  let typedEventService: TypedEventService
  let globalEmitter: EventEmitter2

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [CoreEventsModule]
    }).compile()

    await module.init()

    typedEventService = module.get<TypedEventService>(TypedEventService)
    globalEmitter = module.get<EventEmitter2>(EventEmitter2)
  })

  afterEach(async () => {
    globalEmitter.removeAllListeners()
    await module.close()
  })

  it("'TYPED_EVENT_EMITTER' はグローバル EventEmitter2 と同一インスタンスである（alias）", () => {
    // Arrange
    const aliasedEmitter = module.get<EventEmitter2>('TYPED_EVENT_EMITTER')

    // Assert
    expect(aliasedEmitter).toBe(globalEmitter)
  })

  it('TypedEventService.emit したイベントはグローバル EventEmitter2 のリスナーにも届く（1 バス）', async () => {
    // Arrange: グローバル側に @OnEvent 相当のリスナーを張る
    let globalReceived = false
    globalEmitter.on('character.created', () => {
      globalReceived = true
    })

    // Act: TypedEventService 経由で emit する（バスは同一インスタンス）
    await typedEventService.emit('character.created' as any, {
      characterId: 'char-1',
      source: 'single-bus-test',
      timestamp: new Date()
    })

    // Assert: 同一インスタンスのためグローバル側のリスナーにも届く
    expect(globalReceived).toBe(true)
  })

  it('TypedEventService に登録した on リスナーには自身の emit が届く（emit→on の往復）', async () => {
    // Arrange
    let typedReceived = false
    typedEventService.on('character.created' as any, () => {
      typedReceived = true
    })

    // Act
    await typedEventService.emit('character.created' as any, {
      characterId: 'char-2',
      source: 'single-bus-test',
      timestamp: new Date()
    })

    // Assert
    expect(typedReceived).toBe(true)
  })
})
