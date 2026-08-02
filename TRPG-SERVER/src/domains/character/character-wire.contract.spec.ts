/**
 * runtime 変換は行わず、JSON 直列化の結果が wire と一致することを型で固定する橋。
 * Serialized<T> の Date→string は Express res.json→JSON.stringify→Date.prototype.toJSON→ISO 文字列に対応する。
 * status? の拡幅根拠は character.entity.ts:106-108（lean 経路では旧データの schema default を補完しない）。
 * discordChannelId? の拡幅根拠は create-character.dto.ts:90-92→character.service.ts:89,97-102
 * →repositories/character.repository.ts:74-77（optional 入力を素通しし、永続化前に undefined キーを除去する）。
 */
import type { CharacterSummaryWire, CharacterWire } from '@trpg/api-contract'
import type { ProjectionPaletteEntry } from '@trpg/sheet-projection'
import type { CharacterSummaryDto } from './dto/character-summary.dto'
import type { CharacterEntity, CharacterPaletteEntry } from './models/character.entity'

type Serialized<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Serialized<U>[]
    : T extends object
      ? { [K in keyof T]: Serialized<T[K]> }
      : T

type IsAny<T> = 0 extends 1 & T ? true : false

type IsExact<Actual, Expected> =
  IsAny<Actual> extends true
    ? false
    : IsAny<Expected> extends true
      ? false
      : [Actual] extends [Expected]
        ? [Expected] extends [Actual]
          ? true
          : false
        : false

// このファイルの双方向差分は A | B にまとめず、AssertBothNever の一宣言に収める。
// 差分の union は no-duplicate-type-constituents の auto-fix が never の片側を削除し、単方向化し得る。
type AssertNever<T extends never> = T
type AssertBothNever<A extends never, B extends never> = [A, B]

type OptionalKeys<T> = {
  [Key in keyof T]-?: object extends Pick<T, Key> ? Key : never
}[keyof T]

type MismatchedValueKeys<Actual, Expected> = {
  [Key in keyof Actual & keyof Expected]-?: IsExact<Required<Actual>[Key], Required<Expected>[Key]> extends true
    ? never
    : Key
}[keyof Actual & keyof Expected]

type CharacterPaletteExact = AssertNever<
  IsExact<CharacterPaletteEntry, ProjectionPaletteEntry> extends true ? never : 'Mismatch'
>
// IsExact が見逃す pure optional 追加を、両 variant と入れ子 fieldRef の双方向 optionality 差分で補う。
type CharacterPaletteRollOptionalityMismatches = AssertBothNever<
  Exclude<
    OptionalKeys<Extract<CharacterPaletteEntry, { kind: 'roll' }>>,
    OptionalKeys<Extract<ProjectionPaletteEntry, { kind: 'roll' }>>
  >,
  Exclude<
    OptionalKeys<Extract<ProjectionPaletteEntry, { kind: 'roll' }>>,
    OptionalKeys<Extract<CharacterPaletteEntry, { kind: 'roll' }>>
  >
>
type CharacterPaletteResourceOptionalityMismatches = AssertBothNever<
  Exclude<
    OptionalKeys<Extract<CharacterPaletteEntry, { kind: 'resource' }>>,
    OptionalKeys<Extract<ProjectionPaletteEntry, { kind: 'resource' }>>
  >,
  Exclude<
    OptionalKeys<Extract<ProjectionPaletteEntry, { kind: 'resource' }>>,
    OptionalKeys<Extract<CharacterPaletteEntry, { kind: 'resource' }>>
  >
>
type CharacterPaletteFieldRefOptionalityMismatches = AssertBothNever<
  Exclude<OptionalKeys<CharacterPaletteEntry['fieldRef']>, OptionalKeys<ProjectionPaletteEntry['fieldRef']>>,
  Exclude<OptionalKeys<ProjectionPaletteEntry['fieldRef']>, OptionalKeys<CharacterPaletteEntry['fieldRef']>>
>
type CharacterPaletteValueTypeMismatches = AssertNever<
  MismatchedValueKeys<CharacterPaletteEntry, ProjectionPaletteEntry>
>

type SerializedCharacter = Serialized<CharacterEntity>
type CharacterPayloadWire = Omit<CharacterWire, '_id' | '__v'>

// CharacterEntity と mongoose メタを除く CharacterWire のフィールド増減を双方向に検出する。
type CharacterPayloadKeyMismatches = AssertBothNever<
  Exclude<keyof SerializedCharacter, keyof CharacterPayloadWire>,
  Exclude<keyof CharacterPayloadWire, keyof SerializedCharacter>
>

// JSON 直列化後の共通フィールド値型が optionality を除いて一致することを守る。
type CharacterPayloadValueTypeMismatches = AssertNever<MismatchedValueKeys<SerializedCharacter, CharacterPayloadWire>>

// wire 側だけ optional にできるフィールドを discordChannelId と status の二つへ限定する。
type CharacterWireOnlyOptionalKeys = Exclude<OptionalKeys<CharacterPayloadWire>, OptionalKeys<SerializedCharacter>>
type AllowedCharacterWireOnlyOptionalKeys = 'discordChannelId' | 'status'

// entity 側だけの optional を禁止し、wire 側だけの optional は許可した二つとの完全一致を要求する。
type CharacterPayloadOptionalityMismatches = AssertBothNever<
  Exclude<OptionalKeys<SerializedCharacter>, OptionalKeys<CharacterPayloadWire>>,
  IsExact<CharacterWireOnlyOptionalKeys, AllowedCharacterWireOnlyOptionalKeys> extends true
    ? never
    : 'CharacterWireOnlyOptionalKeysMismatch'
>

// mongoose メタは payload 比較から除外するため、wire 側の値型を個別に固定する。
type CharacterWireMetadataValueTypeMismatches = AssertNever<
  MismatchedValueKeys<CharacterWire, { _id?: string; __v?: number }>
>

// 未保証パス: CharacterSheetState.values は Record<string, unknown> のため、JSON 安全な値かは型・schema とも保証しない。

// repository/service が公開する summary payload と CharacterSummaryWire の双方向等値を守る。
type SerializedCharacterSummary = Serialized<CharacterSummaryDto>
type CharacterSummaryKeyMismatches = AssertBothNever<
  Exclude<keyof SerializedCharacterSummary, keyof CharacterSummaryWire>,
  Exclude<keyof CharacterSummaryWire, keyof SerializedCharacterSummary>
>
type CharacterSummaryOptionalityMismatches = AssertBothNever<
  Exclude<OptionalKeys<SerializedCharacterSummary>, OptionalKeys<CharacterSummaryWire>>,
  Exclude<OptionalKeys<CharacterSummaryWire>, OptionalKeys<SerializedCharacterSummary>>
>
type CharacterSummaryValueTypeMismatches = AssertNever<
  MismatchedValueKeys<SerializedCharacterSummary, CharacterSummaryWire>
>

describe('character wire contract', () => {
  it('有効な entity・summary payload と wire の型橋を通過する', () => {
    expect(true).toBe(true)
  })
})
