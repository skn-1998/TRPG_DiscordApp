/* eslint-disable @typescript-eslint/explicit-function-return-type */
// src/character/character.controller.ts
import { Controller, Get, Body, Patch, Param, Delete, Post,Headers } from '@nestjs/common';
import { CharacterService } from './character.service';
import { UpdateCharacterDto } from './dto/update-character.dto';
import { AuthService } from 'src/auth/auth.service';

@Controller('characters')
export class CharacterController {
  // eslint-disable-next-line no-unused-vars
  constructor(private readonly characterService: CharacterService,
    // eslint-disable-next-line no-unused-vars
    private readonly authService: AuthService) {}


  @Get()
  async findAll(@Headers('Authorization') authorization: string) {
    console.log(authorization+"token")
    const token = await this.authService.parseJwt(authorization)
    return await this.characterService.findHavingAll(token.DiscordUserId);
  }

  @Post('create')
  async CreateCharacter(@Body('TRPGName') TRPGName: string,@Body('DiscordChannelId') DiscordChannelId:string){
    return await this.characterService.create(TRPGName,DiscordChannelId)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.characterService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCharacterDto: UpdateCharacterDto) {
    return this.characterService.update(id, updateCharacterDto);
  }
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.characterService.remove(id);
  }
}
