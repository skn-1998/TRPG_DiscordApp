// グローバル jest-setup の discord.js モックを無効化し、
// 実際の EmbedBuilder / StringSelectMenuBuilder / ActionRowBuilder 挙動（.toJSON() 等）を検証する。
jest.unmock('discord.js')
jest.mock('discord.js', () => jest.requireActual('discord.js'))

import {
  CHARACTER_EMBED_TITLE_KEYWORD,
  buildCharacterEmbed,
  buildCharacterEmbedData,
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

  describe('CHARACTER_EMBED_TITLE_KEYWORD', () => {
    it('既存 Embed 判定に使うキーワードが「キャラクター情報」である', () => {
      expect(CHARACTER_EMBED_TITLE_KEYWORD).toBe('キャラクター情報')
      expect(buildCharacterEmbedData(buildCharacter(), guildInfo).title).toContain(CHARACTER_EMBED_TITLE_KEYWORD)
    })
  })
})
