import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common'
import { AuthService } from '../services/auth.service'

/**
 * JWT認証ガード
 * リクエストのAuthorizationヘッダーまたはクッキーからJWTトークンを検証する
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name)

  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()

    // Authorizationヘッダーを確認
    let token = request.headers.authorization
    let tokenSource = 'Authorization header'

    // Authorizationヘッダーがない場合、クッキーを確認
    if (!token && request.cookies?.jwt) {
      token = `Bearer ${request.cookies.jwt}`
      tokenSource = 'HTTP cookie'
    }

    this.logger.debug(`認証トークン取得: ${tokenSource}`)
    this.logger.debug(`取得したトークン: ${token ? token.substring(0, 20) + '...' : 'なし'}`)

    if (!token) {
      this.logger.warn('認証トークンが見つかりません - ヘッダーまたはクッキーが必要です')
      throw new UnauthorizedException('認証ヘッダーまたはクッキーが必要です')
    }

    try {
      const tokenPayload = await this.authService.validateToken(token)
      request.user = tokenPayload
      this.logger.debug(`認証成功 - ユーザー: ${tokenPayload.username}`)
      return true
    } catch (error) {
      this.logger.error(`認証失敗: ${error instanceof Error ? error.message : '不明なエラー'}`)
      throw new UnauthorizedException('無効な認証トークンです')
    }
  }
}
