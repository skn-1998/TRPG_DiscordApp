import type { DiscordGuildsPayloadWire, DiscordGuildWire, UserProfileWire } from './user.wire'

/**
 * S5a2 で機械固定した server 戻り型と wire 全形の退行を検出する番人。
 */
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

type UserProfileWireShape = Assert<
  IsExact<
    UserProfileWire,
    {
      discordUserId: string
      name: string
      avatarHash?: string | null
      characterIds: string[]
    }
  >
>

type UserProfileWireOptionalKeys = Assert<IsExact<OptionalKeys<UserProfileWire>, 'avatarHash'>>
type UserProfileWireAnyKeys = Assert<IsExact<AnyKeys<UserProfileWire>, never>>

type DiscordGuildWireShape = Assert<
  IsExact<
    DiscordGuildWire,
    {
      id: string
      name: string
      icon: string | null
      owner: boolean
      permissions: string
      features: string[]
    }
  >
>

type DiscordGuildWireOptionalKeys = Assert<IsExact<OptionalKeys<DiscordGuildWire>, never>>
type DiscordGuildWireAnyKeys = Assert<IsExact<AnyKeys<DiscordGuildWire>, never>>

type DiscordGuildsPayloadWireShape = Assert<
  IsExact<
    DiscordGuildsPayloadWire,
    {
      guilds: DiscordGuildWire[]
      count: number
      message: string
    }
  >
>

type DiscordGuildsPayloadWireOptionalKeys = Assert<IsExact<OptionalKeys<DiscordGuildsPayloadWire>, never>>
type DiscordGuildsPayloadWireAnyKeys = Assert<IsExact<AnyKeys<DiscordGuildsPayloadWire>, never>>

describe('user wire key contract', () => {
  it('コンパイル時の全形・optional・any キー固定を通過する', () => {
    expect(true).toBe(true)
  })
})
