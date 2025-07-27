import { LoaderFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { generateDiscordAuthUrl, loginOrRegisterUser, saveJwtToken as saveJwtTokenService } from './auth.service'
import _ from 'lodash'

const { isUndefined } = _

export async function loginLoader({ request }: LoaderFunctionArgs) {
  const discordAuthUrl = generateDiscordAuthUrl()

  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code') || ''

  if (code !== '') {
    try {
      console.log('🔐 Discord認証コードを受信:', code.substring(0, 10) + '...')

      const userInfo = await loginOrRegisterUser(code)

      // 統合型定義システムでは、成功時はuserInfo.success === trueでuserInfo.authが存在
      if (!userInfo.success) {
        console.error('❌ 認証失敗:', userInfo.message)
        throw new Error('Authentication failed')
      }

      if (isUndefined(userInfo.auth.token)) {
        console.error('❌ JWTトークンが存在しません')
        throw new Error('jwtToken is not Exist')
      }

      console.log('✅ 認証成功 - ユーザー:', userInfo.auth.userName)
      console.log('🍪 フロントエンド側でcookieを設定します')

      const cookieHeader = saveJwtTokenService(userInfo.auth.token)
      return redirect('/user', {
        status: 301,
        headers: {
          ...cookieHeader
        }
      })
    } catch (error) {
      console.error('❌ ログインエラー:', error)
      throw redirect('/login')
    }
  }

  return { discordAuthUrl }
}
