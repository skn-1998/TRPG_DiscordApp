'use server'

import { sheetMergeConflictSchema, type SheetMergeConflictWire } from '@trpg/api-contract'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireJwt } from '../../lib/auth-guard.server'
import {
  extractApiErrorMessages,
  getResponseStatus,
  getUpstreamResponse,
  isErrorEnvelope
} from '../../lib/api-response.util'
import {
  getUserCharacterSummaries,
  saveCharacterSheet,
  type CharacterSheetChange
} from './api/character.service.server'
import { GENERIC_SHEET_CONFLICT_MESSAGE, GENERIC_SHEET_NETWORK_ERROR_MESSAGE } from './sheet-edit'

export async function refreshCharacterList(): Promise<{ error: string | null }> {
  await requireJwt()

  try {
    await getUserCharacterSummaries()
    revalidatePath('/user/character')
    return { error: null }
  } catch (error) {
    return {
      error: extractApiErrorMessages(error).join(' / ')
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
    return {
      error: status === undefined
        ? GENERIC_SHEET_NETWORK_ERROR_MESSAGE
        : extractApiErrorMessages(error).join(' / '),
      retryable: status === undefined || status === 429 || (status >= 500 && status < 600)
    }
  }

  redirect('/user/character')
}
