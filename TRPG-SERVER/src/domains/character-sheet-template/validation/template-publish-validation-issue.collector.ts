import { validatePublishTemplate, validateStandaloneRollNotations } from '@trpg/sheet-engine'
import type { CharacterSheetTemplateEntity } from '../models/character-sheet-template.entity'
import { collectProjectionKeyErrors } from './projection-key-validation'
import { toEngineTemplate } from './sheet-engine-template.mapper'

type TemplatePublishValidationStage = 'engine' | 'standalone-notation' | 'projection-key'

export interface TemplatePublishValidationIssue {
  path?: string
  message: string
}

interface TemplatePublishValidationIssueGroup {
  stage: TemplatePublishValidationStage
  issues: readonly TemplatePublishValidationIssue[]
}

/**
 * publish 検証を依存順に実行し、入口ごとの失敗規約を選べるよう段別に返す。
 * engine 検証の失敗時は、engine-valid な形を前提とする後段を実行しない。
 */
export function collectTemplatePublishValidationIssues(
  template: CharacterSheetTemplateEntity
): TemplatePublishValidationIssueGroup[] {
  const engineTemplate = toEngineTemplate(template)
  const engineResult = validatePublishTemplate(engineTemplate)
  if (!engineResult.ok) {
    return [{ stage: 'engine', issues: engineResult.issues }]
  }

  return [
    { stage: 'engine', issues: [] },
    { stage: 'standalone-notation', issues: validateStandaloneRollNotations(engineTemplate) },
    {
      stage: 'projection-key',
      issues: collectProjectionKeyErrors(template).map((message) => ({ message }))
    }
  ]
}
