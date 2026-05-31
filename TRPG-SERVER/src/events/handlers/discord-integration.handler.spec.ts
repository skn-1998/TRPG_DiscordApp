import { Test } from '@nestjs/testing'
import { TypedEventService } from '../../shared/application/typed-event.service'
import { DiscordIntegrationHandler } from './discord-integration.handler'

/**
 * DiscordIntegrationHandler の現状挙動を固定するユニットテスト（T2c 後）
 *
 * T2b で生フロー2件（discord.embed.update.requested / discord.notification.requested）を
 * レガシーバス → TypedEventService へ移設済み。
 * T2c でレガシーバス経由の listen/emit（全て dead）を撤去したため、
 * 残るのは TypedEventService 経由の生フロー2件（ログ記録のみ・バス再発行なし）だけ。
 *
 * モックした typedEventService.on でイベント名→コールバックをキャプチャし、
 * 該当コールバックを直接呼ぶことで挙動を検証する（private を覗かない）。
 */
describe('DiscordIntegrationHandler', () => {
  let handler: DiscordIntegrationHandler
  let typedEventService: { on: jest.Mock }
  // イベント名 → 登録されたハンドラコールバック
  let registered: Map<string, (event: any) => Promise<void> | void>

  beforeEach(async () => {
    jest.clearAllMocks()
    registered = new Map()

    typedEventService = {
      on: jest.fn((eventType: string, cb: (event: any) => Promise<void> | void) => {
        registered.set(eventType, cb)
      })
    }

    const moduleRef = await Test.createTestingModule({
      providers: [DiscordIntegrationHandler, { provide: TypedEventService, useValue: typedEventService }]
    }).compile()

    handler = moduleRef.get(DiscordIntegrationHandler)

    // onModuleInit を実行してハンドラを TypedEventService に登録させる
    handler.onModuleInit()
  })

  describe('onModuleInit / ハンドラ登録', () => {
    it('生フロー2件のみ TypedEventService に登録する（dead なレガシーバス listen は撤去済み）', () => {
      // Assert: 生フロー2件は TypedEventService.on で登録（T2b 移設・T2c 後も維持）
      expect(typedEventService.on).toHaveBeenCalledWith('discord.embed.update.requested', expect.any(Function))
      expect(typedEventService.on).toHaveBeenCalledWith('discord.notification.requested', expect.any(Function))

      // Assert: 登録は上記2件のみ
      expect(typedEventService.on).toHaveBeenCalledTimes(2)
      expect(registered.has('discord.embed.update.requested')).toBe(true)
      expect(registered.has('discord.notification.requested')).toBe(true)
    })
  })

  describe('discord.embed.update.requested ハンドラ', () => {
    it('Embed 更新リクエストを受けてもバスへの再発行は行わない（ログ記録のみ・例外なし）', async () => {
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

      // Act & Assert: 例外なくログ記録のみで完了する
      await expect(cb(event)).resolves.toBeUndefined()
    })
  })

  describe('discord.notification.requested ハンドラ', () => {
    it('通知リクエストを受けてもバスへの再発行は行わない（ログ記録のみ・例外なし）', async () => {
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

      // Act & Assert
      await expect(cb(event)).resolves.toBeUndefined()
    })
  })
})
