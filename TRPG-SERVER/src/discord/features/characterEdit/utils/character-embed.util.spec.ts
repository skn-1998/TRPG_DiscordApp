// グローバル jest-setup の discord.js モックを無効化し、
// 実際の EmbedBuilder / StringSelectMenuBuilder 挙動（.toJSON() 等）を検証する。
jest.unmock('discord.js')
jest.mock('discord.js', () => jest.requireActual('discord.js'))

import { Character } from 'src/domains/character/models/character.model'
import { AttributeSection } from 'src/core/types/attribute.types'
import {
  generateShortCharacterId,
  formatAttributeFieldValue,
  buildAttributeFields,
  buildFieldOptionDisplay,
  buildBasicEmbed,
  buildSectionEmbed,
  buildEditComponents,
  buildSectionedEmbeds,
  buildFieldSelectMenu,
  buildNewCharacterEmbed,
  buildCharacterCreatedEmbed,
  EDITABLE_SECTION_TYPES,
  getSectionData,
  getSectionDisplayName,
  type EmbedSectionType
} from './character-embed.util'

describe('character-embed.util', () => {
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

    it('編集対象の全要素とセクション写像が一致し、basic/back は対象外', () => {
      expect(EDITABLE_SECTION_TYPES).toEqual(['status', 'parameter', 'skill', 'item'])

      for (const sectionType of EDITABLE_SECTION_TYPES) {
        expect(getSectionData(character, sectionType)).toBe(character[sectionType])
      }

      expect(getSectionData(character, 'basic')).toBeUndefined()
      expect(getSectionData(character, 'back')).toBeUndefined()
    })
  })

  describe('generateShortCharacterId', () => {
    it('英小文字と数字のみの8文字を生成する', () => {
      const id = generateShortCharacterId()
      expect(id).toHaveLength(8)
      expect(id).toMatch(/^[a-z0-9]{8}$/)
    })

    it('複数回呼び出すと（ほぼ確実に）異なる値を生成する', () => {
      const ids = new Set(Array.from({ length: 20 }, () => generateShortCharacterId()))
      expect(ids.size).toBeGreaterThan(1)
    })
  })

  describe('formatAttributeFieldValue', () => {
    it('values の合計と内訳（0以外）を整形する', () => {
      const result = formatAttributeFieldValue({ values: { base: 10, buff: 5, zero: 0 } })
      expect(result).toBe('**合計:** 15\n(base: +10, buff: +5)')
    })

    it('負の値はそのまま符号付きで内訳に出す', () => {
      const result = formatAttributeFieldValue({ values: { base: 10, debuff: -3 } })
      expect(result).toBe('**合計:** 7\n(base: +10, debuff: -3)')
    })

    it('dice と description を付与する', () => {
      const result = formatAttributeFieldValue({
        values: { base: 1 },
        dice: '1d100',
        description: '説明文'
      })
      expect(result).toBe('**合計:** 1\n(base: +1)\n🎲 **ダイス:** 1d100\n💬 説明文')
    })

    it('内訳が全て0のとき合計のみ（内訳行なし）', () => {
      const result = formatAttributeFieldValue({ values: { base: 0 } })
      expect(result).toBe('**合計:** 0')
    })

    it('values が空の object は「値が設定されていません」', () => {
      expect(formatAttributeFieldValue({})).toBe('値が設定されていません')
    })

    it('プリミティブは String 化する', () => {
      expect(formatAttributeFieldValue(42)).toBe('42')
      expect(formatAttributeFieldValue('text')).toBe('text')
    })
  })

  describe('buildAttributeFields', () => {
    it('name を優先し inline:true のフィールド配列を返す', () => {
      const fields = buildAttributeFields({
        力: { name: 'STR', values: { base: 12 } },
        器用: { values: { base: 8 } }
      })
      expect(fields).toEqual([
        { name: 'STR', value: '**合計:** 12\n(base: +12)', inline: true },
        { name: '器用', value: '**合計:** 8\n(base: +8)', inline: true }
      ])
    })

    it('null/undefined の値はスキップする', () => {
      const fields = buildAttributeFields({
        a: null,
        b: undefined,
        c: { values: { base: 1 } }
      })
      expect(fields).toHaveLength(1)
      expect(fields[0].name).toBe('c')
    })

    it('フィールド名は256文字、値は1024文字で切り詰める', () => {
      const longName = 'あ'.repeat(300)
      const longDesc = 'b'.repeat(2000)
      const fields = buildAttributeFields({
        [longName]: { description: longDesc }
      })
      expect(fields[0].name).toHaveLength(256)
      expect(fields[0].name.endsWith('...')).toBe(true)
      expect(fields[0].value).toHaveLength(1024)
      expect(fields[0].value.endsWith('...')).toBe(true)
    })
  })

  describe('buildFieldOptionDisplay', () => {
    it('AttributeValue形式: 合計・ダイス・説明を | 区切りで整形', () => {
      const result = buildFieldOptionDisplay('力', {
        name: 'STR',
        values: { base: 10, buff: 5 },
        dice: '1d100',
        description: '筋力'
      })
      expect(result).toEqual({ displayName: 'STR', displayValue: '合計: 15 | ダイス: 1d100 | 筋力' })
    })

    it('AttributeValue形式: values が空のとき「設定値なし」', () => {
      const result = buildFieldOptionDisplay('力', { values: {} })
      expect(result).toEqual({ displayName: '力', displayValue: '設定値なし' })
    })

    it('レガシー形式（name + value）を整形', () => {
      const result = buildFieldOptionDisplay('hp', { name: 'HP', value: 30 })
      expect(result).toEqual({ displayName: 'HP', displayValue: '30' })
    })

    it('その他のオブジェクトは「オブジェクト形式」', () => {
      const result = buildFieldOptionDisplay('misc', { foo: 'bar' })
      expect(result).toEqual({ displayName: 'misc', displayValue: 'オブジェクト形式' })
    })

    it('プリミティブはキーと String 化した値', () => {
      const result = buildFieldOptionDisplay('memo', 'hello')
      expect(result).toEqual({ displayName: 'memo', displayValue: 'hello' })
    })

    it('表示名・表示値を100文字で短縮する', () => {
      const result = buildFieldOptionDisplay('x'.repeat(150), 'y'.repeat(150))
      expect(result.displayName).toHaveLength(100)
      expect(result.displayName.endsWith('...')).toBe(true)
      expect(result.displayValue).toHaveLength(100)
      expect(result.displayValue.endsWith('...')).toBe(true)
    })
  })

  // ==========================================================================
  // discord.js Builder 構築の純粋関数群
  // ==========================================================================

  /** 各セクションに代表的な AttributeValue を持つ character を生成 */
  const buildCharacter = (overrides: Partial<Character> = {}): Character => {
    const section = (): AttributeSection => ({
      力: {
        name: 'STR',
        values: { base: 10, buff: 5, other: 0 },
        dice: '1d100',
        description: '筋力'
      },
      器用: {
        values: { base: 8 }
      }
    })

    return {
      characterId: 'char-1234',
      characterName: 'テスト太郎',
      gameSystemId: 'cthulhu',
      discordUserId: 'user-999',
      discordChannelId: 'channel-1',
      status: section(),
      parameter: section(),
      skill: section(),
      item: section(),
      ...overrides
    } as Character
  }

  describe('buildBasicEmbed', () => {
    it('タイトル・色・ゲームシステム・ID・プレイヤーを含む', () => {
      const embed = buildBasicEmbed(buildCharacter()).toJSON()

      expect(embed.title).toBe('🏷️ テスト太郎 - 基本情報')
      expect(embed.color).toBe(0x3498db)
      expect(embed.fields).toEqual([
        { name: '🎲 ゲームシステム', value: 'cthulhu', inline: true },
        { name: '🆔 キャラクターID', value: 'char-1234', inline: true },
        { name: '👤 プレイヤー', value: '<@user-999>', inline: true }
      ])
    })

    it('gameSystemId が空ならゲームシステムフィールドを省く', () => {
      const embed = buildBasicEmbed(buildCharacter({ gameSystemId: '' })).toJSON()

      expect(embed.fields).toEqual([
        { name: '🆔 キャラクターID', value: 'char-1234', inline: true },
        { name: '👤 プレイヤー', value: '<@user-999>', inline: true }
      ])
    })
  })

  describe('buildSectionEmbed', () => {
    it('AttributeValue を合計・内訳・ダイス・説明付きで整形する', () => {
      const embed = buildSectionEmbed('📊', 'ステータス', '#e74c3c', 'テスト太郎', buildCharacter().status).toJSON()

      expect(embed.title).toBe('📊 テスト太郎 - ステータス')
      expect(embed.color).toBe(0xe74c3c)
      expect(embed.fields).toEqual([
        {
          name: 'STR',
          value: '**合計:** 15\n(base: +10, buff: +5)\n🎲 **ダイス:** 1d100\n💬 筋力',
          inline: true
        },
        {
          name: '器用',
          value: '**合計:** 8\n(base: +8)',
          inline: true
        }
      ])
    })

    it('データが空なら説明文を出してフィールドを持たない', () => {
      const embed = buildSectionEmbed('📊', 'ステータス', '#e74c3c', 'テスト太郎', {}).toJSON()

      expect(embed.description).toBe('ステータス情報がありません。\n編集ボタンから追加してください。')
      expect(embed.fields ?? []).toHaveLength(0)
    })

    it('data が undefined でも説明文を出す', () => {
      const embed = buildSectionEmbed('📊', 'ステータス', '#e74c3c', 'テスト太郎', undefined).toJSON()
      expect(embed.description).toBe('ステータス情報がありません。\n編集ボタンから追加してください。')
    })

    it('フィールドが24件を超える場合、24件に切り詰めて footer で省略数を示す', () => {
      const bigSection: AttributeSection = {}
      for (let i = 0; i < 30; i++) {
        bigSection[`attr${i}`] = { values: { base: i + 1 } }
      }
      const embed = buildSectionEmbed('📊', 'ステータス', '#e74c3c', 'テスト太郎', bigSection).toJSON()

      expect(embed.fields).toHaveLength(24)
      expect(embed.footer?.text).toBe('6個のステータスが省略されています')
    })
  })

  describe('buildEditComponents', () => {
    it('セクション選択メニュー行と操作ボタン行を返す', () => {
      const [menuRow, buttonRow] = buildEditComponents('char-1234').map((r) => r.toJSON()) as any[]

      const menu = menuRow.components[0]
      expect(menu.custom_id).toBe('character-edit-section-char-1234')
      expect(menu.placeholder).toBe('編集するセクションを選択')
      expect(menu.options.map((o: any) => o.value)).toEqual(['status', 'parameter', 'skill', 'item'])

      expect(buttonRow.components[0]).toMatchObject({
        custom_id: 'character-refresh-char-1234',
        label: '🔄 更新'
      })
      expect(buttonRow.components[1]).toMatchObject({
        custom_id: 'character-compact-view-char-1234',
        label: '📋 簡易表示'
      })
    })
  })

  describe('buildSectionedEmbeds', () => {
    it('5つのembedを順番通りに生成し、components はメニュー行+ボタン行', () => {
      const { embeds, components } = buildSectionedEmbeds(buildCharacter())

      expect(embeds.map((e) => e.toJSON().title)).toEqual([
        '🏷️ テスト太郎 - 基本情報',
        '📊 テスト太郎 - ステータス',
        '⚙️ テスト太郎 - パラメータ',
        '⚔️ テスト太郎 - スキル',
        '🎒 テスト太郎 - アイテム'
      ])
      // ダイスロールボタン行は現状空のため components は2行
      expect(components).toHaveLength(2)
    })
  })

  describe('buildFieldSelectMenu', () => {
    it('データがある場合、追加 + 既存フィールドの編集オプションを返す', () => {
      const menu = buildFieldSelectMenu(buildCharacter(), 'status', 'char-1234')

      expect(menu).not.toBeNull()
      const data = menu!.toJSON()
      expect(data.custom_id).toBe('character-field-edit-status-char-1234')
      expect(data.placeholder).toBe('編集するステータスを選択')
      expect(data.options).toHaveLength(3)
      expect(data.options[0]).toMatchObject({ label: '➕ 新しいステータスを追加', value: 'add_new' })
      expect(data.options[1]).toMatchObject({
        label: '✏️ STR',
        value: '力',
        description: '合計: 15 | ダイス: 1d100 | 筋力'
      })
      expect(data.options[2]).toMatchObject({ label: '✏️ 器用', value: '器用', description: '合計: 8' })
    })

    it('データが空の場合、追加専用メニューを返す', () => {
      const menu = buildFieldSelectMenu(buildCharacter({ status: {} }), 'status', 'char-1234')

      const data = menu!.toJSON()
      expect(data.custom_id).toBe('character-field-add-status-char-1234')
      expect(data.placeholder).toBe('ステータスを追加')
      expect(data.options).toHaveLength(1)
      expect(data.options[0]).toMatchObject({ label: '➕ 新しいステータスを追加', value: 'add_new' })
    })

    it('basic は null を返す', () => {
      const menu = buildFieldSelectMenu(buildCharacter(), 'basic', 'char-1234')
      expect(menu).toBeNull()
    })

    it('back は null を返す', () => {
      const menu = buildFieldSelectMenu(buildCharacter(), 'back', 'char-1234')
      expect(menu).toBeNull()
    })

    it('runtime で渡された未知値は null を返す', () => {
      const menu = buildFieldSelectMenu(buildCharacter(), 'unknown' as EmbedSectionType, 'char-1234')
      expect(menu).toBeNull()
    })
  })

  describe('buildNewCharacterEmbed', () => {
    it('作成案内embedと作成/キャンセルボタンを生成する', () => {
      const { embeds, components } = buildNewCharacterEmbed('channel-1', 'user-999')

      expect(embeds).toHaveLength(1)
      const embed = embeds[0].toJSON()
      expect(embed.title).toBe('🆕 新しいキャラクターを作成')
      expect(embed.color).toBe(0x2ecc71)
      expect(embed.fields).toHaveLength(1)
      expect(embed.fields![0].name).toBe('📝 作成手順')

      expect(components).toHaveLength(1)
      const row = components[0].toJSON() as { components: { custom_id: string; label: string }[] }
      expect(row.components[0]).toMatchObject({
        custom_id: 'character-create-basic-channel-1-user-999',
        label: '📝 基本情報入力'
      })
      expect(row.components[1]).toMatchObject({
        custom_id: 'character-create-cancel-channel-1-user-999',
        label: '❌ キャンセル'
      })
    })
  })

  describe('buildCharacterCreatedEmbed', () => {
    it('作成完了embedを生成する', () => {
      const embed = buildCharacterCreatedEmbed(buildCharacter()).toJSON()

      expect(embed.title).toBe('✅ キャラクター作成完了')
      expect(embed.color).toBe(0x27ae60)
      expect(embed.fields).toEqual([
        { name: '🎲 ゲームシステム', value: 'cthulhu', inline: true },
        { name: '🆔 キャラクターID', value: 'char-1234', inline: true },
        { name: '👤 作成者', value: '<@user-999>', inline: true }
      ])
    })

    it('gameSystemId が空でも「未設定」で生成する', () => {
      const embed = buildCharacterCreatedEmbed(buildCharacter({ gameSystemId: '' })).toJSON()
      expect(embed.fields![0]).toEqual({ name: '🎲 ゲームシステム', value: '未設定', inline: true })
    })
  })
})
