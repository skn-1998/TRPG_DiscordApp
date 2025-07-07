import { forwardRef, Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { UserController } from './user.controller'
import { UserService } from './user.service'
import { USER_MODEL, UserSchema } from './models/user.model'
import { UserRepository } from './repositories/user.repository'
import { AuthModule } from '../auth/auth.module'
import { SharedModule } from '../../core/shared/shared.module'

@Module({
  imports: [
    MongooseModule.forFeature([{ name: USER_MODEL, schema: UserSchema }]),
    forwardRef(() => AuthModule),
    SharedModule
  ],
  controllers: [UserController],
  providers: [UserService, UserRepository],
  exports: [UserService, UserRepository]
})
export class UserModule {}
