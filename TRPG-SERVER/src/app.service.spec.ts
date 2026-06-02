import { AppService } from './app.service'

describe('AppService', () => {
  let appService: AppService

  beforeEach(() => {
    appService = new AppService()
  })

  describe('getHello', () => {
    it('"Hello World!" を返す', () => {
      // Act
      const result = appService.getHello()

      // Assert
      expect(result).toBe('Hello World!')
    })
  })
})
