// src/character/models/character.model.ts
import * as dynamoose from 'dynamoose';
import { AnyItem } from 'dynamoose/dist/Item';

const { Schema } = dynamoose;

export interface Character extends AnyItem {
  name: string
  characterId: string
  discordUserId: string
  discordChannelId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  status: Record<string, any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  skill: Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parameter: Record<string, any>
}
export type UpdatePrimary = 'status' | 'parameter' | 'skill'


const CharacterSchema = new Schema({
  characterId: {
    type: String,
    hashKey: true,
  },
  discordUserId: String,
  discordChannelId: String,
  name: String,
  status: {
    type: Object,
    default: {},
  },
  parameter: {
    type: Object,
    default: {},
  },
  skill: {
    type: Object,
    default: {},
  },
}, {
  timestamps: true,
});

export const CharacterModel = dynamoose.model<Character>('Character', CharacterSchema,
  {
    tableName:'trpg-charactertable'
  }
);
