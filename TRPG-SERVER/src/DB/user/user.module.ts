import { forwardRef, Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { configureDynamoose } from '../../dynamoose.config';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports:[forwardRef(()=>AuthModule)],
  controllers: [UserController],
  providers: [UserService],
  exports:[UserService]
})


export class UserModule {
  constructor() {
    configureDynamoose();
  }
}