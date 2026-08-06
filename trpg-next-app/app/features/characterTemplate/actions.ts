'use server'

import { redirect } from 'next/navigation'
import { requireJwt } from '../../lib/auth-guard.server'
import { createCharacterFromTemplate } from '../character/api/character.service.server'
import {
  createSheetTemplate,
  deleteSheetTemplate,
  extractApiErrorMessages
} from './api/sheetTemplateApi.server'
import type { CreateSheetTemplateRequest } from './types/v3'
import { normalizeTemplateReferences } from './utils/v3Template'

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
