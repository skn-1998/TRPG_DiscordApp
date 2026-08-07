import 'server-only'

import { getSheetTemplateSummaries } from '../features/characterTemplate/api/sheetTemplateApi.server'
import type { CharacterSheetTemplateSummary } from '../features/characterTemplate/types/v3'
import { extractApiErrorMessages } from '../lib/api-response.util'

interface TemplateListData {
  summaries: CharacterSheetTemplateSummary[]
  error: string | null
}

function isTemplateSummary(
  summary: CharacterSheetTemplateSummary | null | undefined
): summary is CharacterSheetTemplateSummary {
  return summary != null
}

export async function getTemplateListData(): Promise<TemplateListData> {
  try {
    const summaries = (await getSheetTemplateSummaries()).filter(isTemplateSummary)
    return { summaries, error: null }
  } catch (error) {
    return { summaries: [], error: extractApiErrorMessages(error).join(' / ') }
  }
}
