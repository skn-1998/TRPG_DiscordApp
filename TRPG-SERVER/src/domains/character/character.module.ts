import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { CharacterController } from './character.controller'
import { CharacterService } from './character.service'
import { CHARACTER_MODEL, CharacterSchema } from './models/character.model'
import { CharacterRepository } from './repositories/character.repository'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [MongooseModule.forFeature([{ name: CHARACTER_MODEL, schema: CharacterSchema }]), AuthModule],
  controllers: [CharacterController],
  providers: [CharacterService, CharacterRepository],
  exports: [CharacterService, CharacterRepository]
})
export class CharacterModule {}
