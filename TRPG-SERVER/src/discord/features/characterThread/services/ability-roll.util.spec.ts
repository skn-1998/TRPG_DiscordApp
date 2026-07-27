import type { CharacterEntity } from '../../../../domains/character/models/character.entity'
import { resolveAbilityRoll } from './ability-roll.util'

const characterWithAbility = (abilityValue: unknown): CharacterEntity =>
  ({
    characterId: 'character-1',
    characterName: 'Alice',
    gameSystemId: 'coc7',
    discordUserId: 'owner-1',
    discordChannelId: 'channel-1',
    status: {},
    skill: {},
    parameter: { str: abilityValue }
  }) as CharacterEntity

describe('ability-roll.util', () => {
  it('AttributeValueの全number partを能力ロール目標値へ反映する', () => {
    expect(
      resolveAbilityRoll(
        characterWithAbility({
          name: '筋力',
          values: { base: 50, other: 20 }
        }),
        'str'
      )
    ).toEqual({
      abilityName: '筋力',
      abilityValue: 70
    })
  })

  it.each([
    ['number', 50],
    ['string', '能力50%'],
    ['AttributeValueのlegacy level part', { values: { level: 50 } }]
  ])('%s形状の能力値を維持する', (_name, abilityValue) => {
    expect(resolveAbilityRoll(characterWithAbility(abilityValue), 'str')).toEqual({
      abilityName: 'str',
      abilityValue: 50
    })
  })

  it('legacy number-parts は合算値を返す（旧: 解決不能）', () => {
    expect(resolveAbilityRoll(characterWithAbility({ level: 50 }), 'str')).toEqual({
      abilityName: 'str',
      abilityValue: 50
    })
  })
})
