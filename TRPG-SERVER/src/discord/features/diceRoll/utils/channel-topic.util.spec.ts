// loadJsonFile を固定し、実ファイル I/O を避ける。
// gameSystemList.json の代わりに既知の ID 群を返すモックを注入する。
jest.mock('../../../utils/file.util', () => ({
  ...jest.requireActual('../../../utils/file.util'),
  loadJsonFile: jest.fn(() => [
    { ID: 'AceKillerGene', NAME: 'エースキラージーン', SORT_KEY: '', HELP_MESSAGE: '' },
    { ID: 'GardenOrder', NAME: 'ガーデンオーダー', SORT_KEY: '', HELP_MESSAGE: '' }
  ])
}))

// グローバル jest-setup の discord.js モックを無効化し、
// 実際の ChannelType enum 値を使う。
jest.unmock('discord.js')
jest.mock('discord.js', () => jest.requireActual('discord.js'))

import { ChannelType, type CommandInteraction } from 'discord.js'
import { getGameSystemIdFromTopic, getParentChannelTopic } from './channel-topic.util'

describe('channel-topic.util', () => {
  describe('getGameSystemIdFromTopic', () => {
    it('2行目がリストに存在する ID:<ID> 形式のとき、その ID を返す', () => {
      const topic = '見出し\nID:AceKillerGene\nその他'
      expect(getGameSystemIdFromTopic(topic)).toBe('AceKillerGene')
    })

    it('別の登録済み ID でも一致した ID を返す', () => {
      const topic = 'タイトル\nID:GardenOrder'
      expect(getGameSystemIdFromTopic(topic)).toBe('GardenOrder')
    })

    it('2行目の ID がリストに存在しないときは undefined を返す', () => {
      const topic = '見出し\nID:UnknownSystem'
      expect(getGameSystemIdFromTopic(topic)).toBeUndefined()
    })

    it('ID: プレフィックスが無くても、2行目そのものが登録済み ID なら一致する（replace は先頭のみ除去）', () => {
      const topic = '見出し\nAceKillerGene'
      expect(getGameSystemIdFromTopic(topic)).toBe('AceKillerGene')
    })

    it('2行目が存在しない（改行なし）ときは undefined を返す', () => {
      const topic = 'ID:AceKillerGene'
      expect(getGameSystemIdFromTopic(topic)).toBeUndefined()
    })

    it('空文字のときは undefined を返す', () => {
      expect(getGameSystemIdFromTopic('')).toBeUndefined()
    })

    it('null のときは undefined を返す', () => {
      expect(getGameSystemIdFromTopic(null)).toBeUndefined()
    })

    it('undefined のときは undefined を返す', () => {
      expect(getGameSystemIdFromTopic(undefined)).toBeUndefined()
    })

    it('ID: の後に空 ID（空文字）の場合、リストに一致せず undefined を返す', () => {
      const topic = '見出し\nID:'
      expect(getGameSystemIdFromTopic(topic)).toBeUndefined()
    })
  })

  describe('getParentChannelTopic', () => {
    const makeInteraction = (channel: unknown): CommandInteraction => ({ channel }) as unknown as CommandInteraction

    it('PublicThread のとき parent.topic を返す', () => {
      const interaction = makeInteraction({
        type: ChannelType.PublicThread,
        parent: { topic: 'parent-topic' }
      })
      expect(getParentChannelTopic(interaction)).toBe('parent-topic')
    })

    it('PrivateThread のとき parent.topic を返す', () => {
      const interaction = makeInteraction({
        type: ChannelType.PrivateThread,
        parent: { topic: 'private-parent-topic' }
      })
      expect(getParentChannelTopic(interaction)).toBe('private-parent-topic')
    })

    it('Thread だが parent が無いときは undefined を返す', () => {
      const interaction = makeInteraction({
        type: ChannelType.PublicThread,
        parent: null
      })
      expect(getParentChannelTopic(interaction)).toBeUndefined()
    })

    it('Thread かつ parent.topic が null のときは null を返す', () => {
      const interaction = makeInteraction({
        type: ChannelType.PublicThread,
        parent: { topic: null }
      })
      expect(getParentChannelTopic(interaction)).toBeNull()
    })

    it('Thread 以外（GuildText）のときは null を返す', () => {
      const interaction = makeInteraction({
        type: ChannelType.GuildText,
        parent: { topic: 'should-be-ignored' }
      })
      expect(getParentChannelTopic(interaction)).toBeNull()
    })

    it('channel が null のときは null を返す', () => {
      const interaction = makeInteraction(null)
      expect(getParentChannelTopic(interaction)).toBeNull()
    })
  })
})

describe('module load validation', () => {
  afterAll(() => {
    jest.dontMock('../../../utils/file.util')
    jest.resetModules()
  })

  it('loadJsonFile が配列でない値を返す場合は module import 時に throw する', () => {
    jest.resetModules()
    jest.doMock('../../../utils/file.util', () => ({
      ...jest.requireActual('../../../utils/file.util'),
      loadJsonFile: jest.fn(() => ({}))
    }))

    expect(() => {
      jest.isolateModules(() => {
        jest.requireActual('./channel-topic.util')
      })
    }).toThrow(/構造が不正/)
  })
})
