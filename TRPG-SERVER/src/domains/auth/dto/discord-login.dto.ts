import { IsNotEmpty, IsString, Matches } from 'class-validator'
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
 * ログイン入力DTO
 */
export class LoginInputDto {
  @IsString(ValidationUtils.requiredString('認証コード'))
  @IsNotEmpty()
  readonly code: string
}

/**
 * ログイン出力DTO
 */
export class LoginOutputDto {
  readonly message: string
  readonly discordUserId: string
  readonly userName: string
  readonly token: string
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

/**
 * validate-token用ヘッダーDTO
 */
export class ValidateTokenHeaderDto {
  @IsString({ message: 'Authorizationヘッダーは必須です' })
  @Matches(/^Bearer\s.+$/, { message: 'AuthorizationヘッダーはBearerトークン形式で指定してください' })
  readonly Authorization: string
}
