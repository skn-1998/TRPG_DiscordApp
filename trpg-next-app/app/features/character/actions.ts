'use server'

import {
  sheetMergeConflictSchema,
  type CharacterSheetVisibility,
  type RerollCreationRollResultWire,
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
  rerollCreationRoll,
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

/**
 * 成功時に返す振り直し結果。`error: null` で判別でき、成功側にだけ wire が載る。
 * 呼び出し側は `roll.revision` を次の baseRevision へ、`roll.value` を当該 field の値へ書き戻す。
 */
export type RerollSheetFieldResult =
  | { error: null; roll: RerollCreationRollResultWire }
  | { error: string; conflict?: boolean }

/**
 * 作成時ロールの振り直し。saveSheet と違い成功時に redirect しない。
 * 振り直しは結果（出目）を同じ画面で見せる操作であり、画面遷移すると出目を提示できないため。
 */
export async function rerollSheetField(
  characterId: string,
  fieldUid: string,
  baseRevision: number
): Promise<RerollSheetFieldResult> {
  await requireJwt()

  try {
    const roll = await rerollCreationRoll({ characterId, fieldUid, baseRevision })
    // 一覧（CharacterSummaryWire）はシート値を持たないため、振り直しで陳腐化するのはこのシート面だけ。
    revalidatePath(`/user/character/${characterId}/sheet`)
    return { error: null, roll }
  } catch (error) {
    const status = getResponseStatus(error)
    // server の rerollCreationRoll が投げる 409 は revision 不一致・保存 CAS 敗北・未 materialize の
    // いずれか（character-sheet-operation.service の rerollCreationRoll）。どれも同じ baseRevision の
    // 再送では解消しない。
    if (status === 409) {
      return { error: GENERIC_SHEET_CONFLICT_MESSAGE, conflict: true }
    }
    // saveSheet と違い、どの status も再試行可として分類しない（retryable を返さない）。saveSheet の
    // 再送は path ごとの baseValue CAS に守られ、1 回目が実は成功していれば 2 回目が弾かれる。
    // 振り直しの失敗応答は保存されたかどうかを伝えないので、応答が失われただけの場合の再送は
    // 利用者が意図しない 2 回目の出目になる。
    const messages = status === undefined ? [GENERIC_NETWORK_ERROR_MESSAGE] : extractApiErrorMessages(error)
    return {
      error: messages.length > 0 ? messages.join(' / ') : GENERIC_NETWORK_ERROR_MESSAGE
    }
  }
}
