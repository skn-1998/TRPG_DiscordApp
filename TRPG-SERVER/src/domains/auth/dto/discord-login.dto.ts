import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Discord ログインリクエストのDTO
 */
export class DiscordLoginDto {
  /**
   * Discord認証コード
   * @example 'abcdefghijklmnopqrstuvwxyz'
   */
  @IsNotEmpty({ message: '認証コードは必須です' })
  @IsString({ message: '認証コードは文字列である必要があります' })
  readonly code: string;
} 