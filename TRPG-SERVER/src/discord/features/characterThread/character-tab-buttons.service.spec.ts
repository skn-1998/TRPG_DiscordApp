// 本サービスは interaction.channel instanceof ThreadChannel を判定し、ButtonBuilder を実 new するため、
// グローバル jest-setup の discord.js モックを無効化し実挙動を使う。
jest.unmock('discord.js')
jest.mock('discord.js', () => jest.requireActual('discord.js'))

import { Test } from '@nestjs/testing'
import { ThreadChannel } from 'discord.js'
import { createMockButtonInteraction } from '@discord-test-utils'
import { CharacterTabButtonsService } from './character-tab-buttons.service'
import { TypedEventService } from '../../../core/events/typed-event.service'
import { CharacterDisplayService } from './services'

/**
 * CharacterTabButtonsService はボタンインタラクションを受け、スレッド内でのみ
 * CharacterDisplayService.createCharacterEmbed の結果を editReply する handler。
 * CharacterDisplayService を mock で固定し、非ボタン / 非スレッド / Embed有 / Embed無 / 例外 の
 * 各分岐を検証する。ThreadChannel 判定には実 discord.js を使う。
 */
describe('CharacterTabButtonsService', () => {
  let service: CharacterTabButtonsService
  let displayService: jest.Mocked<Pick<CharacterDisplayService, 'createCharacterEmbed' | 'isValidTabType'>>

  // ThreadChannel として instanceof 判定を通すモックチャンネルを生成
  const createThreadChannel = (id = 'channel-123') => {
    const channel = Object.create(ThreadChannel.prototype)
    channel.id = id
    return channel
  }

  // ThreadChannel を channel に持つボタンインタラクションを生成
  const createInteraction = (customId: string, channel: unknown) =>
    createMockButtonInteraction({ customId, base: { channel: channel as never } })

  beforeEach(async () => {
    displayService = {
      createCharacterEmbed: jest.fn(),
      isValidTabType: jest.fn().mockReturnValue(true)
    } as unknown as jest.Mocked<Pick<CharacterDisplayService, 'createCharacterEmbed' | 'isValidTabType'>>

    const moduleRef = await Test.createTestingModule({
      providers: [
        CharacterTabButtonsService,
        { provide: TypedEventService, useValue: { emit: jest.fn(), on: jest.fn() } },
        { provide: CharacterDisplayService, useValue: displayService }
      ]
    }).compile()

    service = moduleRef.get(CharacterTabButtonsService)
  })

  describe('execute', () => {
    it('isButton が false の場合は何もせず return する', async () => {
      // Arrange
      const interaction = createInteraction('character-tab*channel-123*status', createThreadChannel())
      ;(interaction.isButton as unknown as jest.Mock).mockReturnValue(false)

      // Act
      await service.execute(interaction)

      // Assert
      expect(interaction.deferReply).not.toHaveBeenCalled()
      expect(displayService.createCharacterEmbed).not.toHaveBeenCalled()
    })

    it('チャンネルがスレッドでない場合はエラーメッセージを reply して終了する', async () => {
      // Arrange: 通常チャンネル（ThreadChannel ではない）
      const interaction = createInteraction('character-tab*channel-123*status', { id: 'normal' })

      // Act
      await service.execute(interaction)

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith({
        content: 'このコマンドはスレッド内でのみ使用できます',
        ephemeral: true
      })
      expect(interaction.deferReply).not.toHaveBeenCalled()
    })

    it('Embed が取得できた場合は deferReply 後に editReply で Embed を返す', async () => {
      // Arrange
      const embed = { toJSON: () => ({}) } as never
      displayService.createCharacterEmbed.mockResolvedValue(embed)
      const interaction = createInteraction('character-tab*channel-123*status', createThreadChannel())

      // Act
      await service.execute(interaction)

      // Assert: customId から channelId / tabType を解釈して呼び出す
      expect(interaction.deferReply).toHaveBeenCalledTimes(1)
      expect(displayService.createCharacterEmbed).toHaveBeenCalledWith('channel-123', 'status')
      expect(interaction.editReply).toHaveBeenCalledWith({ embeds: [embed] })
    })

    it('Embed が null の場合は「見つかりませんでした」メッセージを editReply する', async () => {
      // Arrange
      displayService.createCharacterEmbed.mockResolvedValue(null)
      const interaction = createInteraction('character-tab*channel-123*skills', createThreadChannel())

      // Act
      await service.execute(interaction)

      // Assert
      expect(interaction.editReply).toHaveBeenCalledWith({
        content: 'キャラクター情報が見つかりませんでした。'
      })
    })

    it('tabType が省略された customId では basic として扱う', async () => {
      // Arrange
      displayService.createCharacterEmbed.mockResolvedValue({ toJSON: () => ({}) } as never)
      const interaction = createInteraction('character-tab*channel-123', createThreadChannel())

      // Act
      await service.execute(interaction)

      // Assert
      expect(displayService.createCharacterEmbed).toHaveBeenCalledWith('channel-123', 'basic')
    })

    it('isValidTabType が false の場合は basic にフォールバックする', async () => {
      // Arrange
      displayService.isValidTabType.mockReturnValue(false)
      displayService.createCharacterEmbed.mockResolvedValue({ toJSON: () => ({}) } as never)
      const interaction = createInteraction('character-tab*channel-123*invalid', createThreadChannel())

      // Act
      await service.execute(interaction)

      // Assert
      expect(displayService.createCharacterEmbed).toHaveBeenCalledWith('channel-123', 'basic')
    })

    it('処理中に例外が発生してもエラーをハンドリングして再スローしない', async () => {
      // Arrange: deferReply 後に Embed 作成で失敗
      displayService.createCharacterEmbed.mockRejectedValue(new Error('boom'))
      const interaction = createInteraction('character-tab*channel-123*status', createThreadChannel())

      // Act & Assert: ErrorHandler が応答するため例外は外に漏れない
      await expect(service.execute(interaction)).resolves.toBeUndefined()
    })
  })
})
