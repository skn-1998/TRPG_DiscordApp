// CharacterChannelCreateService は channel 作成イベントを受け、orchestrator へ委譲する薄い Service。
// 公開 API は execute(channel, categoryId)。副作用境界は ChannelCreateOrchestratorService.execute のみ。
// orchestrator が throw しても握りつぶし（再スローしない）、logger.error でログのみ残す挙動を検証する。
import { Test } from '@nestjs/testing'
import { TextChannel } from 'discord.js'
import { ChannelCreateOrchestratorService } from '../../features/characterEdit/services/channel-create-orchestrator.service'
import { CharacterChannelCreateService } from './character-channel-create.service'

describe('CharacterChannelCreateService', () => {
  let service: CharacterChannelCreateService
  let orchestrator: jest.Mocked<Pick<ChannelCreateOrchestratorService, 'execute'>>

  // 最小の TextChannel スタブ（参照されるのは name のみ）
  const buildChannel = (name = 'test-channel'): TextChannel => ({ name }) as unknown as TextChannel

  beforeEach(async () => {
    orchestrator = { execute: jest.fn() }

    const moduleRef = await Test.createTestingModule({
      providers: [CharacterChannelCreateService, { provide: ChannelCreateOrchestratorService, useValue: orchestrator }]
    }).compile()

    service = moduleRef.get(CharacterChannelCreateService)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('execute', () => {
    it('orchestrator.execute に channel をそのまま渡して1回呼ぶ', async () => {
      // Arrange
      orchestrator.execute.mockResolvedValue(undefined)
      const channel = buildChannel('キャラクターA')

      // Act
      await service.execute(channel, 'category-1')

      // Assert: 副作用（委譲）が channel をそのまま受けて1回起きること
      expect(orchestrator.execute).toHaveBeenCalledTimes(1)
      expect(orchestrator.execute).toHaveBeenCalledWith(channel)
    })

    it('orchestrator が throw しても例外を握りつぶし void で解決する', async () => {
      // Arrange: インスタンスの logger.error を抑止しつつ呼び出しを検証
      const logger = (service as unknown as { logger: { error: (...args: unknown[]) => void } }).logger
      const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => undefined)
      const failure = new Error('orchestrator failed')
      orchestrator.execute.mockRejectedValue(failure)
      const channel = buildChannel()

      // Act & Assert: 再スローせず undefined で解決する
      await expect(service.execute(channel, 'category-1')).resolves.toBeUndefined()
      expect(errorSpy).toHaveBeenCalledTimes(1)
    })
  })
})
