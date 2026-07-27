import type { UserProfileWire } from '@trpg/api-contract'
import type { UserOutputDto } from './dto/update-user.dto'

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

type Assert<Condition extends true> = Condition

type UserOutputDtoMatchesWire = Assert<IsExact<UserOutputDto, UserProfileWire>>

describe('user output contract', () => {
  it('UserOutputDto と UserProfileWire の双方向等値を通過する', () => {
    expect(true).toBe(true)
  })
})
