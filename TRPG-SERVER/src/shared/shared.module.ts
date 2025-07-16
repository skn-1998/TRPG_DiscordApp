import { Global, Module } from '@nestjs/common'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { EventBusService } from './application/event-bus.service'
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
    EventBusService,
    TypedEventService,
    {
      provide: TypedEventEmitter,
      useFactory: (typedEventService: TypedEventService) => new TypedEventEmitter(typedEventService),
      inject: [TypedEventService]
    }
  ],
  exports: [EventBusService, TypedEventService, TypedEventEmitter]
})
export class SharedModule {}
