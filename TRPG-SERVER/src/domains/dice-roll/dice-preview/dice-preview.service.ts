import { BadRequestException, Injectable, UnprocessableEntityException } from '@nestjs/common'
import { validateStandaloneRollNotation } from '@trpg/sheet-engine'
import { DiceExecutionService } from '../services/dice-execution.service'
import { DicePreviewRequestDto, DicePreviewResponseDto } from './dto/dice-preview.dto'

export const INVALID_DICE_NOTATION_MESSAGE = 'invalid notation'

@Injectable()
export class DicePreviewService {
  constructor(private readonly diceExecutionService: DiceExecutionService) {}

  async preview(dto: DicePreviewRequestDto): Promise<DicePreviewResponseDto> {
    const issues = validateStandaloneRollNotation(dto.notation)
    if (issues.length > 0) {
      throw new BadRequestException(issues.map((issue) => issue.message))
    }

    try {
      return await this.diceExecutionService.executeEvaluatedDiceRoll(dto.notation, dto.gameSystemId)
    } catch {
      throw new UnprocessableEntityException([INVALID_DICE_NOTATION_MESSAGE])
    }
  }
}
