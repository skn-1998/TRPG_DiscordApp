import { ChannelType } from 'discord.js'
import { DiceOrchestratorService } from './dice-orchestrator.service'
import { DiceCalculationService } from './dice-calculation.service'
import dice from 'src/domains/dice-roll/services/bcdice.util'

// dice ユーティリティ(bcdice ラッパ)は副作用の境界なのでモックする
jest.mock('src/domains/dice-roll/services/bcdice.util')
const diceMock = dice as jest.MockedFunction<typeof dice>

/**
 * DiceOrchestratorService は委譲オーケストレーター。
 * 依存サービスはすべて mock し、「正しい引数で委譲先が呼ばれ、戻り値をそのまま返す」ことを検証する。
 * executeBasicNotation / sendToParentChannelBasic / getBasicResultEmoji など
 * 自前ロジックを持つメソッドは挙動を直接検証する。
 */
describe('DiceOrchestratorService', () => {
  let service: DiceOrchestratorService
  let calculationService: jest.Mocked<DiceCalculationService>

  beforeEach(() => {
    // 依存サービスは副作用の境界としてモック(純粋に委譲先呼び出しを検証する)
    calculationService = {
      calculateAndRoll: jest.fn(),
      getResultEmoji: jest.fn(),
      sendToParentChannel: jest.fn()
    } as unknown as jest.Mocked<DiceCalculationService>

    service = new DiceOrchestratorService(calculationService)
  })

  describe('calculateAndRoll', () => {
    it('既定の multiplier=1, modifier=0 で calculationService に委譲し戻り値を返す', async () => {
      // Arrange
      const expected = { roll: 42 } as never
      calculationService.calculateAndRoll.mockResolvedValue(expected)

      // Act
      const result = await service.calculateAndRoll('1d100')

      // Assert
      expect(calculationService.calculateAndRoll).toHaveBeenCalledWith('1d100', 1, 0, undefined)
      expect(result).toBe(expected)
    })

    it('明示した引数(multiplier/modifier/character)をそのまま委譲する', async () => {
      // Arrange
      const character = { id: 'c1' } as never
      const expected = { roll: 7 } as never
      calculationService.calculateAndRoll.mockResolvedValue(expected)

      // Act
      const result = await service.calculateAndRoll('STR', 2, 3, character)

      // Assert
      expect(calculationService.calculateAndRoll).toHaveBeenCalledWith('STR', 2, 3, character)
      expect(result).toBe(expected)
    })
  })

  describe('getResultEmoji', () => {
    it('calculationService.getResultEmoji に委譲し戻り値を返す', () => {
      // Arrange
      const diceResult = { success: true }
      calculationService.getResultEmoji.mockReturnValue('✅')

      // Act
      const result = service.getResultEmoji(diceResult)

      // Assert
      expect(calculationService.getResultEmoji).toHaveBeenCalledWith(diceResult)
      expect(result).toBe('✅')
    })
  })

  describe('sendToParentChannel', () => {
    it('calculationService.sendToParentChannel に委譲する', async () => {
      // Arrange
      const interaction = { id: 'i1' }
      calculationService.sendToParentChannel.mockResolvedValue(undefined)

      // Act
      await service.sendToParentChannel(interaction, 'hello')

      // Assert
      expect(calculationService.sendToParentChannel).toHaveBeenCalledWith(interaction, 'hello')
    })
  })

  describe('executeBasicNotation', () => {
    it('正規化した記法で dice を実行し success:true と結果を返す', async () => {
      // Arrange: "2D100 +10" -> 正規化 "2d100+10"
      const diceResult = { critical: false, fumble: false }
      diceMock.mockResolvedValue(diceResult as never)

      // Act
      const result = await service.executeBasicNotation('2D100 +10', '探索者A')

      // Assert
      expect(diceMock).toHaveBeenCalledWith('2d100+10', 'Cthulhu')
      expect(result).toEqual({
        success: true,
        diceResult,
        description: '2d100+10',
        characterName: '探索者A'
      })
    })

    it('characterName 未指定なら既定"プレイヤー"を返す', async () => {
      // Arrange
      diceMock.mockResolvedValue({ ok: true } as never)

      // Act
      const result = await service.executeBasicNotation('1d100')

      // Assert
      expect(result.characterName).toBe('プレイヤー')
      expect(result.success).toBe(true)
    })

    it('無効なダイス記法は dice を呼ばず success:false を返す', async () => {
      // Act: "abc" はパターン不一致
      const result = await service.executeBasicNotation('abc', '探索者B')

      // Assert
      expect(diceMock).not.toHaveBeenCalled()
      expect(result).toEqual({
        success: false,
        description: '無効なダイス記法: abc',
        characterName: '探索者B'
      })
    })

    it('ダイス個数が上限超過(101d6)は無効として success:false を返す', async () => {
      // Act
      const result = await service.executeBasicNotation('101d6')

      // Assert
      expect(diceMock).not.toHaveBeenCalled()
      expect(result.success).toBe(false)
      expect(result.description).toContain('無効なダイス記法')
    })

    it('dice が falsy を返した場合は実行失敗として success:false を返す', async () => {
      // Arrange
      diceMock.mockResolvedValue(null as never)

      // Act
      const result = await service.executeBasicNotation('1d100')

      // Assert
      expect(result.success).toBe(false)
      expect(result.description).toContain('ダイスロール実行失敗')
    })

    it('dice が例外を投げた場合は計算エラーとして success:false を返す', async () => {
      // Arrange
      diceMock.mockRejectedValue(new Error('boom'))

      // Act
      const result = await service.executeBasicNotation('1d100', '探索者C')

      // Assert
      expect(result).toEqual({
        success: false,
        description: '計算エラー: boom',
        characterName: '探索者C'
      })
    })
  })

  describe('sendToParentChannelBasic', () => {
    it('PublicThread かつ親チャンネルが取得できれば親チャンネルへ送信する', async () => {
      // Arrange
      const parentSend = jest.fn().mockResolvedValue(undefined)
      const parentChannel = {
        isTextBased: jest.fn().mockReturnValue(true),
        send: parentSend
      }
      const interaction = {
        channel: { type: ChannelType.PublicThread, parentId: 'parent-1' },
        client: { channels: { fetch: jest.fn().mockResolvedValue(parentChannel) } }
      }

      // Act
      await service.sendToParentChannelBasic(interaction, 'msg')

      // Assert
      expect(interaction.client.channels.fetch).toHaveBeenCalledWith('parent-1')
      expect(parentSend).toHaveBeenCalledWith({ content: 'msg' })
    })

    it('スレッドでない場合は何も送信しない', async () => {
      // Arrange
      const fetch = jest.fn()
      const interaction = {
        channel: { type: ChannelType.GuildText, parentId: 'parent-1' },
        client: { channels: { fetch } }
      }

      // Act
      await service.sendToParentChannelBasic(interaction, 'msg')

      // Assert
      expect(fetch).not.toHaveBeenCalled()
    })

    it('parentId が無い場合は送信しない', async () => {
      // Arrange
      const fetch = jest.fn()
      const interaction = {
        channel: { type: ChannelType.PublicThread, parentId: null },
        client: { channels: { fetch } }
      }

      // Act
      await service.sendToParentChannelBasic(interaction, 'msg')

      // Assert
      expect(fetch).not.toHaveBeenCalled()
    })

    it('取得チャンネルが TextBased でなければ送信しない', async () => {
      // Arrange
      const parentSend = jest.fn()
      const parentChannel = { isTextBased: jest.fn().mockReturnValue(false), send: parentSend }
      const interaction = {
        channel: { type: ChannelType.PublicThread, parentId: 'parent-1' },
        client: { channels: { fetch: jest.fn().mockResolvedValue(parentChannel) } }
      }

      // Act
      await service.sendToParentChannelBasic(interaction, 'msg')

      // Assert
      expect(parentSend).not.toHaveBeenCalled()
    })

    it('fetch が例外を投げても throw せず握りつぶす', async () => {
      // Arrange
      const interaction = {
        channel: { type: ChannelType.PublicThread, parentId: 'parent-1' },
        client: { channels: { fetch: jest.fn().mockRejectedValue(new Error('fetch failed')) } }
      }

      // Act / Assert: 例外を投げないこと
      await expect(service.sendToParentChannelBasic(interaction, 'msg')).resolves.toBeUndefined()
    })
  })

  describe('getBasicResultEmoji', () => {
    it('旧 API も統一された calculationService.getResultEmoji に委譲する', () => {
      // Arrange: result=3 でも旧マジックナンバー判定はせず、委譲先の結果を使う。
      calculationService.getResultEmoji.mockReturnValue('🎲')

      // Act
      const result = service.getBasicResultEmoji({ rands: [[3]] })

      // Assert
      expect(calculationService.getResultEmoji).toHaveBeenCalledWith({ rands: [[3]] })
      expect(result).toBe('🎲')
    })
  })
})
