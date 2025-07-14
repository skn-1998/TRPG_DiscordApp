import { Module } from '@nestjs/common'
import { SharedModule } from '../../../shared/shared.module'
import { DiscordModule } from '../../discord.module'
import { DiscordCharacterNamePrototype } from './discord-character-name.prototype'

/**
 * Discord プロトタイプモジュール
 * Discord統合機能のイベント駆動アーキテクチャ検証用実装
 */
@Module({
  imports: [
    SharedModule, // EventBusService を提供
    DiscordModule // DiscordService を提供
  ],
  providers: [DiscordCharacterNamePrototype],
  exports: [DiscordCharacterNamePrototype]
})
export class DiscordPrototypeModule {}
