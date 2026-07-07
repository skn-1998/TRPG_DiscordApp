import { Module } from '@nestjs/common'
import { DiceRollModule } from '../../../domains/dice-roll/dice-roll.module'
import { CharacterModule } from '../../../domains/character/character.module'
import { DiceRollLogicService } from './dice-roll-logic.service'
import { DiceOrchestratorService } from './dice-orchestrator.service'
import { DiceCalculationService } from './dice-calculation.service'
import { DiceParserService } from './dice-parser.service'

/**
 * Dice Services Module
 *
 * 🎯 目的: discord/services/dice 配下のダイス計算・ロジック系サービスを所有する中立モジュール。
 *
 * 📋 責務（providers/exports）:
 * - DiceRollLogicService: ボタン/セレクトからのダイスロール実行ロジック（旧 interactions/button から移設）。
 * - DiceOrchestratorService / DiceCalculationService / DiceParserService: ダイス計算・解析。
 *
 * 🏗️ 位置づけ（ARCHITECTURE §5.3 / §6 / §12）:
 * これらは特定 feature の所有物ではなく「複数の利用者（interactions の character-thread handler・
 * character-dice-buttons、diceRoll feature の orchestrator/custom-dice-modal）が使う横断的な dice 基盤」。
 * §6「features は横断基盤を所有しない」に従い services/dice（中立）に置き、本モジュールが所有する。
 * 旧来は interactions.module が ad-hoc に provide していた（§5.3 違反）のを是正。
 *
 * 🔗 依存は domains/core のみ（DiceRollModule・CharacterModule、TypedEventService は core-events の @Global）。
 *    上流（interactions/features）への依存はなく leaf module のため、誰が import しても循環は発生しない。
 */
@Module({
  imports: [DiceRollModule, CharacterModule],
  providers: [DiceRollLogicService, DiceOrchestratorService, DiceCalculationService, DiceParserService],
  exports: [DiceRollLogicService, DiceOrchestratorService, DiceCalculationService, DiceParserService]
})
export class DiceServicesModule {}
