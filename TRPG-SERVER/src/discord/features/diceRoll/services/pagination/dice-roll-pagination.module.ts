import { Module } from '@nestjs/common'
import { DiceRollModule } from 'src/domains/dice-roll/dice-roll.module'
import { DiceRollPaginationService } from './dice-roll-pagination.service'
import { DiceRollCharacterProviderService } from './dice-roll-character-provider.service'

/**
 * Dice Roll Pagination Module
 *
 * 🎯 目的: ダイスロール履歴ページネーション機構の DI 提供を独立モジュール化
 *
 * 📋 責務:
 * - DiceRollPaginationService（ページネーションのオーケストレーション）の提供
 * - DiceRollCharacterProviderService（キャラクター候補解決）の提供
 *
 * 🏗️ 位置づけ:
 * ARCHITECTURE §5.3「dice-roll pagination は diceRoll feature が所有」に沿って、
 * pagination 2 service の所有権を InteractionsModule から diceRoll feature 配下へ移管する。
 * pagination は InteractionsModule 側のサービス（button 系）と DiceRollFeatureModule 側の
 * adapter / handler の双方から必要とされるため、相互 import（循環）を避けるべく独立した
 * 共有モジュールとして切り出す（InteractionRegistryModule と同型のパターン）。
 *
 * ⚠️ 挙動不変: pagination の実体・customId 生成・routing は不変。提供元の module 境界のみ移動。
 */
@Module({
  imports: [DiceRollModule], // DiceRollService（DiceRollPaginationService / CharacterProvider の依存）解決のため
  providers: [DiceRollPaginationService, DiceRollCharacterProviderService],
  exports: [DiceRollPaginationService, DiceRollCharacterProviderService]
})
export class DiceRollPaginationModule {}
