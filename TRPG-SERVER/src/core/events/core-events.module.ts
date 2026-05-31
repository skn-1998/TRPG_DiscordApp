import { Global, Module } from '@nestjs/common'
import { EventEmitterModule, EventEmitter2 } from '@nestjs/event-emitter'
import { TypedEventService, TypedEventEmitter } from './typed-event.service'

/**
 * コアイベントモジュール
 * アプリケーション全体で使用されるイベント基盤（EventEmitter2 / TypedEventService）を提供
 *
 * 注: 旧 SharedModule (src/shared/shared.module.ts) から移設したもの。
 * イベントバスは config と同様に正当なグローバル基盤であり、@Global で全域提供する。
 */
@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot({
      // EventEmitter2 の設定
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 10,
      verboseMemoryLeak: false,
      ignoreErrors: false
    })
  ],
  providers: [
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
      useFactory: (typedEventEmitter: EventEmitter2) => new TypedEventService(typedEventEmitter),
      inject: ['TYPED_EVENT_EMITTER']
    },
    {
      provide: TypedEventEmitter,
      useFactory: (typedEventService: TypedEventService) => new TypedEventEmitter(typedEventService),
      inject: [TypedEventService]
    }
  ],
  exports: [TypedEventService, TypedEventEmitter]
})
export class CoreEventsModule {}
