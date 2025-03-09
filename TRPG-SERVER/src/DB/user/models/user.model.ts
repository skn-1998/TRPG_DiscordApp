// src/character/models/character.model.ts
import * as dynamoose from 'dynamoose';
import { Item } from 'dynamoose/dist/Item';

const { Schema } = dynamoose;



export interface TRPGUser {
  DiscordUserId: string
  name: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  characterId?: string[]
}

export interface TRPGUserModel extends Item,TRPGUser {}

const UserSchema = new Schema({
  DiscordUserId: String,
  name: String,
  characterId: {
    type: Array,
    schema:[String]
  },
}, {
  timestamps: true,
});

export const TRPGUserModel = dynamoose.model<TRPGUserModel>('User', UserSchema,
  {
    tableName:"trpg-user"
  }
);
