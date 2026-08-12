import type { CharacterEntity } from '../models/character.entity'

export const normalizePersistedCharacterSheet = (character: CharacterEntity): CharacterEntity => {
  const sheet = character.sheet
  if (sheet === undefined || sheet.visibility === 'private' || sheet.visibility === 'public') return character

  return {
    ...character,
    sheet: { ...sheet, visibility: 'private' }
  }
}
