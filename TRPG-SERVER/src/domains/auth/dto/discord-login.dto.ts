import { IsNotEmpty, IsString } from 'class-validator'
import { BaseDto, ValidationUtils } from '../../../core/dto/base.dto'

/**
 * Discord ログインリクエストのDTO
 */
export class DiscordLoginDto extends BaseDto {
  /**
   * Discord認証コード
   * @example 'abcdefghijklmnopqrstuvwxyz'
   */
  @IsNotEmpty(ValidationUtils.requiredString('認証コード'))
  @IsString(ValidationUtils.requiredString('認証コード'))
  readonly code: string
}

/**
 * トークン検証出力DTO
 */
export class TokenValidationOutputDto {
  readonly username: string
  readonly discordUserId: string
  readonly iat?: number
  readonly exp?: number
}
