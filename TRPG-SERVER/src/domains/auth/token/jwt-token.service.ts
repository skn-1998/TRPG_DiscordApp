import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { JwtTokenPayload } from '../models/auth.token.model'
import { ErrorHandler } from '../../../core/http/error-handler'

/**
 * JWT トークン検証サービス
 *
 * 目的: JWT の検証（parse / validate）プリミティブを UserService から切り離し、
 *       AuthModule / UserModule のどちらからも利用できる「下位の共通サービス」として提供する。
 *
 * 依存は JwtService（@nestjs/jwt）のみで UserService に依存しないため、
 * このサービスを使う側（JwtAuthGuard / UserController 等）が AuthService → UserService を
 * 引き込んで循環することを防ぐ。
 *
 * NOTE: 検証ロジック・例外・戻り値は AuthService.validateToken / parseJwt から
 *       挙動を変えずに移設している。
 */
@Injectable()
export class JwtTokenService {
  private readonly logger = new Logger(JwtTokenService.name)

  constructor(private readonly jwtService: JwtService) {}

  /**
   * 認証ヘッダーからJWTトークンを検証する
   * @param authorization 認証ヘッダー
   * @returns JWTトークンペイロード
   */
  async validateToken(authorization: string): Promise<JwtTokenPayload> {
    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('認証ヘッダーが無効または欠落しています')
    }

    const jwt = authorization.replace('Bearer ', '')

    try {
      return await this.parseJwt(jwt)
    } catch (error) {
      ErrorHandler.handleServiceError(
        error,
        {
          action: 'validate-token',
          additionalData: { hasAuthorization: !!authorization }
        },
        'JwtTokenService'
      )

      // ErrorHandler.handleServiceError は Error をスローするため、ここには到達しない
      throw new UnauthorizedException('トークンが無効です')
    }
  }

  /**
   * JWTトークンを解析する
   * @param token JWTトークン
   * @returns 解析されたトークンペイロード
   */
  async parseJwt(token: string): Promise<JwtTokenPayload> {
    try {
      const jwt = this.jwtService.verify<JwtTokenPayload>(token)
      this.logger.debug('JWT検証成功')
      return jwt
    } catch (error) {
      if (this.isJwtVerificationError(error)) {
        throw new UnauthorizedException('トークンが無効です')
      }

      ErrorHandler.handleServiceError(
        error,
        {
          action: 'parse-jwt',
          additionalData: { hasToken: !!token }
        },
        'JwtTokenService'
      )

      // ErrorHandler.handleServiceError は Error をスローするため、ここには到達しない
      throw new UnauthorizedException('トークンが無効です')
    }
  }

  private isJwtVerificationError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false
    }

    // jsonwebtoken が Error.name で公開する既知の検証失敗だけを認証失敗にし、予期しない基盤障害と分離する。
    return ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)
  }
}
