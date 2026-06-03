import { Injectable } from '@nestjs/common'
import { ButtonInteraction } from 'discord.js'
import { ButtonInteractionHandler } from '../../../../interactions/handlers/base/interaction-handler.base'
import { CharacterDiceOrchestratorService } from '../../../../interactions/button/character-dice-orchestrator.service'

/**
 * カスタムダイスロールボタンハンドラー
 *
 * customId: roll*custom
 */
@Injectable()
export class DiceRollCustomHandler extends ButtonInteractionHandler {
  constructor(private readonly diceOrchestratorService: CharacterDiceOrchestratorService) {
    super()
  }

  getCustomIdPattern(): string {
    return 'roll*custom'
  }

  async execute(interaction: ButtonInteraction): Promise<void> {
    this.logger.debug(`Handling dice roll custom: ${interaction.customId}`)
    await this.diceOrchestratorService.execute(interaction)
  }
}
