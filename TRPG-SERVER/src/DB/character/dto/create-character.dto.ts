// src/character/dto/create-character.dto.ts
import { IsString } from 'class-validator';

export class CreateCharacterDto {
  @IsString()
  readonly characterId: string;

  @IsString()
  readonly discordUserId: string;

  @IsString()
  readonly discordChannelId: string;

  @IsString()
  readonly characterName: string;

  @IsString()
  readonly TRPGName: string;

  readonly status: object = {};
  readonly parameter: object = {};
  readonly skill: object = {};
}

