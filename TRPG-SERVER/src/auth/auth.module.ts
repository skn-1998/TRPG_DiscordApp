import { forwardRef, Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import 'dotenv/config'
import { DiscordStrategy } from './auth.strategy';
import { HttpModule } from '@nestjs/axios';
import { configureDynamoose } from 'src/dynamoose.config';
import { UserModule } from 'src/DB/user/user.module';
import { CharacterModule } from 'src/DB/character/character.module';


if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined');
}
@Module({
  imports:[
    PassportModule,
    forwardRef(() => UserModule),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: {
        expiresIn: '1h',
        algorithm: 'HS256',
      },
      verifyOptions: {
        algorithms: ['HS256'], // 使用するアルゴリズムを明示
      },
    }),
    HttpModule
  ],
  providers: [AuthService,DiscordStrategy],
  controllers: [AuthController],
  exports:[AuthService]
})
export class AuthModule {
  constructor() {
    configureDynamoose();
  }

}


