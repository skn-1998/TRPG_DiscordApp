import { UserDefinedDiceTable } from 'bcdice'
import { tableDice } from './tableDice'

// bcdice の UserDefinedDiceTable は内部で乱数を回すのでモックして決定化する。
// コンストラクタに渡るテキストを捕捉し、createTaleDiceText の整形結果を間接検証する。
jest.mock('bcdice', () => {
  return {
    UserDefinedDiceTable: jest.fn()
  }
})

const MockedTable = UserDefinedDiceTable as unknown as jest.Mock

describe('tableDice', () => {
  let rollMock: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    rollMock = jest.fn()
    // new UserDefinedDiceTable(text) が roll() を持つインスタンスを返すよう設定
    MockedTable.mockImplementation(() => ({ roll: rollMock }))
  })

  // コンストラクタに渡された text 引数を取得するヘルパ
  const constructorText = () => MockedTable.mock.calls[0][0] as string

  it('isDirect=true のときは contents[0] をそのままテーブル定義テキストに使う', () => {
    // Arrange
    rollMock.mockReturnValue({ text: '直接結果' })

    // Act
    const result = tableDice('チャンネル', ['直接テキスト', '無視される'], true)

    // Assert
    expect(constructorText()).toBe('直接テキスト')
    expect(result).toBe('直接結果')
  })

  it('isDirect=false のときは createTaleDiceText で整形したテキストを使う', () => {
    rollMock.mockReturnValue({ text: '生成結果' })

    const result = tableDice('運命表', ['A', 'B', 'C'], false)

    // 1行目: チャンネル名 / 2行目: 1dN / 3行目以降: reverse した内容に 1始まりの連番
    expect(constructorText()).toBe('運命表\n1d3\n1:C\n2:B\n3:A')
    expect(result).toBe('生成結果')
  })

  it('content 内の改行は \\n にエスケープされる', () => {
    rollMock.mockReturnValue({ text: 'x' })

    tableDice('表', ['一行目\n二行目'], false)

    // 単一要素なので reverse 後もそのまま、改行は \n（リテラル2文字）に置換される
    expect(constructorText()).toBe('表\n1d1\n1:一行目\\n二行目')
  })

  it('roll() が undefined を返す場合は undefined を返す', () => {
    rollMock.mockReturnValue(undefined)

    const result = tableDice('表', ['A'], false)

    expect(result).toBeUndefined()
  })
})
