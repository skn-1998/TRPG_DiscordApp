import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { AuthService } from '../services/auth.service'

/**
 * JWT認証ガード
 * リクエストのAuthorizationヘッダーからJWTトークンを検証する
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const authorization = request.headers.authorization

    if (!authorization) {
      throw new UnauthorizedException('認証ヘッダーが必要です')
    }

    try {
      const tokenPayload = await this.authService.validateToken(authorization)
      request.user = tokenPayload
      return true
    } catch (error) {
      throw new UnauthorizedException('無効な認証トークンです')
    }
  }
}
