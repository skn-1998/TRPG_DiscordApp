import type { UpdateCharacterDto } from '../../../../domains/character/dto/update-character.dto'
import type { CharacterEntity } from '../../../../domains/character/models/character.entity'
import type { CharacterEditSectionType as ContractCharacterEditSectionType } from '../../../../events/contracts/unified-event-contracts'
import {
  EDITABLE_SECTION_TYPES,
  getSectionDisplayName,
  SECTION_DESCRIPTORS,
  type CharacterEditSectionType,
  type EditableSectionType
} from './character-section-descriptor'

describe('character-section-descriptor', () => {
  it('編集可能セクションの値と順序を固定する', () => {
    expect(EDITABLE_SECTION_TYPES).toEqual(['status', 'parameter', 'skill', 'item'])
  })

  it('5 セクションの表示名を固定する', () => {
    expect(Object.fromEntries(SECTION_DESCRIPTORS.map(({ type, displayName }) => [type, displayName]))).toEqual({
      basic: '基本情報',
      status: 'ステータス',
      parameter: 'パラメータ',
      skill: 'スキル',
      item: 'アイテム'
    })
  })

  it('実行時の未知値は throw せず undefined を返す', () => {
    const getUnknownDisplayName = () => getSectionDisplayName('unknown' as never)

    expect(getUnknownDisplayName).not.toThrow()
    expect(getUnknownDisplayName()).toBeUndefined()
  })

  it('events の wire 契約 union と双方向に代入可能である', () => {
    const descriptorFitsContract: CharacterEditSectionType extends ContractCharacterEditSectionType ? true : false =
      true
    const contractFitsDescriptor: ContractCharacterEditSectionType extends CharacterEditSectionType ? true : false =
      true

    expect(descriptorFitsContract).toBe(true)
    expect(contractFitsDescriptor).toBe(true)
  })

  it('editable type が CharacterEntity / UpdateCharacterDto 双方のキーに含まれる', () => {
    const fitsEntity: EditableSectionType extends keyof CharacterEntity ? true : false = true
    const fitsUpdateDto: EditableSectionType extends keyof UpdateCharacterDto ? true : false = true

    expect(fitsEntity).toBe(true)
    expect(fitsUpdateDto).toBe(true)
  })
})
