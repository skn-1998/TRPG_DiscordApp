import { Global, Module } from '@nestjs/common'
import { EventEmitterModule, EventEmitter2 } from '@nestjs/event-emitter'
import { TypedEventService, TypedEventEmitter } from './application/typed-event.service'

/**
 * 共有モジュール
 * アプリケーション全体で使用される共通サービスを提供
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
export class SharedModule {}
