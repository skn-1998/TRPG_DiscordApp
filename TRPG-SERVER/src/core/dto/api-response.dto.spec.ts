import { ErrorResponse, InternalServerErrorResponse, ValidationErrorResponse } from './api-response.dto'

/**
 * P1-C: ErrorResponse の stack 出し分けを「DTO 内 process.env 判定」から
 * 「生成側が渡す includeStack フラグ」へ移したことの characterization。
 *
 * 旧挙動: process.env.NODE_ENV==='development' のときのみ stack を含める。
 * 新挙動: includeStack（既定 false）が true のときのみ stack を含める。
 * → 生成側（http-exception.filter / character-http.exception）が AppConfigService の
 *   app.environment==='development' を渡すことで、env と等価な出し分けを維持する。
 */
describe('ErrorResponse / InternalServerErrorResponse の stack 出し分け（includeStack）', () => {
  const STACK = 'Error: boom\n    at somewhere'

  describe('ErrorResponse', () => {
    it('includeStack 既定（未指定=false）では stack を含めない', () => {
      const res = new ErrorResponse('err', 'msg', undefined, undefined, STACK, 'req-1')
      expect(res.stack).toBeUndefined()
    })

    it('includeStack=false では stack を含めない', () => {
      const res = new ErrorResponse('err', 'msg', undefined, undefined, STACK, 'req-1', false)
      expect(res.stack).toBeUndefined()
    })

    it('includeStack=true では stack をそのまま含める', () => {
      const res = new ErrorResponse('err', 'msg', undefined, undefined, STACK, 'req-1', true)
      expect(res.stack).toBe(STACK)
    })

    it('includeStack=true でも stack 自体が undefined なら undefined', () => {
      const res = new ErrorResponse('err', 'msg', undefined, undefined, undefined, 'req-1', true)
      expect(res.stack).toBeUndefined()
    })

    it('error / message / errorCode などの他フィールドは従来通り', () => {
      const res = new ErrorResponse('err', 'msg', 'CODE', undefined, STACK, 'req-1', true)
      expect(res.success).toBe(false)
      expect(res.error).toBe('err')
      expect(res.message).toBe('msg')
      expect(res.errorCode).toBe('CODE')
    })
  })

  describe('InternalServerErrorResponse', () => {
    it('includeStack を super へ伝播する（true で stack 含有）', () => {
      const res = new InternalServerErrorResponse('msg', STACK, 'req-1', true)
      expect(res.stack).toBe(STACK)
      expect(res.errorCode).toBe('INTERNAL_SERVER_ERROR')
    })

    it('既定（includeStack 未指定）では stack を含めない', () => {
      const res = new InternalServerErrorResponse('msg', STACK, 'req-1')
      expect(res.stack).toBeUndefined()
    })
  })

  describe('stack を渡さないサブクラス（ValidationErrorResponse 等）', () => {
    it('includeStack に関わらず stack は undefined', () => {
      const res = new ValidationErrorResponse([{ field: 'a', message: 'b' }], 'req-1')
      expect(res.stack).toBeUndefined()
    })
  })
})
