import { Injectable } from '@nestjs/common'
import { Response } from 'express'

@Injectable()
export class CookieService {
  /**
   * JWTなどのセキュアクッキーをセット
   */
  setJwtCookie(res: Response, jwt: string, isProduction: boolean): void {
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? ('none' as const) : ('lax' as const),
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7日間
    }
    res.cookie('jwt', jwt, cookieOptions)
  }

  /**
   * クッキーの削除
   */
  clearJwtCookie(res: Response): void {
    res.clearCookie('jwt', { path: '/' })
  }
}
