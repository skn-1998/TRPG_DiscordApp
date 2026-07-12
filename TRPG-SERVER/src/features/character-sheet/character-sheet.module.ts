import { Module } from '@nestjs/common'
import { CharacterModule } from '../../domains/character/character.module'
import { CharacterSheetTemplateModule } from '../../domains/character-sheet-template/character-sheet-template.module'
import { DiceRollModule } from '../../domains/dice-roll/dice-roll.module'
import { CharacterInstantiationService } from './services/character-instantiation.service'
import { CharacterSheetOperationService } from './services/character-sheet-operation.service'
import { SheetMaterializerService } from './services/sheet-materializer.service'

@Module({
  imports: [CharacterModule, CharacterSheetTemplateModule, DiceRollModule],
  providers: [CharacterInstantiationService, SheetMaterializerService, CharacterSheetOperationService],
  exports: [CharacterInstantiationService, SheetMaterializerService, CharacterSheetOperationService]
})
export class CharacterSheetModule {}
