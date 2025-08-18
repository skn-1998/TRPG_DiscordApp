import { Module, forwardRef } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { CharacterController } from './character.controller'
import { CharacterService } from './character.service'
import { CHARACTER_COLLECTION, CHARACTER_MODEL, CharacterSchema } from './models/character.model'
import { CharacterRepository } from './repositories/character.repository'
import { CharacterApplicationService } from './application/character-application.service'
import { CharacterEventHandlerService } from './services/character-event-handler.service'
import { CharacterIdService } from './services/character-id.service'
import { AuthModule } from '../auth/auth.module'
import { UserModule } from '../user/user.module'
import { SharedModule } from '../../shared/shared.module'
// import { DiscordIntegrationModule } from '../../discord/application/discord-integration.module' // 循環依存回避のため一時削除

@Module({
  imports: [
    MongooseModule.forFeature([{ name: CHARACTER_MODEL, schema: CharacterSchema, collection: CHARACTER_COLLECTION }]),
    SharedModule,
    AuthModule,
    UserModule
    // forwardRef(() => DiscordIntegrationModule) // 循環依存回避のため一時削除
  ],
  controllers: [CharacterController],
  providers: [
    CharacterService,
    CharacterRepository,
    CharacterApplicationService,
    CharacterEventHandlerService,
    CharacterIdService
  ],
  exports: [
    CharacterService,
    CharacterRepository,
    CharacterApplicationService,
    CharacterEventHandlerService,
    CharacterIdService
  ]
})
export class CharacterModule {}
