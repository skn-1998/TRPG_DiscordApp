/* eslint-disable @typescript-eslint/explicit-function-return-type */
// src/character/character.controller.ts
import { Controller, Get, Body, Patch, Param, Delete, Post, Headers, UnauthorizedException } from '@nestjs/common';
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
  async CreateCharacter(
    @Headers('Authorization') authorization: string,
    @Body('TRPGName') TRPGName: string,
    @Body('DiscordChannelId') DiscordChannelId: string
  ) {
    if (!authorization) {
      throw new UnauthorizedException('認証が必要です');
    }
    const token = await this.authService.parseJwt(authorization);
    return await this.characterService.create(TRPGName, token.DiscordUserId);
  }

  @Get(':id')
  async findOne(
    @Headers('Authorization') authorization: string,
    @Param('id') id: string
  ) {
    if (!authorization) {
      throw new UnauthorizedException('認証が必要です');
    }
    await this.authService.parseJwt(authorization);
    return this.characterService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Headers('Authorization') authorization: string,
    @Param('id') id: string,
    @Body() updateCharacterDto: UpdateCharacterDto
  ) {
    if (!authorization) {
      throw new UnauthorizedException('認証が必要です');
    }
    await this.authService.parseJwt(authorization);
    return this.characterService.update(id, updateCharacterDto);
  }

  @Delete(':id')
  async remove(
    @Headers('Authorization') authorization: string,
    @Param('id') id: string
  ) {
    if (!authorization) {
      throw new UnauthorizedException('認証が必要です');
    }
    await this.authService.parseJwt(authorization);
    return this.characterService.remove(id);
  }
}
