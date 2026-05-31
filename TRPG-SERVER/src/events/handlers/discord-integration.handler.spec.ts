import { Test } from '@nestjs/testing'
import { GlobalEventBusService } from '../bus/global-event-bus.service'
import { TypedEventService } from '../../shared/application/typed-event.service'
import { DiscordIntegrationHandler } from './discord-integration.handler'

/**
 * DiscordIntegrationHandler の現状挙動を固定するユニットテスト（T2b 安全網）
 *
 * このハンドラの全メソッドは private で、onModuleInit() でバスに登録される。
 * T2b で生フロー2件（discord.embed.update.requested / discord.notification.requested）は
 * GlobalEventBus → TypedEventService へ移設済み。それ以外の listen は GlobalEventBus のまま。
 *
 * テストでは「どのバスで受けるか」に依存しないよう、モックした on() でイベント名→コールバックを
 * キャプチャし、該当コールバックを直接呼ぶことで挙動を検証する（private を覗かない）。
 * 生フロー2件は typedEventService.on から、それ以外は globalEventBus.on からキャプチャする。
 *
 * assert の中心は「globalEventBus.emit が、どのイベント型で呼ばれた/呼ばれなかったか」。
 * 実コードは Discord 通知/Embed 更新を直接は行わず、監査ログ・メトリクス・エラーイベントの
 * 発行のみを行う点を記録する（＝バスを移設しても挙動は不変）。
 */
describe('DiscordIntegrationHandler', () => {
  let handler: DiscordIntegrationHandler
  let globalEventBus: { emit: jest.Mock; on: jest.Mock }
  let typedEventService: { on: jest.Mock }
  // イベント名 → 登録されたハンドラコールバック（GlobalEventBus / TypedEventService 両方を集約）
  let registered: Map<string, (event: any) => Promise<void> | void>

  beforeEach(async () => {
    jest.clearAllMocks()
    registered = new Map()

    globalEventBus = {
      emit: jest.fn().mockResolvedValue(true),
      on: jest.fn((eventType: string, cb: (event: any) => Promise<void> | void) => {
        registered.set(eventType, cb)
      })
    }
    typedEventService = {
      on: jest.fn((eventType: string, cb: (event: any) => Promise<void> | void) => {
        registered.set(eventType, cb)
      })
    }

    const moduleRef = await Test.createTestingModule({
      providers: [
        DiscordIntegrationHandler,
        { provide: GlobalEventBusService, useValue: globalEventBus },
        { provide: TypedEventService, useValue: typedEventService }
      ]
    }).compile()

    handler = moduleRef.get(DiscordIntegrationHandler)

    // onModuleInit を実行してハンドラを各バスに登録させる
    handler.onModuleInit()
  })

  describe('onModuleInit / ハンドラ登録', () => {
    it('生フロー2件は TypedEventService に、それ以外は GlobalEventBus に登録する', () => {
      // Assert: 生フロー2件は TypedEventService.on で登録（T2b 移設）
      expect(typedEventService.on).toHaveBeenCalledWith('discord.embed.update.requested', expect.any(Function))
      expect(typedEventService.on).toHaveBeenCalledWith('discord.notification.requested', expect.any(Function))

      // Assert: それ以外は GlobalEventBus.on で登録（移設対象外）
      expect(globalEventBus.on).toHaveBeenCalledWith('discord.embed.updated', expect.any(Function))
      expect(globalEventBus.on).toHaveBeenCalledWith('discord.notification.sent', expect.any(Function))
      expect(globalEventBus.on).toHaveBeenCalledWith('discord.integration.error', expect.any(Function))
      expect(globalEventBus.on).toHaveBeenCalledWith('discord.channel.create.requested', expect.any(Function))
      expect(globalEventBus.on).toHaveBeenCalledWith('discord.thread.create.requested', expect.any(Function))

      // Assert: 登録自体は両バス合わせて確認できる
      expect(registered.has('discord.embed.update.requested')).toBe(true)
      expect(registered.has('discord.notification.requested')).toBe(true)
      expect(registered.has('discord.embed.updated')).toBe(true)
      expect(registered.has('discord.notification.sent')).toBe(true)
      expect(registered.has('discord.integration.error')).toBe(true)
      expect(registered.has('discord.channel.create.requested')).toBe(true)
      expect(registered.has('discord.thread.create.requested')).toBe(true)
    })
  })

  describe('discord.embed.update.requested ハンドラ', () => {
    it('Embed 更新リクエストを受けてもバスへの再発行は行わない（ログ記録のみ）', async () => {
      // Arrange
      const cb = registered.get('discord.embed.update.requested')!
      const event = {
        type: 'discord.embed.update.requested',
        timestamp: new Date(),
        source: 'system',
        channelId: 'ch-1',
        embedData: {
          channelId: 'ch-1',
          characterId: 'char-1',
          embedType: 'character',
          updateMode: 'create'
        }
      }

      // Act
      await cb(event)

      // Assert: 現状は emit せずログのみ
      expect(globalEventBus.emit).not.toHaveBeenCalled()
    })
  })

  describe('discord.notification.requested ハンドラ', () => {
    it('通知リクエストを受けてもバスへの再発行は行わない（ログ記録のみ）', async () => {
      // Arrange
      const cb = registered.get('discord.notification.requested')!
      const event = {
        type: 'discord.notification.requested',
        timestamp: new Date(),
        source: 'system',
        channelId: 'ch-1',
        notification: {
          type: 'character.created',
          channelId: 'ch-1',
          title: 'タイトル',
          message: 'メッセージ'
        }
      }

      // Act
      await cb(event)

      // Assert
      expect(globalEventBus.emit).not.toHaveBeenCalled()
    })
  })

  describe('discord.embed.updated ハンドラ', () => {
    it('成功した Embed 更新完了ではエラーイベントを発行しない', async () => {
      // Arrange
      const cb = registered.get('discord.embed.updated')!
      const event = {
        type: 'discord.embed.updated',
        timestamp: new Date(),
        source: 'discord',
        embed: {
          messageId: 'msg-1',
          channelId: 'ch-1',
          characterId: 'char-1',
          embedType: 'character',
          success: true
        }
      }

      // Act
      await cb(event)

      // Assert
      expect(globalEventBus.emit).not.toHaveBeenCalled()
    })

    it('失敗した Embed 更新完了では discord.integration.error を発行する', async () => {
      // Arrange
      const cb = registered.get('discord.embed.updated')!
      const event = {
        type: 'discord.embed.updated',
        timestamp: new Date(),
        source: 'discord',
        embed: {
          messageId: 'msg-1',
          channelId: 'ch-1',
          characterId: 'char-1',
          embedType: 'character',
          success: false
        }
      }

      // Act
      await cb(event)

      // Assert: エラーイベントが発行され、コード/オペレーションが固定されている
      expect(globalEventBus.emit).toHaveBeenCalledTimes(1)
      expect(globalEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'discord.integration.error',
          source: 'discord',
          error: expect.objectContaining({
            code: 'EMBED_UPDATE_FAILED',
            operation: 'embed.update',
            details: { characterId: 'char-1', embedType: 'character' }
          })
        })
      )
    })
  })

  describe('discord.notification.sent ハンドラ', () => {
    it('成功した通知送信完了ではエラーイベントを発行しない', async () => {
      // Arrange
      const cb = registered.get('discord.notification.sent')!
      const event = {
        type: 'discord.notification.sent',
        timestamp: new Date(),
        source: 'discord',
        notification: {
          messageId: 'msg-1',
          channelId: 'ch-1',
          type: 'character.created',
          success: true
        }
      }

      // Act
      await cb(event)

      // Assert
      expect(globalEventBus.emit).not.toHaveBeenCalled()
    })

    it('失敗した通知送信完了では discord.integration.error を発行する', async () => {
      // Arrange
      const cb = registered.get('discord.notification.sent')!
      const event = {
        type: 'discord.notification.sent',
        timestamp: new Date(),
        source: 'discord',
        notification: {
          messageId: 'msg-1',
          channelId: 'ch-1',
          type: 'character.created',
          success: false
        }
      }

      // Act
      await cb(event)

      // Assert
      expect(globalEventBus.emit).toHaveBeenCalledTimes(1)
      expect(globalEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'discord.integration.error',
          source: 'discord',
          error: expect.objectContaining({
            code: 'NOTIFICATION_SEND_FAILED',
            operation: 'notification.send',
            details: { notificationType: 'character.created' }
          })
        })
      )
    })
  })

  describe('discord.integration.error ハンドラ', () => {
    it('統合エラーを受けると system.error.occurred を severity=high で発行する', async () => {
      // Arrange
      const cb = registered.get('discord.integration.error')!
      const event = {
        type: 'discord.integration.error',
        timestamp: new Date(),
        source: 'discord',
        error: {
          code: 'EMBED_UPDATE_FAILED',
          message: 'failure',
          operation: 'embed.update',
          details: { characterId: 'char-1' }
        }
      }

      // Act
      await cb(event)

      // Assert: システムエラーへ変換して発行
      expect(globalEventBus.emit).toHaveBeenCalledTimes(1)
      expect(globalEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'system.error.occurred',
          source: 'system',
          error: expect.objectContaining({
            code: 'EMBED_UPDATE_FAILED',
            message: 'failure',
            severity: 'high',
            context: { operation: 'embed.update', details: { characterId: 'char-1' } }
          })
        })
      )
    })
  })

  describe('discord.channel.create.requested ハンドラ', () => {
    it('チャンネル作成リクエストで監査ログとパフォーマンスメトリクスを発行する', async () => {
      // Arrange
      const cb = registered.get('discord.channel.create.requested')!
      const event = {
        type: 'discord.channel.create.requested',
        timestamp: new Date(),
        source: 'system',
        userId: 'user-1',
        guildId: 'guild-1',
        characterId: 'char-1',
        channelData: { name: 'new-channel', guildId: 'guild-1' }
      }

      // Act
      await cb(event)

      // Assert: 監査ログ + メトリクスの2件
      expect(globalEventBus.emit).toHaveBeenCalledTimes(2)
      expect(globalEventBus.emit).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          type: 'system.audit.logged',
          audit: expect.objectContaining({
            action: 'discord.channel.create.requested',
            userId: 'user-1',
            resource: 'channel:new-channel',
            outcome: 'success'
          })
        })
      )
      expect(globalEventBus.emit).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ type: 'system.performance.metrics.collected' })
      )
    })
  })

  describe('discord.thread.create.requested ハンドラ', () => {
    it('スレッド作成リクエストで監査ログのみ発行する', async () => {
      // Arrange
      const cb = registered.get('discord.thread.create.requested')!
      const event = {
        type: 'discord.thread.create.requested',
        timestamp: new Date(),
        source: 'system',
        userId: 'user-1',
        guildId: 'guild-1',
        channelId: 'ch-1',
        characterId: 'char-1',
        threadData: { name: 'thread-1', channelId: 'ch-1' }
      }

      // Act
      await cb(event)

      // Assert: 監査ログ1件のみ
      expect(globalEventBus.emit).toHaveBeenCalledTimes(1)
      expect(globalEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'system.audit.logged',
          audit: expect.objectContaining({
            action: 'discord.thread.create.requested',
            userId: 'user-1',
            resource: 'thread:thread-1',
            outcome: 'success'
          })
        })
      )
    })
  })
})
