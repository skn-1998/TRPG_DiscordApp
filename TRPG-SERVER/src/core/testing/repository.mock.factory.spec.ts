import { RepositoryMockFactory } from './repository.mock.factory'

describe('RepositoryMockFactory', () => {
  const methodNames = ['create', 'findById', 'findAll', 'update', 'remove'] as const

  describe('createMock', () => {
    it('Repository の全メソッドを jest.fn として持つ', () => {
      const mock = RepositoryMockFactory.createMock()

      for (const name of methodNames) {
        expect(jest.isMockFunction(mock[name])).toBe(true)
      }
    })

    it('余計なキーを持たない（5 メソッドのみ）', () => {
      const mock = RepositoryMockFactory.createMock()

      expect(Object.keys(mock).sort()).toEqual([...methodNames].sort())
    })

    it('戻り値を設定していないメソッドは undefined を返す', () => {
      const mock = RepositoryMockFactory.createMock()

      expect(mock.create({})).toBeUndefined()
      expect(mock.findById('id')).toBeUndefined()
      expect(mock.findAll()).toBeUndefined()
      expect(mock.update('id', {})).toBeUndefined()
      expect(mock.remove('id')).toBeUndefined()
    })

    it('呼び出すと呼び出し履歴が記録される', () => {
      const mock = RepositoryMockFactory.createMock<{ id: string }, string>()

      mock.findById('abc')

      expect(mock.findById).toHaveBeenCalledTimes(1)
      expect(mock.findById).toHaveBeenCalledWith('abc')
    })

    it('呼び出すたびに新しい独立したインスタンスを返す', () => {
      const mockA = RepositoryMockFactory.createMock()
      const mockB = RepositoryMockFactory.createMock()

      expect(mockA).not.toBe(mockB)
      expect(mockA.create).not.toBe(mockB.create)
    })

    it('片方のモックの呼び出しはもう片方に影響しない', () => {
      const mockA = RepositoryMockFactory.createMock()
      const mockB = RepositoryMockFactory.createMock()

      mockA.create({})

      expect(mockA.create).toHaveBeenCalledTimes(1)
      expect(mockB.create).not.toHaveBeenCalled()
    })
  })

  describe('createEmptyMock', () => {
    it('Repository の全メソッドを jest.fn として持つ', () => {
      const mock = RepositoryMockFactory.createEmptyMock()

      for (const name of methodNames) {
        expect(jest.isMockFunction(mock[name])).toBe(true)
      }
    })

    it('create は null を解決する', async () => {
      const mock = RepositoryMockFactory.createEmptyMock()

      await expect(mock.create({})).resolves.toBeNull()
    })

    it('findById は null を解決する', async () => {
      const mock = RepositoryMockFactory.createEmptyMock()

      await expect(mock.findById('id')).resolves.toBeNull()
    })

    it('findAll は空配列を解決する', async () => {
      const mock = RepositoryMockFactory.createEmptyMock()

      await expect(mock.findAll()).resolves.toEqual([])
    })

    it('update は null を解決する', async () => {
      const mock = RepositoryMockFactory.createEmptyMock()

      await expect(mock.update('id', {})).resolves.toBeNull()
    })

    it('remove は undefined を解決する', async () => {
      const mock = RepositoryMockFactory.createEmptyMock()

      await expect(mock.remove('id')).resolves.toBeUndefined()
    })

    it('呼び出すたびに新しい独立したインスタンスを返す', () => {
      const mockA = RepositoryMockFactory.createEmptyMock()
      const mockB = RepositoryMockFactory.createEmptyMock()

      expect(mockA).not.toBe(mockB)
      expect(mockA.findAll).not.toBe(mockB.findAll)
    })
  })

  describe('createMockWithData', () => {
    it('Repository の全メソッドを jest.fn として持つ', () => {
      const mock = RepositoryMockFactory.createMockWithData({ id: '1' })

      for (const name of methodNames) {
        expect(jest.isMockFunction(mock[name])).toBe(true)
      }
    })

    it('create は渡したデータを解決する', async () => {
      const data = { id: '1', name: 'foo' }
      const mock = RepositoryMockFactory.createMockWithData(data)

      await expect(mock.create({})).resolves.toBe(data)
    })

    it('findById は渡したデータを解決する', async () => {
      const data = { id: '1', name: 'foo' }
      const mock = RepositoryMockFactory.createMockWithData(data)

      await expect(mock.findById('1')).resolves.toBe(data)
    })

    it('findAll は渡したデータを 1 件含む配列を解決する', async () => {
      const data = { id: '1', name: 'foo' }
      const mock = RepositoryMockFactory.createMockWithData(data)

      await expect(mock.findAll()).resolves.toEqual([data])
    })

    it('update は渡したデータを解決する', async () => {
      const data = { id: '1', name: 'foo' }
      const mock = RepositoryMockFactory.createMockWithData(data)

      await expect(mock.update('1', {})).resolves.toBe(data)
    })

    it('remove は undefined を解決する', async () => {
      const mock = RepositoryMockFactory.createMockWithData({ id: '1' })

      await expect(mock.remove('1')).resolves.toBeUndefined()
    })

    it('呼び出すたびに新しい独立したインスタンスを返す', () => {
      const mockA = RepositoryMockFactory.createMockWithData({ id: '1' })
      const mockB = RepositoryMockFactory.createMockWithData({ id: '2' })

      expect(mockA).not.toBe(mockB)
      expect(mockA.findById).not.toBe(mockB.findById)
    })
  })
})
