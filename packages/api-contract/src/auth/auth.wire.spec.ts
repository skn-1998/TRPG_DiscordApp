import type { LoginDataWire } from './auth.wire'

type OptionalKeys<T> = {
  [Key in keyof T]-?: object extends Pick<T, Key> ? Key : never
}[keyof T]

type IsAny<T> = 0 extends 1 & T ? true : false

type AnyKeys<T> = {
  [Key in keyof T]-?: 0 extends 1 & T[Key] ? Key : never
}[keyof T]

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

type LoginDataWireShape = Assert<
  IsExact<
    LoginDataWire,
    {
      message: string
      discordUserId: string
      userName: string
      token: string
      user: {
        id: string
        username: string
        avatar?: string | null
      }
    }
  >
>

type LoginDataWireOptionalKeys = Assert<IsExact<OptionalKeys<LoginDataWire>, never>>
type LoginDataWireAnyKeys = Assert<IsExact<AnyKeys<LoginDataWire>, never>>
type LoginDataWireUserAnyKeys = Assert<IsExact<AnyKeys<LoginDataWire['user']>, never>>

describe('auth wire key contract', () => {
  it('コンパイル時の全形・optional・any キー固定を通過する', () => {
    expect(true).toBe(true)
  })
})
