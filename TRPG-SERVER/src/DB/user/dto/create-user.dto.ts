// src/character/dto/create-character.dto.ts
import { IsArray, IsString } from 'class-validator';

export class CreateUserDto {
  @IsString()
  readonly DiscordUserId: string;

  @IsString()
  readonly name: string;

  @IsArray()
  @IsString({each:true})
  readonly characterId: string[] = []
}
