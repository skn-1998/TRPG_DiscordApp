import type { UpdateCharacterDto } from '../../../../domains/character/dto/update-character.dto'
import type { CharacterEntity } from '../../../../domains/character/models/character.entity'

type EditableCharacterSectionKey = keyof CharacterEntity & keyof UpdateCharacterDto

type CharacterSectionDescriptorConstraint =
  | {
      readonly type: 'basic'
      readonly displayName: string
      readonly emoji: string | null
      readonly color: `#${string}`
      readonly editable: false
      readonly menuDescription: null
    }
  | {
      readonly type: EditableCharacterSectionKey
      readonly displayName: string
      readonly emoji: string
      readonly color: `#${string}`
      readonly editable: true
      readonly menuDescription: string
    }

/**
 * characterEdit が扱う表示セクションの正本。
 * editable 行の type は CharacterEntity / UpdateCharacterDto 双方のキーに制約される。
 */
export const SECTION_DESCRIPTORS = [
  {
    type: 'basic',
    displayName: '基本情報',
    emoji: '🏷️',
    color: '#3498db',
    editable: false,
    menuDescription: null
  },
  {
    type: 'status',
    displayName: 'ステータス',
    emoji: '📊',
    color: '#e74c3c',
    editable: true,
    menuDescription: '基本ステータスを編集'
  },
  {
    type: 'parameter',
    displayName: 'パラメータ',
    emoji: '⚙️',
    color: '#34495e',
    editable: true,
    menuDescription: '能力値やパラメータを編集'
  },
  {
    type: 'skill',
    displayName: 'スキル',
    emoji: '⚔️',
    color: '#9b59b6',
    editable: true,
    menuDescription: '技能や特技を編集'
  },
  {
    type: 'item',
    displayName: 'アイテム',
    emoji: '🎒',
    color: '#f39c12',
    editable: true,
    menuDescription: '装備品やアイテムを編集'
  }
] as const satisfies readonly CharacterSectionDescriptorConstraint[]

export type CharacterSectionDescriptor = (typeof SECTION_DESCRIPTORS)[number]
export type CharacterEditSectionType = CharacterSectionDescriptor['type']
export type EditableSectionDescriptor = Extract<CharacterSectionDescriptor, { readonly editable: true }>
export type EditableSectionType = EditableSectionDescriptor['type']
export type EmbedSectionType = CharacterEditSectionType | 'back'

export const EDITABLE_SECTION_DESCRIPTORS: readonly EditableSectionDescriptor[] = SECTION_DESCRIPTORS.filter(
  (descriptor): descriptor is EditableSectionDescriptor => descriptor.editable
)

export const EDITABLE_SECTION_TYPES: readonly EditableSectionType[] = EDITABLE_SECTION_DESCRIPTORS.map(
  ({ type }) => type
)

export function isCharacterEditSectionType(value: string | undefined): value is CharacterEditSectionType {
  return SECTION_DESCRIPTORS.some(({ type }) => type === value)
}

export function isEditableSectionType(value: string): value is EditableSectionType {
  return EDITABLE_SECTION_TYPES.some((type) => type === value)
}

export function getSectionDescriptor<T extends CharacterEditSectionType>(
  type: T
): Extract<CharacterSectionDescriptor, { readonly type: T }>
export function getSectionDescriptor(type: CharacterEditSectionType): CharacterSectionDescriptor | undefined {
  return SECTION_DESCRIPTORS.find((descriptor) => descriptor.type === type)
}

export function getSectionDisplayName(sectionType: CharacterEditSectionType): string
export function getSectionDisplayName(sectionType: CharacterEditSectionType): string | undefined {
  return getSectionDescriptor(sectionType)?.displayName
}

/** basic/back は編集データを持たないため undefined を返す。 */
export function getSectionData(
  character: CharacterEntity,
  sectionType: EmbedSectionType
): Record<string, unknown> | undefined {
  if (!isEditableSectionType(sectionType)) {
    return undefined
  }

  return character[sectionType]
}
