'use server'

import {
  sheetMergeConflictSchema,
  type CharacterSheetVisibility,
  type SheetMergeConflictWire
} from '@trpg/api-contract'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireJwt } from '../../lib/auth-guard.server'
import {
  extractApiErrorMessages,
  GENERIC_NETWORK_ERROR_MESSAGE,
  getResponseStatus,
  getUpstreamResponse,
  isErrorEnvelope
} from '../../lib/api-response.util'
import {
  getUserCharacterSummaries,
  saveCharacterSheet,
  type CharacterSheetChange,
  updateCharacterSheetVisibility
} from './api/character.service.server'
import { GENERIC_SHEET_CONFLICT_MESSAGE } from './sheet-edit'

export async function refreshCharacterList(): Promise<{ error: string | null }> {
  await requireJwt()

  try {
    await getUserCharacterSummaries()
    revalidatePath('/user/character')
    return { error: null }
  } catch (error) {
    const status = getResponseStatus(error)
    const messages = status === undefined ? [GENERIC_NETWORK_ERROR_MESSAGE] : extractApiErrorMessages(error)
    return {
      error: messages.length > 0 ? messages.join(' / ') : GENERIC_NETWORK_ERROR_MESSAGE
    }
  }
}

export async function updateSheetVisibility(
  characterId: string,
  visibility: CharacterSheetVisibility
): Promise<{ visibility: CharacterSheetVisibility } | { error: string }> {
  await requireJwt()

  try {
    const result = await updateCharacterSheetVisibility(characterId, visibility)
    revalidatePath('/user/character')
    return { visibility: result.visibility }
  } catch (error) {
    const status = getResponseStatus(error)
    const messages = status === undefined ? [GENERIC_NETWORK_ERROR_MESSAGE] : extractApiErrorMessages(error)
    return {
      error: messages.length > 0 ? messages.join(' / ') : GENERIC_NETWORK_ERROR_MESSAGE
    }
  }
}

export async function saveSheet(
  characterId: string,
  input: { baseRevision: number; changes: CharacterSheetChange[] }
): Promise<{
  error: string | null
  conflict?: boolean
  mergeConflict?: SheetMergeConflictWire
  retryable?: boolean
}> {
  await requireJwt()

  try {
    await saveCharacterSheet({ characterId, ...input })
  } catch (error) {
    const status = getResponseStatus(error)
    if (status === 409) {
      const upstreamResponse = getUpstreamResponse(error)
      if (upstreamResponse && isErrorEnvelope(upstreamResponse.data)) {
        const mergeConflict = sheetMergeConflictSchema.safeParse(upstreamResponse.data.cause)
        if (mergeConflict.success) {
          return {
            error: null,
            conflict: true,
            mergeConflict: mergeConflict.data
          }
        }
      }

      return {
        error: GENERIC_SHEET_CONFLICT_MESSAGE,
        conflict: true
      }
    }
    const messages = status === undefined ? [GENERIC_NETWORK_ERROR_MESSAGE] : extractApiErrorMessages(error)
    return {
      error: messages.length > 0 ? messages.join(' / ') : GENERIC_NETWORK_ERROR_MESSAGE,
      retryable: status === undefined || status === 429 || (status >= 500 && status < 600)
    }
  }

  redirect('/user/character')
}
