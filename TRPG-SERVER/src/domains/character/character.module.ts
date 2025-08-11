import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { CharacterController } from './character.controller'
import { CharacterService } from './character.service'
import { CHARACTER_COLLECTION, CHARACTER_MODEL, CharacterSchema } from './models/character.model'
import { CharacterRepository } from './repositories/character.repository'
import { CharacterApplicationService } from './application/character-application.service'
import { CharacterEventHandlerService } from './services/character-event-handler.service'
import { AuthModule } from '../auth/auth.module'
import { UserModule } from '../user/user.module'
import { SharedModule } from '../../shared/shared.module'
import { DiscordIntegrationModule } from 'src/discord/features/characterEdit'

@Module({
  imports: [
    MongooseModule.forFeature([{ name: CHARACTER_MODEL, schema: CharacterSchema, collection: CHARACTER_COLLECTION }]),
    SharedModule,
    AuthModule,
    UserModule,
    DiscordIntegrationModule
  ],
  controllers: [CharacterController],
  providers: [CharacterService, CharacterRepository, CharacterApplicationService, CharacterEventHandlerService],
  exports: [CharacterService, CharacterRepository, CharacterApplicationService, CharacterEventHandlerService]
})
export class CharacterModule {}
