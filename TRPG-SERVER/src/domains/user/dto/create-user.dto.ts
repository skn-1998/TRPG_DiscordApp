import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateUserDto {
  @IsString()
  readonly discordUserId: string;

  @IsString()
  readonly name: string;

  @IsArray()
  @IsString({each: true})
  @IsOptional()
  readonly characterIds?: string[];
} 