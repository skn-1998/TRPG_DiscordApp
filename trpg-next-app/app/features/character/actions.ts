'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireJwt } from '../../lib/auth-guard.server'
import { extractApiErrorMessages, getResponseStatus } from '../../lib/api-response.util'
import {
  getUserCharacterSummaries,
  saveCharacterSheet,
  type CharacterSheetChange
} from './api/character.service.server'

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
): Promise<{ error: string | null; conflict?: boolean }> {
  await requireJwt()

  try {
    await saveCharacterSheet({ characterId, ...input })
  } catch (error) {
    if (getResponseStatus(error) === 409) {
      return {
        error: '他の操作でシートが更新されました。ページを再読み込みしてから再入力してください。',
        conflict: true
      }
    }
    return { error: extractApiErrorMessages(error).join(' / ') }
  }

  redirect('/user/character')
}
