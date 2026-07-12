import {
  GROUP_SELECT_MORE_VALUE,
  DISCORD_EMBED_TOTAL_MAX_LENGTH,
  createDiscordProjectionViewModel,
  createEphemeralPanel,
  createGroupBrowser,
  createGroupSelect,
  splitPinnedButtonRows,
  type DiscordProjectionInput,
  type ProjectionPaletteEntry,
} from '..'

declare const require: (path: string) => unknown

const goldenInput = require('../../fixtures/hub-basic.input.json') as DiscordProjectionInput
const goldenExpected = require('../../fixtures/hub-basic.expected.json')

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

  it('invalid keyと100文字超customIdは警告してcomponentを除外する', () => {
    const invalid = { ...roll(1), key: 'bad-key' }
    const overBudget = { ...roll(2), key: 'a'.repeat(90) }
    const panel = createEphemeralPanel({
      channelId: input([]).channelId,
      palette: [invalid, overBudget],
      groupId: 'group',
    })
    expect(panel.actions).toEqual([])
    expect(panel.warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining(['invalid-custom-id-part', 'custom-id-budget-exceeded'])
    )
  })
})
