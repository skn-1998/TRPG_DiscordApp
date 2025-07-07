import { Module } from '@nestjs/common'
import { HttpModule } from '@nestjs/axios'
import { HttpClientService } from './services/http.service'

/**
 * 共通モジュール
 * 複数のドメインで使用される共通サービスを提供
 */
@Module({
  imports: [HttpModule],
  providers: [HttpClientService],
  exports: [HttpClientService]
})
export class SharedModule {}
