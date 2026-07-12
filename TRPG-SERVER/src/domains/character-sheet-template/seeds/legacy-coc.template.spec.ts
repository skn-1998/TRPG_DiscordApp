import { evaluateTemplate, validatePublishTemplate } from '@trpg/sheet-engine'
import { LEGACY_COC_TEMPLATE } from './legacy-coc.template'

describe('LEGACY_COC_TEMPLATE', () => {
  it('passes sheet-engine publish validation', () => {
    const result = validatePublishTemplate(LEGACY_COC_TEMPLATE)

    expect(result.issues).toEqual([])
    expect(result.ok).toBe(true)
  })

  it('evaluates HP, MP, and DB for sample legacy CoC values', () => {
    const evaluated = evaluateTemplate(LEGACY_COC_TEMPLATE, {
      values: {
        lgc_str: 50,
        lgc_siz: 60,
        lgc_con: 55,
        lgc_pow: 60
      }
    })

    expect(evaluated.values.lgc_hp).toEqual({ type: 'number', value: 11 })
    expect(evaluated.values.lgc_mp).toEqual({ type: 'number', value: 12 })
    expect(evaluated.values.lgc_db).toEqual({ type: 'dice', value: '0' })
  })

  it('evaluates damage bonus boundary values at STR plus SIZ 124 and 125', () => {
    const belowBoundary = evaluateTemplate(LEGACY_COC_TEMPLATE, {
      values: {
        lgc_str: 64,
        lgc_siz: 60
      }
    })
    const atBoundary = evaluateTemplate(LEGACY_COC_TEMPLATE, {
      values: {
        lgc_str: 65,
        lgc_siz: 60
      }
    })

    expect(belowBoundary.values.lgc_db).toEqual({ type: 'dice', value: '0' })
    expect(atBoundary.values.lgc_db).toEqual({ type: 'dice', value: '+1d4' })
  })
})
