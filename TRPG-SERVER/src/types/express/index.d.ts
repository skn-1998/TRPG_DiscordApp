import { JwtTokenPayload } from '../../domains/auth/models/auth.token.model';

declare global {
  namespace Express {
    interface Request {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      user?: Record<string, unknown>;
    }
  }
}

// これはモジュールとして認識されるために必要
export {}; 