import { validatePublishTemplate } from '@trpg/sheet-engine'
import type { CharacterSheetTemplateEntity } from '../domains/character-sheet-template/models/character-sheet-template.entity'
import { LEGACY_COC_TEMPLATE } from '../domains/character-sheet-template/seeds/legacy-coc.template'
import {
  SeedLogger,
  SeedTemplateRepository,
  buildLegacyCocSeedEntity,
  collectSeedPublishIssues,
  parseSeedMode,
  runLegacyCocTemplateSeed
} from './seed-legacy-coc-template'

/**
 * legacy-coc seeder が「seed 実体をそのまま published 行にする」「冪等」「dry-run 既定」
 * 「publish 検証に落ちたら挿入しない」「v2 が published になった後でだけ旧行を deprecate する」
 * を守ることを検証する。
 *
 * 必要な前提: repository は findById / create / deprecatePublished だけをモックする
 * （実 DB へは接続しない）。
 * publish 検証の失敗経路だけは、seed 実体が実際には検証を通るため sheet-engine の
 * validatePublishTemplate をモックで落として確認する（既定は実装そのままを委譲）。
 *
 * collectSeedPublishIssues が再利用する 3 検証は、いずれもモックではなく実関数を通して固定する。
 * engine 段だけを固定すると standalone roll 検証・投影キー検証の削除が緑のまま通るため、
 * 各段でだけ落ちる欠陥と、issues 配列の並び順（standalone → projection）を別々に検証する。
 */
jest.mock('@trpg/sheet-engine', () => {
  const actual = jest.requireActual('@trpg/sheet-engine')
  return { ...actual, validatePublishTemplate: jest.fn(actual.validatePublishTemplate) }
})

const validatePublishTemplateMock = validatePublishTemplate as jest.Mock

const PUBLISHED_AT = new Date('2026-08-13T00:00:00.000Z')

function createHarness(existing: CharacterSheetTemplateEntity | null = null) {
  const findById = jest.fn(async (templateId: string) =>
    existing !== null && existing.templateId === templateId ? existing : null
  )
  const create = jest.fn(async (entity: CharacterSheetTemplateEntity) => entity)
  // 既定は「対象の published 行なし」。deprecate 済み・未投入のどちらの環境もこの戻り値になる。
  const deprecatePublished = jest.fn<Promise<CharacterSheetTemplateEntity | null>, [string, string]>(async () => null)
  const logger: SeedLogger = {
    log: jest.fn(),
    error: jest.fn()
  }

  return {
    repository: { findById, create, deprecatePublished } as SeedTemplateRepository,
    logger,
    findById,
    create,
    deprecatePublished
  }
}

function existingRow(overrides: Partial<CharacterSheetTemplateEntity> = {}): CharacterSheetTemplateEntity {
  return { ...buildLegacyCocSeedEntity(PUBLISHED_AT), ...overrides }
}

/**
 * seed 実体の sections を clone し、定数 notation の roll field を parameter へ足す。
 *
 * seed 本体は roll field を持たない（能力値の作成時ロールは scalar 自身が宣言する）ため、
 * standalone roll 検証だけが落ちる欠陥はここで注入するしかない。定数 notation は
 * placeholder を含まないため engine 段（validatePublishTemplate）を通過する。
 * engine 段で落ちると後段 2 検証は早期 return で走らず、この段の退行を検出できない。
 */
function sectionsWithConstantRollNotation(): any[] {
  const sections: any[] = structuredClone(buildLegacyCocSeedEntity(PUBLISHED_AT).sections)
  sections
    .find((section) => section.id === 'parameter')
    .fields.push({ type: 'roll', id: 'str_roll', uid: 'lgc_str_roll', label: 'STR roll', notation: '10' })
  return sections
}

/**
 * 投影先が description へ寄る非投影 section（section id が投影先 5 種のいずれでもない）。
 *
 * 既存の description.note と投影後の field id が衝突する一方、canonical path（memo.note）と
 * uid は seed 実体と重複しないため engine 段の一意性検査は通る。投影キー検証だけが落とせる。
 */
const DUPLICATE_PROJECTION_SECTION: any = {
  id: 'memo',
  label: 'Memo',
  fields: [{ type: 'scalar', id: 'note', uid: 'lgc_memo_note', label: 'Memo Note', valueType: 'text' }]
}

describe('seed-legacy-coc-template', () => {
  it('引数なしは dry-run、--execute のみ execute、未知引数は拒否する', () => {
    expect(parseSeedMode([])).toBe('dry-run')
    expect(parseSeedMode(['--execute'])).toBe('execute')
    expect(() => parseSeedMode(['--rollback'])).toThrow('Unknown argument')
  })

  it('seed 実体は publish 検証を通り、壊れた式を混ぜると検出される', () => {
    const entity = buildLegacyCocSeedEntity(PUBLISHED_AT)
    const brokenSections: any[] = structuredClone(entity.sections)
    brokenSections
      .find((section) => section.id === 'status')
      .fields.push({
        type: 'computed',
        id: 'ghost',
        uid: 'lgc_ghost',
        label: 'Ghost',
        resultType: 'number',
        formula: '{parameter.does_not_exist}'
      })

    expect(collectSeedPublishIssues(entity)).toEqual([])
    expect(collectSeedPublishIssues({ ...entity, sections: brokenSections }).length).toBeGreaterThan(0)
  })

  it('定数のみの standalone roll notation を拒否する', () => {
    const entity = buildLegacyCocSeedEntity(PUBLISHED_AT)

    expect(collectSeedPublishIssues({ ...entity, sections: sectionsWithConstantRollNotation() })).toEqual([
      'parameter.str_roll.notation: standalone roll expression must contain at least one literal dice term'
    ])
  })

  it('投影先が同じになる section 間の field id 重複を拒否する', () => {
    const entity = buildLegacyCocSeedEntity(PUBLISHED_AT)
    const sections: any[] = [...structuredClone(entity.sections), DUPLICATE_PROJECTION_SECTION]

    expect(collectSeedPublishIssues({ ...entity, sections })).toEqual([
      'duplicate projected field id in description: note'
    ])
  })

  it('standalone roll 由来の issue を投影キー由来より先に並べる', () => {
    const entity = buildLegacyCocSeedEntity(PUBLISHED_AT)
    const sections: any[] = [...sectionsWithConstantRollNotation(), DUPLICATE_PROJECTION_SECTION]

    expect(collectSeedPublishIssues({ ...entity, sections })).toEqual([
      'parameter.str_roll.notation: standalone roll expression must contain at least one literal dice term',
      'duplicate projected field id in description: note'
    ])
  })

  it('dry-run は挿入せず insert 判定だけを返す', async () => {
    const harness = createHarness()

    const result = await runLegacyCocTemplateSeed({
      mode: 'dry-run',
      repository: harness.repository,
      logger: harness.logger,
      publishedAt: PUBLISHED_AT
    })

    expect(harness.findById).toHaveBeenCalledWith('legacy-coc-v2')
    expect(harness.create).not.toHaveBeenCalled()
    expect(result).toMatchObject({ decision: 'insert', inserted: false, issues: [], exitCode: 0 })
  })

  it('execute は seed 実体の値をそのまま published 行として 1 件挿入する', async () => {
    const harness = createHarness()

    const result = await runLegacyCocTemplateSeed({
      mode: 'execute',
      repository: harness.repository,
      logger: harness.logger,
      publishedAt: PUBLISHED_AT
    })

    expect(harness.create).toHaveBeenCalledTimes(1)
    expect(harness.create).toHaveBeenCalledWith({
      // 旧 `legacy-coc` 行を残したまま出し直すため、seeder が触る id は v2 側だけになる
      templateId: 'legacy-coc-v2',
      status: 'published',
      version: '1.0.0',
      schemaVersion: 3,
      name: LEGACY_COC_TEMPLATE.name,
      gameSystemId: 'Cthulhu',
      tags: LEGACY_COC_TEMPLATE.tags,
      visibility: 'private',
      authorDiscordUserId: 'system',
      sections: LEGACY_COC_TEMPLATE.sections,
      tables: LEGACY_COC_TEMPLATE.tables,
      settings: LEGACY_COC_TEMPLATE.settings,
      draftRevision: 1,
      publishedAt: PUBLISHED_AT
    })
    expect(result).toMatchObject({ decision: 'insert', inserted: true, exitCode: 0 })
  })

  it('同じ templateId+version の published 行があれば挿入しない（冪等）', async () => {
    const harness = createHarness(existingRow())

    const result = await runLegacyCocTemplateSeed({
      mode: 'execute',
      repository: harness.repository,
      logger: harness.logger,
      publishedAt: PUBLISHED_AT
    })

    expect(harness.create).not.toHaveBeenCalled()
    expect(result).toMatchObject({ decision: 'skip-existing', inserted: false, exitCode: 0 })
  })

  it('版違い・status 違いの既存行があれば挿入せず exit code 1 を返す', async () => {
    const otherVersion = createHarness(existingRow({ version: '2.0.0' }))
    const draftRow = createHarness(existingRow({ status: 'draft' }))

    const versionResult = await runLegacyCocTemplateSeed({
      mode: 'execute',
      repository: otherVersion.repository,
      logger: otherVersion.logger,
      publishedAt: PUBLISHED_AT
    })
    const statusResult = await runLegacyCocTemplateSeed({
      mode: 'execute',
      repository: draftRow.repository,
      logger: draftRow.logger,
      publishedAt: PUBLISHED_AT
    })

    expect(otherVersion.create).not.toHaveBeenCalled()
    expect(draftRow.create).not.toHaveBeenCalled()
    expect(versionResult).toMatchObject({ decision: 'conflict-existing', inserted: false, exitCode: 1 })
    expect(statusResult).toMatchObject({ decision: 'conflict-existing', inserted: false, exitCode: 1 })
  })

  it('publish 検証に落ちたら挿入せず exit code 1 を返す', async () => {
    const harness = createHarness()
    validatePublishTemplateMock.mockReturnValueOnce({
      ok: false,
      issues: [{ path: 'sections[1].fields[0]', message: 'unknown reference' }]
    })

    const result = await runLegacyCocTemplateSeed({
      mode: 'execute',
      repository: harness.repository,
      logger: harness.logger,
      publishedAt: PUBLISHED_AT
    })

    expect(harness.create).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      decision: 'validation-failed',
      inserted: false,
      issues: ['sections[1].fields[0]: unknown reference'],
      exitCode: 1
    })
  })

  it('挿入失敗を exit code 1 に反映する', async () => {
    const harness = createHarness()
    harness.create.mockRejectedValueOnce(new Error('write failed'))

    const result = await runLegacyCocTemplateSeed({
      mode: 'execute',
      repository: harness.repository,
      logger: harness.logger,
      publishedAt: PUBLISHED_AT
    })

    expect(result).toMatchObject({ decision: 'insert', inserted: false, exitCode: 1 })
    expect(harness.logger.error).toHaveBeenCalledWith('Error: write failed')
  })

  it('execute は v2 を挿入した後に旧 legacy-coc を deprecate する', async () => {
    const harness = createHarness()
    // 戻り値は「published 行が 1 件一致した」ことだけを表す。中身は deprecatedPrevious に影響しない。
    harness.deprecatePublished.mockResolvedValueOnce(existingRow({ templateId: 'legacy-coc', status: 'deprecated' }))

    const result = await runLegacyCocTemplateSeed({
      mode: 'execute',
      repository: harness.repository,
      logger: harness.logger,
      publishedAt: PUBLISHED_AT
    })

    expect(harness.deprecatePublished).toHaveBeenCalledWith('legacy-coc', 'system')
    // 順序そのものを固定する。v2 が published になる前に旧行を落とすと選べる行が消える。
    expect(harness.create.mock.invocationCallOrder[0]).toBeLessThan(
      harness.deprecatePublished.mock.invocationCallOrder[0]
    )
    expect(result).toMatchObject({ inserted: true, deprecatedPrevious: true, exitCode: 0 })
  })

  it('v2 の insert に失敗したら旧行を deprecate しない', async () => {
    const harness = createHarness()
    harness.create.mockRejectedValueOnce(new Error('write failed'))

    const result = await runLegacyCocTemplateSeed({
      mode: 'execute',
      repository: harness.repository,
      logger: harness.logger,
      publishedAt: PUBLISHED_AT
    })

    expect(harness.deprecatePublished).not.toHaveBeenCalled()
    expect(result).toMatchObject({ inserted: false, deprecatedPrevious: false, exitCode: 1 })
  })

  it('同版の published 行が既にあるときも旧行を deprecate する', async () => {
    const harness = createHarness(existingRow())

    const result = await runLegacyCocTemplateSeed({
      mode: 'execute',
      repository: harness.repository,
      logger: harness.logger,
      publishedAt: PUBLISHED_AT
    })

    expect(harness.deprecatePublished).toHaveBeenCalledWith('legacy-coc', 'system')
    expect(result).toMatchObject({ decision: 'skip-existing', exitCode: 0 })
  })

  it('dry-run は deprecate を実行せず予定だけを記録する', async () => {
    const harness = createHarness()

    const result = await runLegacyCocTemplateSeed({
      mode: 'dry-run',
      repository: harness.repository,
      logger: harness.logger,
      publishedAt: PUBLISHED_AT
    })

    expect(harness.deprecatePublished).not.toHaveBeenCalled()
    expect(harness.logger.log).toHaveBeenCalledWith('would deprecate templateId=legacy-coc author=system')
    expect(result).toMatchObject({ deprecatedPrevious: false, exitCode: 0 })
  })

  it('deprecate 対象の行が無くても成功として扱う', async () => {
    const harness = createHarness()

    const result = await runLegacyCocTemplateSeed({
      mode: 'execute',
      repository: harness.repository,
      logger: harness.logger,
      publishedAt: PUBLISHED_AT
    })

    expect(harness.deprecatePublished).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({ inserted: true, deprecatedPrevious: false, exitCode: 0 })
    expect(harness.logger.error).not.toHaveBeenCalled()
  })

  it('deprecate が例外を投げたら exit code 1 を返す', async () => {
    const harness = createHarness()
    harness.deprecatePublished.mockRejectedValueOnce(new Error('update failed'))

    const result = await runLegacyCocTemplateSeed({
      mode: 'execute',
      repository: harness.repository,
      logger: harness.logger,
      publishedAt: PUBLISHED_AT
    })

    // v2 の挿入自体は成功しているので inserted は下げない
    expect(result).toMatchObject({ inserted: true, deprecatedPrevious: false, exitCode: 1 })
    expect(harness.logger.error).toHaveBeenCalledWith('Error: update failed')
  })
})
