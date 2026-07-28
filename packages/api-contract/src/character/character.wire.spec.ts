import type { z } from 'zod'
import type { characterEntitySchema } from './character.zod'
import type {
  CharacterAttributeValueWire,
  CharacterDeleteResultWire,
  CharacterHubWire,
  CharacterPaletteEntryWire,
  CharacterSheetStateWire,
  CharacterSummaryWire,
  CharacterTemplatePinWire,
  CharacterWire,
  CreateCharacterFromTemplateResultWire,
  SaveCharacterSheetResultWire
} from './character.wire'

/**
 * wire 単体のキー集合、optionality、any 混入を固定する。
 * server entity との同値は server 側 character-wire.contract.spec.ts が担当する。
 */
type AnyKeys<T> = {
  [Key in keyof T]-?: 0 extends 1 & T[Key] ? Key : never
}[keyof T]

type IsAny<T> = 0 extends 1 & T ? true : false

type IsExact<Actual, Expected> = IsAny<Actual> extends true
  ? false
  : IsAny<Expected> extends true
    ? false
    : [Actual] extends [Expected]
      ? [Expected] extends [Actual]
        ? true
        : false
      : false

type Assert<Condition extends true> = Condition

type AssertNever<T extends never> = T

type OptionalKeys<T> = {
  [Key in keyof T]-?: object extends Pick<T, Key> ? Key : never
}[keyof T]

type CharacterWirePayloadKeys = Exclude<keyof CharacterWire, '_id' | '__v'>
type CharacterSchemaKeys = keyof z.infer<typeof characterEntitySchema>

type CharacterWireOnlyKeys = AssertNever<Exclude<CharacterWirePayloadKeys, CharacterSchemaKeys>>
type CharacterSchemaOnlyKeys = AssertNever<Exclude<CharacterSchemaKeys, CharacterWirePayloadKeys>>

type ExpectedCharacterWireOptionalKeys =
  | OptionalKeys<z.infer<typeof characterEntitySchema>>
  | '_id'
  | '__v'
  | 'discordChannelId'
  | 'status'
type UnexpectedCharacterWireOptionalKeys = AssertNever<
  Exclude<OptionalKeys<CharacterWire>, ExpectedCharacterWireOptionalKeys>
>
type MissingCharacterWireOptionalKeys = AssertNever<
  Exclude<ExpectedCharacterWireOptionalKeys, OptionalKeys<CharacterWire>>
>

type CharacterDeleteResultWireRequiredKeys = Exclude<
  keyof CharacterDeleteResultWire,
  OptionalKeys<CharacterDeleteResultWire>
>
type ExpectedCharacterDeleteResultWireRequiredKeys = 'message' | 'characterId'
type UnexpectedCharacterDeleteResultWireRequiredKeys = AssertNever<
  Exclude<CharacterDeleteResultWireRequiredKeys, ExpectedCharacterDeleteResultWireRequiredKeys>
>
type MissingCharacterDeleteResultWireRequiredKeys = AssertNever<
  Exclude<ExpectedCharacterDeleteResultWireRequiredKeys, CharacterDeleteResultWireRequiredKeys>
>
type UnexpectedCharacterDeleteResultWireOptionalKeys = AssertNever<OptionalKeys<CharacterDeleteResultWire>>

type SaveCharacterSheetResultWireRequiredKeys = Exclude<
  keyof SaveCharacterSheetResultWire,
  OptionalKeys<SaveCharacterSheetResultWire>
>
type ExpectedSaveCharacterSheetResultWireRequiredKeys = 'revision' | 'noOp' | 'appliedChanges'
type UnexpectedSaveCharacterSheetResultWireRequiredKeys = AssertNever<
  Exclude<SaveCharacterSheetResultWireRequiredKeys, ExpectedSaveCharacterSheetResultWireRequiredKeys>
>
type MissingSaveCharacterSheetResultWireRequiredKeys = AssertNever<
  Exclude<ExpectedSaveCharacterSheetResultWireRequiredKeys, SaveCharacterSheetResultWireRequiredKeys>
>
type UnexpectedSaveCharacterSheetResultWireOptionalKeys = AssertNever<OptionalKeys<SaveCharacterSheetResultWire>>
type SaveCharacterSheetResultWireShape = Assert<
  IsExact<
    SaveCharacterSheetResultWire,
    {
      revision: number
      noOp: boolean
      appliedChanges: number
    }
  >
>

type CreateCharacterFromTemplateResultWireRequiredKeys = Exclude<
  keyof CreateCharacterFromTemplateResultWire,
  OptionalKeys<CreateCharacterFromTemplateResultWire>
>
type ExpectedCreateCharacterFromTemplateResultWireRequiredKeys = 'characterId'
type UnexpectedCreateCharacterFromTemplateResultWireRequiredKeys = AssertNever<
  Exclude<CreateCharacterFromTemplateResultWireRequiredKeys, ExpectedCreateCharacterFromTemplateResultWireRequiredKeys>
>
type MissingCreateCharacterFromTemplateResultWireRequiredKeys = AssertNever<
  Exclude<ExpectedCreateCharacterFromTemplateResultWireRequiredKeys, CreateCharacterFromTemplateResultWireRequiredKeys>
>
type UnexpectedCreateCharacterFromTemplateResultWireOptionalKeys = AssertNever<
  OptionalKeys<CreateCharacterFromTemplateResultWire>
>
type CreateCharacterFromTemplateResultWireShape = Assert<
  IsExact<
    CreateCharacterFromTemplateResultWire,
    {
      characterId: string
    }
  >
>

type CharacterWireAnyKeys = AssertNever<AnyKeys<CharacterWire>>
type CharacterSummaryWireAnyKeys = AssertNever<AnyKeys<CharacterSummaryWire>>
type CharacterDeleteResultWireAnyKeys = AssertNever<AnyKeys<CharacterDeleteResultWire>>
type SaveCharacterSheetResultWireAnyKeys = AssertNever<AnyKeys<SaveCharacterSheetResultWire>>
type CreateCharacterFromTemplateResultWireAnyKeys = AssertNever<AnyKeys<CreateCharacterFromTemplateResultWire>>
type CharacterHubWireAnyKeys = AssertNever<AnyKeys<CharacterHubWire>>
type CharacterSheetStateWireAnyKeys = AssertNever<AnyKeys<CharacterSheetStateWire>>
type CharacterTemplatePinWireAnyKeys = AssertNever<AnyKeys<CharacterTemplatePinWire>>
type CharacterRollPaletteEntryWireAnyKeys = AssertNever<
  AnyKeys<Extract<CharacterPaletteEntryWire, { kind: 'roll' }>>
>
type CharacterResourcePaletteEntryWireAnyKeys = AssertNever<
  AnyKeys<Extract<CharacterPaletteEntryWire, { kind: 'resource' }>>
>
type CharacterAttributeValueWireAnyKeys = AssertNever<AnyKeys<CharacterAttributeValueWire>>

describe('character wire key contract', () => {
  it('コンパイル時のキー集合・any 混入固定を通過する', () => {
    expect(true).toBe(true)
  })
})
