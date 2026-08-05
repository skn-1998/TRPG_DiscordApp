/**
 * character-section-editor.util の純粋関数テスト
 *
 * すべてモック不要（副作用なし）。CharacterSectionEditorService から抽出した
 * 整形・分岐判定ロジックの 3 分岐・境界・異常系を網羅する。
 */

import {
  extractFieldEditValues,
  extractSectionFromCustomId,
  isFieldOperationCustomId,
  buildDirectModalId,
  buildSessionModalId,
  shouldUseDirectModalId,
  buildModalTitle,
  getSectionDisplayName,
  sanitizeDescriptionValue,
  getSectionData
} from './character-section-editor.util'
import { Character } from '../../../../domains/character/models/character.model'

describe('character-section-editor.util (pure functions)', () => {
  describe('extractFieldEditValues', () => {
    describe('AttributeValue 形式', () => {
      it('values を合算して数値欄に、dice/description/name を各欄に振り分ける', () => {
        const sectionData = {
          hp: { name: 'ヒットポイント', values: { base: 10, buff: 5 }, dice: '3d6', description: '生命力' }
        }
        expect(extractFieldEditValues(sectionData, 'hp')).toEqual({
          fieldName: 'ヒットポイント',
          currentValues: '15',
          currentDice: '3d6',
          currentDescription: '生命力'
        })
      })

      it('values が空オブジェクトなら数値欄は空文字（合算しない）', () => {
        const sectionData = { mp: { name: 'MP', values: {} } }
        expect(extractFieldEditValues(sectionData, 'mp')).toEqual({
          fieldName: 'MP',
          currentValues: '',
          currentDice: '',
          currentDescription: ''
        })
      })

      it('name が無ければ fieldKey をフォールバックに使う', () => {
        const sectionData = { atk: { values: { base: 3 } } }
        expect(extractFieldEditValues(sectionData, 'atk').fieldName).toBe('atk')
      })

      it('dice/description が無ければ各欄は空文字', () => {
        const sectionData = { def: { name: '防御', values: { base: 7 } } }
        const result = extractFieldEditValues(sectionData, 'def')
        expect(result.currentValues).toBe('7')
        expect(result.currentDice).toBe('')
        expect(result.currentDescription).toBe('')
      })
    })

    describe('レガシー name+value 形式', () => {
      it('value が数値文字列なら数値欄に入る', () => {
        const sectionData = { atk: { name: '攻撃力', value: '42' } }
        expect(extractFieldEditValues(sectionData, 'atk')).toEqual({
          fieldName: '攻撃力',
          currentValues: '42',
          currentDice: '',
          currentDescription: ''
        })
      })

      it('value が非数値なら説明欄に入る', () => {
        const sectionData = { memo: { name: 'メモ', value: 'これは説明文' } }
        expect(extractFieldEditValues(sectionData, 'memo')).toEqual({
          fieldName: 'メモ',
          currentValues: '',
          currentDice: '',
          currentDescription: 'これは説明文'
        })
      })

      it('name が文字列でなければ fieldKey をフォールバック', () => {
        const sectionData = { x: { name: 123, value: '5' } }
        expect(extractFieldEditValues(sectionData, 'x').fieldName).toBe('x')
      })

      it('value が未定義（null/undefined）なら説明欄に空文字相当', () => {
        const sectionData = { y: { name: 'Y', value: null } }
        const result = extractFieldEditValues(sectionData, 'y')
        expect(result.currentValues).toBe('')
        expect(result.currentDescription).toBe('')
      })
    })

    describe('プリミティブ値', () => {
      it('数値プリミティブは数値欄に入り、fieldName は fieldKey', () => {
        const sectionData = { lv: 7 }
        expect(extractFieldEditValues(sectionData, 'lv')).toEqual({
          fieldName: 'lv',
          currentValues: '7',
          currentDice: '',
          currentDescription: ''
        })
      })

      it('数値文字列プリミティブも数値欄に入る', () => {
        const sectionData = { lv: '12' }
        expect(extractFieldEditValues(sectionData, 'lv').currentValues).toBe('12')
      })

      it('非数値文字列プリミティブは説明欄に入る', () => {
        const sectionData = { note: 'freeform text' }
        expect(extractFieldEditValues(sectionData, 'note')).toEqual({
          fieldName: 'note',
          currentValues: '',
          currentDice: '',
          currentDescription: 'freeform text'
        })
      })
    })

    describe('境界・異常系', () => {
      it('sectionData が undefined なら空値 + fieldName=fieldKey', () => {
        expect(extractFieldEditValues(undefined, 'hp')).toEqual({
          fieldName: 'hp',
          currentValues: '',
          currentDice: '',
          currentDescription: ''
        })
      })

      it('fieldKey が存在しなければ空値 + fieldName=fieldKey', () => {
        expect(extractFieldEditValues({ other: 1 }, 'hp').fieldName).toBe('hp')
      })

      it('値が object でも values も name+value も持たないなら空値', () => {
        const sectionData = { weird: { foo: 'bar' } }
        expect(extractFieldEditValues(sectionData, 'weird')).toEqual({
          fieldName: 'weird',
          currentValues: '',
          currentDice: '',
          currentDescription: ''
        })
      })
    })
  })

  describe('extractSectionFromCustomId', () => {
    it.each([
      ['character-field-edit-status-x', 'status'],
      ['character-field-edit-parameter-x', 'parameter'],
      ['character-field-edit-skill-x', 'skill'],
      ['character-field-add-item-x', 'item']
    ])('%s -> %s', (customId, expected) => {
      expect(extractSectionFromCustomId(customId)).toBe(expected)
    })

    it('該当するセクション語が無ければ null', () => {
      expect(extractSectionFromCustomId('character-edit-section-abc')).toBeNull()
    })

    it('中置は位置を問わず一致する（includes 現挙動の正例 pin）', () => {
      expect(extractSectionFromCustomId('x-status-y')).toBe('status')
    })

    it('中置の語彙を含むが両端ハイフンが揃わない敵対値は null', () => {
      expect(extractSectionFromCustomId('character-field-edit-statusx-abc')).toBeNull()
    })
  })

  describe('isFieldOperationCustomId', () => {
    it.each([
      ['character-field-edit-status-x', true],
      ['character-field-add-status-x', true],
      ['character-edit-section-x', false],
      ['character-section-select-x', false],
      // 中置に prefix を含む敵対値（includes 現挙動の正例 pin）
      ['x-character-field-edit-y', true],
      // 引き締め差分の負例 pin: 末尾ハイフン無しの非生成形は旧 true → 新 false
      ['character-field-edit', false],
      ['character-field-editorial-x', false]
    ])('%s -> %s', (customId, expected) => {
      expect(isFieldOperationCustomId(customId)).toBe(expected)
    })
  })

  describe('shouldUseDirectModalId', () => {
    it('8 文字以下は true（直接 customId）', () => {
      expect(shouldUseDirectModalId('abc123')).toBe(true)
      expect(shouldUseDirectModalId('12345678')).toBe(true)
    })

    it('8 文字超は false（session 採番）', () => {
      expect(shouldUseDirectModalId('123456789')).toBe(false)
    })
  })

  describe('buildDirectModalId', () => {
    it('char-edit-<section>-<field>-<id> の形を生成', () => {
      expect(buildDirectModalId('status', 'hp', 'abc123')).toBe('char-edit-status-hp-abc123')
    })
  })

  describe('buildSessionModalId', () => {
    it('char-edit-modal-<sessionId> の形を生成', () => {
      expect(buildSessionModalId('SESSION99')).toBe('char-edit-modal-SESSION99')
    })
  })

  describe('getSectionDisplayName', () => {
    it.each([
      ['status', 'ステータス'],
      ['parameter', 'パラメータ'],
      ['skill', 'スキル'],
      ['item', 'アイテム'],
      ['basic', '基本情報']
    ] as const)('%s -> %s', (section, expected) => {
      expect(getSectionDisplayName(section)).toBe(expected)
    })
  })

  describe('buildModalTitle', () => {
    it('isNew=true は「追加」を付ける', () => {
      expect(buildModalTitle('status', true)).toBe('ステータス追加')
    })

    it('isNew=false は「編集」を付ける', () => {
      expect(buildModalTitle('skill', false)).toBe('スキル編集')
    })
  })

  describe('sanitizeDescriptionValue', () => {
    it('前後の空白を trim する', () => {
      expect(sanitizeDescriptionValue('  hello  ')).toBe('hello')
    })

    it('1000 文字以下はそのまま', () => {
      const s = 'a'.repeat(1000)
      expect(sanitizeDescriptionValue(s)).toBe(s)
      expect(sanitizeDescriptionValue(s)).toHaveLength(1000)
    })

    it('1000 文字超は 997 文字 + "..." に切り詰める', () => {
      const s = 'b'.repeat(1500)
      const result = sanitizeDescriptionValue(s)
      expect(result).toHaveLength(1000)
      expect(result.endsWith('...')).toBe(true)
      expect(result.substring(0, 997)).toBe('b'.repeat(997))
    })
  })

  describe('getSectionData', () => {
    const character = {
      characterId: 'c1',
      status: { hp: 1 },
      parameter: { str: 2 },
      skill: { swim: 3 },
      item: { sword: 4 }
    } as unknown as Character

    it.each([
      ['status', { hp: 1 }],
      ['parameter', { str: 2 }],
      ['skill', { swim: 3 }],
      ['item', { sword: 4 }]
    ] as const)('%s セクションを返す', (section, expected) => {
      expect(getSectionData(character, section)).toEqual(expected)
    })

    it('basic/back など対象外セクションは undefined', () => {
      expect(getSectionData(character, 'basic')).toBeUndefined()
      expect(getSectionData(character, 'back')).toBeUndefined()
    })
  })
})
