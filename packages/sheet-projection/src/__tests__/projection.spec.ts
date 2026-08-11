import {
  GROUP_SELECT_MORE_VALUE,
  DISCORD_CUSTOM_ID_MAX_LENGTH,
  DISCORD_EMBED_TOTAL_MAX_LENGTH,
  HUB_GROUP_ID_MAX_LENGTH,
  HUB_PANEL_CUSTOM_ID_PREFIX,
  ROLL_PALETTE_CUSTOM_ID_PREFIX,
  canonicalizeResourceDelta,
  createDiscordProjectionViewModel,
  createEphemeralPanel,
  createGroupBrowser,
  createGroupSelect,
  splitPinnedButtonRows,
  type DiscordProjectionInput,
  type ProjectionPaletteEntry,
} from '..'
import * as customId from '../custom-id'

declare const require: (path: string) => unknown

const goldenInput = require('../../fixtures/hub-basic.input.json') as DiscordProjectionInput
const goldenExpected = require('../../fixtures/hub-basic.expected.json')
const emptyDeltasInput = require('../../fixtures/hub-empty-deltas.input.json') as DiscordProjectionInput

function roll(index: number, group = 'group'): ProjectionPaletteEntry {
  return {
    key: `r${index}`,
    kind: 'roll',
    notation: '1d100',
    label: `Roll ${index}`,
    group,
    fieldRef: { uid: `uid-${index}` },
  }
}

function input(palette: ProjectionPaletteEntry[]): DiscordProjectionInput {
  return {
    characterName: 'Boundary',
    templateVersion: '1',
    channelId: '123456789012345678',
    palette,
  }
}

describe('@trpg/sheet-projection', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('golden fixture: inputからhub ViewModel全体を固定する', () => {
    expect(createDiscordProjectionViewModel(goldenInput)).toEqual(goldenExpected)
  })

  it('ピン留めを最大20件・5件/行に分割し、21件目を警告する', () => {
    const twenty = Array.from({ length: 20 }, (_, index) => roll(index))
    expect(splitPinnedButtonRows(twenty, input([]).channelId).map((row) => row.length)).toEqual([5, 5, 5, 5])

    const result = createDiscordProjectionViewModel(input([...twenty, roll(20)]))
    expect(result.hub.pinnedButtonRows.map((row) => row.length)).toEqual([5, 5, 5, 5])
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'pinned-button-limit-exceeded' }))
  })

  it('6件は5件と1件の2行になり、pinnedKeysは指定順・重複なしになる', () => {
    const palette = Array.from({ length: 6 }, (_, index) => roll(index))
    expect(splitPinnedButtonRows(palette, input([]).channelId).map((row) => row.length)).toEqual([5, 1])
    expect(splitPinnedButtonRows(palette, input([]).channelId, ['r5', 'r1', 'r5']).flat().map((button) => button.paletteKey)).toEqual([
      'r5',
      'r1',
    ])
  })

  it('group selectは24件まで、25件目以降を「その他…」へ送る', () => {
    const groups24 = Array.from({ length: 24 }, (_, index) => roll(index, `g${index}`))
    const groups25 = [...groups24, roll(24, 'g24')]
    expect(createGroupSelect(groups24, input([]).channelId)?.options).toHaveLength(24)
    const select = createGroupSelect(groups25, input([]).channelId)
    expect(select?.options).toHaveLength(25)
    expect(select?.options[24]).toEqual({ label: 'その他…', value: GROUP_SELECT_MORE_VALUE })
    expect(select?.hasMore).toBe(true)
  })

  it('空deltas resourceのみのgroupをselectとbrowserから除外し、warningとstale panel fallbackを返す', () => {
    const result = createDiscordProjectionViewModel(emptyDeltasInput)
    const browser = createGroupBrowser({
      channelId: emptyDeltasInput.channelId,
      palette: emptyDeltasInput.palette,
    })
    const staleGroupId = 'gfafz1b'
    const panel = createEphemeralPanel({
      channelId: emptyDeltasInput.channelId,
      palette: emptyDeltasInput.palette,
      groupId: staleGroupId,
    })

    expect(result.hub.groupSelect?.options).toEqual([{ label: 'skills', value: 'skills' }])
    expect(result.hub.embed.fields).toEqual([{ name: 'HP', value: '—', inline: true }])
    expect(browser.options).toEqual([{ label: 'skills', value: 'skills' }])
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: 'empty-group-omitted',
        path: 'group.空リソース',
        message: expect.stringContaining('omitted'),
      })
    ])
    expect(panel).toEqual(
      expect.objectContaining({
        title: staleGroupId,
        actions: [],
      })
    )
  })

  it('rollと空deltas resourceが混在するgroupはroll actionを保ち、warningを出さない', () => {
    const palette: ProjectionPaletteEntry[] = [
      { key: 'empty', kind: 'resource', deltas: [], label: 'Empty', group: 'mixed', fieldRef: { uid: 'empty' } },
      roll(1, 'mixed'),
    ]
    const result = createDiscordProjectionViewModel(input(palette))
    const browser = createGroupBrowser({ channelId: input([]).channelId, palette })
    const panel = createEphemeralPanel({ channelId: input([]).channelId, palette, groupId: 'mixed' })

    expect(result.hub.groupSelect?.options).toEqual([{ label: 'mixed', value: 'mixed' }])
    expect(browser.options).toEqual([{ label: 'mixed', value: 'mixed' }])
    expect(panel.actions.map((action) => action.paletteKey)).toEqual(['r1'])
    expect(result.warnings).toEqual([])
  })

  it('全groupが空deltas resourceのみならgroup selectを生成しない', () => {
    const palette: ProjectionPaletteEntry[] = [
      { key: 'hp', kind: 'resource', deltas: [], label: 'HP', group: 'health', fieldRef: { uid: 'hp' } },
      { key: 'mp', kind: 'resource', deltas: [], label: 'MP', group: 'magic', fieldRef: { uid: 'mp' } },
    ]
    const result = createDiscordProjectionViewModel(input(palette))

    expect(result.hub.groupSelect).toBeUndefined()
    expect(result.warnings.map(({ code, path }) => ({ code, path }))).toEqual([
      { code: 'empty-group-omitted', path: 'group.health' },
      { code: 'empty-group-omitted', path: 'group.magic' },
    ])
  })

  it('無効roll keyのみのgroupをselectとbrowserから除外し、warningを返す', () => {
    const palette = [{ ...roll(1, 'invalid-roll'), key: 'bad-key' }]
    const result = createDiscordProjectionViewModel(input(palette))
    const browser = createGroupBrowser({ channelId: input([]).channelId, palette })

    expect(result.hub.groupSelect).toBeUndefined()
    expect(browser.options).toEqual([])
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'invalid-custom-id-part', path: 'palette.bad-key.key' }),
        expect.objectContaining({ code: 'empty-group-omitted', path: 'group.invalid-roll' }),
      ])
    )
  })

  it('非正準deltaのみのresource groupをselectとbrowserから除外し、warningを返す', () => {
    const palette: ProjectionPaletteEntry[] = [
      {
        key: 'hp',
        kind: 'resource',
        deltas: [-0, 1e21, 1e-7],
        label: 'HP',
        group: 'noncanonical-resource',
        fieldRef: { uid: 'hp' },
      },
    ]
    const result = createDiscordProjectionViewModel(input(palette))
    const browser = createGroupBrowser({ channelId: input([]).channelId, palette })

    expect(result.hub.groupSelect).toBeUndefined()
    expect(browser.options).toEqual([])
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'invalid-custom-id-part', path: 'palette.hp.deltas' }),
        expect.objectContaining({ code: 'empty-group-omitted', path: 'group.noncanonical-resource' }),
      ])
    )
  })

  it('有効・無効action混在groupは除外せず、有効actionだけを表示する', () => {
    const palette: ProjectionPaletteEntry[] = [
      roll(1, 'mixedrenderability'),
      { ...roll(2, 'mixedrenderability'), key: 'bad-key' },
      {
        key: 'hp',
        kind: 'resource',
        deltas: [-0, -1, 1e21, 1],
        label: 'HP',
        group: 'mixedrenderability',
        fieldRef: { uid: 'hp' },
      },
    ]
    const result = createDiscordProjectionViewModel(input(palette))
    const browser = createGroupBrowser({ channelId: input([]).channelId, palette })
    const panel = createEphemeralPanel({
      channelId: input([]).channelId,
      palette,
      groupId: 'mixedrenderability',
    })

    expect(result.hub.groupSelect?.options).toEqual([
      { label: 'mixedrenderability', value: 'mixedrenderability' },
    ])
    expect(browser.options).toEqual([{ label: 'mixedrenderability', value: 'mixedrenderability' }])
    expect(panel.actions.map(({ paletteKey, delta }) => [paletteKey, delta])).toEqual([
      ['r1', undefined],
      ['hp', -1],
      ['hp', 1],
    ])
    expect(result.warnings).not.toContainEqual(expect.objectContaining({ code: 'empty-group-omitted' }))
  })

  it('unsafe group labelは決定的なsafe keyへ変換し、panelで元groupを解決する', () => {
    const palette = [roll(1, '戦闘 技能')]
    const first = createDiscordProjectionViewModel(input(palette))
    const second = createDiscordProjectionViewModel(input(palette))
    const option = first.hub.groupSelect?.options[0]
    expect(option?.label).toBe('戦闘 技能')
    expect(option?.value).toMatch(/^g[a-z0-9]+$/)
    expect(option?.value).toBe(second.hub.groupSelect?.options[0].value)
    expect(first.warnings).toContainEqual(expect.objectContaining({ code: 'group-id-normalized' }))
    expect(createEphemeralPanel({ channelId: input([]).channelId, palette, groupId: option!.value }).actions).toHaveLength(1)
  })

  it('ephemeral panelは20 action/pageで1-indexed pagingする', () => {
    const palette = Array.from({ length: 21 }, (_, index) => roll(index, 'skills'))
    const page1 = createEphemeralPanel({ channelId: input([]).channelId, palette, groupId: 'skills', page: 1 })
    const page2 = createEphemeralPanel({ channelId: input([]).channelId, palette, groupId: 'skills', page: 2 })
    expect(page1.actions).toHaveLength(20)
    expect(page1.actionRows.map((row) => row.length)).toEqual([5, 5, 5, 5])
    expect(page1.page).toEqual(expect.objectContaining({ currentPage: 1, totalPages: 2 }))
    expect(page1.page.next?.customId).toBe('hub_panel_123456789012345678_skills_2')
    expect(page2.actions).toHaveLength(1)
    expect(page2.page.previous?.customId).toBe('hub_panel_123456789012345678_skills_1')
  })

  it('hub panel customId予算は最大長の構成要素でもDiscord上限内に収まる', () => {
    // 20: channelId、16: Number.MAX_SAFE_INTEGERのpage、2: 「_」区切り。
    expect(
      HUB_PANEL_CUSTOM_ID_PREFIX.length + 20 + 16 + 2 + HUB_GROUP_ID_MAX_LENGTH
    ).toBeLessThanOrEqual(DISCORD_CUSTOM_ID_MAX_LENGTH)
  })

  it('resource entryをdeltaごとの± actionへ展開する', () => {
    const palette: ProjectionPaletteEntry[] = [
      { key: 'hp', kind: 'resource', deltas: [-5, -1, 1, 5], label: 'HP', group: 'resource', fieldRef: { uid: 'hp' } },
    ]
    const panel = createEphemeralPanel({ channelId: input([]).channelId, palette, groupId: 'resource' })
    expect(panel.actions.map(({ customId, style }) => [customId, style])).toEqual([
      ['res_123456789012345678_hp_-5', 'danger'],
      ['res_123456789012345678_hp_-1', 'danger'],
      ['res_123456789012345678_hp_1', 'success'],
      ['res_123456789012345678_hp_5', 'success'],
    ])
  })

  it('指数表記・-0など正準10進表現にできないdeltaは警告してactionを生成しない', () => {
    const palette: ProjectionPaletteEntry[] = [
      {
        key: 'hp',
        kind: 'resource',
        deltas: [-0, 1e21, 1e-7, 0.5],
        label: 'HP',
        group: 'resource',
        fieldRef: { uid: 'hp' },
      },
    ]

    const panel = createEphemeralPanel({ channelId: input([]).channelId, palette, groupId: 'resource' })

    expect(panel.actions.map((action) => action.customId)).toEqual(['res_123456789012345678_hp_0.5'])
    expect(panel.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'invalid-custom-id-part',
          path: 'palette.hp.deltas',
        }),
      ])
    )
    expect(canonicalizeResourceDelta(-0)).toBeNull()
    expect(canonicalizeResourceDelta(1e21)).toBeNull()
    expect(canonicalizeResourceDelta(1e-7)).toBeNull()
  })

  it('空のfield/section labelはfield uid由来の表示へfallbackする', () => {
    const palette: ProjectionPaletteEntry[] = [
      { ...roll(1, '   '), label: '  ' },
      { key: 'hp', kind: 'resource', deltas: [-1, 1], label: '', group: 'resource', fieldRef: { uid: 'main.hp' } },
    ]
    const result = createDiscordProjectionViewModel({
      ...input(palette),
      resourceValues: { 'main.hp': 10 },
    })

    expect(result.hub.pinnedButtonRows[0][0].label).toBe('uid-1')
    expect(result.hub.groupSelect?.options[0].label).toBe('uid-1')
    expect(result.hub.embed.fields[0].name).toBe('main.hp')
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'empty-label-fallback' }))
  })

  it('resource currentはsheet.valuesのpartsを合算し、materialized labelの値重複を除く', () => {
    const palette: ProjectionPaletteEntry[] = [
      { key: 'hp', kind: 'resource', deltas: [-1, 1], label: 'HP (11)', group: 'resource', fieldRef: { uid: 'hp' } },
    ]
    const result = createDiscordProjectionViewModel({
      ...input(palette),
      resourceValues: { hp: { parts: { base: 12, buff: 1, temp: 0, other: -2 } } },
    })
    expect(result.hub.embed.fields).toEqual([{ name: 'HP', value: '11', inline: true }])
  })

  it('group browserは24 group/pageでページングする', () => {
    const palette = Array.from({ length: 25 }, (_, index) => roll(index, `g${index}`))
    const first = createGroupBrowser({ channelId: input([]).channelId, palette, page: 1 })
    const second = createGroupBrowser({ channelId: input([]).channelId, palette, page: 2 })
    expect(first.options).toHaveLength(24)
    expect(first.page.next?.customId).toBe('hub_groups_123456789012345678_2')
    expect(second.options).toEqual([{ label: 'g24', value: 'g24' }])
    expect(second.page.previous?.customId).toBe('hub_groups_123456789012345678_1')
  })

  it('palette soft capは128件では警告せず129件で警告する', () => {
    const palette128 = Array.from({ length: 128 }, (_, index) => roll(index))
    const palette129 = [...palette128, roll(128)]
    expect(createDiscordProjectionViewModel(input(palette128)).warnings.some((warning) => warning.code === 'palette-soft-cap-exceeded')).toBe(false)
    expect(createDiscordProjectionViewModel(input(palette129)).warnings).toContainEqual(
      expect.objectContaining({ code: 'palette-soft-cap-exceeded' })
    )
  })

  it('embedはfield個別上限に加えて総6000文字以内へ決定的に省略する', () => {
    const palette: ProjectionPaletteEntry[] = Array.from({ length: 25 }, (_, index) => ({
      key: `hp${index}`,
      kind: 'resource',
      deltas: [-1, 1],
      label: `R${index}${'n'.repeat(254)}`,
      group: 'resource',
      fieldRef: { uid: `hp-${index}` },
    }))
    const resourceValues = Object.fromEntries(
      palette.map((entry) => [entry.fieldRef.uid, 'v'.repeat(1024)])
    )
    const result = createDiscordProjectionViewModel({ ...input(palette), resourceValues })
    const embed = result.hub.embed
    const total =
      embed.title.length +
      (embed.description?.length ?? 0) +
      (embed.footer?.text.length ?? 0) +
      embed.fields.reduce((sum, field) => sum + field.name.length + field.value.length, 0)
    expect(total).toBeLessThanOrEqual(DISCORD_EMBED_TOTAL_MAX_LENGTH)
    expect(embed.fields.length).toBeLessThan(25)
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'embed-truncated' }))
  })

  it('invalid keyと100文字超customIdのgroupをselect/browserから除外し、警告を一度ずつ返す', () => {
    const invalid = { ...roll(1), key: 'bad-key' }
    const overBudget = { ...roll(2), key: 'a'.repeat(90) }
    const result = createDiscordProjectionViewModel(input([invalid, overBudget]))
    const browser = createGroupBrowser({ channelId: input([]).channelId, palette: [invalid, overBudget] })
    const panel = createEphemeralPanel({
      channelId: input([]).channelId,
      palette: [invalid, overBudget],
      groupId: 'group',
    })

    expect(result.hub.groupSelect).toBeUndefined()
    expect(browser.options).toEqual([])
    expect(panel.actions).toEqual([])
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'invalid-custom-id-part', path: 'palette.bad-key.key' }),
        expect.objectContaining({ code: 'custom-id-budget-exceeded', path: `palette.${overBudget.key}.customId` }),
        expect.objectContaining({ code: 'empty-group-omitted', path: 'group.group' }),
      ])
    )
    expect(result.warnings.filter(({ code }) => code === 'invalid-custom-id-part')).toHaveLength(1)
    expect(result.warnings.filter(({ code }) => code === 'custom-id-budget-exceeded')).toHaveLength(1)
    expect(result.warnings.filter(({ code }) => code === 'empty-group-omitted')).toHaveLength(1)
  })

  it('roll customIdは100文字ならgroupとpageに残り、104文字なら除外される', () => {
    const channelId = input([]).channelId
    const atLimitKey = 'a'.repeat(
      DISCORD_CUSTOM_ID_MAX_LENGTH - ROLL_PALETTE_CUSTOM_ID_PREFIX.length - channelId.length - 1
    )
    const overLimitKey = 'b'.repeat(atLimitKey.length + 4)
    const pageBoundaryPalette = [
      ...Array.from({ length: 19 }, (_, index) => roll(index, 'pageboundary')),
      { ...roll(19, 'pageboundary'), key: atLimitKey },
      { ...roll(20, 'pageboundary'), key: overLimitKey },
      { ...roll(21, 'overonly'), key: `c${overLimitKey.slice(1)}` },
    ]
    const panelCustomId = jest.spyOn(customId, 'createHubPanelCustomId')

    const result = createDiscordProjectionViewModel(input(pageBoundaryPalette))
    const browser = createGroupBrowser({ channelId, palette: pageBoundaryPalette })
    const boundaryPanel = createEphemeralPanel({
      channelId,
      palette: pageBoundaryPalette,
      groupId: 'pageboundary',
    })
    const omittedPanel = createEphemeralPanel({
      channelId,
      palette: pageBoundaryPalette,
      groupId: 'overonly',
    })

    expect(customId.createRollPaletteCustomId(channelId, atLimitKey)).toHaveLength(100)
    expect(customId.createRollPaletteCustomId(channelId, overLimitKey)).toHaveLength(104)
    expect(result.hub.groupSelect?.options).toEqual([{ label: 'pageboundary', value: 'pageboundary' }])
    expect(browser.options).toEqual([{ label: 'pageboundary', value: 'pageboundary' }])
    expect(boundaryPanel.actions).toHaveLength(20)
    expect(boundaryPanel.actions.some(({ paletteKey }) => paletteKey === atLimitKey)).toBe(true)
    expect(boundaryPanel.actions.some(({ paletteKey }) => paletteKey === overLimitKey)).toBe(false)
    expect(boundaryPanel.page.totalPages).toBe(1)
    expect(omittedPanel.actions).toEqual([])
    expect(panelCustomId).toHaveBeenCalledWith(channelId, 'pageboundary', 1)
    expect(panelCustomId).not.toHaveBeenCalledWith(channelId, 'pageboundary', 2)
  })

  it('roll customId生成失敗の警告は既存のcodeとpathを維持する', () => {
    jest.spyOn(customId, 'createRollPaletteCustomId').mockReturnValue(null)

    const hub = createDiscordProjectionViewModel(input([roll(1)]))

    expect(hub.warnings.map(({ code, path }) => ({ code, path }))).toContainEqual({
      code: 'invalid-custom-id-part',
      path: 'palette.r1.customId',
    })
  })

  it('page customId生成失敗の警告は既存のcodeとpathを維持する', () => {
    jest.spyOn(customId, 'createHubGroupBrowserCustomId').mockReturnValue(null)

    const browser = createGroupBrowser({
      channelId: input([]).channelId,
      palette: Array.from({ length: 25 }, (_, index) => roll(index, `g${index}`)),
      page: 1,
    })

    expect(browser.warnings.map(({ code, path }) => ({ code, path }))).toContainEqual({
      code: 'invalid-custom-id-part',
      path: 'group-browser-page.次へ',
    })
  })
})
