import { Module, forwardRef } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { CharacterController } from './character.controller'
import { CharacterService } from './character.service'
import { CHARACTER_MODEL, CharacterSchema } from './models/character.model'
import { CharacterRepository } from './repositories/character.repository'
import { CharacterApplicationService } from './application/character-application.service'
import { AuthModule } from '../auth/auth.module'
import { UserModule } from '../user/user.module'
import { DiscordModule } from '../../discord/discord.module'
import { SharedModule } from '../../shared/shared.module'

@Module({
  imports: [
    MongooseModule.forFeature([{ name: CHARACTER_MODEL, schema: CharacterSchema }]),
    SharedModule,
    AuthModule,
    UserModule,
    forwardRef(() => DiscordModule)
  ],
  controllers: [CharacterController],
  providers: [CharacterService, CharacterRepository, CharacterApplicationService],
  exports: [CharacterService, CharacterRepository, CharacterApplicationService]
})
export class CharacterModule {}
