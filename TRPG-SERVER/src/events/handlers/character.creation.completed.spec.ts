import { Test } from '@nestjs/testing'
import { CharacterCreationCompletedHandler } from './character.creation.completed'
import { CharacterEmbedManagerService } from '../../discord/features/characterEdit/services/character-embed-manager.service'
import { DiscordClientService } from '../../discord/services/discord-client.service'
import { GlobalEventBusService } from '../bus/global-event-bus.service'
import { TypedEventService } from '../../shared/application/typed-event.service'

// CharacterUIService は構築上 DI トークンとしてのみ必要で、本テストでは一切呼ばない。
// 本体ファイルにスコープ外の既存型エラー（AttributeValue ドリフト等）があるため、
// jest.mock で実体読み込みと型診断を回避してダミーのトークンを得る。
jest.mock('../../discord/features/characterEdit/services/character-ui.service', () => ({
  CharacterUIService: class CharacterUIService {}
}))
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { CharacterUIService } = require('../../discord/features/characterEdit/services/character-ui.service')

/**
 * CharacterCreationCompletedHandler の現状挙動を固定するユニットテスト（T2b 安全網）
 *
 * このハンドラは「生フロー」の橋渡し役。handle(event) を呼ぶと
 *  - discord.notification.requested / discord.embed.update.requested を GlobalEventBus へ emit
 *  - discord.thread.create.requested / discord.character.display.requested を TypedEventService へ emit
 *  - system.audit.logged を GlobalEventBus へ emit
 *  - Discord UI（EmbedManager / DiscordClient）を呼ぶ
 *
 * T2b ではこの「どちらのバスに何を emit するか」が変わる予定のため、現状を assert で記録する。
 * バスを移設したらこのテストの assert を更新し、差分が検出できるようにする。
 */
describe('CharacterCreationCompletedHandler', () => {
  let handler: CharacterCreationCompletedHandler
  let characterUIService: { [k: string]: jest.Mock }
  let embedManager: jest.Mocked<Pick<CharacterEmbedManagerService, 'createSectionedEmbeds'>>
  let discordClientService: jest.Mocked<Pick<DiscordClientService, 'getClient'>>
  let globalEventBus: { emit: jest.Mock }
  let typedEventService: { emit: jest.Mock }

  const baseCharacter = {
    characterId: 'char-1',
    characterName: 'テスト太郎',
    gameSystemId: 'coc',
    discordChannelId: 'ch-1',
    discordUserId: 'user-1',
    threadId: 'thread-1',
    status: {},
    parameter: {},
    skill: {},
    item: {},
    createdAt: new Date(),
    updatedAt: new Date()
  }

  const buildEvent = (characterOverrides: Record<string, any> = {}) => ({
    type: 'character.creation.completed' as const,
    timestamp: new Date(),
    source: 'web',
    characterId: 'char-1',
    character: { ...baseCharacter, ...characterOverrides }
  })

  beforeEach(async () => {
    jest.clearAllMocks()

    characterUIService = {}
    embedManager = {
      createSectionedEmbeds: jest.fn().mockResolvedValue({ embeds: [], components: [] })
    }
    discordClientService = {
      // デフォルトはクライアント無し（UI 送信はスキップされるが致命的ではない）
      getClient: jest.fn().mockReturnValue(null)
    }
    globalEventBus = { emit: jest.fn().mockResolvedValue(true) }
    typedEventService = { emit: jest.fn().mockResolvedValue(undefined) }

    const moduleRef = await Test.createTestingModule({
      providers: [
        CharacterCreationCompletedHandler,
        { provide: CharacterUIService, useValue: characterUIService },
        { provide: CharacterEmbedManagerService, useValue: embedManager },
        { provide: DiscordClientService, useValue: discordClientService },
        { provide: GlobalEventBusService, useValue: globalEventBus },
        { provide: TypedEventService, useValue: typedEventService }
      ]
    }).compile()

    handler = moduleRef.get(CharacterCreationCompletedHandler)
  })

  describe('getEventName', () => {
    it('character.creation.completed を返す', () => {
      expect(handler.getEventName()).toBe('character.creation.completed')
    })
  })

  describe('handle - discordChannelId がある場合（生フロー本流）', () => {
    it('GlobalEventBus へ discord.notification.requested を期待ペイロードで emit する', async () => {
      // Act
      await handler.handle(buildEvent())

      // Assert
      expect(globalEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'discord.notification.requested',
          source: 'system',
          channelId: 'ch-1',
          notification: expect.objectContaining({
            type: 'character.created',
            channelId: 'ch-1',
            characterId: 'char-1'
          })
        })
      )
    })

    it('GlobalEventBus へ discord.embed.update.requested を updateMode=create で emit する', async () => {
      await handler.handle(buildEvent())

      expect(globalEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'discord.embed.update.requested',
          source: 'system',
          channelId: 'ch-1',
          embedData: expect.objectContaining({
            channelId: 'ch-1',
            characterId: 'char-1',
            embedType: 'character',
            updateMode: 'create'
          })
        })
      )
    })

    it('TypedEventService へ discord.thread.create.requested を emit する', async () => {
      await handler.handle(buildEvent())

      expect(typedEventService.emit).toHaveBeenCalledWith(
        'discord.thread.create.requested',
        expect.objectContaining({
          channelId: 'ch-1',
          creatorId: 'user-1',
          displayType: 'enhanced',
          source: 'character-creation-completed-handler'
        })
      )
    })

    it('TypedEventService へ discord.character.display.requested を emit する', async () => {
      await handler.handle(buildEvent())

      expect(typedEventService.emit).toHaveBeenCalledWith(
        'discord.character.display.requested',
        expect.objectContaining({
          channelId: 'ch-1',
          requesterId: 'user-1',
          displayType: 'enhanced',
          source: 'character-creation-completed-handler'
        })
      )
    })

    it('GlobalEventBus へ system.audit.logged を outcome=success で emit する', async () => {
      await handler.handle(buildEvent())

      expect(globalEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'system.audit.logged',
          audit: expect.objectContaining({
            action: 'character.created',
            userId: 'user-1',
            resource: 'character:char-1',
            outcome: 'success'
          })
        })
      )
    })

    it('Discord UI（EmbedManager.createSectionedEmbeds）を呼ぶ', async () => {
      await handler.handle(buildEvent())

      expect(embedManager.createSectionedEmbeds).toHaveBeenCalledTimes(1)
      expect(discordClientService.getClient).toHaveBeenCalled()
    })

    it('emit の振り分けが現状どおり（GlobalEventBus=3件 / TypedEventService=2件）', async () => {
      // T2b でバスを移設したら、この件数 assert を更新して差分を検出する
      await handler.handle(buildEvent())

      const globalTypes = globalEventBus.emit.mock.calls.map((c) => c[0].type)
      const typedEvents = typedEventService.emit.mock.calls.map((c) => c[0])

      expect(globalTypes).toEqual([
        'discord.notification.requested',
        'discord.embed.update.requested',
        'system.audit.logged'
      ])
      expect(typedEvents).toEqual(['discord.thread.create.requested', 'discord.character.display.requested'])
    })
  })

  describe('handle - discordChannelId が無い場合', () => {
    it('通知・Embed・display は emit せず、監査ログのみ GlobalEventBus へ emit する', async () => {
      // Arrange: channelId/threadId 無し
      const event = buildEvent({ discordChannelId: undefined, threadId: undefined })

      // Act
      await handler.handle(event)

      // Assert: 通知/Embed/thread/display は呼ばれない
      const globalTypes = globalEventBus.emit.mock.calls.map((c) => c[0].type)
      expect(globalTypes).toEqual(['system.audit.logged'])
      expect(typedEventService.emit).not.toHaveBeenCalled()
    })

    it('Discord UI（EmbedManager）は呼ばれない', async () => {
      const event = buildEvent({ discordChannelId: undefined, threadId: undefined })

      await handler.handle(event)

      expect(embedManager.createSectionedEmbeds).not.toHaveBeenCalled()
    })
  })

  describe('handle - 統合通知処理でエラーが発生した場合', () => {
    it('GlobalEventBus.emit が失敗すると system.error.occurred を発行し、再スローしない', async () => {
      // Arrange: 最初の emit（notification）で失敗させる
      globalEventBus.emit.mockRejectedValueOnce(new Error('emit failed')).mockResolvedValue(true)
      const event = buildEvent()

      // Act / Assert: handle 自体は完了する（throw しない）
      await expect(handler.handle(event)).resolves.toBeUndefined()

      // エラーイベントが severity=medium で発行されている
      expect(globalEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'system.error.occurred',
          error: expect.objectContaining({
            code: 'CHARACTER_CREATION_NOTIFICATION_ERROR',
            severity: 'medium',
            context: expect.objectContaining({
              characterId: 'char-1',
              eventType: 'character.creation.completed'
            })
          })
        })
      )
    })
  })
})
