import { Global, Module } from '@nestjs/common'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { EventBusService } from './application/event-bus.service'

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
  providers: [EventBusService],
  exports: [EventBusService]
})
export class SharedModule {}
