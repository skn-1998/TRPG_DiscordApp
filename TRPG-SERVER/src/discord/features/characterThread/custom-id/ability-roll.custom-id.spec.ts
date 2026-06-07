import { AbilityRollCustomId } from './ability-roll.custom-id'

/**
 * AbilityRollCustomId の create / parse 契約テスト（skill-roll.custom-id.spec.ts のミラー）。
 * parse は byte-identical 分解と、空 channelId / 空 abilityKey / 区切りなしを null で弾くことを固定する。
 */
describe('AbilityRollCustomId', () => {
  it('pattern は ability_', () => {
    expect(AbilityRollCustomId.pattern).toBe('ability_')
  })

  it('create は ability_{channelId}_{abilityKey}', () => {
    expect(AbilityRollCustomId.create('chan123', 'str')).toBe('ability_chan123_str')
  })

  describe('parse', () => {
    it('ability_{channelId}_{abilityKey} を分解する', () => {
      expect(AbilityRollCustomId.parse('ability_chan123_str')).toEqual({ channelId: 'chan123', abilityKey: 'str' })
    })

    it('abilityKey に _ を含む場合は最初の _ で分割し残りを abilityKey とする', () => {
      expect(AbilityRollCustomId.parse('ability_chan123_dex_mod')).toEqual({
        channelId: 'chan123',
        abilityKey: 'dex_mod'
      })
    })

    it('prefix 不一致は null', () => {
      expect(AbilityRollCustomId.parse('character-tab*x')).toBeNull()
      expect(AbilityRollCustomId.parse('x-ability_chan_str')).toBeNull()
      expect(AbilityRollCustomId.parse('skill_chan123_dodge')).toBeNull()
    })

    it('区切り `_` が無い場合は null', () => {
      expect(AbilityRollCustomId.parse('ability_chan123')).toBeNull()
    })

    it('channelId が空（先頭が `_`）は null', () => {
      expect(AbilityRollCustomId.parse('ability__str')).toBeNull()
    })

    it('abilityKey が空（末尾が `_`）は null', () => {
      expect(AbilityRollCustomId.parse('ability_chan123_')).toBeNull()
    })

    it('prefix のみは null', () => {
      expect(AbilityRollCustomId.parse('ability_')).toBeNull()
    })
  })
})
