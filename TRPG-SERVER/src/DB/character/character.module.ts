// src/character/character.module.ts
import { Module } from '@nestjs/common';
import { CharacterService } from './character.service';
import { CharacterController } from './character.controller';
import { configureDynamoose } from '../../dynamoose.config';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CharacterController],
  providers: [CharacterService],
  exports:[CharacterService]
})
export class CharacterModule {
  constructor() {
    configureDynamoose();
  }
}
