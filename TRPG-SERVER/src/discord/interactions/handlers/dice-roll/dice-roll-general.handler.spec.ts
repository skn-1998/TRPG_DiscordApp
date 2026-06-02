import { createMockButtonInteraction } from '@discord-test-utils'
import { DiceRollGeneralHandler } from './dice-roll-general.handler'
import { CharacterDiceOrchestratorService } from '../../button/character-dice-orchestrator.service'

describe('DiceRollGeneralHandler', () => {
  const mockService = { execute: jest.fn().mockResolvedValue(undefined) }
  let handler: DiceRollGeneralHandler

  beforeEach(() => {
    jest.clearAllMocks()
    handler = new DiceRollGeneralHandler(mockService as unknown as CharacterDiceOrchestratorService)
  })

  it('button タイプを返す', () => {
    expect(handler.getInteractionType()).toBe('button')
  })

  it('customId パターンはダイス表記にマッチする正規表現', () => {
    // Arrange
    const pattern = handler.getCustomIdPattern()
    // Assert
    expect(pattern).toBeInstanceOf(RegExp)
    expect(pattern.test('roll*1d100')).toBe(true)
    expect(pattern.test('roll*2d6')).toBe(true)
    // スキルロール（_区切り）やcustomにはマッチしない
    expect(pattern.test('roll*custom')).toBe(false)
    expect(pattern.test('roll*戦闘_1234567890')).toBe(false)
  })

  it('execute は委譲先 execute へ interaction を渡す', async () => {
    // Arrange
    const interaction = createMockButtonInteraction({ customId: 'roll*1d100' })
    // Act
    await handler.execute(interaction)
    // Assert
    expect(mockService.execute).toHaveBeenCalledWith(interaction)
    expect(mockService.execute).toHaveBeenCalledTimes(1)
  })

  it('委譲先がrejectした場合はそのエラーを伝播する', async () => {
    // Arrange
    const error = new Error('delegate failed')
    mockService.execute.mockRejectedValueOnce(error)
    const interaction = createMockButtonInteraction({ customId: 'roll*1d100' })
    // Act & Assert
    await expect(handler.execute(interaction)).rejects.toBe(error)
  })
})
