import type { DicePreviewRequest, DicePreviewResponse } from '@trpg/api-contract'
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator'

export class DicePreviewRequestDto implements DicePreviewRequest {
  @IsString()
  @IsNotEmpty()
  readonly notation: string

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  readonly gameSystemId?: string
}

export class DicePreviewResponseDto implements DicePreviewResponse {
  @IsNumber()
  readonly total: number

  @IsString()
  readonly details: string
}
