import { SkillRollCustomId } from './skill-roll.custom-id'

/**
 * SkillRollCustomId の create / parse 契約テスト。
 * parse は byte-identical 分解と、空 channelId / 空 skillKey / 区切りなしを null で弾くことを固定する。
 */
describe('SkillRollCustomId', () => {
  it('pattern は skill_', () => {
    expect(SkillRollCustomId.pattern).toBe('skill_')
  })

  it('create は skill_{channelId}_{skillKey}', () => {
    expect(SkillRollCustomId.create('chan123', 'dodge')).toBe('skill_chan123_dodge')
  })

  describe('parse', () => {
    it('skill_{channelId}_{skillKey} を分解する', () => {
      expect(SkillRollCustomId.parse('skill_chan123_dodge')).toEqual({ channelId: 'chan123', skillKey: 'dodge' })
    })

    it('skillKey に _ を含む場合は最初の _ で分割し残りを skillKey とする', () => {
      expect(SkillRollCustomId.parse('skill_chan123_fast_talk')).toEqual({
        channelId: 'chan123',
        skillKey: 'fast_talk'
      })
    })

    it('prefix 不一致は null', () => {
      expect(SkillRollCustomId.parse('character-tab*x')).toBeNull()
      expect(SkillRollCustomId.parse('x-skill_chan_dodge')).toBeNull()
    })

    it('区切り `_` が無い場合は null', () => {
      expect(SkillRollCustomId.parse('skill_chan123')).toBeNull()
    })

    it('channelId が空（先頭が `_`）は null', () => {
      expect(SkillRollCustomId.parse('skill__dodge')).toBeNull()
    })

    it('skillKey が空（末尾が `_`）は null', () => {
      expect(SkillRollCustomId.parse('skill_chan123_')).toBeNull()
    })

    it('prefix のみは null', () => {
      expect(SkillRollCustomId.parse('skill_')).toBeNull()
    })
  })
})
