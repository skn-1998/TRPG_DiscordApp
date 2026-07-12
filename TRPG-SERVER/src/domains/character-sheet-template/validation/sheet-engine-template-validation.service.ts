import { BadRequestException, Injectable } from '@nestjs/common'
import { validatePublishTemplate } from '@trpg/sheet-engine'
import { CharacterSheetTemplateEntity } from '../models/character-sheet-template.entity'
import { collectProjectionKeyErrors } from './projection-key-validation'
import { toEngineTemplate } from './sheet-engine-template.mapper'
import { TemplateValidationPort } from './template-validation.port'

@Injectable()
export class SheetEngineTemplateValidationService implements TemplateValidationPort {
  validateForSave(template: CharacterSheetTemplateEntity): void {
    this.assertEngineValid(template)
  }

  validateForPublish(template: CharacterSheetTemplateEntity): void {
    if (template.visibility !== 'public') {
      throw new BadRequestException('published template visibility must be public')
    }
    this.assertEngineValid(template)
    this.assertProjectionKeysUnique(template)
  }

  private assertEngineValid(template: CharacterSheetTemplateEntity): void {
    const result = validatePublishTemplate(toEngineTemplate(template))
    if (!result.ok) {
      throw new BadRequestException(result.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '))
    }
  }

  private assertProjectionKeysUnique(template: CharacterSheetTemplateEntity): void {
    const errors = collectProjectionKeyErrors(template)
    if (errors.length > 0) {
      throw new BadRequestException(errors.join('; '))
    }
  }
}
