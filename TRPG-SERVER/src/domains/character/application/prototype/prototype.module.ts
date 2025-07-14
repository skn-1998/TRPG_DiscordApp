import { Module } from '@nestjs/common'
import { SharedModule } from '../../../../shared/shared.module'
import { CharacterNameUpdatePrototype } from './character-name-update.prototype'
import { CharacterModule } from '../../character.module'

/**
 * プロトタイプモジュール
 * イベント駆動アーキテクチャの検証用最小限実装
 */
@Module({
  imports: [
    SharedModule, // EventBusService を提供
    CharacterModule // CharacterRepository を提供
  ],
  providers: [CharacterNameUpdatePrototype],
  exports: [CharacterNameUpdatePrototype]
})
export class PrototypeModule {}
