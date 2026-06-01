// グローバル jest-setup の discord.js モックを無効化し、
// 実際の EmbedBuilder / StringSelectMenuBuilder / ActionRowBuilder 挙動（.toJSON() 等）を検証する。
jest.unmock('discord.js')
jest.mock('discord.js', () => jest.requireActual('discord.js'))

import {
  CHARACTER_EMBED_TITLE_KEYWORD,
  SECTION_SELECT_CUSTOM_ID_PREFIX,
  buildChannelStatusText,
  buildCharacterDeletionNotificationMessage,
  buildCharacterEmbed,
  buildCharacterEmbedData,
  buildCharacterUpdateNotificationMessage,
  buildFieldSelectMenu,
  buildSectionSelectMenu,
  buildSectionSelectMenuWithBack,
  extractCharacterIdFromSectionSelect,
  isSectionSelectCustomId,
  toSelectMenuRow,
  type GuildInfo
} from './character-ui.util'
import { Character } from 'src/domains/character/models/character.model'

describe('character-ui.util', () => {
  const guildInfo: GuildInfo = {
    id: 'guild-1',
    name: 'TRPG Server',
    memberCount: 3,
    channels: []
  }

  const buildCharacter = (overrides: Partial<Character> = {}): Character =>
    ({
      characterId: 'char-1234',
      characterName: 'テスト太郎',
      discordChannelId: 'channel-1',
      ...overrides
    }) as unknown as Character

  describe('buildCharacterEmbedData', () => {
    it('characterName を inline フィールドに含める', () => {
      const data = buildCharacterEmbedData(buildCharacter(), guildInfo)
      expect(data.title).toBe('🎭 キャラクター情報 - テスト太郎')
      expect(data.description).toBe('サーバー: TRPG Server\nチャンネル: <#channel-1>')
      expect(data.color).toBe(0x00ff00)
      expect(data.fields).toContainEqual({ name: 'キャラクター名', value: 'テスト太郎', inline: true })
    })

    it('characterName が空ならタイトルは「未設定」、名前フィールドは出さない', () => {
      const data = buildCharacterEmbedData(buildCharacter({ characterName: '' }), guildInfo)
      expect(data.title).toBe('🎭 キャラクター情報 - 未設定')
      expect(data.fields.find((f) => f.name === 'キャラクター名')).toBeUndefined()
    })

    it('status オブジェクトの truthy 値を inline フィールドに展開する', () => {
      const data = buildCharacterEmbedData(
        buildCharacter({ status: { hp: 10, mp: 0, level: 5 } as unknown as Character['status'] }),
        guildInfo
      )
      expect(data.fields).toContainEqual({ name: 'hp', value: '10', inline: true })
      expect(data.fields).toContainEqual({ name: 'level', value: '5', inline: true })
      // falsy(0) は除外される
      expect(data.fields.find((f) => f.name === 'mp')).toBeUndefined()
    })

    it('status が JSON 文字列でもパースして展開する', () => {
      const data = buildCharacterEmbedData(
        buildCharacter({ status: JSON.stringify({ hp: 7 }) as unknown as Character['status'] }),
        guildInfo
      )
      expect(data.fields).toContainEqual({ name: 'hp', value: '7', inline: true })
    })

    it('skill オブジェクトを key: value 改行結合で1フィールドにまとめる', () => {
      const data = buildCharacterEmbedData(
        buildCharacter({ skill: { 探索: 60, 図書館: 0, 目星: 50 } as unknown as Character['skill'] }),
        guildInfo
      )
      const skillField = data.fields.find((f) => f.name === 'スキル')
      expect(skillField).toEqual({ name: 'スキル', value: '探索: 60\n目星: 50', inline: false })
    })

    it('skill が空オブジェクトならスキルフィールドを出さない', () => {
      const data = buildCharacterEmbedData(buildCharacter({ skill: {} as unknown as Character['skill'] }), guildInfo)
      expect(data.fields.find((f) => f.name === 'スキル')).toBeUndefined()
    })
  })

  describe('buildCharacterEmbed', () => {
    it('EmbedData から title/description/color/fields を持つ Embed を生成する', () => {
      const data = buildCharacterEmbedData(buildCharacter(), guildInfo)
      const embed = buildCharacterEmbed(data).toJSON()
      expect(embed.title).toBe('🎭 キャラクター情報 - テスト太郎')
      expect(embed.color).toBe(0x00ff00)
      expect(embed.fields).toContainEqual({ name: 'キャラクター名', value: 'テスト太郎', inline: true })
      expect(embed.timestamp).toBeUndefined()
    })

    it('withTimestamp=true で timestamp を付与する', () => {
      const data = buildCharacterEmbedData(buildCharacter(), guildInfo)
      const embed = buildCharacterEmbed(data, true).toJSON()
      expect(embed.timestamp).toBeDefined()
    })
  })

  describe('buildCharacterUpdateNotificationMessage', () => {
    it('既知フィールドを日本語名にマップし、userId 付きメンションで整形する', () => {
      const msg = buildCharacterUpdateNotificationMessage(
        buildCharacter(),
        ['characterName', 'status', 'hp'],
        'user-99'
      )
      expect(msg).toBe('<@user-99> 「テスト太郎」のキャラクター名, ステータス, HPが更新されました！✨')
    })

    it('未知フィールドはそのまま使い、userId 無しならメンションを付けない', () => {
      const msg = buildCharacterUpdateNotificationMessage(buildCharacter(), ['unknownField'])
      expect(msg).toBe('「テスト太郎」のunknownFieldが更新されました！✨')
    })
  })

  describe('buildCharacterDeletionNotificationMessage', () => {
    it('userId 付きでメンションを付ける', () => {
      expect(buildCharacterDeletionNotificationMessage('テスト太郎', 'user-99')).toBe(
        '<@user-99> キャラクター「テスト太郎」が削除されました。'
      )
    })

    it('userId 無しならメンションなし', () => {
      expect(buildCharacterDeletionNotificationMessage('テスト太郎')).toBe(
        'キャラクター「テスト太郎」が削除されました。'
      )
    })
  })

  describe('buildChannelStatusText', () => {
    it('名前のみ（status 無し）', () => {
      expect(buildChannelStatusText(buildCharacter({ status: undefined as unknown as Character['status'] }))).toBe(
        '🎭 テスト太郎'
      )
    })

    it('hp/mp/level を順に連結する', () => {
      const text = buildChannelStatusText(
        buildCharacter({ status: { hp: 10, mp: 5, level: 3 } as unknown as Character['status'] })
      )
      expect(text).toBe('🎭 テスト太郎 | HP: 10 | MP: 5 | Lv: 3')
    })

    it('status が JSON 文字列でもパースして連結する', () => {
      const text = buildChannelStatusText(
        buildCharacter({ status: JSON.stringify({ hp: 8 }) as unknown as Character['status'] })
      )
      expect(text).toBe('🎭 テスト太郎 | HP: 8')
    })
  })

  describe('buildSectionSelectMenu', () => {
    it('customId とプレースホルダ・4セクションのオプションを持つ', () => {
      const data = buildSectionSelectMenu('char-1234').toJSON()
      expect(data.custom_id).toBe(`${SECTION_SELECT_CUSTOM_ID_PREFIX}char-1234`)
      expect(data.placeholder).toBe('編集するセクションを選択')
      expect(data.options.map((o) => o.value)).toEqual(['status', 'parameter', 'skill', 'item'])
    })
  })

  describe('buildSectionSelectMenuWithBack', () => {
    it('先頭に back オプションを含む5オプションを持つ', () => {
      const data = buildSectionSelectMenuWithBack('char-1234').toJSON()
      expect(data.placeholder).toBe('別のセクションを選択するか戻る')
      expect(data.options.map((o) => o.value)).toEqual(['back', 'status', 'parameter', 'skill', 'item'])
    })
  })

  describe('buildFieldSelectMenu', () => {
    it('既知セクションで customId と「追加 / 準備中」の2オプションを持つ', () => {
      const menu = buildFieldSelectMenu('skill', 'char-1234')
      expect(menu).not.toBeNull()
      const data = menu!.toJSON()
      expect(data.custom_id).toBe('character-field-edit-skill-char-1234')
      expect(data.placeholder).toBe('編集するスキルを選択')
      expect(data.options.map((o) => o.value)).toEqual(['add_new', 'coming_soon'])
      expect(data.options[0].label).toBe('➕ 新しいスキルを追加')
    })

    it('未知セクションは null を返す', () => {
      expect(buildFieldSelectMenu('unknown', 'char-1234')).toBeNull()
    })
  })

  describe('toSelectMenuRow', () => {
    it('StringSelectMenu を含む ActionRow を返す', () => {
      const row = toSelectMenuRow(buildSectionSelectMenu('char-1234')).toJSON() as {
        components: Array<{ custom_id: string }>
      }
      expect(row.components).toHaveLength(1)
      expect(row.components[0].custom_id).toBe(`${SECTION_SELECT_CUSTOM_ID_PREFIX}char-1234`)
    })
  })

  describe('isSectionSelectCustomId / extractCharacterIdFromSectionSelect', () => {
    it('プレフィックス一致を判定する', () => {
      expect(isSectionSelectCustomId(`${SECTION_SELECT_CUSTOM_ID_PREFIX}abc`)).toBe(true)
      expect(isSectionSelectCustomId('other-id')).toBe(false)
    })

    it('プレフィックスを除いた characterId を抽出する', () => {
      expect(extractCharacterIdFromSectionSelect(`${SECTION_SELECT_CUSTOM_ID_PREFIX}char-1234`)).toBe('char-1234')
    })
  })

  describe('CHARACTER_EMBED_TITLE_KEYWORD', () => {
    it('既存 Embed 判定に使うキーワードが「キャラクター情報」である', () => {
      expect(CHARACTER_EMBED_TITLE_KEYWORD).toBe('キャラクター情報')
      expect(buildCharacterEmbedData(buildCharacter(), guildInfo).title).toContain(CHARACTER_EMBED_TITLE_KEYWORD)
    })
  })
})
