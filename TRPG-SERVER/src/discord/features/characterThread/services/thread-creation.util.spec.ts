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
  createDetailedCharacterEmbed,
  createDiceRollActionRow,
  createParameterSelectMenu,
  createPresetButtons,
  chunkButtonsIntoRows,
  createSkillRollActionRows
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

  describe('createDiceRollActionRow', () => {
    it('1D100/1D6/2D6/カスタムの 4 ボタンを持つ', () => {
      const row = createDiceRollActionRow().toJSON()
      const components = row.components as any[]
      expect(components).toHaveLength(4)
      expect(components.map((c) => c.custom_id)).toEqual(['roll*1d100', 'roll*1d6', 'roll*2d6', 'roll*custom'])
    })
  })

  describe('createParameterSelectMenu', () => {
    it('status/skill/parameter からオプションを生成し custom 計算を末尾に追加する', () => {
      const menu = createParameterSelectMenu(buildCharacter())
      expect(menu).not.toBeNull()
      const data = menu!.toJSON()
      expect(data.custom_id).toBe('flexible-dice-param*char-123')
      const values = data.options.map((o) => o.value)
      expect(values).toContain('status:hp:12')
      expect(values).toContain('skill:dodge:40')
      expect(values).toContain('parameter:str:50')
      expect(values).toContain('custom:formula:0')
    })

    it('有効パラメータが無くてもカスタム計算オプションは残るため null にならない', () => {
      const character = buildCharacter({ status: {}, skill: {}, parameter: {} } as any)
      const menu = createParameterSelectMenu(character)
      expect(menu).not.toBeNull()
      expect(menu!.toJSON().options.map((o) => o.value)).toEqual(['custom:formula:0'])
    })

    it('0 以下の値はオプションに含めない', () => {
      const character = buildCharacter({ status: { dead: { name: '死亡', value: 0 } } } as any)
      const menu = createParameterSelectMenu(character)
      const values = menu!.toJSON().options.map((o) => o.value)
      expect(values).not.toContain('status:dead:0')
    })
  })

  describe('createPresetButtons', () => {
    it('値の高い順に ×3 / ×2 のボタンを生成する', () => {
      const character = buildCharacter({
        status: {},
        skill: {},
        parameter: { str: { name: 'STR', value: 60 } }
      } as any)
      const buttons = createPresetButtons(character)
      const ids = buttons.map((b) => (b.toJSON() as any).custom_id)
      expect(ids).toContain('preset-dice*char-123*parameter*str*60*3')
      expect(ids).toContain('preset-dice*char-123*parameter*str*60*2')
    })

    it('最大 10 ボタンに制限する', () => {
      const parameter: Record<string, unknown> = {}
      for (let i = 0; i < 20; i++) parameter[`p${i}`] = { name: `P${i}`, value: i + 1 }
      const character = buildCharacter({ status: {}, skill: {}, parameter } as any)
      expect(createPresetButtons(character).length).toBeLessThanOrEqual(10)
    })

    it('有効パラメータが無ければ空配列', () => {
      const character = buildCharacter({ status: {}, skill: {}, parameter: {} } as any)
      expect(createPresetButtons(character)).toEqual([])
    })
  })

  describe('chunkButtonsIntoRows', () => {
    it('5 個ずつ ActionRow に分割する', () => {
      const buttons = createPresetButtons(
        buildCharacter({
          status: {},
          skill: {},
          parameter: Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`p${i}`, { name: `P${i}`, value: i + 1 }]))
        } as any)
      )
      // 6 値 ×(×3,×2) だが maxButtons=10 で 10 ボタン → 2 行 (5+5)
      const rows = chunkButtonsIntoRows(buttons)
      expect(rows).toHaveLength(2)
      expect(rows[0].toJSON().components as any[]).toHaveLength(5)
    })

    it('空配列なら空の行配列', () => {
      expect(chunkButtonsIntoRows([])).toEqual([])
    })
  })

  describe('createSkillRollActionRows', () => {
    it('スキルが無ければ空配列', () => {
      expect(createSkillRollActionRows(buildCharacter({ skill: {} } as any))).toEqual([])
    })

    it('共有フォーマット roll*_name-value*characterId の customId を生成する', () => {
      const character = buildCharacter({ skill: { dodge: { name: '回避', value: 40 } } } as any)
      const rows = createSkillRollActionRows(character)
      expect(rows.length).toBeGreaterThan(0)
      const firstButton = (rows[0].toJSON().components as any[])[0]
      expect(firstButton.custom_id).toBe('roll*_回避-40*char-123')
      expect(firstButton.label).toBe('回避(40)')
    })

    it('値 0 以下のスキルはスキップする', () => {
      const character = buildCharacter({ skill: { broken: { name: '無効', value: 0 } } } as any)
      expect(createSkillRollActionRows(character)).toEqual([])
    })

    it('最大 20 ボタン（5 個ずつ最大 4 行）に制限する', () => {
      const skill: Record<string, unknown> = {}
      for (let i = 0; i < 30; i++) skill[`s${i}`] = { name: `S${i}`, value: i + 1 }
      const character = buildCharacter({ skill } as any)
      const rows = createSkillRollActionRows(character)
      const total = rows.reduce((sum, r) => sum + (r.toJSON().components as any[]).length, 0)
      expect(total).toBeLessThanOrEqual(20)
      expect(rows.length).toBeLessThanOrEqual(4)
    })
  })
})
