import { EventHandler, EventContext, ValidationError, BusinessLogicError, TemporaryError } from './event-handler.base'

/**
 * EventHandler（抽象基底クラス）の現状挙動を固定するユニットテスト
 *
 * 抽象クラスのため、spec 内に最小の具象サブクラス TestHandler を定義して検証する。
 * - execute() パイプライン（validateEvent → handle → 成功ログ）
 * - validateEvent の入力チェック
 * - handleError 経路（非リトライは再スロー / リトライ可能は scheduleRetry で再 execute）
 * - isRetryableError / sanitizeEventForLogging / safeGet / safeSet / getMaxRetries（純粋寄り）
 * - エラークラスの name/code
 *
 * handle・logger は jest で制御し、setTimeout は fakeTimers で制御する。
 */

class TestHandler extends EventHandler<any> {
  public handleMock = jest.fn().mockResolvedValue(undefined)

  getEventName(): string {
    return 'test.event'
  }

  async handle(event: any, context?: EventContext): Promise<void> {
    return this.handleMock(event, context)
  }
}

describe('EventHandler（抽象基底クラス）', () => {
  let handler: TestHandler

  beforeEach(() => {
    jest.clearAllMocks()
    handler = new TestHandler()
    // ログ出力はテスト対象ではないため抑制する
    jest.spyOn((handler as any).logger, 'log').mockImplementation(() => undefined)
    jest.spyOn((handler as any).logger, 'warn').mockImplementation(() => undefined)
    jest.spyOn((handler as any).logger, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('execute / 正常系パイプライン', () => {
    it('validateEvent を通過して handle が呼ばれる', async () => {
      // Arrange
      const event = { type: 'test.event' }

      // Act
      await handler.execute(event)

      // Assert
      expect(handler.handleMock).toHaveBeenCalledTimes(1)
      expect(handler.handleMock).toHaveBeenCalledWith(event, expect.objectContaining({ eventName: 'test.event' }))
    })

    it('context が未指定でも correlationId などが補完される', async () => {
      // Act
      await handler.execute({ type: 'test.event' })

      // Assert
      const ctx = handler.handleMock.mock.calls[0][1]
      expect(ctx.correlationId).toEqual(expect.stringMatching(/^evt_/))
      expect(ctx.handlerName).toBe('TestHandler')
      expect(ctx.eventName).toBe('test.event')
    })
  })

  describe('validateEvent', () => {
    const callValidate = (event: any) => (handler as any).validateEvent(event)

    it('null は ValidationError', async () => {
      await expect(callValidate(null)).rejects.toMatchObject({ name: 'ValidationError' })
    })

    it('undefined は ValidationError', async () => {
      await expect(callValidate(undefined)).rejects.toMatchObject({ name: 'ValidationError' })
    })

    it('オブジェクト以外（文字列）は ValidationError', async () => {
      await expect(callValidate('not-object')).rejects.toMatchObject({
        name: 'ValidationError',
        message: expect.stringContaining('must be an object')
      })
    })

    it('正常なオブジェクトは customValidation を通過して解決する', async () => {
      await expect(callValidate({ type: 'test.event' })).resolves.toBeUndefined()
    })
  })

  describe('handleError 経路（execute 経由）', () => {
    it('非リトライエラーは握りつぶさず再スローする', async () => {
      // Arrange: 通常の Error はリトライ不可
      handler.handleMock.mockRejectedValue(new Error('fatal'))

      // Act & Assert: execute は handleError 内で再スローする
      await expect(handler.execute({ type: 'test.event' })).rejects.toThrow('fatal')
    })

    it('リトライ可能エラーは scheduleRetry で setTimeout 後に再 execute される', async () => {
      // Arrange
      jest.useFakeTimers()
      const timeoutError = new Error('TimeoutError occurred')
      timeoutError.name = 'TimeoutError'
      // 1回目は失敗、2回目（リトライ）は成功させる
      handler.handleMock.mockRejectedValueOnce(timeoutError).mockResolvedValueOnce(undefined)

      // Act: 1回目の execute はリトライをスケジュールして解決する（再スローしない）
      await handler.execute({ type: 'test.event' })
      expect(handler.handleMock).toHaveBeenCalledTimes(1)

      // 指数バックオフの基準遅延（retryCount=0 → 1000ms）を進める
      jest.advanceTimersByTime(1000)
      await Promise.resolve()
      await Promise.resolve()

      // Assert: リトライで再度 handle が呼ばれる
      expect(handler.handleMock).toHaveBeenCalledTimes(2)
      const retryCtx = handler.handleMock.mock.calls[1][1]
      expect(retryCtx.retryCount).toBe(1)

      jest.useRealTimers()
    })

    it('再試行が非リトライエラーで失敗しても拒否を漏らさずデッドレターへ移動する', async () => {
      // Arrange
      jest.useFakeTimers()
      const event = { type: 'test.event' }
      const retryableError = new Error('socket ECONNRESET')
      const terminalError = new BusinessLogicError('CHARACTER_ALREADY_EXISTS')
      handler.handleMock.mockRejectedValueOnce(retryableError).mockRejectedValueOnce(terminalError)
      const moveToDeadLetterQueueSpy = jest.spyOn(handler as any, 'moveToDeadLetterQueue')
      const loggerErrorSpy = (handler as any).logger.error as jest.Mock

      // Act
      await handler.execute(event)
      await jest.advanceTimersByTimeAsync(1000)

      // Assert
      expect(handler.handleMock).toHaveBeenCalledTimes(2)
      expect(moveToDeadLetterQueueSpy).toHaveBeenCalledWith(
        event,
        expect.objectContaining({
          retryCount: 1,
          retryReason: retryableError.message
        }),
        terminalError
      )
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        '🚨 Retry failed permanently for test.event',
        expect.objectContaining({
          eventName: 'test.event',
          error: terminalError.message,
          retryCount: 1
        })
      )

      jest.useRealTimers()
    })

    it('リトライ終端時のデッドレター移動が拒否してもタイマーコールバックは解決する', async () => {
      // Arrange
      const event = { type: 'test.event' }
      const retryableError = new Error('socket ECONNRESET')
      const terminalError = new BusinessLogicError('CHARACTER_ALREADY_EXISTS')
      let retryCallback: (() => Promise<void>) | undefined
      jest.spyOn(global, 'setTimeout').mockImplementation(((callback: () => Promise<void>) => {
        retryCallback = callback
        return {} as ReturnType<typeof setTimeout>
      }) as typeof setTimeout)
      handler.handleMock.mockRejectedValueOnce(retryableError).mockRejectedValueOnce(terminalError)
      const moveToDeadLetterQueueSpy = jest
        .spyOn(handler as any, 'moveToDeadLetterQueue')
        .mockRejectedValue(new Error('dead letter queue failed'))

      await handler.execute(event)
      expect(retryCallback).toBeDefined()

      // Act & Assert
      await expect(retryCallback!()).resolves.toBeUndefined()
      expect(moveToDeadLetterQueueSpy).toHaveBeenCalledWith(
        event,
        expect.objectContaining({ retryCount: 1, retryReason: retryableError.message }),
        terminalError
      )
    })

    it('リトライ終端ログが throw してもタイマーコールバックは解決する', async () => {
      // Arrange
      const event = { type: 'test.event' }
      const retryableError = new Error('socket ECONNRESET')
      const terminalError = new BusinessLogicError('CHARACTER_ALREADY_EXISTS')
      let retryCallback: (() => Promise<void>) | undefined
      jest.spyOn(global, 'setTimeout').mockImplementation(((callback: () => Promise<void>) => {
        retryCallback = callback
        return {} as ReturnType<typeof setTimeout>
      }) as typeof setTimeout)
      handler.handleMock.mockRejectedValueOnce(retryableError).mockRejectedValueOnce(terminalError)
      const moveToDeadLetterQueueSpy = jest.spyOn(handler as any, 'moveToDeadLetterQueue')
      const loggerErrorSpy = (handler as any).logger.error as jest.Mock
      loggerErrorSpy.mockImplementation((message: string) => {
        if (message === '🚨 Retry failed permanently for test.event') {
          throw new Error('terminal logger failed')
        }
      })

      await handler.execute(event)
      expect(retryCallback).toBeDefined()

      // Act & Assert
      await expect(retryCallback!()).resolves.toBeUndefined()
      expect(moveToDeadLetterQueueSpy).toHaveBeenCalledWith(
        event,
        expect.objectContaining({ retryCount: 1, retryReason: retryableError.message }),
        terminalError
      )
    })

    it('最大リトライ回数を超えるとデッドレターへ移動し再 execute しない', async () => {
      // Arrange
      jest.useFakeTimers()
      const timeoutError = new Error('TimeoutError occurred')
      timeoutError.name = 'TimeoutError'
      handler.handleMock.mockRejectedValue(timeoutError)

      // 既定 maxRetries=3。retryCount=3 のコンテキストで実行 → 上限到達
      const context: EventContext = {
        correlationId: 'c1',
        source: 'system',
        timestamp: new Date(),
        retryCount: 3
      }

      // Act
      await handler.execute({ type: 'test.event' }, context)
      jest.advanceTimersByTime(60000)
      await Promise.resolve()

      // Assert: 再実行されない（1回のみ）
      expect(handler.handleMock).toHaveBeenCalledTimes(1)

      jest.useRealTimers()
    })
  })

  describe('isRetryableError', () => {
    const isRetryable = (err: Error) => (handler as any).isRetryableError(err)

    it.each(['NetworkError', 'TimeoutError', 'TemporaryError', 'RateLimitError', 'ServiceUnavailable'])(
      'name=%s はリトライ可',
      (name) => {
        const err = new Error('boom')
        err.name = name
        expect(isRetryable(err)).toBe(true)
      }
    )

    it('メッセージに ECONNRESET を含むとリトライ可', () => {
      expect(isRetryable(new Error('socket ECONNRESET'))).toBe(true)
    })

    it('メッセージに ENOTFOUND を含むとリトライ可', () => {
      expect(isRetryable(new Error('getaddrinfo ENOTFOUND'))).toBe(true)
    })

    it('通常の Error はリトライ不可', () => {
      expect(isRetryable(new Error('普通のエラー'))).toBe(false)
    })
  })

  describe('sanitizeEventForLogging（純粋）', () => {
    const sanitize = (event: any) => (handler as any).sanitizeEventForLogging(event)

    it('機密フィールドを [REDACTED] に置換する', () => {
      const result = sanitize({
        userId: 'u1',
        password: 'pw',
        token: 'tk',
        secret: 's',
        key: 'k',
        authorization: 'bearer'
      })
      expect(result).toEqual({
        userId: 'u1',
        password: '[REDACTED]',
        token: '[REDACTED]',
        secret: '[REDACTED]',
        key: '[REDACTED]',
        authorization: '[REDACTED]'
      })
    })

    it('ネストされた機密フィールドも再帰的に置換する', () => {
      const result = sanitize({ outer: { password: 'pw', name: 'A' } })
      expect(result).toEqual({ outer: { password: '[REDACTED]', name: 'A' } })
    })

    it('配列内のオブジェクトも処理する', () => {
      const result = sanitize({ list: [{ token: 't1' }, { token: 't2' }] })
      expect(result).toEqual({ list: [{ token: '[REDACTED]' }, { token: '[REDACTED]' }] })
    })

    it('オブジェクト以外はそのまま返す', () => {
      expect(sanitize('plain')).toBe('plain')
      expect(sanitize(null)).toBeNull()
    })
  })

  describe('safeGet（純粋）', () => {
    const safeGet = (obj: any, path: string, def: any) => (handler as any).safeGet(obj, path, def)

    it('存在するネストパスの値を返す', () => {
      expect(safeGet({ a: { b: { c: 5 } } }, 'a.b.c', 0)).toBe(5)
    })

    it('存在しないパスは defaultValue を返す', () => {
      expect(safeGet({ a: {} }, 'a.b.c', 'def')).toBe('def')
    })

    it('途中が非オブジェクトでも defaultValue を返す', () => {
      expect(safeGet({ a: 1 }, 'a.b', 'def')).toBe('def')
    })
  })

  describe('safeSet（純粋）', () => {
    const safeSet = (obj: any, path: string, value: any) => (handler as any).safeSet(obj, path, value)

    it('ネストパスへ値を設定する', () => {
      const obj: any = {}
      safeSet(obj, 'a.b.c', 9)
      expect(obj).toEqual({ a: { b: { c: 9 } } })
    })

    it('途中が非オブジェクトなら上書きしてネストを作る', () => {
      const obj: any = { a: 1 }
      safeSet(obj, 'a.b', 'x')
      expect(obj).toEqual({ a: { b: 'x' } })
    })

    it('既存のネストを保ちつつ値を追加する', () => {
      const obj: any = { a: { x: 1 } }
      safeSet(obj, 'a.y', 2)
      expect(obj).toEqual({ a: { x: 1, y: 2 } })
    })
  })

  describe('getMaxRetries', () => {
    it('既定値は 3', () => {
      expect((handler as any).getMaxRetries()).toBe(3)
    })
  })

  describe('エラークラス', () => {
    it('ValidationError は name=ValidationError', () => {
      const err = new ValidationError('msg')
      expect(err.name).toBe('ValidationError')
      expect(err.message).toBe('msg')
      expect(err).toBeInstanceOf(Error)
    })

    it('BusinessLogicError は name と code を持つ', () => {
      const err = new BusinessLogicError('msg', 'SOME_CODE')
      expect(err.name).toBe('BusinessLogicError')
      expect(err.code).toBe('SOME_CODE')
    })

    it('BusinessLogicError の code は省略可', () => {
      const err = new BusinessLogicError('msg')
      expect(err.code).toBeUndefined()
    })

    it('TemporaryError は name=TemporaryError', () => {
      const err = new TemporaryError('msg')
      expect(err.name).toBe('TemporaryError')
    })
  })
})
