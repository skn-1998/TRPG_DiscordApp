import { BadRequestException, Injectable } from '@nestjs/common'
import { validatePublishTemplate } from '@trpg/sheet-engine'
import { CharacterSheetTemplateEntity } from '../models/character-sheet-template.entity'
import { toEngineTemplate } from './sheet-engine-template.mapper'
import { TemplateValidationPort } from './template-validation.port'
import { collectTemplatePublishValidationIssues } from './template-publish-validation-issue.collector'
import type { TemplatePublishValidationIssue } from './template-publish-validation-issue.collector'

@Injectable()
export class SheetEngineTemplateValidationService implements TemplateValidationPort {
  validateForSave(template: CharacterSheetTemplateEntity): void {
    this.assertEngineValid(template)
  }

  validateForPublish(template: CharacterSheetTemplateEntity): void {
    if (template.visibility !== 'public') {
      throw new BadRequestException('published template visibility must be public')
    }

    const firstInvalidStage = collectTemplatePublishValidationIssues(template).find(({ issues }) => issues.length > 0)
    if (firstInvalidStage !== undefined) {
      throw new BadRequestException(firstInvalidStage.issues.map(formatValidationIssue))
    }
  }

  private assertEngineValid(template: CharacterSheetTemplateEntity): void {
    const result = validatePublishTemplate(toEngineTemplate(template))
    if (!result.ok) {
      throw new BadRequestException(result.issues.map(formatValidationIssue))
    }
  }
}

function formatValidationIssue(issue: TemplatePublishValidationIssue): string {
  return issue.path === undefined ? issue.message : `${issue.path}: ${issue.message}`
}
