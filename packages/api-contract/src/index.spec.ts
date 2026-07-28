import ts from 'typescript'

declare const require: (id: string) => Record<string, unknown>
declare const __dirname: string

const path = require('path') as { join: (...paths: string[]) => string }

describe('@trpg/api-contract public exports', () => {
  it('型シンボルの公開面を35名に固定する', () => {
    const indexPath = path.join(__dirname, 'index.ts')
    const program = ts.createProgram([indexPath], {
      moduleResolution: ts.ModuleResolutionKind.Node10
    })

    const indexSourceFile = program.getSourceFile(indexPath)
    if (!indexSourceFile) {
      throw new Error(`Compiler API で ${indexPath} を読み込めませんでした`)
    }

    const checker = program.getTypeChecker()
    const indexSymbol = checker.getSymbolAtLocation(indexSourceFile)
    if (!indexSymbol) {
      throw new Error('Compiler API で index.ts の module symbol を取得できませんでした')
    }

    const exportedSymbolNames = checker
      .getExportsOfModule(indexSymbol)
      .map((symbol) => symbol.getName())
      .sort()

    expect(exportedSymbolNames).toEqual([
      'CharacterAttributeSectionWire',
      'CharacterAttributeValueWire',
      'CharacterDeleteResultWire',
      'CharacterHubStatusWire',
      'CharacterHubWire',
      'CharacterPaletteEntryWire',
      'CharacterSheetStateWire',
      'CharacterSheetTemplateEntityInput',
      'CharacterSummaryWire',
      'CharacterTemplatePinWire',
      'CharacterWire',
      'CreateCharacterFromTemplateResultWire',
      'DiscordGuildWire',
      'DiscordGuildsPayloadWire',
      'Envelope',
      'ErrorEnvelope',
      'LoginDataWire',
      'SaveCharacterSheetResultWire',
      'SuccessEnvelope',
      'UserProfileWire',
      'attributeSectionSchema',
      'attributeValueSchema',
      'characterEntitySchema',
      'characterHubSchema',
      'characterHubStatusSchema',
      'characterPaletteEntrySchema',
      'characterSheetStateSchema',
      'characterSheetTemplateEntitySchema',
      'characterTemplatePinSchema',
      'materializedCharacterEntitySchema',
      'saveSheetMaterializedPayloadSchema',
      'sheetTemplateForkedFromSchema',
      'sheetTemplateSettingsSchema',
      'sheetTemplateStatusSchema',
      'sheetTemplateVisibilitySchema'
    ])
  })

  it('ランタイム値の公開面を15名に固定する', () => {
    // require('./index') は ts-jest がソースを解決する。
    // これはソース公開面の値/型区分の証人であり、dist 成果物の検証は build が担う。
    // 35 − 15 = 型のみ20（封筒3＋auth wire型1＋character wire型12＋user/guild wire型3＋template型1）を不変条件とする。
    const runtimeExportNames = Object.keys(require('./index'))
      .filter((name) => name !== '__esModule')
      .sort()

    expect(runtimeExportNames).toEqual([
      'attributeSectionSchema',
      'attributeValueSchema',
      'characterEntitySchema',
      'characterHubSchema',
      'characterHubStatusSchema',
      'characterPaletteEntrySchema',
      'characterSheetStateSchema',
      'characterSheetTemplateEntitySchema',
      'characterTemplatePinSchema',
      'materializedCharacterEntitySchema',
      'saveSheetMaterializedPayloadSchema',
      'sheetTemplateForkedFromSchema',
      'sheetTemplateSettingsSchema',
      'sheetTemplateStatusSchema',
      'sheetTemplateVisibilitySchema'
    ])
  })
})
