import 'server-only'

import { redirect } from 'next/navigation'
import { getSheetTemplateSummaries } from '../features/characterTemplate/api/sheetTemplateApi.server'
import type { CharacterSheetTemplateSummary } from '../features/characterTemplate/types/v3'
import { getResponseStatus } from '../lib/api-response.util'

interface TemplateListData {
  summaries: CharacterSheetTemplateSummary[]
}

function isTemplateSummary(
  summary: CharacterSheetTemplateSummary | null | undefined
): summary is CharacterSheetTemplateSummary {
  return summary != null
}

export async function getTemplateListData(): Promise<TemplateListData> {
  try {
    const summaries = (await getSheetTemplateSummaries()).filter(isTemplateSummary)
    return { summaries }
  } catch (error) {
    const status = getResponseStatus(error)
    if (status === 401 || status === 403) redirect('/login')
    throw error
  }
}
