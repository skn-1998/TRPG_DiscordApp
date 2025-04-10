// src/character/character.service.ts
import { Injectable } from '@nestjs/common';
import { Character, CharacterModel } from './models/character.model';
import { CreateCharacterDto } from './dto/create-character.dto';
import { UpdateCharacterDto } from './dto/update-character.dto';
import { Item } from 'dynamoose/dist/Item';
import { QueryResponse } from 'dynamoose/dist/ItemRetriever';

@Injectable()
export class CharacterService {
  async   create(name:string,discordUserId:string = ""):Promise<Item & Character> {
    const createCharacterDto: CreateCharacterDto = {
      characterId:crypto.randomUUID(),
      name:"",
      discordUserId:discordUserId,
      discordChannelId:"",
      skill:{},
      status:{},
      parameter:{}
    }
    try {
      console.log('Creating character with DTO:', JSON.stringify(createCharacterDto, null, 2));
      const character = new CharacterModel(createCharacterDto)
      console.log(character.name)
      await character.save();
      console.log(character.name+character.discordUserId)
      return character
    } catch (error:unknown) {
      console.error('Error creating character:', error);
      if(error instanceof Error)
      {
        console.log("this err is occur")
        console.log(error.message)
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
