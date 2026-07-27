import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Req,
  UnauthorizedException,
  UseGuards
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Request } from 'express'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { JwtTokenPayload } from '../auth/models/auth.token.model'
import {
  CharacterSheetTemplateIdParamDto,
  CreateCharacterSheetTemplateDto
} from './dto/create-character-sheet-template.dto'
import { UpdateCharacterSheetTemplateDto } from './dto/update-character-sheet-template.dto'
import { CharacterSheetTemplateService } from './character-sheet-template.service'
import { CharacterSheetTemplateEntity, CharacterSheetTemplateSummary } from './models/character-sheet-template.entity'

@ApiTags('シートテンプレート')
@ApiBearerAuth()
@Controller('sheet-templates')
@UseGuards(JwtAuthGuard)
export class CharacterSheetTemplateController {
  constructor(private readonly service: CharacterSheetTemplateService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateCharacterSheetTemplateDto,
    @Req() req: Request
  ): Promise<CharacterSheetTemplateEntity> {
    const user = this.extractAuthenticatedUser(req)
    return this.service.create(dto, user.discordUserId)
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async findSummaries(@Req() req: Request): Promise<CharacterSheetTemplateSummary[]> {
    const user = this.extractAuthenticatedUser(req)
    return this.service.findSummaries(user.discordUserId)
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(
    @Param() params: CharacterSheetTemplateIdParamDto,
    @Req() req: Request
  ): Promise<CharacterSheetTemplateEntity> {
    const user = this.extractAuthenticatedUser(req)
    return this.service.findOne(params.id, user.discordUserId)
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param() params: CharacterSheetTemplateIdParamDto,
    @Body() dto: UpdateCharacterSheetTemplateDto,
    @Req() req: Request
  ): Promise<CharacterSheetTemplateEntity> {
    const user = this.extractAuthenticatedUser(req)
    return this.service.update(params.id, dto, user.discordUserId)
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  async publish(
    @Param() params: CharacterSheetTemplateIdParamDto,
    @Req() req: Request
  ): Promise<CharacterSheetTemplateEntity> {
    const user = this.extractAuthenticatedUser(req)
    return this.service.publish(params.id, user.discordUserId)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param() params: CharacterSheetTemplateIdParamDto, @Req() req: Request): Promise<unknown> {
    const user = this.extractAuthenticatedUser(req)
    return this.service.remove(params.id, user.discordUserId)
  }

  private extractAuthenticatedUser(req: Request): JwtTokenPayload {
    const user = req.user as JwtTokenPayload | undefined
    if (!user?.discordUserId) {
      throw new UnauthorizedException('認証トークンがありません')
    }
    return user
  }
}
