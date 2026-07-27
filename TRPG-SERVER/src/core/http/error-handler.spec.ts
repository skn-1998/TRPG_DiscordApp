import { Logger, HttpException, HttpStatus } from '@nestjs/common'
import { Response } from 'express'
import { ErrorHandler, BackgroundTaskErrorHandler, ErrorContext } from './error-handler'

// Logger のモック
jest.mock('@nestjs/common', () => ({
  ...jest.requireActual('@nestjs/common'),
  Logger: jest.fn().mockImplementation(() => ({
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
    debug: jest.fn()
  }))
}))

describe('ErrorHandler', () => {
  let mockResponse: Partial<Response>

  beforeEach(() => {
    // Response モック
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    }

    // 環境変数をリセット
    process.env.NODE_ENV = 'test'
  })

  describe('handleHttpError', () => {
    const mockContext: ErrorContext = {
      userId: 'test-user-id',
      action: 'test-action'
    }

    it('should handle HttpException correctly', () => {
      const httpError = new HttpException('Test error', HttpStatus.BAD_REQUEST)

      ErrorHandler.handleHttpError(httpError, mockContext, mockResponse as Response)

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST)
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Test error',
        error: 'Test error',
        timestamp: expect.any(String),
        statusCode: HttpStatus.BAD_REQUEST
      })
    })

    it('should handle generic Error correctly', () => {
      const genericError = new Error('Generic error')

      ErrorHandler.handleHttpError(genericError, mockContext, mockResponse as Response)

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR)
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'リクエストの処理中にエラーが発生しました',
        error: 'Generic error',
        timestamp: expect.any(String),
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      })
    })

    it('should hide error details in production (isProduction オプションで判定・脱 process.env)', () => {
      const genericError = new Error('Generic error')

      ErrorHandler.handleHttpError(genericError, mockContext, mockResponse as Response, { isProduction: true })

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'リクエストの処理中にエラーが発生しました',
        error: undefined,
        timestamp: expect.any(String),
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      })
    })

    it('isProduction:false（既定）では error 詳細を露出する', () => {
      const genericError = new Error('Generic error')

      ErrorHandler.handleHttpError(genericError, mockContext, mockResponse as Response, { isProduction: false })

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'リクエストの処理中にエラーが発生しました',
        error: 'Generic error',
        timestamp: expect.any(String),
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      })
    })
  })

  describe('handleServiceError', () => {
    const mockContext: ErrorContext = {
      action: 'test-service-action'
    }

    it('should re-throw HttpException', () => {
      const httpError = new HttpException('Service error', HttpStatus.CONFLICT)

      expect(() => {
        ErrorHandler.handleServiceError(httpError, mockContext, 'TestService')
      }).toThrow(HttpException)
    })

    it('should convert generic error to HttpException', () => {
      const genericError = new Error('Generic service error')

      expect(() => {
        ErrorHandler.handleServiceError(genericError, mockContext, 'TestService')
      }).toThrow(HttpException)

      expect(() => {
        ErrorHandler.handleServiceError(genericError, mockContext, 'TestService')
      }).toThrow('サービス処理中にエラーが発生しました')
    })
  })

  describe('extractErrorMessage', () => {
    it('should extract message from Error object', () => {
      const error = new Error('Test error message')
      const result = (ErrorHandler as any).extractErrorMessage(error)
      expect(result).toBe('Test error message')
    })

    it('should return string error as is', () => {
      const error = 'String error'
      const result = (ErrorHandler as any).extractErrorMessage(error)
      expect(result).toBe('String error')
    })

    it('should stringify object error', () => {
      const error = { code: 'ERROR_CODE', details: 'Error details' }
      const result = (ErrorHandler as any).extractErrorMessage(error)
      expect(result).toBe('{"code":"ERROR_CODE","details":"Error details"}')
    })
  })

  describe('sanitizeAdditionalData', () => {
    it('should sanitize sensitive data', () => {
      const data = {
        token: 'secret-token',
        password: 'secret-password',
        normalData: 'normal-value',
        discordAccessToken: 'discord-token'
      }

      const result = (ErrorHandler as any).sanitizeAdditionalData(data)

      expect(result).toEqual({
        token: '[REDACTED]',
        password: '[REDACTED]',
        normalData: 'normal-value',
        discordAccessToken: '[REDACTED]'
      })
    })

    it('should not modify data without sensitive keys', () => {
      const data = {
        normalData: 'normal-value',
        userId: 'user-123'
      }

      const result = (ErrorHandler as any).sanitizeAdditionalData(data)

      expect(result).toEqual(data)
    })
  })

  describe('isCriticalError', () => {
    it('should identify critical errors', () => {
      const databaseError = new Error('Database connection failed')
      const authError = new Error('Authentication failed')
      const timeoutError = new Error('Request timeout')

      expect((ErrorHandler as any).isCriticalError(databaseError)).toBe(true)
      expect((ErrorHandler as any).isCriticalError(authError)).toBe(true)
      expect((ErrorHandler as any).isCriticalError(timeoutError)).toBe(true)
    })

    it('should identify non-critical errors', () => {
      const validationError = new Error('Invalid input')
      const stringError = 'Simple error'

      expect((ErrorHandler as any).isCriticalError(validationError)).toBe(false)
      expect((ErrorHandler as any).isCriticalError(stringError)).toBe(false)
    })
  })

  describe('getErrorStats', () => {
    it('should return empty stats object', () => {
      const stats = ErrorHandler.getErrorStats()
      expect(stats).toEqual({})
    })
  })
})

describe('BackgroundTaskErrorHandler', () => {
  let mockLogger: jest.Mocked<Logger>

  beforeEach(() => {
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      log: jest.fn(),
      debug: jest.fn()
    } as any
    ;(BackgroundTaskErrorHandler as any).logger = mockLogger
    ;(ErrorHandler as any).logger = mockLogger
  })

  describe('handleBackgroundError', () => {
    it('should handle background task error', () => {
      const error = new Error('Background task error')
      const taskName = 'test-task'
      const context: ErrorContext = { userId: 'user-123' }

      BackgroundTaskErrorHandler.handleBackgroundError(error, taskName, context)

      // バックグラウンドタスクエラーが正常にハンドリングされることを確認
      expect(() => {
        BackgroundTaskErrorHandler.handleBackgroundError(error, taskName, context)
      }).not.toThrow()
    })

    it('should handle background task error with empty context', () => {
      const error = new Error('Background task error')
      const taskName = 'test-task'

      expect(() => {
        BackgroundTaskErrorHandler.handleBackgroundError(error, taskName)
      }).not.toThrow()
    })

    it('should not throw error for background tasks', () => {
      const error = new Error('Background task error')
      const taskName = 'test-task'

      expect(() => {
        BackgroundTaskErrorHandler.handleBackgroundError(error, taskName)
      }).not.toThrow()
    })
  })
})
