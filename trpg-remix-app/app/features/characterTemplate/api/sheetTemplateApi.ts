import { apiClient, withJwt } from '~/lib/api-client'
import { isErrorEnvelope } from '../../../lib/api-response.util'
import type {
  CharacterSheetTemplateEntity,
  CharacterSheetTemplateSummary,
  CreateSheetTemplateRequest,
  UpdateSheetTemplateRequest
} from '../types/v3'

export async function getSheetTemplateSummaries(jwt?: string): Promise<CharacterSheetTemplateSummary[]> {
  const response = await apiClient.get<CharacterSheetTemplateSummary[]>(
    '/sheet-templates',
    jwt ? withJwt(jwt) : undefined
  )
  return response.data
}

export async function getSheetTemplate(templateId: string, jwt?: string): Promise<CharacterSheetTemplateEntity> {
  const response = await apiClient.get<CharacterSheetTemplateEntity>(
    `/sheet-templates/${templateId}`,
    jwt ? withJwt(jwt) : undefined
  )
  return response.data
}

export async function createSheetTemplate(
  request: CreateSheetTemplateRequest,
  jwt?: string
): Promise<CharacterSheetTemplateEntity> {
  const response = await apiClient.post<CharacterSheetTemplateEntity>(
    '/sheet-templates',
    request,
    jwt ? withJwt(jwt) : undefined
  )
  return response.data
}

export async function updateSheetTemplate(
  templateId: string,
  request: UpdateSheetTemplateRequest,
  jwt?: string
): Promise<CharacterSheetTemplateEntity> {
  const response = await apiClient.put<CharacterSheetTemplateEntity>(
    `/sheet-templates/${templateId}`,
    request,
    jwt ? withJwt(jwt) : undefined
  )
  return response.data
}

export async function publishSheetTemplate(templateId: string, jwt?: string): Promise<CharacterSheetTemplateEntity> {
  const response = await apiClient.post<CharacterSheetTemplateEntity>(
    `/sheet-templates/${templateId}/publish`,
    undefined,
    jwt ? withJwt(jwt) : undefined
  )
  return response.data
}

export async function deleteSheetTemplate(templateId: string, jwt?: string): Promise<unknown> {
  const response = await apiClient.delete<unknown>(`/sheet-templates/${templateId}`, jwt ? withJwt(jwt) : undefined)
  return response.data
}

export function extractApiErrorMessages(error: unknown): string[] {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { data?: unknown } }).response
    const data = response?.data
    if (isErrorEnvelope(data)) {
      const diagnostics = [
        ...(data.issues?.map((issue) => issue.message) ?? []),
        ...(data.details?.map((detail) => detail.message) ?? [])
      ].filter((message) => message.length > 0)
      const uniqueDiagnostics = [...new Set(diagnostics)]

      // issues/details（各フィールド診断）を優先する。data.error は診断の集約スーパーセット
      // 文字列になり得るため、診断が取れたときは二重表示を避けて error を落とす。
      if (uniqueDiagnostics.length > 0) return uniqueDiagnostics
      if (data.error.length > 0) return [data.error]
      return [data.message]
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
