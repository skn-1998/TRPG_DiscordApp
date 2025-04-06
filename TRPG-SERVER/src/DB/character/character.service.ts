// src/character/character.service.ts
import { Injectable } from '@nestjs/common';
import {  Character, CharacterModel } from './models/character.model';
import { CreateCharacterDto } from './dto/create-character.dto';
import { UpdateCharacterDto } from './dto/update-character.dto';
import { Item } from 'dynamoose/dist/Item';
import { QueryResponse } from 'dynamoose/dist/ItemRetriever';

@Injectable()
export class CharacterService {
  async   create(TRPGName:string,characterName:string,discordUserId:string = ""):Promise<Item & Character> {
    const createCharacterDto: CreateCharacterDto = {
      characterId:crypto.randomUUID(),
      characterName:characterName,
      TRPGName:TRPGName,
      discordUserId:discordUserId,
      discordChannelId:"",
      skill:{},
      status:{},
      parameter:{}
    }
    try {
      const character = new CharacterModel(createCharacterDto)
      await character.save();
      return character

    } catch (error:unknown) {
      console.error('Error creating character:', error);
      if(error instanceof Error)
      {
        throw new Error(error.message)
      }else
      {
        throw new Error("Unknown Error")
      }
    }
  }

  async findHavingAll(DiscordUserId:string): Promise<QueryResponse<Character>> {
    const character = await CharacterModel.query("DiscordUserId").eq(DiscordUserId).exec()
    return character
  }


  async findOne(characterId: string):  Promise<Character & Item> {
    return CharacterModel.get(characterId);
  }

  async update(characterId: string, updateCharacterDto: UpdateCharacterDto):  Promise<Item> {
    return CharacterModel.update({ characterId }, updateCharacterDto);
  }

  async remove(characterId: string): Promise<void> {
    await CharacterModel.delete(characterId);
  }
}
