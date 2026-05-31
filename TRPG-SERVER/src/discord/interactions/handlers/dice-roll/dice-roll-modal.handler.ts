import { Injectable } from '@nestjs/common'
import { ModalSubmitInteraction } from 'discord.js'
import { ModalInteractionHandler } from '../base/interaction-handler.base'
import { CustomDiceModalService } from '../../modal/custom-dice-modal.service'

/**
 * ダイスロールモーダルハンドラー
 *
 * customId: custom-dice-modal または param-dice-modal*{characterId}
 */
@Injectable()
export class DiceRollModalHandler extends ModalInteractionHandler {
  constructor(private readonly customDiceModalService: CustomDiceModalService) {
    super()
  }

  getCustomIdPattern(): RegExp {
    return /^(custom|param)-dice-modal/
  }

  async execute(interaction: ModalSubmitInteraction): Promise<void> {
    this.logger.debug(`Handling dice roll modal: ${interaction.customId}`)
    await this.customDiceModalService.execute(interaction)
  }
}
