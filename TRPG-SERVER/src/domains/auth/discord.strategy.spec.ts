import { DiscordStrategy } from './discord.strategy'
import { AuthService } from './services/auth.service'
import { DiscordUserProfile } from './models/discord-user.model'
import { AppConfigService } from '../../config/config.service'

/**
 * DiscordStrategy は PassportStrategy 継承クラス。
 * constructor は super 初期化のため AppConfigService.get を必要とするのでモックし、
 * validate は副作用の境界（AuthService）をモックして done コールバックの呼ばれ方を検証する。
 */
describe('DiscordStrategy', () => {
  let strategy: DiscordStrategy
  let authService: jest.Mocked<Pick<AuthService, 'validateDiscordUser'>>
  let getMock: jest.Mock

  beforeEach(() => {
    authService = { validateDiscordUser: jest.fn() }
    // super() が OAuth 設定を読むため get に固定値を返させる。
    // AppConfigService.get はオーバーロードが複雑なので、最小の get を持つオブジェクトを渡す。
    const map: Record<string, string> = {
      'discord.applicationId': 'app-id',
      'discord.secret': 'secret',
      'auth.redirectUrl': 'http://localhost:3000/auth/discord/callback'
    }
    getMock = jest.fn((key: string) => map[key])
    const appConfigService = { get: getMock } as unknown as AppConfigService
    strategy = new DiscordStrategy(authService as unknown as AuthService, appConfigService)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  const profile = { username: 'tester' } as DiscordUserProfile

  describe('validate', () => {
    it('認証成功時は accessToken を user に付与し done(null, user) を呼ぶ', async () => {
      // Arrange
      const user: Record<string, unknown> = { id: 'u1' }
      authService.validateDiscordUser.mockResolvedValue(user as never)
      const done = jest.fn()

      // Act
      await strategy.validate('access-token', 'refresh-token', profile, done)

      // Assert: 委譲先に正しい引数を渡し、accessToken を user に保存し、成功コールバック
      expect(authService.validateDiscordUser).toHaveBeenCalledWith('access-token', 'refresh-token', profile)
      expect(user.accessToken).toBe('access-token')
      expect(done).toHaveBeenCalledWith(null, user)
    })

    it('認証失敗時は done(error, null) を呼ぶ', async () => {
      // Arrange
      const error = new Error('認証拒否')
      authService.validateDiscordUser.mockRejectedValue(error)
      const done = jest.fn()

      // Act
      await strategy.validate('access-token', 'refresh-token', profile, done)

      // Assert
      expect(done).toHaveBeenCalledWith(error, null)
    })
  })
})
