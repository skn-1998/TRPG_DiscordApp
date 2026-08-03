import { Module } from '@nestjs/common'
import { AuthTokenModule } from '../../auth/token/auth-token.module'
import { DiceRollModule } from '../dice-roll.module'
import { DicePreviewController } from './dice-preview.controller'
import { DicePreviewService } from './dice-preview.service'
import { DicePreviewRateLimitGuard } from './guards/dice-preview-rate-limit.guard'

@Module({
  imports: [AuthTokenModule, DiceRollModule],
  controllers: [DicePreviewController],
  providers: [DicePreviewService, DicePreviewRateLimitGuard]
})
export class DicePreviewModule {}
