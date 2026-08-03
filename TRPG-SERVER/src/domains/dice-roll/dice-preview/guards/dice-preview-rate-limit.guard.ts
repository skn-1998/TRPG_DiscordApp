import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException
} from '@nestjs/common'
import { Request } from 'express'

export const DICE_PREVIEW_RATE_LIMIT_REQUESTS = 10
export const DICE_PREVIEW_RATE_LIMIT_WINDOW_MS = 10_000

type UserRateLimitWindow = {
  startedAt: number
  count: number
}

@Injectable()
export class DicePreviewRateLimitGuard implements CanActivate {
  // NOTE: プロセス内固定窓のため、多インスタンス間では上限を共有しない（現行 deploy は単一インスタンス）。
  private readonly windowsByDiscordUserId = new Map<string, UserRateLimitWindow>()

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>()
    const discordUserId = request.user?.discordUserId
    if (!discordUserId) {
      throw new UnauthorizedException('認証トークンがありません')
    }

    const now = Date.now()
    this.pruneExpiredWindows(now)
    const currentWindow = this.windowsByDiscordUserId.get(discordUserId)
    if (!currentWindow) {
      this.windowsByDiscordUserId.set(discordUserId, { startedAt: now, count: 1 })
      return true
    }

    if (currentWindow.count >= DICE_PREVIEW_RATE_LIMIT_REQUESTS) {
      throw new HttpException('dice preview rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS)
    }

    currentWindow.count += 1
    return true
  }

  private pruneExpiredWindows(now: number): void {
    for (const [discordUserId, window] of this.windowsByDiscordUserId) {
      if (now - window.startedAt >= DICE_PREVIEW_RATE_LIMIT_WINDOW_MS) {
        this.windowsByDiscordUserId.delete(discordUserId)
      }
    }
  }
}
