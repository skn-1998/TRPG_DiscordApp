import type { CharacterEntity } from '../../../../domains/character/models/character.entity'
import { extractSkillLevel, resolveSkillRoll } from './skill-roll.util'

const characterWithSkill = (skillValue: unknown): CharacterEntity =>
  ({
    characterId: 'character-1',
    characterName: 'Alice',
    gameSystemId: 'coc7',
    discordUserId: 'owner-1',
    discordChannelId: 'channel-1',
    status: {},
    skill: { listen: skillValue },
    parameter: {}
  }) as CharacterEntity

describe('skill-roll.util', () => {
  it('AttributeValueの全number partを表示規則どおり合算する', () => {
    const character = characterWithSkill({
      name: '聞き耳',
      values: { base: 50, other: 20 }
    })

    expect(extractSkillLevel(character.skill?.listen)).toBe('70')
    expect(resolveSkillRoll(character, 'listen')).toEqual({
      skillName: '聞き耳',
      skillValue: 70
    })
  })

  it.each([
    ['number', 50, '50'],
    ['string', '技能50%', '50'],
    ['AttributeValueのlegacy level part', { values: { level: 50 } }, '50']
  ])('%s形状を維持する', (_name, value, expected) => {
    expect(extractSkillLevel(value)).toBe(expected)
  })

  it('legacy number-parts は合算値を返す（旧: 解決不能）', () => {
    expect(extractSkillLevel({ level: 50 })).toBe('50')
  })

  it('values が空の AttributeValue はレベル解決不能として null を返す', () => {
    expect(extractSkillLevel({ name: 'メモ', values: {}, description: '説明' })).toBeNull()
  })

  it('legacyのlevel/valueも他partと同じ合算対象にする', () => {
    expect(extractSkillLevel({ values: { level: 50, value: 10, other: 5 } })).toBe('65')
  })
})
