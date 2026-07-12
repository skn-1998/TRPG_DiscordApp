import { resolveCharacterState } from './character.entity'

describe('resolveCharacterState', () => {
  it('sheet も templatePin も無ければ legacy-unpinned', () => {
    expect(resolveCharacterState({})).toBe('legacy-unpinned')
  })

  it('sheet がなく templatePin があれば legacy-pinned', () => {
    expect(
      resolveCharacterState({
        templatePin: { templateId: 'legacy-coc', templateVersion: '1.0.0', pinnedBy: 'backfill-2026-07-12' }
      })
    ).toBe('legacy-pinned')
  })

  it('sheet があれば materialized', () => {
    expect(
      resolveCharacterState({
        sheet: { templateId: 'tpl-1', templateVersion: '1.0.0', revision: 1, values: {} }
      })
    ).toBe('materialized')
  })

  it('sheet と templatePin が両方あっても sheet を優先して materialized', () => {
    expect(
      resolveCharacterState({
        sheet: { templateId: 'tpl-1', templateVersion: '2.0.0', revision: 2, values: {} },
        templatePin: { templateId: 'legacy-coc', templateVersion: '1.0.0', pinnedBy: 'backfill' }
      })
    ).toBe('materialized')
  })
})
