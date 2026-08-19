import {
  BACKFILL_MARKER_FILTER,
  BACKFILL_PINNED_BY,
  BACKFILL_TEMPLATE_PIN,
  BackfillCharacterModel,
  BackfillLogger,
  LEGACY_UNPINNED_FILTER,
  TemplatePinRepository,
  parseBackfillMode,
  runTemplatePinBackfill
} from './backfill-template-pin'

type FakeCharacter = {
  characterId: string
  sheet?: { templateId: string }
  templatePin?: { templateId: string; templateVersion: string; pinnedBy: string }
}

function createHarness(initialCharacters: FakeCharacter[]) {
  const characters = initialCharacters.map((character) => structuredClone(character))
  const find = jest.fn((filter: Record<string, unknown>) => {
    const matches = characters.filter((character) => {
      if ('sheet' in filter) {
        return character.sheet === undefined && character.templatePin === undefined
      }
      return character.templatePin?.pinnedBy === BACKFILL_PINNED_BY
    })
    const query: any = {}
    query.select = jest.fn().mockReturnValue(query)
    query.lean = jest.fn().mockReturnValue(query)
    query.exec = jest.fn().mockResolvedValue(matches.map(({ characterId }) => ({ characterId })))
    return query
  })
  const updateOne = jest.fn((filter: Record<string, unknown>, update: Record<string, unknown>) => ({
    exec: jest.fn().mockImplementation(async () => {
      const character = characters.find(
        (candidate) =>
          candidate.characterId === filter.characterId &&
          candidate.templatePin?.pinnedBy === filter['templatePin.pinnedBy']
      )
      if (character === undefined || !('$unset' in update)) return { modifiedCount: 0 }
      delete character.templatePin
      return { modifiedCount: 1 }
    })
  }))
  const setTemplatePin = jest.fn(async (characterId: string) => {
    const character = characters.find((candidate) => candidate.characterId === characterId)
    if (character === undefined || character.sheet !== undefined || character.templatePin !== undefined) return null
    character.templatePin = { ...BACKFILL_TEMPLATE_PIN }
    return character
  })
  const logger: BackfillLogger = {
    log: jest.fn(),
    error: jest.fn()
  }

  return {
    characters,
    model: { find, updateOne } as BackfillCharacterModel,
    repository: { setTemplatePin } as TemplatePinRepository,
    logger,
    find,
    updateOne,
    setTemplatePin
  }
}

describe('backfill-template-pin', () => {
  // 他のテストは BACKFILL_TEMPLATE_PIN を参照で使うだけなので、値が別テンプレートの
  // ものへ差し替わっても気付けない。ここだけは実際の値そのものを固定する。
  it('pin は旧 legacy-coc テンプレートの id と版を指す', () => {
    expect(BACKFILL_TEMPLATE_PIN.templateId).toBe('legacy-coc')
    expect(BACKFILL_TEMPLATE_PIN.templateVersion).toBe('1.0.0')
  })

  it('引数なしは dry-run、相反・未知引数は拒否する', () => {
    expect(parseBackfillMode([])).toBe('dry-run')
    expect(parseBackfillMode(['--execute'])).toBe('execute')
    expect(parseBackfillMode(['--rollback'])).toBe('rollback')
    expect(() => parseBackfillMode(['--execute', '--rollback'])).toThrow()
    expect(() => parseBackfillMode(['--unknown'])).toThrow('Unknown argument')
  })

  it('dry-run は legacy-unpinned の件数と ID だけを取得し変更しない', async () => {
    const harness = createHarness([
      { characterId: 'legacy-unpinned' },
      {
        characterId: 'legacy-pinned',
        templatePin: { templateId: 'other', templateVersion: '2.0.0', pinnedBy: 'manual' }
      },
      { characterId: 'materialized', sheet: { templateId: 'template-1' } }
    ])

    const result = await runTemplatePinBackfill({
      mode: 'dry-run',
      repository: harness.repository,
      model: harness.model,
      logger: harness.logger
    })

    expect(harness.find).toHaveBeenCalledWith(LEGACY_UNPINNED_FILTER)
    expect(result.targetCharacterIds).toEqual(['legacy-unpinned'])
    expect(result.processedCharacterIds).toEqual([])
    expect(harness.setTemplatePin).not.toHaveBeenCalled()
    expect(harness.updateOne).not.toHaveBeenCalled()
    expect(result.exitCode).toBe(0)
  })

  it('execute は legacy-unpinned だけを pin し、2回目は対象0件になる', async () => {
    const existingPin = { templateId: 'other', templateVersion: '2.0.0', pinnedBy: 'manual' }
    const materializedSheet = { templateId: 'template-1' }
    const harness = createHarness([
      { characterId: 'legacy-unpinned' },
      { characterId: 'legacy-pinned', templatePin: existingPin },
      { characterId: 'materialized', sheet: materializedSheet }
    ])

    const first = await runTemplatePinBackfill({
      mode: 'execute',
      repository: harness.repository,
      model: harness.model,
      logger: harness.logger
    })
    const second = await runTemplatePinBackfill({
      mode: 'execute',
      repository: harness.repository,
      model: harness.model,
      logger: harness.logger
    })

    expect(first.processedCharacterIds).toEqual(['legacy-unpinned'])
    expect(second.targetCharacterIds).toEqual([])
    expect(second.processedCharacterIds).toEqual([])
    expect(harness.setTemplatePin).toHaveBeenCalledTimes(1)
    expect(harness.setTemplatePin).toHaveBeenCalledWith('legacy-unpinned', BACKFILL_TEMPLATE_PIN)
    expect(harness.characters.find(({ characterId }) => characterId === 'legacy-pinned')?.templatePin).toEqual(
      existingPin
    )
    expect(harness.characters.find(({ characterId }) => characterId === 'materialized')?.sheet).toEqual(
      materializedSheet
    )
  })

  it('rollback は本スクリプトの marker だけを条件付きで unset する', async () => {
    const otherPin = { templateId: 'other', templateVersion: '2.0.0', pinnedBy: 'manual' }
    const harness = createHarness([
      { characterId: 'backfilled', templatePin: { ...BACKFILL_TEMPLATE_PIN } },
      { characterId: 'other-pin', templatePin: otherPin },
      { characterId: 'materialized', sheet: { templateId: 'template-1' } }
    ])

    const result = await runTemplatePinBackfill({
      mode: 'rollback',
      repository: harness.repository,
      model: harness.model,
      logger: harness.logger
    })

    expect(harness.find).toHaveBeenCalledWith(BACKFILL_MARKER_FILTER)
    expect(harness.updateOne).toHaveBeenCalledWith(
      { characterId: 'backfilled', ...BACKFILL_MARKER_FILTER },
      { $unset: { templatePin: 1 } }
    )
    expect(result.processedCharacterIds).toEqual(['backfilled'])
    expect(harness.characters.find(({ characterId }) => characterId === 'backfilled')?.templatePin).toBeUndefined()
    expect(harness.characters.find(({ characterId }) => characterId === 'other-pin')?.templatePin).toEqual(otherPin)
    expect(harness.characters.find(({ characterId }) => characterId === 'materialized')?.sheet).toEqual({
      templateId: 'template-1'
    })
    expect(harness.setTemplatePin).not.toHaveBeenCalled()
  })

  it('処理失敗を failed ID と exit code 1 に反映する', async () => {
    const harness = createHarness([{ characterId: 'broken' }])
    harness.setTemplatePin.mockRejectedValueOnce(new Error('write failed'))

    const result = await runTemplatePinBackfill({
      mode: 'execute',
      repository: harness.repository,
      model: harness.model,
      logger: harness.logger
    })

    expect(result.failedCharacterIds).toEqual(['broken'])
    expect(result.exitCode).toBe(1)
    expect(harness.logger.error).toHaveBeenCalledWith('characterId=broken Error: write failed')
  })
})
