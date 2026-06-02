// 実 discord.js Builder / ChannelType の挙動を検証するためグローバルモックを無効化
jest.unmock('discord.js')
jest.mock('discord.js', () => jest.requireActual('discord.js'))

import { ChannelType } from 'discord.js'
import {
  buildFallbackOption,
  buildSelectOptions,
  ChannelSnapshot,
  isTextChannelInCategory,
  matchesCharacterCategory,
  MAX_SELECT_OPTIONS,
  selectChannelOptions
} from './channel-manager.util'

/**
 * channel-manager.util の純関数テスト。
 * すべてモック不要（引数 → 戻り値のみ）。
 */
describe('channel-manager.util', () => {
  describe('matchesCharacterCategory', () => {
    it('GuildCategory かつ name が一致すれば true', () => {
      expect(matchesCharacterCategory({ type: ChannelType.GuildCategory, name: 'cat' }, ['cat'])).toBe(true)
    })

    it('type が GuildCategory でなければ false', () => {
      expect(matchesCharacterCategory({ type: ChannelType.GuildText, name: 'cat' }, ['cat'])).toBe(false)
    })

    it('name が候補に含まれなければ false', () => {
      expect(matchesCharacterCategory({ type: ChannelType.GuildCategory, name: 'other' }, ['cat'])).toBe(false)
    })
  })

  describe('isTextChannelInCategory', () => {
    it('GuildText かつ parentId が一致すれば true', () => {
      expect(isTextChannelInCategory({ type: ChannelType.GuildText, parentId: 'cat-1' }, 'cat-1')).toBe(true)
    })

    it('type が GuildText でなければ false', () => {
      expect(isTextChannelInCategory({ type: ChannelType.GuildVoice, parentId: 'cat-1' }, 'cat-1')).toBe(false)
    })

    it('parentId が一致しなければ false', () => {
      expect(isTextChannelInCategory({ type: ChannelType.GuildText, parentId: 'other' }, 'cat-1')).toBe(false)
    })

    it('parentId が null なら false', () => {
      expect(isTextChannelInCategory({ type: ChannelType.GuildText, parentId: null }, 'cat-1')).toBe(false)
    })
  })

  describe('selectChannelOptions', () => {
    const make = (id: string, name: string, ts: number | null): ChannelSnapshot => ({
      id,
      name,
      type: ChannelType.GuildText,
      parentId: 'cat-1',
      createdTimestamp: ts
    })

    it('createdTimestamp 降順に並べ替える', () => {
      const result = selectChannelOptions([make('a', 'A', 10), make('c', 'C', 30), make('b', 'B', 20)])
      expect(result.map((o) => o.value)).toEqual(['c', 'b', 'a'])
    })

    it('label=name / value=id（id は文字列化）で整形する', () => {
      const result = selectChannelOptions([
        { id: 123 as unknown as string, name: 'numeric-id', type: ChannelType.GuildText, createdTimestamp: 1 }
      ])
      expect(result[0]).toEqual({ label: 'numeric-id', value: '123' })
    })

    it('既定では最大25件に制限する', () => {
      const channels = Array.from({ length: 40 }, (_, i) => make(`ch-${i}`, `n-${i}`, i))
      const result = selectChannelOptions(channels)
      expect(result).toHaveLength(MAX_SELECT_OPTIONS)
      // 降順なので最新(ch-39)が先頭
      expect(result[0].value).toBe('ch-39')
    })

    it('limit を指定できる', () => {
      const channels = Array.from({ length: 10 }, (_, i) => make(`ch-${i}`, `n-${i}`, i))
      expect(selectChannelOptions(channels, 3)).toHaveLength(3)
    })

    it('createdTimestamp が null/undefined は 0 として最後尾に寄る', () => {
      const result = selectChannelOptions([make('null-ts', 'N', null), make('has-ts', 'H', 5)])
      expect(result.map((o) => o.value)).toEqual(['has-ts', 'null-ts'])
    })

    it('入力配列を破壊しない', () => {
      const channels = [make('a', 'A', 1), make('b', 'B', 2)]
      const snapshot = [...channels]
      selectChannelOptions(channels)
      expect(channels).toEqual(snapshot)
    })

    it('空配列なら空配列を返す', () => {
      expect(selectChannelOptions([])).toEqual([])
    })
  })

  describe('buildSelectOptions', () => {
    it('{label,value} を StringSelectMenuOptionBuilder に変換する', () => {
      const options = buildSelectOptions([
        { label: 'L1', value: 'v1' },
        { label: 'L2', value: 'v2' }
      ])
      expect(options).toHaveLength(2)
      expect(options[0].data.label).toBe('L1')
      expect(options[0].data.value).toBe('v1')
      expect(options[1].data.value).toBe('v2')
    })

    it('空配列なら空配列を返す', () => {
      expect(buildSelectOptions([])).toEqual([])
    })
  })

  describe('buildFallbackOption', () => {
    it('指定 label/value の単一オプションを生成する', () => {
      const option = buildFallbackOption('見つかりません', 'no-category')
      expect(option.data.label).toBe('見つかりません')
      expect(option.data.value).toBe('no-category')
    })
  })
})
