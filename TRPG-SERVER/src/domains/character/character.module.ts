import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { CharacterController } from './character.controller'
import { CharacterService } from './character.service'
import { CHARACTER_COLLECTION, CHARACTER_MODEL, CharacterSchema } from './models/character.model'
import { CharacterRepository } from './repositories/character.repository'
import { CharacterIdService } from './services/character-id.service'
import { AuthModule } from '../auth/auth.module'
import { UserModule } from '../user/user.module'
// import { DiscordIntegrationModule } from '../../discord/application/discord-integration.module' // 循環依存回避のため一時削除

@Module({
  imports: [
    MongooseModule.forFeature([{ name: CHARACTER_MODEL, schema: CharacterSchema, collection: CHARACTER_COLLECTION }]),
    AuthModule,
    UserModule
    // forwardRef(() => DiscordIntegrationModule) // 循環依存回避のため一時削除
  ],
  controllers: [CharacterController],
  providers: [CharacterService, CharacterRepository, CharacterIdService],
  exports: [CharacterService, CharacterRepository, CharacterIdService]
})
export class CharacterModule {}
