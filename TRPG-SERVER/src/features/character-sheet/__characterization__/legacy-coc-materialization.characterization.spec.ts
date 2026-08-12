import { Test, TestingModule } from '@nestjs/testing'
import { isAttributeSection } from '../../../core/types/attribute.types'
import { CharacterSheetTemplateEntity } from '../../../domains/character-sheet-template/models/character-sheet-template.entity'
import { LEGACY_COC_TEMPLATE } from '../../../domains/character-sheet-template/seeds/legacy-coc.template'
import { SheetMaterializerService } from '../services/sheet-materializer.service'
import { CharacterSheetProjection } from '../types/character-sheet.types'
import { REPRESENTATIVE_LEGACY_CHARACTER_PROJECTION } from './representative-legacy-character.fixture'

describe('legacy-coc materialization characterization', () => {
  let module: TestingModule
  let service: SheetMaterializerService

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [SheetMaterializerService]
    }).compile()

    service = module.get(SheetMaterializerService)
  })

  afterAll(async () => {
    await module.close()
  })

  const materializeRepresentativeLegacyCharacter = () => {
    const parameterSection = LEGACY_COC_TEMPLATE.sections.find((section) => section.id === 'parameter')
    if (!parameterSection) {
      throw new Error('legacy-coc template does not contain the parameter section')
    }

    const values = Object.fromEntries(
      parameterSection.fields.flatMap((field) => {
        if (field.type !== 'scalar') {
          return []
        }

        const base = REPRESENTATIVE_LEGACY_CHARACTER_PROJECTION.parameter[field.id]?.values?.base
        if (base === undefined) {
          throw new Error(`representative legacy fixture does not contain parameter.${field.id}.values.base`)
        }

        return [[field.uid, base]]
      })
    )

    return service.materialize({
      template: LEGACY_COC_TEMPLATE as unknown as CharacterSheetTemplateEntity,
      sheet: {
        templateId: LEGACY_COC_TEMPLATE.templateId,
        templateVersion: LEGACY_COC_TEMPLATE.version,
        revision: 1,
        visibility: 'private',
        values
      }
    })
  }

  it('現行の status / parameter 投影が代表 legacy キャラの golden fixture と完全一致する', () => {
    const materialized = materializeRepresentativeLegacyCharacter()

    expect(materialized.projection.status).toEqual(REPRESENTATIVE_LEGACY_CHARACTER_PROJECTION.status)
    expect(materialized.projection.parameter).toEqual(REPRESENTATIVE_LEGACY_CHARACTER_PROJECTION.parameter)
  })

  it('生成された5投影がすべて AttributeSection 正準形を満たす', () => {
    const projection = materializeRepresentativeLegacyCharacter().projection
    const sectionNames: Array<keyof CharacterSheetProjection> = ['status', 'parameter', 'skill', 'item', 'description']

    for (const sectionName of sectionNames) {
      expect(isAttributeSection(projection[sectionName])).toBe(true)
    }
  })
})
