import { convertCharacterInfoToJson, filterAndFormatInput, convertCharacterJsonToString } from './convertToJSON'
import { Character } from '../../domains/character/models/character.model'

describe('convertToJSON', () => {
  // テスト用に未使用変数を追加
  const unusedVariable = 'このテスト変数は使われていません';
  
  describe('filterAndFormatInput', () => {
    it('有効なKEY:VALUE形式のみを抽出する', () => {
      const input = `HP:100
MP:20
STR:30
hogehoge
DEX:20
Invalid: text
123:not a number
toolong:1234567890123456789
:10
10:
`
      const expected = `HP:100
MP:20
STR:30
DEX:20`
      
      expect(filterAndFormatInput(input)).toBe(expected)
    })

    it('空の入力に対して空文字列を返す', () => {
      expect(filterAndFormatInput('')).toBe('')
    })

    it('有効なフォーマットがない場合は空文字列を返す', () => {
      const input = `hogehoge
Invalid: text
123:not a number
toolong:1234567890123456789
:10
10:`
      
      expect(filterAndFormatInput(input)).toBe('')
    })
  })

  describe('convertCharacterInfoToJson', () => {
    it('正常なデータを正しくパースする', () => {
      const input = `HP:100
MP:20
STR:30
DEX:20`
      
      const expected = {
        'HP': { name: 'HP', value: 100, index: 0 },
        'MP': { name: 'MP', value: 20, index: 1 },
        'STR': { name: 'STR', value: 30, index: 2 },
        'DEX': { name: 'DEX', value: 20, index: 3 }
      }
      
      expect(convertCharacterInfoToJson(input)).toEqual(expected)
    })

    it('無効な行を無視する', () => {
      const input = `HP:100
hogehoge
MP:20
Invalid: text
STR:30
DEX:20`
      
      const expected = {
        'HP': { name: 'HP', value: 100, index: 0 },
        'MP': { name: 'MP', value: 20, index: 1 },
        'STR': { name: 'STR', value: 30, index: 2 },
        'DEX': { name: 'DEX', value: 20, index: 3 }
      }
      
      expect(convertCharacterInfoToJson(input)).toEqual(expected)
    })

    it('空の入力に対して空のオブジェクトを返す', () => {
      expect(convertCharacterInfoToJson('')).toEqual({})
    })
  })

  describe('convertCharacterJsonToString', () => {
    it('キャラクターオブジェクトから文字列を生成する', () => {
      const character: Character = {
        characterId: 'test-id',
        discordUserId: 'discord-user-id',
        discordChannelId: 'discord-channel-id',
        TRPGName: 'Test TRPG',
        characterName: 'Test Character',
        status: {
          'HP': 100,
          'MP': 20
        },
        parameter: {
          'STR': 30,
          'DEX': 20
        },
        skill: {}
      }
      
      const expectedStatus = `HP:100
MP:20`
      const expectedParameter = `STR:30
DEX:20`
      
      expect(convertCharacterJsonToString(character, 'status')).toBe(expectedStatus)
      expect(convertCharacterJsonToString(character, 'parameter')).toBe(expectedParameter)
    })

    it('空のオブジェクトに対して空文字列を返す', () => {
      const character: Character = {
        characterId: 'test-id',
        discordUserId: 'discord-user-id',
        discordChannelId: 'discord-channel-id',
        TRPGName: 'Test TRPG',
        characterName: 'Test Character',
        status: {},
        parameter: {},
        skill: {}
      }
      
      expect(convertCharacterJsonToString(character, 'status')).toBe('')
    })
  })
}) 