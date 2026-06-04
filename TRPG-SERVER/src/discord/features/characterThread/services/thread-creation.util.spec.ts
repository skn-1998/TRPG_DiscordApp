// 実 discord.js Builder の挙動を検証するためグローバルモックを無効化
jest.unmock('discord.js')
jest.mock('discord.js', () => jest.requireActual('discord.js'))

import { Character } from '../../../../domains/character/models/character.model'
import {
  buildThreadName,
  buildThreadUrl,
  generateCharacterEditUrl,
  formatCharacterData,
  extractNumericValue,
  createBasicCharacterEmbed,
  createDetailedCharacterEmbed
} from './thread-creation.util'

const buildCharacter = (overrides: Partial<Character> = {}): Character =>
  ({
    characterId: 'char-123',
    characterName: 'テストキャラ',
    gameSystemId: 'coc7',
    discordUserId: 'user-1',
    discordChannelId: 'channel-edit-999',
    status: { hp: { name: 'HP', value: 12 } },
    parameter: { str: { name: 'STR', value: 50 } },
    skill: { dodge: { name: '回避', value: 40 } },
    item: { sword: { name: '剣', value: 1 } },
    ...overrides
  }) as unknown as Character

describe('thread-creation.util', () => {
  describe('buildThreadName', () => {
    it('🎭 名前 [YYYY-MM-DD] 形式で生成する', () => {
      const date = new Date('2024-03-15T10:30:00Z')
      expect(buildThreadName('アリス', date)).toBe('🎭 アリス [2024-03-15]')
    })

    it('日付未指定時もフォーマットに一致する', () => {
      expect(buildThreadName('ボブ')).toMatch(/^🎭 ボブ \[\d{4}-\d{2}-\d{2}\]$/)
    })
  })

  describe('buildThreadUrl', () => {
    it('Discord チャンネル URL を組み立てる', () => {
      expect(buildThreadUrl('g1', 'c1', 't1')).toBe('https://discord.com/channels/g1/c1/t1')
    })
  })

  describe('generateCharacterEditUrl', () => {
    it('discordChannelId があれば編集 URL を返す', () => {
      const character = buildCharacter({ discordChannelId: 'edit-1' })
      expect(generateCharacterEditUrl(character, 'g1')).toBe('https://discord.com/channels/g1/edit-1')
    })

    it('discordChannelId が無ければ null を返す', () => {
      const character = buildCharacter({ discordChannelId: '' })
      expect(generateCharacterEditUrl(character, 'g1')).toBeNull()
    })
  })

  describe('formatCharacterData', () => {
    it('name/value 形式は **name**: value で整形する', () => {
      const result = formatCharacterData({ hp: { name: 'HP', value: 12 } })
      expect(result).toBe('**HP**: 12')
    })

    it('プレーン値は **key**: value で整形する', () => {
      expect(formatCharacterData({ str: 50 })).toBe('**str**: 50')
    })

    it('最大5項目までに制限する', () => {
      const data: Record<string, unknown> = {}
      for (let i = 0; i < 8; i++) data[`k${i}`] = i
      const lines = formatCharacterData(data).split('\n')
      expect(lines).toHaveLength(5)
    })

    it('object 以外は空文字を返す', () => {
      expect(formatCharacterData(null as any)).toBe('')
    })
  })

  describe('extractNumericValue', () => {
    it('number はそのまま返す', () => {
      expect(extractNumericValue(42)).toBe(42)
    })

    it('{ value } オブジェクトは value を数値化', () => {
      expect(extractNumericValue({ value: '15' })).toBe(15)
    })

    it('数値化できない場合は 0', () => {
      expect(extractNumericValue('abc')).toBe(0)
      expect(extractNumericValue(undefined)).toBe(0)
    })
  })

  describe('createBasicCharacterEmbed', () => {
    it('タイトル・色・主要フィールドを含む', () => {
      const embed = createBasicCharacterEmbed(buildCharacter(), 'g1')
      const data = embed.toJSON()
      expect(data.title).toBe('🎭 テストキャラ')
      expect(data.color).toBe(0x00ae86)
      const fieldNames = data.fields?.map((f) => f.name) ?? []
      expect(fieldNames).toContain('🎲 ゲームシステム')
      expect(fieldNames).toContain('🆔 キャラクターID')
      expect(fieldNames).toContain('✏️ キャラクター編集')
    })

    it('discordChannelId が無ければ編集フィールドを含めない', () => {
      const embed = createBasicCharacterEmbed(buildCharacter({ discordChannelId: '' }), 'g1')
      const fieldNames = (embed.toJSON().fields ?? []).map((f) => f.name)
      expect(fieldNames).not.toContain('✏️ キャラクター編集')
    })
  })

  describe('createDetailedCharacterEmbed', () => {
    it('「詳細情報」タイトルとステータス/スキル/アイテム項目を含む', () => {
      const embed = createDetailedCharacterEmbed(buildCharacter(), 'g1')
      const data = embed.toJSON()
      expect(data.title).toBe('🎭 テストキャラ - 詳細情報')
      const fieldNames = data.fields?.map((f) => f.name) ?? []
      expect(fieldNames).toContain('🩸 ステータス')
      expect(fieldNames).toContain('⚔️ スキル')
      expect(fieldNames).toContain('🎒 アイテム')
    })
  })
})
