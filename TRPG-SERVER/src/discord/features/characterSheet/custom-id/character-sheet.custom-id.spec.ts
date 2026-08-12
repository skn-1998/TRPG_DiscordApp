import {
  createDiscordProjectionViewModel,
  createEphemeralPanel,
  createGroupBrowser,
  type DiscordButtonModel,
  type ProjectionPaletteEntry
} from '@trpg/sheet-projection'
import {
  CHECK_CUSTOM_ID_RESERVED_PREFIX,
  DECLARE_CUSTOM_ID_RESERVED_PREFIX,
  HubGroupBrowserCustomId,
  HubGroupSelectCustomId,
  HubPanelCustomId,
  ResourceDeltaCustomId,
  RollPaletteCustomId
} from './character-sheet.custom-id'

describe('characterSheet customId v2', () => {
  it('予約 prefix を定数として確保する', () => {
    expect(CHECK_CUSTOM_ID_RESERVED_PREFIX).toBe('chk_')
    expect(DECLARE_CUSTOM_ID_RESERVED_PREFIX).toBe('dec_')
  })

  describe('hub customId', () => {
    it('select/panel/browser のFactory・Parserを1-indexed pageで共有する', () => {
      expect(HubGroupSelectCustomId.parse(HubGroupSelectCustomId.create('123'))).toEqual({ channelId: '123' })
      expect(HubPanelCustomId.parse(HubPanelCustomId.create('123', 'gabc123', 2))).toEqual({
        channelId: '123',
        groupId: 'gabc123',
        page: 2
      })
      expect(HubGroupBrowserCustomId.parse(HubGroupBrowserCustomId.create('123', 3))).toEqual({
        channelId: '123',
        page: 3
      })
    })

    it('unsafe group id・0 page・suffixを拒否する', () => {
      expect(() => HubPanelCustomId.create('123', '日本語 group', 1)).toThrow()
      expect(() => HubPanelCustomId.create('123', 'g1', 0)).toThrow()
      expect(HubPanelCustomId.parse('hub_panel_123_g1_1_suffix')).toBeNull()
      expect(HubGroupBrowserCustomId.parse('hub_groups_123_0')).toBeNull()
    })
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
      expect(() => ResourceDeltaCustomId.create('123', 'hp', -0)).toThrow()
      expect(() => ResourceDeltaCustomId.create('123', 'hp', 1e21)).toThrow()
      expect(() => ResourceDeltaCustomId.create('123', 'hp', 1e-7)).toThrow()
    })
  })

  it('projection が生成した全customIdをserver parserでround-tripできる', () => {
    const channelId = '123456789012345678'
    const resource: ProjectionPaletteEntry = {
      key: 'hp',
      kind: 'resource',
      deltas: [-1, 1],
      label: 'HP',
      group: 'skills',
      fieldRef: { uid: 'main.hp' }
    }
    const rolls: ProjectionPaletteEntry[] = Array.from({ length: 25 }, (_, index) => ({
      key: `r${index}`,
      kind: 'roll' as const,
      notation: '1d100',
      label: `Roll ${index}`,
      group: index < 20 ? 'skills' : `g${index}`,
      fieldRef: { uid: `main.r${index}` }
    }))
    const palette = [resource, ...rolls]
    const hub = createDiscordProjectionViewModel({
      characterName: 'Alice',
      templateVersion: '1',
      channelId,
      palette
    })
    const panel = createEphemeralPanel({ channelId, palette, groupId: 'skills', canMutate: true, page: 1 })
    const browserPalette: ProjectionPaletteEntry[] = Array.from({ length: 25 }, (_, index) => ({
      key: `b${index}`,
      kind: 'roll' as const,
      notation: '1d6',
      label: `Browser ${index}`,
      group: `g${index}`,
      fieldRef: { uid: `browser.b${index}` }
    }))
    const browser = createGroupBrowser({ channelId, palette: browserPalette, page: 1 })
    const navigationButtons = [panel.page.previous, panel.page.next, browser.page.previous, browser.page.next].filter(
      (button): button is DiscordButtonModel => button !== undefined
    )
    const customIds = [
      ...hub.hub.pinnedButtonRows.flat().map((button) => button.customId),
      ...(hub.hub.groupSelect ? [hub.hub.groupSelect.menuCustomId] : []),
      ...panel.actions.map((button) => button.customId),
      ...navigationButtons.map((button) => button.customId),
      browser.menuCustomId
    ]

    expect(customIds.length).toBeGreaterThan(0)
    for (const customId of customIds) {
      const parsed = customId.startsWith('roll_')
        ? RollPaletteCustomId.parse(customId)
        : customId.startsWith('res_')
          ? ResourceDeltaCustomId.parse(customId)
          : customId.startsWith('hub_panel_')
            ? HubPanelCustomId.parse(customId)
            : customId.startsWith('hub_groups_')
              ? HubGroupBrowserCustomId.parse(customId)
              : HubGroupSelectCustomId.parse(customId)
      expect(parsed).not.toBeNull()
    }
  })
})
