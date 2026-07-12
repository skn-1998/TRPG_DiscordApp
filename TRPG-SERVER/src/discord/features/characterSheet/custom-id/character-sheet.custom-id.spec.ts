import {
  CHECK_CUSTOM_ID_RESERVED_PREFIX,
  DECLARE_CUSTOM_ID_RESERVED_PREFIX,
  ResourceDeltaCustomId,
  RollPaletteCustomId
} from './character-sheet.custom-id'

describe('characterSheet customId v2', () => {
  it('予約 prefix を定数として確保する', () => {
    expect(CHECK_CUSTOM_ID_RESERVED_PREFIX).toBe('chk_')
    expect(DECLARE_CUSTOM_ID_RESERVED_PREFIX).toBe('dec_')
  })

  describe('RollPaletteCustomId', () => {
    it('Factory と Parser と pattern が同じ契約を共有する', () => {
      const customId = RollPaletteCustomId.create('123456789012345678', 'atk1')

      expect(customId).toBe('roll_123456789012345678_atk1')
      expect(RollPaletteCustomId.pattern.test(customId)).toBe(true)
      expect(RollPaletteCustomId.parse(customId)).toEqual({
        channelId: '123456789012345678',
        key: 'atk1'
      })
    })

    it.each([
      'roll_channel_atk1',
      'roll_123_ATK',
      'roll_123_atk_key',
      'roll_123_atk-sword',
      'roll_123_atk_suffix',
      'xroll_123_atk',
      'roll_123_atk_extra',
      'roll__atk',
      'roll_123_'
    ])('不正形式を完全一致 parser で拒否する: %s', (customId) => {
      expect(RollPaletteCustomId.parse(customId)).toBeNull()
    })

    it('Factory は不正な channelId/key を生成しない', () => {
      expect(() => RollPaletteCustomId.create('channel', 'atk')).toThrow()
      expect(() => RollPaletteCustomId.create('123', 'atk_key')).toThrow()
    })
  })

  describe('ResourceDeltaCustomId', () => {
    it.each([
      ['res_123456789012345678_hp_10', 10],
      ['res_123456789012345678_hp_-2', -2],
      ['res_123456789012345678_hp_0.5', 0.5]
    ] as const)('%s を厳密に parse する', (customId, delta) => {
      expect(ResourceDeltaCustomId.pattern.test(customId)).toBe(true)
      expect(ResourceDeltaCustomId.parse(customId)).toEqual({
        channelId: '123456789012345678',
        key: 'hp',
        delta
      })
    })

    it.each([
      'res_channel_hp_1',
      'res_123_HP_1',
      'res_123_hp_key_1',
      'res_123_hp_+1',
      'res_123_hp_01',
      'res_123_hp_.5',
      'res_123_hp_1.',
      'res_123_hp_1e2',
      'res_123_hp_NaN',
      'res_123_hp_Infinity',
      'res_123_hp_1_suffix',
      'xres_123_hp_1'
    ])('曖昧な区切り・suffix・非通常10進数を拒否する: %s', (customId) => {
      expect(ResourceDeltaCustomId.parse(customId)).toBeNull()
    })

    it('Factory と pattern/Parser が一致する', () => {
      const customId = ResourceDeltaCustomId.create('123', 'mp2', -3.5)

      expect(customId).toBe('res_123_mp2_-3.5')
      expect(ResourceDeltaCustomId.pattern.test(customId)).toBe(true)
      expect(ResourceDeltaCustomId.parse(customId)).toEqual({ channelId: '123', key: 'mp2', delta: -3.5 })
    })

    it('Factory は非有限値や指数表記になる値を生成しない', () => {
      expect(() => ResourceDeltaCustomId.create('123', 'hp', Number.NaN)).toThrow()
      expect(() => ResourceDeltaCustomId.create('123', 'hp', Number.POSITIVE_INFINITY)).toThrow()
      expect(() => ResourceDeltaCustomId.create('123', 'hp', 1e21)).toThrow()
    })
  })
})
