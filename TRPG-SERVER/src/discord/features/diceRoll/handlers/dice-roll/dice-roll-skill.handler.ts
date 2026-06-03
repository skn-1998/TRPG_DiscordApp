import { Injectable } from '@nestjs/common'
import { ButtonInteraction } from 'discord.js'
import { ButtonInteractionHandler } from '../../../../interactions/handlers/base/interaction-handler.base'
import { CharacterDiceOrchestratorService } from '../../services/character-dice-orchestrator.service'

/**
 * ダイススキルロールボタンハンドラー
 *
 * customId: roll*{skill}_{channelId} (スキルロール)
 *
 * 例: roll*戦闘_1234567890
 */
@Injectable()
export class DiceRollSkillHandler extends ButtonInteractionHandler {
  constructor(private readonly diceOrchestratorService: CharacterDiceOrchestratorService) {
    super()
  }

  getCustomIdPattern(): RegExp {
    // roll* で始まり、_ を含む（スキルロール）
    return /^roll\*[^_]+_/
  }

  async execute(interaction: ButtonInteraction): Promise<void> {
    this.logger.debug(`Handling dice roll skill: ${interaction.customId}`)
    await this.diceOrchestratorService.execute(interaction)
  }
}
