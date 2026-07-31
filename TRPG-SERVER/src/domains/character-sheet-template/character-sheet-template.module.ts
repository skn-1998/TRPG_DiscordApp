import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { AuthTokenModule } from '../auth/token/auth-token.module'
import { CharacterSheetTemplateController } from './character-sheet-template.controller'
import { CharacterSheetTemplateService } from './character-sheet-template.service'
import {
  CHARACTER_SHEET_TEMPLATE_COLLECTION,
  CHARACTER_SHEET_TEMPLATE_MODEL,
  CharacterSheetTemplateSchema
} from './models/character-sheet-template.model'
import { CharacterSheetTemplateRepository } from './repositories/character-sheet-template.repository'
import { SheetEngineTemplateValidationService } from './validation/sheet-engine-template-validation.service'
import { TEMPLATE_VALIDATION_PORT } from './validation/template-validation.port'

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: CHARACTER_SHEET_TEMPLATE_MODEL,
        schema: CharacterSheetTemplateSchema,
        collection: CHARACTER_SHEET_TEMPLATE_COLLECTION
      }
    ]),
    AuthTokenModule
  ],
  controllers: [CharacterSheetTemplateController],
  providers: [
    CharacterSheetTemplateService,
    CharacterSheetTemplateRepository,
    SheetEngineTemplateValidationService,
    {
      provide: TEMPLATE_VALIDATION_PORT,
      useExisting: SheetEngineTemplateValidationService
    }
  ],
  exports: [CharacterSheetTemplateService, CharacterSheetTemplateRepository]
})
export class CharacterSheetTemplateModule {}
