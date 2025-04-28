import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { UserController } from './user.controller'
import { UserService } from './user.service'
import { USER_MODEL, UserSchema } from './models/user.model'
import { UserRepository } from './repositories/user.repository'

@Module({
  imports: [MongooseModule.forFeature([{ name: USER_MODEL, schema: UserSchema }])],
  controllers: [UserController],
  providers: [UserService, UserRepository],
  exports: [UserService, UserRepository]
})
export class UserModule {}
