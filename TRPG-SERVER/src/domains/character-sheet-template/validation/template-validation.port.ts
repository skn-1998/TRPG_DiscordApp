import { CharacterSheetTemplateEntity } from '../models/character-sheet-template.entity'

export const TEMPLATE_VALIDATION_PORT = Symbol('TemplateValidationPort')

export interface TemplateValidationPort {
  validateForSave(template: CharacterSheetTemplateEntity): void | Promise<void>
  validateForPublish(template: CharacterSheetTemplateEntity): void | Promise<void>
}
