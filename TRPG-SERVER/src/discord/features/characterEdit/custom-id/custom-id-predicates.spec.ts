/**
 * characterEdit customId 契約モジュールの述語（is / isBasic / isCancel）characterization テスト。
 *
 * P1-D slice1 Slice B で enhanced-character-edit.service の button 分岐
 * （customId.startsWith(...) によるディスパッチ）を契約モジュールの述語へ移行した。
 * 述語は旧 startsWith と byte-identical な受理範囲（空 id でも true・substring は false・
 * 他 family は false）であることを固定し、将来の drift を防ぐ。
 */

import { CharacterRefreshCustomId } from './character-refresh.custom-id'
import { CharacterCompactCustomId } from './character-compact.custom-id'
import { CharacterCreateCustomId } from './character-create.custom-id'

describe('characterEdit custom-id 述語（startsWith 等価）', () => {
  describe('CharacterRefreshCustomId.is', () => {
    it('prefix で始まれば true（characterId 付き）', () => {
      expect(CharacterRefreshCustomId.is('character-refresh-abc123')).toBe(true)
    })

    it('prefix のみ（characterId 空）でも true（旧 startsWith 挙動を保存）', () => {
      expect(CharacterRefreshCustomId.is('character-refresh-')).toBe(true)
    })

    it('prefix が途中にある（前方一致でない）場合は false', () => {
      expect(CharacterRefreshCustomId.is('x-character-refresh-abc')).toBe(false)
    })

    it('別 family（compact-view）は false', () => {
      expect(CharacterRefreshCustomId.is('character-compact-view-abc')).toBe(false)
    })
  })

  describe('CharacterCompactCustomId.is', () => {
    it('prefix で始まれば true', () => {
      expect(CharacterCompactCustomId.is('character-compact-view-abc123')).toBe(true)
    })

    it('prefix のみでも true', () => {
      expect(CharacterCompactCustomId.is('character-compact-view-')).toBe(true)
    })

    it('別 family（refresh）は false', () => {
      expect(CharacterCompactCustomId.is('character-refresh-abc')).toBe(false)
    })
  })

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
})
