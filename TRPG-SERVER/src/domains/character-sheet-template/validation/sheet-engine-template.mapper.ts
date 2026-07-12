import type { SheetTemplate } from '@trpg/sheet-engine'
import type { CharacterSheetTemplateEntity } from '../models/character-sheet-template.entity'

export function toEngineTemplate(template: CharacterSheetTemplateEntity): SheetTemplate {
  const engineTemplate = {
    templateId: template.templateId,
    name: template.name,
    version: template.version,
    schemaVersion: template.schemaVersion,
    gameSystemId: template.gameSystemId,
    tags: template.tags,
    visibility: template.visibility,
    authorDiscordUserId: template.authorDiscordUserId,
    forkedFrom: template.forkedFrom,
    license: template.license,
    sections: template.sections,
    tables: template.tables,
    settings: template.settings
  }

  // @trpg/sheet-engine does not export its Zod template schema. Save/publish paths
  // validate this shape with validatePublishTemplate, so keep the boundary cast here.
  return engineTemplate as unknown as SheetTemplate
}
