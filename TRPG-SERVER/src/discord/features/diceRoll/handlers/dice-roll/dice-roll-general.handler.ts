import { Injectable } from '@nestjs/common'
import { ButtonInteraction } from 'discord.js'
import { ButtonInteractionHandler } from '../../../../interactions/handlers/base/interaction-handler.base'
import { CharacterDiceOrchestratorService } from '../../../../interactions/button/character-dice-orchestrator.service'

/**
 * 一般ダイスロールボタンハンドラー
 *
 * customId: roll*{diceExpression} (ダイス表記)
 *
 * 例: roll*1d100, roll*2d6
 */
@Injectable()
export class DiceRollGeneralHandler extends ButtonInteractionHandler {
  constructor(private readonly diceOrchestratorService: CharacterDiceOrchestratorService) {
    super()
  }

  getCustomIdPattern(): RegExp {
    // roll* で始まり、数字とdを含む（ダイス表記: 1d100, 2d6等）
    return /^roll\*\d+d\d+/
  }

  async execute(interaction: ButtonInteraction): Promise<void> {
    this.logger.debug(`Handling dice roll general: ${interaction.customId}`)
    await this.diceOrchestratorService.execute(interaction)
  }
}
