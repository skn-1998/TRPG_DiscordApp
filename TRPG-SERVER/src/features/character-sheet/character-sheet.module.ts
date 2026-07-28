import { Module } from '@nestjs/common'
import { AuthTokenModule } from '../../domains/auth/token/auth-token.module'
import { CharacterModule } from '../../domains/character/character.module'
import { CharacterSheetTemplateModule } from '../../domains/character-sheet-template/character-sheet-template.module'
import { DiceRollModule } from '../../domains/dice-roll/dice-roll.module'
import { CharacterInstantiationService } from './services/character-instantiation.service'
import { CharacterSheetOperationService } from './services/character-sheet-operation.service'
import { SheetMaterializerService } from './services/sheet-materializer.service'
import {
  CHARACTER_INSTANTIATION_USE_CASE,
  CHARACTER_SHEET_OPERATION_USE_CASE,
  CharacterSheetController
} from './character-sheet.controller'

@Module({
  imports: [AuthTokenModule, CharacterModule, CharacterSheetTemplateModule, DiceRollModule],
  controllers: [CharacterSheetController],
  providers: [
    CharacterInstantiationService,
    SheetMaterializerService,
    CharacterSheetOperationService,
    { provide: CHARACTER_INSTANTIATION_USE_CASE, useExisting: CharacterInstantiationService },
    { provide: CHARACTER_SHEET_OPERATION_USE_CASE, useExisting: CharacterSheetOperationService }
  ],
  exports: [CharacterInstantiationService, SheetMaterializerService, CharacterSheetOperationService]
})
export class CharacterSheetModule {}
