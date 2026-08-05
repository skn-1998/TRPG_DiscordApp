import { IsDate, IsOptional, IsString, ValidationOptions } from 'class-validator'
import { Type } from 'class-transformer'

/**
 * 共通DTOフィールド
 */
export abstract class BaseDto {
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  readonly createdAt?: Date

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  readonly updatedAt?: Date
}

/**
 * Discord関連共通フィールド
 */
export abstract class DiscordDto extends BaseDto {
  @IsString()
  readonly discordUserId: string

  @IsOptional()
  @IsString()
  readonly discordChannelId?: string
}

/**
 * 共通バリデーションメッセージ
 */
export const ValidationMessages = {
  required: (field: string) => `${field}は必須です`,
  string: (field: string) => `${field}は文字列である必要があります`,
  number: (field: string) => `${field}は数値である必要があります`,
  boolean: (field: string) => `${field}は真偽値である必要があります`,
  array: (field: string) => `${field}は配列である必要があります`,
  date: (field: string) => `${field}は日付である必要があります`,
  email: (field: string) => `${field}は有効なメールアドレスである必要があります`,
  minLength: (field: string, min: number) => `${field}は${min}文字以上である必要があります`,
  maxLength: (field: string, max: number) => `${field}は${max}文字以下である必要があります`,
  min: (field: string, min: number) => `${field}は${min}以上である必要があります`,
  max: (field: string, max: number) => `${field}は${max}以下である必要があります`
}

/**
 * バリデーションオプション生成ユーティリティ
 */
export class ValidationUtils {
  /**
   * 必須文字列バリデーション
   */
  static requiredString(field: string): ValidationOptions {
    return {
      message: ValidationMessages.required(field)
    }
  }

  /**
   * オプショナル文字列バリデーション
   */
  static optionalString(field: string): ValidationOptions {
    return {
      message: ValidationMessages.string(field)
    }
  }

  /**
   * 配列バリデーション
   */
  static array(field: string): ValidationOptions {
    return {
      message: ValidationMessages.array(field)
    }
  }

  /**
   * 日付バリデーション
   */
  static date(field: string): ValidationOptions {
    return {
      message: ValidationMessages.date(field)
    }
  }
}
