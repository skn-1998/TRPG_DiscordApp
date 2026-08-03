import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { DicePreviewRequestDto, DicePreviewResponseDto } from './dto/dice-preview.dto'
import { DicePreviewRateLimitGuard } from './guards/dice-preview-rate-limit.guard'
import { DicePreviewService } from './dice-preview.service'

@ApiTags('ダイスロール')
@ApiBearerAuth()
@Controller('dice-roll')
@UseGuards(JwtAuthGuard, DicePreviewRateLimitGuard)
export class DicePreviewController {
  constructor(private readonly dicePreviewService: DicePreviewService) {}

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  preview(@Body() dto: DicePreviewRequestDto): Promise<DicePreviewResponseDto> {
    return this.dicePreviewService.preview(dto)
  }
}
