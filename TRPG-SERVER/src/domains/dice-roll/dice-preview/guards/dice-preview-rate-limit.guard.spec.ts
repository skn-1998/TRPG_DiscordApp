import { ExecutionContext, HttpException, UnauthorizedException } from '@nestjs/common'
import {
  DICE_PREVIEW_RATE_LIMIT_REQUESTS,
  DICE_PREVIEW_RATE_LIMIT_WINDOW_MS,
  DicePreviewRateLimitGuard
} from './dice-preview-rate-limit.guard'

describe('DicePreviewRateLimitGuard', () => {
  let guard: DicePreviewRateLimitGuard

  beforeEach(() => {
    guard = new DicePreviewRateLimitGuard()
  })

  it('同一 discordUserId の固定窓内10件を許可し、11件目を 429 にする', () => {
    const context = contextFor('user-1')

    for (let count = 0; count < DICE_PREVIEW_RATE_LIMIT_REQUESTS; count += 1) {
      expect(guard.canActivate(context)).toBe(true)
    }

    let exception: unknown
    try {
      guard.canActivate(context)
    } catch (error) {
      exception = error
    }

    expect(exception).toBeInstanceOf(HttpException)
    expect((exception as HttpException).getStatus()).toBe(429)
  })

  it('上限は discordUserId ごとに独立する', () => {
    const firstUser = contextFor('user-1')
    for (let count = 0; count < DICE_PREVIEW_RATE_LIMIT_REQUESTS; count += 1) {
      guard.canActivate(firstUser)
    }

    expect(guard.canActivate(contextFor('user-2'))).toBe(true)
  })

  it('10秒の固定窓が終了すると count をリセットする', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000)
    const context = contextFor('user-1')
    for (let count = 0; count < DICE_PREVIEW_RATE_LIMIT_REQUESTS; count += 1) {
      guard.canActivate(context)
    }

    nowSpy.mockReturnValue(1_000 + DICE_PREVIEW_RATE_LIMIT_WINDOW_MS)

    expect(guard.canActivate(context)).toBe(true)
  })

  it('JWT user が無い場合は 401 にする', () => {
    expect(() => guard.canActivate(contextFor())).toThrow(UnauthorizedException)
  })
})

function contextFor(discordUserId?: string): ExecutionContext {
  const request = discordUserId ? { user: { discordUserId } } : {}
  return {
    switchToHttp: () => ({ getRequest: () => request })
  } as unknown as ExecutionContext
}
