import { SetMetadata } from '@nestjs/common'

/**
 * ResponseInterceptor による封筒化をスキップするマーカー。
 *
 * 変換前から envelope を作っていない（= 素のレスポンス / redirect を返す）ハンドラに付与する。
 * 例: @Res() で res.redirect() を行う discordLoginCallback、
 *     何も返さない discordLogin。
 *
 * これらのハンドラは挙動保存のため戻り値の封筒化を行わない。
 */
export const SKIP_RESPONSE_WRAPPER_KEY = 'response:skipWrapper'

export const SkipResponseWrapper = (): MethodDecorator => SetMetadata(SKIP_RESPONSE_WRAPPER_KEY, true)
