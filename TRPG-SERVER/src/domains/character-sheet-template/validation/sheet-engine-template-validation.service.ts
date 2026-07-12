import { BadRequestException, Injectable } from '@nestjs/common'
import { validatePublishTemplate } from '@trpg/sheet-engine'
import { CharacterSheetTemplateEntity } from '../models/character-sheet-template.entity'
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
  }

  private assertEngineValid(template: CharacterSheetTemplateEntity): void {
    const result = validatePublishTemplate(toEngineTemplate(template))
    if (!result.ok) {
      throw new BadRequestException(result.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '))
    }
  }
}
