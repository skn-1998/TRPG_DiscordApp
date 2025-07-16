import { JwtTokenPayload } from '../../domains/auth/models/auth.token.model'

declare module 'express' {
  interface Request {
    user?: JwtTokenPayload
  }
}

// これはモジュールとして認識されるために必要
export {}
