import { ChannelType } from 'discord.js'
import { createMockChatInputInteraction } from '@discord-test-utils'
import { RollDiceOrchestrator } from './roll-dice.orchestrator'
import dice from 'src/domains/dice-roll/services/bcdice.util'
import { getGameSystemIdFromTopic, getParentChannelTopic } from '../utils/channel-topic.util'

// dice(bcdice ラッパ) と topic 解決ユーティリティは副作用の境界なのでモックする
jest.mock('src/domains/dice-roll/services/bcdice.util')
jest.mock('../utils/channel-topic.util')

const diceMock = dice as jest.MockedFunction<typeof dice>
const getGameSystemIdFromTopicMock = getGameSystemIdFromTopic as jest.MockedFunction<typeof getGameSystemIdFromTopic>
const getParentChannelTopicMock = getParentChannelTopic as jest.MockedFunction<typeof getParentChannelTopic>

/**
 * RollDiceOrchestrator は注入依存を持たない。dice / topic ユーティリティを境界モックし、
 * execute の分岐(型ガード / channel 無し / GuildText とスレッドの topic 取得 / dice 結果)を検証する。
 */
describe('RollDiceOrchestrator', () => {
  let orchestrator: RollDiceOrchestrator

  beforeEach(() => {
    orchestrator = new RollDiceOrchestrator()
    getGameSystemIdFromTopicMock.mockReturnValue('Cthulhu')
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('execute', () => {
    it('ChatInputCommand でなければ何もしない', async () => {
      // Arrange
      const interaction = createMockChatInputInteraction()
      ;(interaction.isChatInputCommand as unknown as jest.Mock).mockReturnValue(false)

      // Act
      await orchestrator.execute(interaction)

      // Assert
      expect(diceMock).not.toHaveBeenCalled()
      expect(interaction.reply).not.toHaveBeenCalled()
    })

    it('channel が無い場合は警告を reply して終了する', async () => {
      // Arrange
      const interaction = createMockChatInputInteraction({
        base: { channel: null },
        options: { getString: jest.fn().mockReturnValue('CC<=50') }
      })

      // Act
      await orchestrator.execute(interaction)

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith('⚠️ チャンネルが取得できませんでした。')
      expect(diceMock).not.toHaveBeenCalled()
    })

    it('GuildText チャンネルでは channel.topic から gameSystemId を取得し dice 結果を reply する', async () => {
      // Arrange
      const channel = { type: ChannelType.GuildText, topic: 'game\nID:Cthulhu' }
      const interaction = createMockChatInputInteraction({
        base: { channel: channel as never },
        options: { getString: jest.fn().mockReturnValue('CC<=50') }
      })
      diceMock.mockResolvedValue({ text: '1D100<=50 ＞ 30 ＞ 成功' } as never)

      // Act
      await orchestrator.execute(interaction)

      // Assert: GuildText では topic を直接渡す（getParentChannelTopic は使わない）
      expect(getGameSystemIdFromTopicMock).toHaveBeenCalledWith('game\nID:Cthulhu')
      expect(getParentChannelTopicMock).not.toHaveBeenCalled()
      expect(diceMock).toHaveBeenCalledWith('CC<=50', 'Cthulhu')
      expect(interaction.reply).toHaveBeenCalledWith('1D100<=50 ＞ 30 ＞ 成功')
    })

    it('GuildText 以外では getParentChannelTopic で topic を取得する', async () => {
      // Arrange
      const channel = { type: ChannelType.PublicThread }
      const interaction = createMockChatInputInteraction({
        base: { channel: channel as never },
        options: { getString: jest.fn().mockReturnValue('2d6') }
      })
      getParentChannelTopicMock.mockReturnValue('parent\nID:Cthulhu')
      diceMock.mockResolvedValue({ text: '2D6 ＞ 7' } as never)

      // Act
      await orchestrator.execute(interaction)

      // Assert
      expect(getParentChannelTopicMock).toHaveBeenCalledWith(interaction)
      expect(getGameSystemIdFromTopicMock).toHaveBeenCalledWith('parent\nID:Cthulhu')
      expect(diceMock).toHaveBeenCalledWith('2d6', 'Cthulhu')
      expect(interaction.reply).toHaveBeenCalledWith('2D6 ＞ 7')
    })

    it('dice が null を返した場合は無効コマンドメッセージを reply する', async () => {
      // Arrange
      const channel = { type: ChannelType.GuildText, topic: null }
      const interaction = createMockChatInputInteraction({
        base: { channel: channel as never },
        options: { getString: jest.fn().mockReturnValue('invalid') }
      })
      diceMock.mockResolvedValue(null as never)

      // Act
      await orchestrator.execute(interaction)

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith('無効なコマンドです\ninvalid')
    })
  })
})
