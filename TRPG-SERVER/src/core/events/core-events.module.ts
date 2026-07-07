import { Global, Module } from '@nestjs/common'
import { EventEmitterModule, EventEmitter2 } from '@nestjs/event-emitter'
import { TypedEventService } from './typed-event.service'

/**
 * コアイベントモジュール
 * アプリケーション全体で使用されるイベント基盤（EventEmitter2 / TypedEventService）を提供
 *
 * 注: 旧 SharedModule (src/shared/shared.module.ts) から移設したもの。
 * イベントバスは config と同様に正当なグローバル基盤であり、@Global で全域提供する。
 *
 * バスは EventEmitterModule.forRoot() が提供する EventEmitter2 の 1 インスタンスのみ（E-4c）。
 * 'TYPED_EVENT_EMITTER' はその alias であり、typed イベント（11 契約）と @OnEvent 監視イベントは
 * 同一バスに載る（イベント名の重複はゼロのため相互干渉なし）。
 * 設定は旧 typed 側（maxListeners:10 / verboseMemoryLeak:false）ではなく、
 * 監視性の高い forRoot 側（maxListeners:20 / verboseMemoryLeak:true）に統一した。
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
      maxListeners: 20,
      verboseMemoryLeak: true,
      ignoreErrors: false
    })
  ],
  providers: [
    {
      // forRoot が提供する EventEmitter2 と同一インスタンスへの alias（バス 1 インスタンス化・E-4c）
      provide: 'TYPED_EVENT_EMITTER',
      useExisting: EventEmitter2
    },
    {
      provide: TypedEventService,
      useFactory: (typedEventEmitter: EventEmitter2) => new TypedEventService(typedEventEmitter),
      inject: ['TYPED_EVENT_EMITTER']
    }
  ],
  exports: [TypedEventService]
})
export class CoreEventsModule {}
