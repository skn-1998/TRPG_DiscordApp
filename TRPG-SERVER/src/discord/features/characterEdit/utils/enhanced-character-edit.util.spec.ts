import {
  extractCharacterIdFromCustomId,
  parseModalSubmitCustomId,
  parseSectionSelectValue,
  normalizeSectionType,
  messageHasCharacterEditButtons,
  MessageLike
} from './enhanced-character-edit.util'
import { CharacterRefreshCustomId } from '../custom-id/character-refresh.custom-id'
import { CharacterCompactCustomId } from '../custom-id/character-compact.custom-id'
import { CharacterSectionCustomId } from '../custom-id/character-section.custom-id'
import { CharacterFieldCustomId } from '../custom-id/character-field.custom-id'

describe('enhanced-character-edit.util (pure functions)', () => {
  describe('extractCharacterIdFromCustomId', () => {
    it('character-refresh- パターンから ID を抽出する', () => {
      expect(extractCharacterIdFromCustomId('character-refresh-abc123')).toBe('abc123')
    })

    it('character-compact-view- パターンから ID を抽出する', () => {
      expect(extractCharacterIdFromCustomId('character-compact-view-xyz789')).toBe('xyz789')
    })

    it('ハイフンを含む characterId も貪欲に抽出する', () => {
      expect(extractCharacterIdFromCustomId('character-refresh-id-with-dash')).toBe('id-with-dash')
    })

    it('character-edit-section- パターンから ID を抽出', () => {
      expect(extractCharacterIdFromCustomId('character-edit-section-abc123')).toBe('abc123')
    })

    it('character-field-edit-<section>- パターンから ID を抽出', () => {
      expect(extractCharacterIdFromCustomId('character-field-edit-status-abc123')).toBe('abc123')
    })

    it('character-field-add-<section>- パターンから ID を抽出', () => {
      expect(extractCharacterIdFromCustomId('character-field-add-skill-xyz789')).toBe('xyz789')
    })

    it('character-section-select- パターンから ID を抽出', () => {
      expect(extractCharacterIdFromCustomId('character-section-select-id-1')).toBe('id-1')
    })

    it('ハイフンを含む長い ID も貪欲に抽出', () => {
      expect(extractCharacterIdFromCustomId('character-edit-section-a-b-c-123')).toBe('a-b-c-123')
    })

    it('section family の characterId に refresh prefix が含まれても完全な ID を返す', () => {
      expect(extractCharacterIdFromCustomId('character-edit-section-character-refresh-x')).toBe('character-refresh-x')
    })

    it('field family の characterId に refresh prefix が含まれても完全な ID を返す', () => {
      expect(extractCharacterIdFromCustomId('character-field-edit-status-character-refresh-x')).toBe(
        'character-refresh-x'
      )
    })

    it('family prefix が位置 0 にない customId は捕捉しない', () => {
      expect(extractCharacterIdFromCustomId('x-character-refresh-abc')).toBeNull()
    })

    it('一致しない customId は null', () => {
      expect(extractCharacterIdFromCustomId('totally-unknown')).toBeNull()
    })

    it('マッチしない customId は null を返す', () => {
      expect(extractCharacterIdFromCustomId('char-edit-status-hp-char-123')).toBeNull()
      expect(extractCharacterIdFromCustomId('unknown')).toBeNull()
    })

    describe('契約 create との round-trip', () => {
      const collisionId = 'character-refresh-x'

      it('refresh family は create した ID を完全に抽出する', () => {
        expect(extractCharacterIdFromCustomId(CharacterRefreshCustomId.create(collisionId))).toBe(collisionId)
      })

      it('compact-view family は create した ID を完全に抽出する', () => {
        expect(extractCharacterIdFromCustomId(CharacterCompactCustomId.create(collisionId))).toBe(collisionId)
      })

      it('edit-section family は create した ID を完全に抽出する', () => {
        expect(extractCharacterIdFromCustomId(CharacterSectionCustomId.createEditSection(collisionId))).toBe(
          collisionId
        )
      })

      it('field-edit family は create した ID を完全に抽出する', () => {
        expect(extractCharacterIdFromCustomId(CharacterFieldCustomId.createEdit('status', collisionId))).toBe(
          collisionId
        )
      })

      it('field-add family は create した ID を完全に抽出する', () => {
        expect(extractCharacterIdFromCustomId(CharacterFieldCustomId.createAdd('skill', collisionId))).toBe(collisionId)
      })

      it('section-select family は契約形式の ID を完全に抽出する', () => {
        expect(extractCharacterIdFromCustomId('character-section-select-' + collisionId)).toBe(collisionId)
      })
    })
  })

  describe('parseModalSubmitCustomId', () => {
    it('split の最後を characterId、parts[2]/parts[3] を section/field とする', () => {
      expect(parseModalSubmitCustomId('char-edit-status-hp-char-123')).toEqual({
        characterId: '123',
        sectionType: 'status',
        fieldKey: 'hp'
      })
    })

    it('要素が足りない場合 sectionType/fieldKey は unknown', () => {
      expect(parseModalSubmitCustomId('char-edit')).toEqual({
        characterId: 'edit',
        sectionType: 'unknown',
        fieldKey: 'unknown'
      })
    })

    it('単一要素は characterId にその値、section/field は unknown', () => {
      expect(parseModalSubmitCustomId('solo')).toEqual({
        characterId: 'solo',
        sectionType: 'unknown',
        fieldKey: 'unknown'
      })
    })
  })

  describe('parseSectionSelectValue', () => {
    it('sectionType-fieldKey を分解する', () => {
      expect(parseSectionSelectValue('status-hp')).toEqual({ sectionType: 'status', fieldKey: 'hp' })
    })

    it('fieldKey が無い場合は fieldKey=undefined を unknown に補正する', () => {
      expect(parseSectionSelectValue('status')).toEqual({ sectionType: 'status', fieldKey: 'unknown' })
    })

    it('undefined は両方 unknown', () => {
      expect(parseSectionSelectValue(undefined)).toEqual({ sectionType: 'unknown', fieldKey: 'unknown' })
    })
  })

  describe('normalizeSectionType', () => {
    it('既知の sectionType はそのまま返す', () => {
      expect(normalizeSectionType('status')).toBe('status')
      expect(normalizeSectionType('parameter')).toBe('parameter')
      expect(normalizeSectionType('skill')).toBe('skill')
      expect(normalizeSectionType('item')).toBe('item')
      expect(normalizeSectionType('basic')).toBe('basic')
    })

    it('未知の値や undefined は basic にフォールバックする', () => {
      expect(normalizeSectionType('unknown')).toBe('basic')
      expect(normalizeSectionType(undefined)).toBe('basic')
    })
  })

  describe('messageHasCharacterEditButtons', () => {
    const botMessageWith = (customId: string): MessageLike => ({
      author: { bot: true },
      components: [{ components: [{ type: 2, customId }] }]
    })

    it('refresh ボタンを含むボット発メッセージは true', () => {
      expect(messageHasCharacterEditButtons(botMessageWith('character-refresh-abc'), 'abc')).toBe(true)
    })

    it('compact-view ボタンを含むボット発メッセージは true', () => {
      expect(messageHasCharacterEditButtons(botMessageWith('character-compact-view-abc'), 'abc')).toBe(true)
    })

    it('別 characterId のボタンは false', () => {
      expect(messageHasCharacterEditButtons(botMessageWith('character-refresh-other'), 'abc')).toBe(false)
    })

    it('生成文字列が中置に現れる敵対値も一致する（includes 現挙動の正例 pin）', () => {
      expect(messageHasCharacterEditButtons(botMessageWith('x-character-refresh-abc-y'), 'abc')).toBe(true)
    })

    it('語彙を中置に含むが characterId が一致しない敵対値は false', () => {
      expect(messageHasCharacterEditButtons(botMessageWith('x-character-refresh-zzz-y'), 'abc')).toBe(false)
    })

    it('ボタン以外(type!=2)は false', () => {
      const msg: MessageLike = {
        author: { bot: true },
        components: [{ components: [{ type: 3, customId: 'character-refresh-abc' }] }]
      }
      expect(messageHasCharacterEditButtons(msg, 'abc')).toBe(false)
    })

    it('ボット以外の発言は false', () => {
      const msg = botMessageWith('character-refresh-abc')
      msg.author.bot = false
      expect(messageHasCharacterEditButtons(msg, 'abc')).toBe(false)
    })

    it('components 無しの行は安全に false', () => {
      const msg: MessageLike = { author: { bot: true }, components: [{}] }
      expect(messageHasCharacterEditButtons(msg, 'abc')).toBe(false)
    })
  })
})
