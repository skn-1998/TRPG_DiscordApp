import type { z } from 'zod'
import type { CharacterSheetVisibility, characterEntitySchema } from './character.zod'
import {
  sheetMergeConflictSchema,
  type CharacterAttributeValueWire,
  type CharacterDeleteResultWire,
  type CharacterHubWire,
  type CharacterPaletteEntryWire,
  type CharacterSheetStateWire,
  type CharacterSummaryWire,
  type CharacterTemplatePinWire,
  type CharacterWire,
  type CreateCharacterFromTemplateResultWire,
  type SaveCharacterSheetResultWire,
  type SheetMergeConflictWire
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

type SheetMergeConflictWireShape = Assert<
  IsExact<
    SheetMergeConflictWire,
    {
      characterId: string
      conflicts: Array<{
        path: { fieldUid: string; partsKey?: string }
        current: unknown
        base: unknown
        yours: unknown
      }>
      currentRevision: number
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

type CharacterSheetStateWireShape = Assert<
  IsExact<
    CharacterSheetStateWire,
    {
      templateId: string
      templateVersion: string
      revision: number
      visibility: CharacterSheetVisibility
      values: Record<string, unknown>
    }
  >
>

type CharacterWireAnyKeys = AssertNever<AnyKeys<CharacterWire>>
type CharacterSummaryWireAnyKeys = AssertNever<AnyKeys<CharacterSummaryWire>>
type CharacterDeleteResultWireAnyKeys = AssertNever<AnyKeys<CharacterDeleteResultWire>>
type SaveCharacterSheetResultWireAnyKeys = AssertNever<AnyKeys<SaveCharacterSheetResultWire>>
type SheetMergeConflictWireAnyKeys = AssertNever<AnyKeys<SheetMergeConflictWire>>
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

describe('sheetMergeConflictSchema', () => {
  const validConflict = {
    characterId: 'character-1',
    conflicts: [
      {
        path: { fieldUid: 'uid-score', partsKey: 'base' },
        current: 5,
        base: 3,
        yours: 7
      }
    ],
    currentRevision: 4
  }

  it('cause の将来追加キーを許容し、契約外キーは出力から除外する', () => {
    expect(
      sheetMergeConflictSchema.safeParse({
        diagnostic: 'x',
        ...validConflict
      })
    ).toEqual({ success: true, data: validConflict })
  })

  it('conflicts が空配列なら拒否する', () => {
    expect(sheetMergeConflictSchema.safeParse({ ...validConflict, conflicts: [] }).success).toBe(false)
  })

  it('currentRevision が負数なら拒否する', () => {
    expect(sheetMergeConflictSchema.safeParse({ ...validConflict, currentRevision: -1 }).success).toBe(false)
  })

  it('conflict の path が欠落していれば拒否する', () => {
    expect(
      sheetMergeConflictSchema.safeParse({
        ...validConflict,
        conflicts: [{ current: 5, base: 3, yours: 7 }]
      }).success
    ).toBe(false)
  })

  it('conflict に余剰キーがあれば拒否する', () => {
    expect(
      sheetMergeConflictSchema.safeParse({
        ...validConflict,
        conflicts: [{ ...validConflict.conflicts[0], extra: 1 }]
      }).success
    ).toBe(false)
  })

  it('conflict の current が欠落していれば拒否する', () => {
    expect(
      sheetMergeConflictSchema.safeParse({
        ...validConflict,
        conflicts: [
          {
            path: { fieldUid: 'uid-score', partsKey: 'base' },
            base: 3,
            yours: 7
          }
        ]
      }).success
    ).toBe(false)
  })

  // 欠落拒否を維持しつつ「現在値なし」を明示できるよう、null は wire の有効値として固定する。
  it('conflict の current: null を受理する', () => {
    expect(
      sheetMergeConflictSchema.safeParse({
        ...validConflict,
        conflicts: [{ ...validConflict.conflicts[0], current: null }]
      }).success
    ).toBe(true)
  })
})
