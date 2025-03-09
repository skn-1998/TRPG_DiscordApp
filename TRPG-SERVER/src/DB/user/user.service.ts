// src/user/user.service.ts
import { Injectable } from '@nestjs/common';
import {  TRPGUser, TRPGUserModel} from './models/user.model';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Item } from 'dynamoose/dist/Item';
import _ from 'lodash';

@Injectable()
export class UserService {
  async   create(name:string,discordUserid:string = ""):Promise<Item> {
    const createUserDto: CreateUserDto = {
      DiscordUserId:discordUserid,
      name:name,
      characterId:[]
    }
    try
    {
      const user = new TRPGUserModel(createUserDto)
      return user.save();
    }catch(e)
    {
      throw new Error(e.message)
    }
  }

  async findAll(): Promise<Item[]> {
    return TRPGUserModel.scan().exec();
  }

  async findOne(discordUserId: string):  Promise<TRPGUser & Item | null | undefined> {
    try{
      if(_.isNil(discordUserId) )
      {
        console.log("discordUserId is Nil")
      }
      
      const userInfo = await TRPGUserModel.get({DiscordUserId:discordUserId});
      return userInfo
    }catch(e){
      console.log(e.message+e+"findError")
      return null
    }
  }

  async update(userId: string, updateUserDto: UpdateUserDto):  Promise<TRPGUser & Item> {
    return TRPGUserModel.update({ userId },updateUserDto);
  }

  async remove(userId: string): Promise<void> {
    await TRPGUserModel.delete(userId);
  }
}
