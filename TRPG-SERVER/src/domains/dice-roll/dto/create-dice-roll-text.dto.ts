import { IsBoolean, IsOptional, IsString } from 'class-validator'
import { ValidationUtils } from '../../../core/dto/base.dto'

/**
 * ダイスロールテキスト入力DTO（部分入力可能）
 */
export class DiceRollTextInputDto {
  @IsString(ValidationUtils.optionalString('テキストID'))
  @IsOptional()
  readonly textId?: string

  @IsString(ValidationUtils.requiredString('チャンネルID'))
  readonly channelId: string

  @IsString(ValidationUtils.requiredString('ユーザーID'))
  readonly userId: string

  @IsString(ValidationUtils.requiredString('ダイス記法'))
  readonly diceExpression: string

  @IsOptional()
  readonly result?: number | string

  @IsString(ValidationUtils.optionalString('結果詳細'))
  @IsOptional()
  readonly resultDetails?: string

  @IsString(ValidationUtils.optionalString('理由'))
  @IsOptional()
  readonly reason?: string

  @IsString(ValidationUtils.optionalString('キャラクター名'))
  @IsOptional()
  readonly characterName?: string

  @IsString(ValidationUtils.optionalString('ゲームシステム'))
  @IsOptional()
  readonly gameSystem?: string

  // 後方互換性のための旧フィールド
  @IsString(ValidationUtils.optionalString('Discordチャンネル'))
  @IsOptional()
  readonly discordChannelId?: string

  @IsString(ValidationUtils.optionalString('キャラクターID'))
  @IsOptional()
  readonly characterId?: string

  @IsString(ValidationUtils.optionalString('ダイスロール'))
  @IsOptional()
  readonly diceRoll?: string

  @IsString(ValidationUtils.optionalString('テキスト'))
  @IsOptional()
  readonly text?: string

  @IsBoolean()
  @IsOptional()
  readonly isSecret?: boolean
}
