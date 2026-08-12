import { characterSheetVisibilitySchema, type CharacterSheetVisibility } from '@trpg/api-contract'
import type { CharacterEntity } from '../models/character.entity'

export const normalizeSheetVisibilityValue = (value: unknown): CharacterSheetVisibility => {
  const parsedVisibility = characterSheetVisibilitySchema.safeParse(value)
  if (parsedVisibility.success) return parsedVisibility.data
  return 'private'
}

export const normalizePersistedCharacterSheet = (character: CharacterEntity): CharacterEntity => {
  const sheet = character.sheet
  if (sheet === undefined) return character

  const visibility = normalizeSheetVisibilityValue(sheet.visibility)
  if (sheet.visibility === visibility) return character

  return {
    ...character,
    sheet: { ...sheet, visibility }
  }
}
