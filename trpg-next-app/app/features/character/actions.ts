'use server'

import { revalidatePath } from 'next/cache'
import { requireJwt } from '../../lib/auth-guard.server'
import { getUserCharacterSummaries } from './api/character.service.server'

export async function refreshCharacterList(): Promise<{ error: string | null }> {
  await requireJwt()

  try {
    await getUserCharacterSummaries()
    revalidatePath('/user/character')
    return { error: null }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to load characters'
    }
  }
}
