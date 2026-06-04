import { PresetDiceCustomId, resolvePresetDiceRoll } from './preset-dice.custom-id'

describe('PresetDiceCustomId', () => {
  it('pattern は dice_(coc7|dnd5e|sw25)_ に前方一致する RegExp', () => {
    expect(PresetDiceCustomId.pattern.test('dice_coc7_1d100_chan1')).toBe(true)
    expect(PresetDiceCustomId.pattern.test('dice_dnd5e_save_chan1')).toBe(true)
    expect(PresetDiceCustomId.pattern.test('dice_sw25_magic_chan1')).toBe(true)
    // routed 済みの dice_generic_ や未対応 system は match しない
    expect(PresetDiceCustomId.pattern.test('dice_generic_1d6_chan1')).toBe(false)
    expect(PresetDiceCustomId.pattern.test('dice_pathfinder_x_chan1')).toBe(false)
  })

  it('create は dice_{system}_{action}_{channelId}', () => {
    expect(PresetDiceCustomId.create('coc7', 'sanity', 'chan123')).toBe('dice_coc7_sanity_chan123')
  })

  describe('parse', () => {
    it('dice_{system}_{action}_{channelId} を分解する', () => {
      expect(PresetDiceCustomId.parse('dice_coc7_1d100_chan123')).toEqual({
        system: 'coc7',
        action: '1d100',
        channelId: 'chan123'
      })
    })

    it('channelId に _ を含む場合も parts.slice(3) で復元する', () => {
      expect(PresetDiceCustomId.parse('dice_sw25_attack_chan_1_2')).toEqual({
        system: 'sw25',
        action: 'attack',
        channelId: 'chan_1_2'
      })
    })

    it('未対応 system は null', () => {
      expect(PresetDiceCustomId.parse('dice_pathfinder_attack_chan1')).toBeNull()
      // dice_generic_ は preset ではない
      expect(PresetDiceCustomId.parse('dice_generic_1d6_chan1')).toBeNull()
    })

    it('action / channelId が欠落・prefix 不一致は null', () => {
      expect(PresetDiceCustomId.parse('dice_coc7_sanity')).toBeNull() // channelId なし
      expect(PresetDiceCustomId.parse('skill_chan_dodge')).toBeNull()
    })
  })
})

describe('resolvePresetDiceRoll', () => {
  it('system 既定 notation を返す（coc7=1d100 / dnd5e=1d20 / sw25=2d6）', () => {
    expect(resolvePresetDiceRoll('coc7', '1d100').notation).toBe('1d100')
    expect(resolvePresetDiceRoll('dnd5e', '1d20').notation).toBe('1d20')
    expect(resolvePresetDiceRoll('sw25', '2d6').notation).toBe('2d6')
    // semantic action でも notation は system 既定（暫定機能化）
    expect(resolvePresetDiceRoll('coc7', 'sanity').notation).toBe('1d100')
    expect(resolvePresetDiceRoll('dnd5e', 'save').notation).toBe('1d20')
    expect(resolvePresetDiceRoll('sw25', 'magic').notation).toBe('2d6')
  })

  it('既知 action は対応ラベル、semantic は（簡易）付き', () => {
    expect(resolvePresetDiceRoll('coc7', '1d100').reason).toBe('技能判定')
    expect(resolvePresetDiceRoll('coc7', 'sanity').reason).toBe('SAN値判定（簡易）')
    expect(resolvePresetDiceRoll('dnd5e', 'save').reason).toBe('セーヴィング・スロー（簡易）')
    expect(resolvePresetDiceRoll('sw25', 'magic').reason).toBe('魔法行使（簡易）')
  })

  it('未知 action は ${action}（簡易）にフォールバック', () => {
    expect(resolvePresetDiceRoll('coc7', 'unknownAct').reason).toBe('unknownAct（簡易）')
  })
})
