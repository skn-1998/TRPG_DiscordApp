import { createMockChatInputInteraction } from '@discord-test-utils'
import { DiceResultOrchestrator } from './dice-result.orchestrator'
import { DiceRollPaginationService } from '../../../components/pagination/dice-roll-pagination.service'

/**
 * DiceResultOrchestrator は DiceRollPaginationService にのみ依存する委譲オーケストレーター。
 * pagination サービスは副作用の境界としてモックし、execute の各分岐
 * (型ガード / channelId 無し / 空ページ / 正常系) を検証する。
 */
describe('DiceResultOrchestrator', () => {
  let pagination: jest.Mocked<
    Pick<DiceRollPaginationService, 'createPaginatedEmbeds' | 'savePaginationState' | 'createPaginationControls'>
  >
  let orchestrator: DiceResultOrchestrator

  beforeEach(() => {
    pagination = {
      createPaginatedEmbeds: jest.fn(),
      savePaginationState: jest.fn(),
      createPaginationControls: jest.fn()
    }
    orchestrator = new DiceResultOrchestrator(pagination as unknown as DiceRollPaginationService)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('execute', () => {
    it('ChatInputCommand でなければ何もせず deferReply も呼ばない', async () => {
      // Arrange
      const interaction = createMockChatInputInteraction()
      ;(interaction.isChatInputCommand as unknown as jest.Mock).mockReturnValue(false)

      // Act
      await orchestrator.execute(interaction)

      // Assert
      expect(interaction.deferReply).not.toHaveBeenCalled()
      expect(pagination.createPaginatedEmbeds).not.toHaveBeenCalled()
    })

    it('channelId が無い場合は警告メッセージを editReply して終了する', async () => {
      // Arrange
      const interaction = createMockChatInputInteraction({ base: { channelId: '' as never } })

      // Act
      await orchestrator.execute(interaction)

      // Assert
      expect(interaction.deferReply).toHaveBeenCalled()
      expect(interaction.editReply).toHaveBeenCalledWith({
        content: '⚠️ チャンネル情報を取得できませんでした。'
      })
      expect(pagination.createPaginatedEmbeds).not.toHaveBeenCalled()
    })

    it('ページが空なら履歴なしメッセージを editReply して終了する', async () => {
      // Arrange
      const interaction = createMockChatInputInteraction({
        base: { channelId: 'ch-1' },
        options: { getString: jest.fn().mockReturnValue('探索者A') }
      })
      pagination.createPaginatedEmbeds.mockResolvedValue([])

      // Act
      await orchestrator.execute(interaction)

      // Assert
      expect(pagination.createPaginatedEmbeds).toHaveBeenCalledWith('ch-1', '探索者A')
      expect(interaction.editReply).toHaveBeenCalledWith({ content: 'ダイスロール履歴がありません。' })
      expect(pagination.savePaginationState).not.toHaveBeenCalled()
    })

    it('ページがある場合は状態保存・コントロール生成して最終 editReply する', async () => {
      // Arrange
      const pages = [{ title: 'page1' }, { title: 'page2' }] as never
      const controls = [{ type: 1 }] as never
      const interaction = createMockChatInputInteraction({
        base: { channelId: 'ch-2' },
        options: { getString: jest.fn().mockReturnValue('探索者B') }
      })
      ;(interaction.editReply as jest.Mock).mockResolvedValue({ id: 'msg-99' })
      pagination.createPaginatedEmbeds.mockResolvedValue(pages)
      pagination.createPaginationControls.mockResolvedValue(controls)

      // Act
      await orchestrator.execute(interaction)

      // Assert: 1回目の editReply で送信、ID取得
      expect(interaction.editReply).toHaveBeenNthCalledWith(1, { embeds: [pages[0]], components: [] })
      // 状態保存にメッセージIDとページ情報が渡る
      expect(pagination.savePaginationState).toHaveBeenCalledWith('ch-2', 'msg-99', {
        pages,
        totalPages: 2,
        currentPage: 1,
        characterId: '探索者B',
        messageId: 'msg-99'
      })
      // コントロール生成
      expect(pagination.createPaginationControls).toHaveBeenCalledWith('msg-99', 'ch-2', 2)
      // 2回目の editReply でコントロール付き更新
      expect(interaction.editReply).toHaveBeenNthCalledWith(2, { embeds: [pages[0]], components: controls })
    })

    it('characterOption が null なら createPaginatedEmbeds に undefined を渡し characterId も undefined', async () => {
      // Arrange
      const pages = [{ title: 'p' }] as never
      const interaction = createMockChatInputInteraction({
        base: { channelId: 'ch-3' },
        options: { getString: jest.fn().mockReturnValue(null) }
      })
      ;(interaction.editReply as jest.Mock).mockResolvedValue({ id: 'msg-1' })
      pagination.createPaginatedEmbeds.mockResolvedValue(pages)
      pagination.createPaginationControls.mockResolvedValue([] as never)

      // Act
      await orchestrator.execute(interaction)

      // Assert
      expect(pagination.createPaginatedEmbeds).toHaveBeenCalledWith('ch-3', undefined)
      expect(pagination.savePaginationState).toHaveBeenCalledWith(
        'ch-3',
        'msg-1',
        expect.objectContaining({ characterId: undefined })
      )
    })
  })
})
