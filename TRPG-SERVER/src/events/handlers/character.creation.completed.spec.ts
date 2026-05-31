import { Test } from '@nestjs/testing'
import { CharacterCreationCompletedHandler } from './character.creation.completed'
import { CharacterEmbedManagerService } from '../../discord/features/characterEdit/services/character-embed-manager.service'
import { DiscordClientService } from '../../discord/services/discord-client.service'
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
 * CharacterCreationCompletedHandler の現状挙動を固定するユニットテスト（T2c 後）
 *
 * このハンドラは「生フロー」の橋渡し役。handle(event) を呼ぶと
 *  - discord.notification.requested / discord.embed.update.requested を TypedEventService へ emit（T2b 移設済み）
 *  - discord.thread.create.requested / discord.character.display.requested を TypedEventService へ emit
 *  - Discord UI（EmbedManager / DiscordClient）を呼ぶ
 *
 * T2c でレガシーバスへの dead emit（system.audit.logged / system.error.occurred）を撤去した。
 * 観測可能な挙動（TypedEventService の生フロー・Discord UI 呼び出し）は不変であり、本テストはそれを引き続き保証する。
 */
describe('CharacterCreationCompletedHandler', () => {
  let handler: CharacterCreationCompletedHandler
  let characterUIService: { [k: string]: jest.Mock }
  let embedManager: jest.Mocked<Pick<CharacterEmbedManagerService, 'createSectionedEmbeds'>>
  let discordClientService: jest.Mocked<Pick<DiscordClientService, 'getClient'>>
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
    typedEventService = { emit: jest.fn().mockResolvedValue(undefined) }

    const moduleRef = await Test.createTestingModule({
      providers: [
        CharacterCreationCompletedHandler,
        { provide: CharacterUIService, useValue: characterUIService },
        { provide: CharacterEmbedManagerService, useValue: embedManager },
        { provide: DiscordClientService, useValue: discordClientService },
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
    it('TypedEventService へ discord.notification.requested を期待ペイロードで emit する（T2b 移設）', async () => {
      // Act
      await handler.handle(buildEvent())

      // Assert: payload 内容・依存検証は不変
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'discord.notification.requested',
        expect.objectContaining({
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

    it('TypedEventService へ discord.embed.update.requested を updateMode=create で emit する（T2b 移設）', async () => {
      await handler.handle(buildEvent())

      expect(typedEventService.emit).toHaveBeenCalledWith(
        'discord.embed.update.requested',
        expect.objectContaining({
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

    it('Discord UI（EmbedManager.createSectionedEmbeds）を呼ぶ', async () => {
      await handler.handle(buildEvent())

      expect(embedManager.createSectionedEmbeds).toHaveBeenCalledTimes(1)
      expect(discordClientService.getClient).toHaveBeenCalled()
    })

    it('TypedEventService へ生フロー4件をこの順で emit する', async () => {
      await handler.handle(buildEvent())

      const typedEvents = typedEventService.emit.mock.calls.map((c) => c[0])

      expect(typedEvents).toEqual([
        'discord.notification.requested',
        'discord.thread.create.requested',
        'discord.embed.update.requested',
        'discord.character.display.requested'
      ])
    })
  })

  describe('handle - discordChannelId が無い場合', () => {
    it('通知・Embed・thread・display は一切 emit しない', async () => {
      // Arrange: channelId/threadId 無し
      const event = buildEvent({ discordChannelId: undefined, threadId: undefined })

      // Act
      await handler.handle(event)

      // Assert
      expect(typedEventService.emit).not.toHaveBeenCalled()
    })

    it('Discord UI（EmbedManager）は呼ばれない', async () => {
      const event = buildEvent({ discordChannelId: undefined, threadId: undefined })

      await handler.handle(event)

      expect(embedManager.createSectionedEmbeds).not.toHaveBeenCalled()
    })
  })

  describe('handle - 統合通知処理でエラーが発生した場合', () => {
    it('TypedEventService.emit が失敗しても再スローしない（致命的ではない）', async () => {
      // Arrange: 最初の emit（notification）で失敗させる
      typedEventService.emit.mockRejectedValueOnce(new Error('emit failed')).mockResolvedValue(undefined)
      const event = buildEvent()

      // Act / Assert: handle 自体は完了する（throw しない）
      await expect(handler.handle(event)).resolves.toBeUndefined()
    })
  })
})
