/**
 * characterEdit customId 契約モジュールの生存述語と field 生成契約の characterization テスト。
 *
 * 生存中の作成述語が旧 startsWith と同じ受理範囲を保つことと、field の生成・探索に使う
 * prefix / セクション中置が byte 一致することを固定する。
 */

import { CharacterCreateCustomId } from './character-create.custom-id'
import {
  CharacterFieldCustomId,
  CHARACTER_FIELD_EDIT_CUSTOM_ID_PREFIX,
  CHARACTER_FIELD_ADD_CUSTOM_ID_PREFIX,
  characterFieldSectionInfix
} from './character-field.custom-id'

describe('characterEdit custom-id 述語（startsWith 等価）', () => {
  describe('CharacterCreateCustomId.isBasic / isCancel', () => {
    it('isBasic: basic prefix は true・cancel prefix は false', () => {
      expect(CharacterCreateCustomId.isBasic('character-create-basic-chan-user')).toBe(true)
      expect(CharacterCreateCustomId.isBasic('character-create-cancel-chan-user')).toBe(false)
    })

    it('isCancel: cancel prefix は true・basic prefix は false', () => {
      expect(CharacterCreateCustomId.isCancel('character-create-cancel-chan-user')).toBe(true)
      expect(CharacterCreateCustomId.isCancel('character-create-basic-chan-user')).toBe(false)
    })

    it('prefix のみ（引数空）でも true（旧 startsWith 挙動を保存）', () => {
      expect(CharacterCreateCustomId.isBasic('character-create-basic-')).toBe(true)
      expect(CharacterCreateCustomId.isCancel('character-create-cancel-')).toBe(true)
    })

    it('前方一致でない場合は false', () => {
      expect(CharacterCreateCustomId.isBasic('x-character-create-basic-')).toBe(false)
    })
  })

  // field 操作 prefix とセクション中置の正本を契約側へ集約。
  // 生成（createEdit/createAdd）と探索（includes 判定・extractSectionFromCustomId）の
  // byte 一致をここで固定する。
  describe('CharacterFieldCustomId 正本（prefix / セクション中置）', () => {
    it('prefix 定数は生成フォーマットの literal と byte 一致', () => {
      expect(CHARACTER_FIELD_EDIT_CUSTOM_ID_PREFIX).toBe('character-field-edit-')
      expect(CHARACTER_FIELD_ADD_CUSTOM_ID_PREFIX).toBe('character-field-add-')
    })

    it('characterFieldSectionInfix は `-{sectionType}-` を返す', () => {
      expect(characterFieldSectionInfix('status')).toBe('-status-')
      expect(characterFieldSectionInfix('parameter')).toBe('-parameter-')
      expect(characterFieldSectionInfix('skill')).toBe('-skill-')
      expect(characterFieldSectionInfix('item')).toBe('-item-')
    })

    it('createEdit/createAdd の生成 bytes は prefix + 中置と一致する（Factory ↔ 正本の三者一致）', () => {
      expect(CharacterFieldCustomId.createEdit('status', 'abc123')).toBe('character-field-edit-status-abc123')
      expect(CharacterFieldCustomId.createAdd('skill', 'xyz789')).toBe('character-field-add-skill-xyz789')

      expect(
        CharacterFieldCustomId.createEdit('status', 'abc123').startsWith(CHARACTER_FIELD_EDIT_CUSTOM_ID_PREFIX)
      ).toBe(true)
      expect(CharacterFieldCustomId.createAdd('skill', 'xyz789').startsWith(CHARACTER_FIELD_ADD_CUSTOM_ID_PREFIX)).toBe(
        true
      )
      expect(CharacterFieldCustomId.createEdit('status', 'abc123').includes(characterFieldSectionInfix('status'))).toBe(
        true
      )
      expect(CharacterFieldCustomId.createAdd('skill', 'xyz789').includes(characterFieldSectionInfix('skill'))).toBe(
        true
      )
    })
  })
})
