// bcdice の StaticLoader は重く非決定的なため、loader.dynamicLoad を固定モックする。
// bcdice.util.ts は「dynamicLoad で得た gameSystem の eval を呼んで返すだけ」の純 wrapper なので、
// 検証対象は「どの gameSystemId をロードするか」「command をそのまま eval に渡すか」
// 「eval の戻り値を透過するか」「dynamicLoad / eval の reject を伝播するか」の4点。
// （E-6e で src/discord/utils/dice.spec.ts から移設・Assert 不変）
const mockDynamicLoad = jest.fn()

jest.mock('bcdice/lib/loader/static_loader', () => {
  // default export のクラスを模した stub。new StaticLoader() で dynamicLoad を持つ
  return jest.fn().mockImplementation(() => ({
    dynamicLoad: mockDynamicLoad
  }))
})

import dice from './bcdice.util'

describe('dice', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('gameSystemId 未指定のときデフォルト DiceBot をロードする', async () => {
    // Arrange
    const evalMock = jest.fn().mockReturnValue('result')
    mockDynamicLoad.mockResolvedValue({ eval: evalMock })

    // Act
    await dice('1d6')

    // Assert
    expect(mockDynamicLoad).toHaveBeenCalledWith('DiceBot')
  })

  it('gameSystemId を指定するとその id がロードされる', async () => {
    // Arrange
    const evalMock = jest.fn().mockReturnValue('result')
    mockDynamicLoad.mockResolvedValue({ eval: evalMock })

    // Act
    await dice('CC<=50', 'Cthulhu')

    // Assert
    expect(mockDynamicLoad).toHaveBeenCalledWith('Cthulhu')
  })

  it('command をそのまま gameSystem.eval に渡す', async () => {
    // Arrange
    const evalMock = jest.fn().mockReturnValue('result')
    mockDynamicLoad.mockResolvedValue({ eval: evalMock })

    // Act
    await dice('2d6+3')

    // Assert
    expect(evalMock).toHaveBeenCalledWith('2d6+3')
    expect(evalMock).toHaveBeenCalledTimes(1)
  })

  it('gameSystem.eval の戻り値をそのまま返す（透過）', async () => {
    // Arrange
    const evalResult = { text: '(1D6) ＞ 3', success: true }
    const evalMock = jest.fn().mockReturnValue(evalResult)
    mockDynamicLoad.mockResolvedValue({ eval: evalMock })

    // Act
    const result = await dice('1d6')

    // Assert
    expect(result).toBe(evalResult)
  })

  it('eval が null を返す場合（コマンド不一致）も透過する', async () => {
    // Arrange
    const evalMock = jest.fn().mockReturnValue(null)
    mockDynamicLoad.mockResolvedValue({ eval: evalMock })

    // Act
    const result = await dice('not-a-command')

    // Assert
    expect(result).toBeNull()
  })

  it('dynamicLoad が reject するとその例外を伝播する（未知のゲームシステム等）', async () => {
    // Arrange
    const loadError = new Error('Unknown game system')
    mockDynamicLoad.mockRejectedValue(loadError)

    // Act & Assert
    await expect(dice('1d6', 'NoSuchSystem')).rejects.toThrow('Unknown game system')
  })

  it('gameSystem.eval が throw するとその例外を伝播する', async () => {
    // Arrange
    const evalError = new Error('eval failed')
    const evalMock = jest.fn().mockImplementation(() => {
      throw evalError
    })
    mockDynamicLoad.mockResolvedValue({ eval: evalMock })

    // Act & Assert
    await expect(dice('1d6')).rejects.toThrow('eval failed')
  })
})
