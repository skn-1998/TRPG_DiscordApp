'use server'

import { redirect } from 'next/navigation'
import { normalizeTemplateLayout } from '@trpg/sheet-engine'
import {
  extractApiErrorMessages,
  GENERIC_NETWORK_ERROR_MESSAGE,
  getResponseStatus
} from '../../lib/api-response.util'
import { requireJwt } from '../../lib/auth-guard.server'
import { createCharacterFromTemplate } from '../character/api/character.service.server'
import {
  createSheetTemplate,
  deleteSheetTemplate,
  publishSheetTemplate,
  updateSheetTemplate
} from './api/sheetTemplateApi.server'
import type {
  CharacterSheetTemplateEntity,
  CreateSheetTemplateRequest,
  UpdateSheetTemplateRequest
} from './types/v3'
import { normalizeTemplateReferences } from './utils/v3Template'

export type EditorIntent = 'autosave' | 'save' | 'publish'

export type EditorActionData = {
  template?: CharacterSheetTemplateEntity
  conflict?: boolean
  messages?: string[]
  retryable?: boolean
}

export async function createTemplate(): Promise<{ error: string | null }> {
  await requireJwt()

  let created
  try {
    created = await createSheetTemplate({
      name: '新規テンプレート',
      version: '0.1.0',
      schemaVersion: 3,
      visibility: 'private',
      tags: [],
      sections: [{ id: 'basic', label: '基本情報', fields: [] }],
      tables: [],
      settings: { rounding: 'floor' }
    })
  } catch (error) {
    const status = getResponseStatus(error)
    const messages = status === undefined ? [GENERIC_NETWORK_ERROR_MESSAGE] : extractApiErrorMessages(error)
    return {
      error: messages.length > 0 ? messages.join(' / ') : GENERIC_NETWORK_ERROR_MESSAGE
    }
  }

  redirect(`/templates/${created.templateId}/edit`)
}

export async function importV2Template(
  payload: CreateSheetTemplateRequest
): Promise<{ error: string | null }> {
  await requireJwt()

  const requestBody = payload.sections
    ? normalizeTemplateLayout(normalizeTemplateReferences({ ...payload, sections: payload.sections }))
    : payload

  let created
  try {
    created = await createSheetTemplate(requestBody)
  } catch (error) {
    const status = getResponseStatus(error)
    const messages = status === undefined ? [GENERIC_NETWORK_ERROR_MESSAGE] : extractApiErrorMessages(error)
    return {
      error: messages.length > 0 ? messages.join(' / ') : GENERIC_NETWORK_ERROR_MESSAGE
    }
  }

  redirect(`/templates/${created.templateId}/edit`)
}

export async function deleteTemplate(templateId: string): Promise<{ error: string | null }> {
  await requireJwt()

  try {
    await deleteSheetTemplate(templateId)
  } catch (error) {
    const status = getResponseStatus(error)
    const messages = status === undefined ? [GENERIC_NETWORK_ERROR_MESSAGE] : extractApiErrorMessages(error)
    return {
      error: messages.length > 0 ? messages.join(' / ') : GENERIC_NETWORK_ERROR_MESSAGE
    }
  }

  redirect('/templates')
}

export async function createCharacter(input: {
  templateId: string
  templateVersion: string
  characterName: string
}): Promise<{ error: string | null }> {
  await requireJwt()

  const characterName = input.characterName.trim()
  if (!input.templateId || !input.templateVersion || !characterName) {
    return { error: 'テンプレートとキャラクター名を入力してください' }
  }

  try {
    await createCharacterFromTemplate({ ...input, characterName })
  } catch (error) {
    const status = getResponseStatus(error)
    const messages = status === undefined ? [GENERIC_NETWORK_ERROR_MESSAGE] : extractApiErrorMessages(error)
    return {
      error: messages.length > 0 ? messages.join(' / ') : GENERIC_NETWORK_ERROR_MESSAGE
    }
  }

  redirect('/user/character')
}

export async function saveTemplateDraft(
  templateId: string,
  intent: EditorIntent,
  payload: CharacterSheetTemplateEntity
): Promise<EditorActionData> {
  await requireJwt()

  try {
    const updated = await updateSheetTemplate(templateId, toUpdateRequest(payload))

    if (intent === 'publish') {
      const published = await publishSheetTemplate(templateId)
      return { template: published }
    }

    return { template: updated }
  } catch (error) {
    const status = getResponseStatus(error)
    if (status === 409) {
      return {
        conflict: true,
        messages: extractApiErrorMessages(error)
      }
    }

    // upstream body が {message: ''} や ';;' だと extractApiErrorMessages は空配列を返しうる。
    // messages が空だと編集画面はエラーも再試行ボタンも出せないため、定型文で埋める
    const extracted = status === undefined ? [GENERIC_NETWORK_ERROR_MESSAGE] : extractApiErrorMessages(error)

    return {
      conflict: false,
      messages: extracted.length > 0 ? extracted : [GENERIC_NETWORK_ERROR_MESSAGE],
      retryable: status === undefined || status === 429 || (status >= 500 && status < 600)
    }
  }
}

function toUpdateRequest(template: CharacterSheetTemplateEntity): UpdateSheetTemplateRequest {
  return {
    draftRevision: template.draftRevision,
    name: template.name,
    version: template.version,
    schemaVersion: 3,
    gameSystemId: template.gameSystemId,
    tags: template.tags,
    visibility: template.visibility,
    forkedFrom: template.forkedFrom,
    license: template.license,
    sections: template.sections,
    tables: template.tables,
    settings: template.settings
  }
}
