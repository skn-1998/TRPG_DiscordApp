import {
  extractCharacterIdFromCustomId,
  parseModalSubmitCustomId,
  parseSectionSelectValue,
  normalizeSectionType,
  messageHasCharacterEditButtons,
  MessageLike
} from './enhanced-character-edit.util'

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

    it('マッチしない customId は null を返す', () => {
      expect(extractCharacterIdFromCustomId('char-edit-status-hp-char-123')).toBeNull()
      expect(extractCharacterIdFromCustomId('unknown')).toBeNull()
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
