import type { CharacterEntity } from '../models/character.entity'

export const normalizeSheetVisibilityValue = (value: unknown): 'private' | 'public' => {
  if (value === 'private' || value === 'public') return value
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
