import { SheetTemplate, validatePublishTemplate } from '..';

export function baseTemplate(overrides: Partial<SheetTemplate> = {}): SheetTemplate {
  return {
    templateId: 'tpl',
    name: 'Template',
    version: '1.0.0',
    schemaVersion: 3,
    tags: [],
    visibility: 'private',
    authorDiscordUserId: 'author',
    settings: { rounding: 'floor' },
    tables: [],
    sections: [],
    ...overrides,
  };
}

export function issueMessages(template: unknown): string[] {
  return validatePublishTemplate(template).issues.map((issue) => issue.message);
}
