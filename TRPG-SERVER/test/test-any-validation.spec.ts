// テストファイルでのany使用許容確認用

describe('Any Usage in Test Files', () => {
  it('should allow any type usage in test files', () => {
    // 以下のany使用がlintエラーにならないことを確認
    const mockData: any = {
      id: 1,
      name: 'test',
      value: 42
    }

    const mockFunction = jest.fn((param: any) => param)

    const result = mockFunction(mockData)

    expect(result).toBe(mockData)
    expect(mockFunction).toHaveBeenCalledWith(mockData)
  })

  it('should allow unsafe operations in test files', () => {
    const mockObject: any = {
      nested: {
        deeply: {
          value: 'test-value'
        }
      }
    }

    // これらの操作がlintエラーにならないことを確認
    const value1 = mockObject.nested.deeply.value
    const value2 = mockObject.nonExistentProperty?.someMethod?.()
    const value3 = mockObject['dynamic-property']

    expect(value1).toBe('test-value')
    expect(value2).toBeUndefined()
    expect(value3).toBeUndefined()
  })

  it('should allow any in mock factory pattern', () => {
    const createMockUser = (overrides: any = {}) => ({
      id: 'default-id',
      name: 'default-name',
      ...overrides
    })

    const mockUser = createMockUser({
      id: 'custom-id',
      customProperty: 'custom-value'
    })

    expect(mockUser.id).toBe('custom-id')
    expect(mockUser.name).toBe('default-name')
    expect(mockUser.customProperty).toBe('custom-value')
  })

  it('should allow any in test helper functions', () => {
    const testHelper = {
      assertValue: (actual: any, expected: any) => {
        expect(actual).toEqual(expected)
      },

      mockMethod: jest.fn().mockImplementation((args: any) => args),

      createTestData: (): any => ({
        complexStructure: {
          arrays: [1, 2, 3],
          objects: { nested: true },
          functions: () => 'test'
        }
      })
    }

    const testData = testHelper.createTestData()
    testHelper.assertValue(testData.complexStructure.arrays.length, 3)
    testHelper.mockMethod({ test: 'data' })

    expect(testHelper.mockMethod).toHaveBeenCalled()
  })
})
