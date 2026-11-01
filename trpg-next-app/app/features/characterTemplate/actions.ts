'use server'

import { redirect } from 'next/navigation'
import { normalizeTemplateLayout } from '@trpg/sheet-engine'
import type { RollOnCreateResultWire } from '@trpg/api-contract'
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
  forkSheetTemplate,
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

type CreateCharacterActionResult = {
  error: string | null
  rollOnCreateResults?: RollOnCreateResultWire[]
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

export async function forkTemplate(templateId: string): Promise<{ error: string | null }> {
  await requireJwt()

  // fork は front で payload を組まない（server が保存・検証済み entity を写す）ため、
  // payload を受け取る importTemplate と異なり front 正規化（normalizeTemplateLayout 等）の対象そのものが存在しない。
  let created
  try {
    created = await forkSheetTemplate(templateId)
  } catch (error) {
    const status = getResponseStatus(error)
    const messages = status === undefined ? [GENERIC_NETWORK_ERROR_MESSAGE] : extractApiErrorMessages(error)
    return {
      error: messages.length > 0 ? messages.join(' / ') : GENERIC_NETWORK_ERROR_MESSAGE
    }
  }

  redirect(`/templates/${created.templateId}/edit`)
}

// Why: v2 移行導線と JSON 貼り付け導線は同じ create 前正規化・エラー処理を必要とするため共用する。
// client 正規化を適用できない sections の構造不正は server の 400 → {error} 経路へ渡す。
export async function importTemplate(
  payload: CreateSheetTemplateRequest
): Promise<{ error: string | null }> {
  await requireJwt()

  let requestBody = payload
  if (Array.isArray(payload.sections)) {
    try {
      requestBody = normalizeTemplateLayout(
        normalizeTemplateReferences({ ...payload, sections: payload.sections })
      )
    } catch {
      // 正規化は短縮参照・layout 既定値のベストエフォート救済に限る。
      // 適用できない構造は素の payload を server の保存時検証へ送り、400 を {error} 経路に載せる。
      requestBody = payload
    }
  }

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
  values?: Record<string, unknown>
}): Promise<CreateCharacterActionResult> {
  await requireJwt()

  const characterName = input.characterName.trim()
  if (!input.templateId || !input.templateVersion || !characterName) {
    return { error: 'テンプレートとキャラクター名を入力してください' }
  }

  try {
    const result = await createCharacterFromTemplate({ ...input, characterName })

    // 出目は作成応答限りで再照会できないため、非空時は作成の場へ返し、空なら従来どおり一覧へ遷移する。
    if (result.rollOnCreateResults.length > 0) {
      return { error: null, rollOnCreateResults: result.rollOnCreateResults }
    }
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
      try {
        const published = await publishSheetTemplate(templateId)
        return { template: published }
      } catch (error) {
        const status = getResponseStatus(error)
        if (status === 409) {
          return {
            conflict: true,
            messages: extractApiErrorMessages(error)
          }
        }

        const extracted = status === undefined ? [GENERIC_NETWORK_ERROR_MESSAGE] : extractApiErrorMessages(error)
        // 「template あり ∧ messages 非空」を部分成功（draft は保存済み・publish leg だけ失敗）として
        // 編集画面へ伝える。messages を空にすると保存成功と区別できなくなる
        return {
          template: updated,
          messages: extracted.length > 0 ? extracted : [GENERIC_NETWORK_ERROR_MESSAGE],
          retryable: status === undefined || status === 429 || (status >= 500 && status < 600)
        }
      }
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
