import {
  characterSheetVisibilitySchema,
  materializedCharacterEntitySchema,
  saveSheetMaterializedPayloadSchema
} from './character.zod'

const canonicalSections = {
  status: { HP: { values: { base: 10, buff: 2, temp: -1, other: 3 } } },
  parameter: {},
  skill: {},
  item: {},
  description: {}
}

describe('character Zod schemas', () => {
  it('character sheet visibility の named options を固定する', () => {
    expect(characterSheetVisibilitySchema.options).toEqual(['private', 'public'])
  })

  it('materialized character の全要素と AttributeValue parts を受理する', () => {
    expect(
      materializedCharacterEntitySchema.safeParse({
        characterId: 'c1',
        characterName: 'Alice',
        gameSystemId: 'coc7',
        discordUserId: 'u1',
        discordChannelId: 'ch1',
        ...canonicalSections,
        sheet: {
          templateId: 'tpl-1',
          templateVersion: '1.0.0',
          revision: 1,
          visibility: 'private',
          values: { hp: 10 }
        },
        computedCache: { hpHalf: 5 },
        palette: [],
        hub: { status: 'none' },
        appliedInteractionIds: []
      }).success
    ).toBe(true)
  })

  it.each([
    ['display', { status: { HP: { values: { base: 10 }, display: 10 } } }],
    ['non-finite', { status: { HP: { values: { base: Number.NaN } } } }],
    ['primitive', { status: { HP: 10 } }]
  ])('save payload の不正な %s 投影を拒否する', (_name, override) => {
    const result = saveSheetMaterializedPayloadSchema.safeParse({
      values: {},
      computedCache: {},
      palette: [],
      ...canonicalSections,
      pendingRevision: 2,
      appliedInteractionIds: [],
      ...override
    })

    expect(result.success).toBe(false)
  })

  it('materialized character の interaction id が21件なら拒否する', () => {
    const result = materializedCharacterEntitySchema.safeParse({
      characterId: 'c1',
      characterName: 'Alice',
      gameSystemId: 'coc7',
      discordUserId: 'u1',
      discordChannelId: 'ch1',
      ...canonicalSections,
      sheet: {
        templateId: 'tpl-1',
        templateVersion: '1.0.0',
        revision: 1,
        visibility: 'private',
        values: {}
      },
      computedCache: {},
      palette: [],
      hub: { status: 'none' },
      appliedInteractionIds: Array.from({ length: 21 }, (_, index) => `interaction-${index}`)
    })

    expect(result.success).toBe(false)
  })

  it('materialized character 作成では legacy templatePin を拒否する', () => {
    const result = materializedCharacterEntitySchema.safeParse({
      characterId: 'c1',
      characterName: 'Alice',
      gameSystemId: 'coc7',
      discordUserId: 'u1',
      discordChannelId: 'ch1',
      ...canonicalSections,
      sheet: {
        templateId: 'tpl-1',
        templateVersion: '1.0.0',
        revision: 1,
        visibility: 'private',
        values: {}
      },
      templatePin: { templateId: 'legacy-coc', templateVersion: '1.0.0', pinnedBy: 'backfill' },
      computedCache: {},
      palette: [],
      hub: { status: 'none' },
      appliedInteractionIds: []
    })

    expect(result.success).toBe(false)
  })

  it.each([
    ['欠落', undefined],
    ['unlisted', 'unlisted'],
    ['未知値', 'friends']
  ])('character sheet visibility の%sを拒否する', (_caseName, visibility) => {
    const result = materializedCharacterEntitySchema.safeParse({
      characterId: 'c1',
      characterName: 'Alice',
      gameSystemId: 'coc7',
      discordUserId: 'u1',
      discordChannelId: 'ch1',
      ...canonicalSections,
      sheet: { templateId: 'tpl-1', templateVersion: '1.0.0', revision: 1, visibility, values: {} },
      computedCache: {},
      palette: [],
      hub: { status: 'none' },
      appliedInteractionIds: []
    })

    expect(result.success).toBe(false)
  })
})
