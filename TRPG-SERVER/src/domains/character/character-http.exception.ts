import { HttpStatus } from '@nestjs/common'
import { ApiError } from '../../core/http'

/**
 * 認証欠落（変換前の UnauthorizedException → authenticationError）を表す例外。
 *
 * userMessage は HttpExceptionFilter が作る ErrorResponse の error フィールドへ反映される。
 * errorPayload は文字列なので stack は development でも undefined となり、旧 wire 封筒を維持する。
 */
export class CharacterAuthenticationException extends ApiError {
  readonly userMessage: string

  constructor(userMessage: string) {
    super(HttpStatus.UNAUTHORIZED, '認証エラー', userMessage, 'AUTHENTICATION_ERROR')
    this.userMessage = userMessage
  }
}

/**
 * リソース未発見（変換前の notFoundError(res, resource)）を表す例外。
 *
 * resource から作る文字列は HttpExceptionFilter が ErrorResponse の error へ反映する。
 * errorPayload は文字列なので stack は development でも undefined となり、旧 wire 封筒を維持する。
 */
export class CharacterNotFoundException extends ApiError {
  readonly resource: string

  constructor(resource: string) {
    super(HttpStatus.NOT_FOUND, '未発見エラー', `${resource}が見つかりません`, 'NOT_FOUND_ERROR')
    this.resource = resource
  }
}
