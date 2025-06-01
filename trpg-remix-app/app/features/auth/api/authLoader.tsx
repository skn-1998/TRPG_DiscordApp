import { json, LoaderFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { generateDiscordAuthUrl, loginOrRegisterUser, saveJwtToken as saveJwtTokenService } from './auth.service'
import _ from 'lodash'

const { isUndefined } = _

export async function loginLoader({ request }: LoaderFunctionArgs) {
  const discordAuthUrl = generateDiscordAuthUrl()

  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code') || ''

  if (code !== '') {
    const userInfo = await loginOrRegisterUser(code)
    if (isUndefined(userInfo.token)) throw new Error('jwtToken is not Exist')
    const cookieHeader = saveJwtTokenService(userInfo.token)
    return redirect('/user', {
      status: 301,
      headers: {
        ...cookieHeader
      }
    })
  }

  return json({ discordAuthUrl })
}
