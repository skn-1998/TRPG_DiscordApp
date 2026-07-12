import { normalizePersistedAttributeSection, normalizePersistedCharacterAttributes } from './character-attribute.mapper'
import { CharacterEntity } from '../models/character.entity'

describe('persisted Character AttributeValue legacy adapter', () => {
  it('正準形のセクションは同じ参照で返す', () => {
    const section = { HP: { values: { base: 10 }, dice: '1d6' } }

    expect(normalizePersistedAttributeSection(section, 'status')).toBe(section)
  })

  it('旧Discord編集が保存したnullを省き、値と文字列を保持する', () => {
    const legacy = {
      目星: {
        name: '目星',
        index: null,
        values: { base: 25, growth: 15 },
        description: null,
        dice: null,
        isVisible: true
      }
    }

    expect(normalizePersistedAttributeSection(legacy, 'skill')).toEqual({
      目星: {
        name: '目星',
        values: { base: 25, growth: 15 },
        isVisible: true
      }
    })
    expect(legacy.目星).toHaveProperty('index', null)
  })

  it('数値プリミティブと文字列プリミティブを情報を失わず正準形へ変換する', () => {
    expect(normalizePersistedAttributeSection({ STR: 50, memo: '古い備考' }, 'parameter')).toEqual({
      STR: { values: { base: 50 } },
      memo: { description: '古い備考' }
    })
  })

  it('旧name/value形を数値または説明へ変換する', () => {
    expect(
      normalizePersistedAttributeSection(
        {
          STR: { name: 'STR', value: 50 },
          memo: { name: 'メモ', value: '古い備考' }
        },
        'parameter'
      )
    ).toEqual({
      STR: { name: 'STR', values: { base: 50 } },
      memo: { name: 'メモ', description: '古い備考' }
    })
  })

  it('既知でない破損形は黙って捨てず例外にする', () => {
    expect(() => normalizePersistedAttributeSection({ STR: { score: 50 } }, 'parameter')).toThrow(/parameter\.STR/)
  })

  it('Characterの存在する5セクションだけを非破壊で正規化する', () => {
    const character = {
      characterId: 'c1',
      characterName: 'Legacy',
      gameSystemId: 'coc',
      discordUserId: 'u1',
      discordChannelId: 'ch1',
      status: { HP: { values: { base: 10 }, index: null } },
      skill: { 目星: 25 }
    } as unknown as CharacterEntity

    const normalized = normalizePersistedCharacterAttributes(character)

    expect(normalized).toEqual(
      expect.objectContaining({
        status: { HP: { values: { base: 10 } } },
        skill: { 目星: { values: { base: 25 } } }
      })
    )
    expect(normalized).not.toBe(character)
    expect((character.status.HP as unknown as { index: null }).index).toBeNull()
  })
})
