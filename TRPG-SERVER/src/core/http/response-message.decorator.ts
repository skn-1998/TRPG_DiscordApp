import { SetMetadata } from '@nestjs/common'

/**
 * 成功レスポンスの message を指定するデコレータ。
 *
 * ResponseInterceptor がこのメタデータを読み取り、SuccessResponse.message に反映する。
 * 未指定の場合は ApiResponseUtil.success のデフォルトと同じ '成功' が使われる。
 */
export const RESPONSE_MESSAGE_KEY = 'response:message'

export const ResponseMessage = (message: string): MethodDecorator => SetMetadata(RESPONSE_MESSAGE_KEY, message)
