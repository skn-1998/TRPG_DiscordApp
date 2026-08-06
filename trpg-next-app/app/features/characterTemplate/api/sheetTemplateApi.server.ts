import 'server-only'

import { apiClient } from '../../../lib/api-client.server'
import { errorEnvelopeMessages, isErrorEnvelope } from '../../../lib/api-response.util'
import type {
  CharacterSheetTemplateEntity,
  CharacterSheetTemplateSummary,
  CreateSheetTemplateRequest,
  UpdateSheetTemplateRequest
} from '../types/v3'

export async function getSheetTemplateSummaries(): Promise<CharacterSheetTemplateSummary[]> {
  const response = await apiClient.get<CharacterSheetTemplateSummary[]>('/sheet-templates')
  return response.data
}

export async function getSheetTemplate(templateId: string): Promise<CharacterSheetTemplateEntity> {
  const response = await apiClient.get<CharacterSheetTemplateEntity>(`/sheet-templates/${templateId}`)
  // ResponseInterceptor は sheet-templates controller に適用されないため、応答は封筒なしの entity。
  return response.data
}

export async function createSheetTemplate(
  request: CreateSheetTemplateRequest
): Promise<CharacterSheetTemplateEntity> {
  const response = await apiClient.post<CharacterSheetTemplateEntity>('/sheet-templates', request)
  return response.data
}

export async function updateSheetTemplate(
  templateId: string,
  request: UpdateSheetTemplateRequest
): Promise<CharacterSheetTemplateEntity> {
  const response = await apiClient.put<CharacterSheetTemplateEntity>(`/sheet-templates/${templateId}`, request)
  return response.data
}

export async function publishSheetTemplate(templateId: string): Promise<CharacterSheetTemplateEntity> {
  const response = await apiClient.post<CharacterSheetTemplateEntity>(
    `/sheet-templates/${templateId}/publish`,
    undefined
  )
  return response.data
}

export async function deleteSheetTemplate(templateId: string): Promise<unknown> {
  const response = await apiClient.delete<unknown>(`/sheet-templates/${templateId}`)
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
