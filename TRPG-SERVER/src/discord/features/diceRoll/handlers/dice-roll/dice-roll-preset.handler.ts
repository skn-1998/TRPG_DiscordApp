import { Injectable } from '@nestjs/common'
import { ButtonInteraction } from 'discord.js'
import { ButtonInteractionHandler } from '../../../../interactions/handlers/base/interaction-handler.base'
import { CharacterDiceOrchestratorService } from '../../../../interactions/button/character-dice-orchestrator.service'

/**
 * プリセットダイスロールボタンハンドラー
 *
 * customId: preset-dice*{presetId}_{characterId}
 */
@Injectable()
export class DiceRollPresetHandler extends ButtonInteractionHandler {
  constructor(private readonly diceOrchestratorService: CharacterDiceOrchestratorService) {
    super()
  }

  getCustomIdPattern(): string {
    return 'preset-dice*'
  }

  async execute(interaction: ButtonInteraction): Promise<void> {
    this.logger.debug(`Handling dice roll preset: ${interaction.customId}`)
    await this.diceOrchestratorService.execute(interaction)
  }
}
