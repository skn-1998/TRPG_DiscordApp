import 'server-only'

import { apiClient } from '../../../lib/api-client.server'
import { errorEnvelopeMessages, isErrorEnvelope } from '../../../lib/api-response.util'
import type { CharacterSheetTemplateEntity } from '../types/v3'

export async function getSheetTemplate(templateId: string): Promise<CharacterSheetTemplateEntity> {
  const response = await apiClient.get<CharacterSheetTemplateEntity>(`/sheet-templates/${templateId}`)
  // ResponseInterceptor は sheet-templates controller に適用されないため、応答は封筒なしの entity。
  return response.data
}

export function extractApiErrorMessages(error: unknown): string[] {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { data?: unknown } }).response
    const data = response?.data
    if (isErrorEnvelope(data)) {
      return errorEnvelopeMessages(data)
    }

    if (data && typeof data === 'object' && 'message' in data) {
      const message = (data as { message?: unknown }).message
      if (Array.isArray(message)) return message.map(String)
      if (typeof message === 'string')
        return message
          .split(';')
          .map((part) => part.trim())
          .filter(Boolean)
    }
  }

  if (error instanceof Error) return [error.message]
  return ['リクエストの処理中にエラーが発生しました']
}
