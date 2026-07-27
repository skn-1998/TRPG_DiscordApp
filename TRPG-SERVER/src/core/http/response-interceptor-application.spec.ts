import { INTERCEPTORS_METADATA } from '@nestjs/common/constants'
import { AuthController } from '../../domains/auth/auth.controller'
import { CharacterController, CharacterSheetController } from '../../domains/character/character.controller'
import { UserController } from '../../domains/user/user.controller'
import { ResponseInterceptor } from './response.interceptor'
import { SKIP_RESPONSE_WRAPPER_KEY } from './skip-response-wrapper.decorator'

/**
 * HTTP 封筒を公開する controller と、封筒化を除外する auth handler の metadata 契約を固定する。
 */
describe('ResponseInterceptor application', () => {
  const getInterceptors = (target: object): unknown[] =>
    (Reflect.getMetadata(INTERCEPTORS_METADATA, target) as unknown[] | undefined) ?? []

  it('Auth/User/Character controller に ResponseInterceptor が適用される', () => {
    expect(getInterceptors(AuthController)).toContain(ResponseInterceptor)
    expect(getInterceptors(UserController)).toContain(ResponseInterceptor)
    expect(getInterceptors(CharacterController)).toContain(ResponseInterceptor)
  })

  it('CharacterSheetController に ResponseInterceptor が適用されない', () => {
    expect(getInterceptors(CharacterSheetController)).not.toContain(ResponseInterceptor)
  })

  it('Discord OAuth の redirect handler は封筒化をスキップする', () => {
    expect(Reflect.getMetadata(SKIP_RESPONSE_WRAPPER_KEY, AuthController.prototype.discordLogin)).toBe(true)
    expect(Reflect.getMetadata(SKIP_RESPONSE_WRAPPER_KEY, AuthController.prototype.discordLoginCallback)).toBe(true)
  })

  it('封筒面 controller の SkipResponseWrapper 付与集合を固定する', () => {
    const envelopeControllers = [AuthController, UserController, CharacterController]
    const skippedHandlerNames = envelopeControllers
      .flatMap((controller) =>
        Object.getOwnPropertyNames(controller.prototype).filter((handlerName) => {
          const handler = Object.getOwnPropertyDescriptor(controller.prototype, handlerName)?.value
          return typeof handler === 'function' && Reflect.getMetadata(SKIP_RESPONSE_WRAPPER_KEY, handler) === true
        })
      )
      .sort()

    expect(skippedHandlerNames).toEqual(['discordLogin', 'discordLoginCallback'])
  })

  it('UserController.getDiscordGuilds は封筒化をスキップしない', () => {
    expect(Reflect.getMetadata(SKIP_RESPONSE_WRAPPER_KEY, UserController.prototype.getDiscordGuilds)).toBeUndefined()
  })
})
