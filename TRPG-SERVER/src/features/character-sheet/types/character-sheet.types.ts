import type {
  CharacterEntity,
  CharacterPaletteEntry as PaletteEntry,
  CharacterSheetState
} from '../../../domains/character/models/character.entity'
import type { CharacterSheetTemplateEntity } from '../../../domains/character-sheet-template/models/character-sheet-template.entity'
import type { AttributeSection } from '../../../core/types/attribute.types'

export type { CharacterSheetState, PaletteEntry }

export interface CharacterSheetProjection {
  status: AttributeSection
  parameter: AttributeSection
  skill: AttributeSection
  item: AttributeSection
  description: AttributeSection
}

export interface MaterializeCharacterSheetInput {
  template: CharacterSheetTemplateEntity
  sheet: CharacterSheetState
  existingPalette?: PaletteEntry[]
}

export interface MaterializedCharacterSheet {
  sheet: CharacterSheetState
  computedCache: Record<string, number | string | boolean>
  projection: CharacterSheetProjection
  palette: PaletteEntry[]
}

export interface InstantiateCharacterInput {
  templateId: string
  templateVersion: string
  requesterDiscordUserId: string
  characterName: string
  discordUserId: string
  discordChannelId: string
  discordThreadId?: string
  values?: Record<string, unknown>
}

export interface RollOnCreateResult {
  uid: string
  notation: string
  total: number
  details: string
}

export interface InstantiateCharacterResult {
  character: CharacterEntity
  materialized: MaterializedCharacterSheet
  rollOnCreateResults: RollOnCreateResult[]
}
