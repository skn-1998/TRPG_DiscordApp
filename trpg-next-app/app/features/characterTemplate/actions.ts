'use server'

import { redirect } from 'next/navigation'
import { getResponseStatus } from '../../lib/api-response.util'
import { requireJwt } from '../../lib/auth-guard.server'
import { createCharacterFromTemplate } from '../character/api/character.service.server'
import {
  createSheetTemplate,
  deleteSheetTemplate,
  extractApiErrorMessages,
  publishSheetTemplate,
  updateSheetTemplate
} from './api/sheetTemplateApi.server'
import type {
  CharacterSheetTemplateEntity,
  CreateSheetTemplateRequest,
  UpdateSheetTemplateRequest
} from './types/v3'
import { normalizeTemplateReferences } from './utils/v3Template'

export type EditorActionData = {
  ok: boolean
  intent: 'autosave' | 'save' | 'publish'
  template?: CharacterSheetTemplateEntity
  conflict?: boolean
  messages?: string[]
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
    return { error: extractApiErrorMessages(error).join(' / ') }
  }

  redirect(`/templates/${created.templateId}/edit`)
}

export async function importV2Template(
  payload: CreateSheetTemplateRequest
): Promise<{ error: string | null }> {
  await requireJwt()

  const requestBody = payload.sections
    ? normalizeTemplateReferences({ ...payload, sections: payload.sections })
    : payload

  let created
  try {
    created = await createSheetTemplate(requestBody)
  } catch (error) {
    return { error: extractApiErrorMessages(error).join(' / ') }
  }

  redirect(`/templates/${created.templateId}/edit`)
}

export async function deleteTemplate(templateId: string): Promise<{ error: string | null }> {
  await requireJwt()

  try {
    await deleteSheetTemplate(templateId)
  } catch (error) {
    return { error: extractApiErrorMessages(error).join(' / ') }
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
    return { error: extractApiErrorMessages(error).join(' / ') }
  }

  redirect('/user/character')
}

export async function saveTemplateDraft(
  templateId: string,
  intent: 'autosave' | 'save' | 'publish',
  payload: CharacterSheetTemplateEntity
): Promise<EditorActionData> {
  await requireJwt()

  try {
    const updated = await updateSheetTemplate(templateId, toUpdateRequest(payload))

    if (intent === 'publish') {
      const published = await publishSheetTemplate(templateId)
      return { ok: true, intent, template: published }
    }

    return { ok: true, intent, template: updated }
  } catch (error) {
    return {
      ok: false,
      intent,
      conflict: getResponseStatus(error) === 409,
      messages: extractApiErrorMessages(error)
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
