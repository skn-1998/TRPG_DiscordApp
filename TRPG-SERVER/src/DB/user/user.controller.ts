/* eslint-disable @typescript-eslint/explicit-function-return-type */
// src/user/user.controller.ts
import { Controller, Get, Body, Patch, Param, Delete,Headers } from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthService } from 'src/auth/auth.service';

@Controller('trpg-user')
export class UserController {
  // eslint-disable-next-line no-unused-vars
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService
  ) {}

  // @Get()
  // findAll() {
  //   return this.userService.findAll();
  // }

  @Get()
  async findUserByToken(@Headers('Authorization') authorization: string)
  {
    try {
      const token = await this.authService.validateToken(authorization)
      return await this.userService.findOne(token.DiscordUserId)
    } catch (error) {
      throw new Error(error.message)      
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(id, updateUserDto);
  }
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }
}
