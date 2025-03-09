// src/character/dto/create-character.dto.ts
import { IsString } from 'class-validator';

export class CreateCharacterDto {
  @IsString()
  readonly characterId: string;

  @IsString()
  readonly discordUserId: string;

  @IsString()
  readonly name: string;

  readonly status: object = {};
  readonly parameter: object = {};
  readonly skill: object = {};
}

