import { json, LoaderFunctionArgs } from '@remix-run/node'
import { loginOrRegisterUser } from '~/utils/axiosClient'
import { redirect } from "@remix-run/node"
import _ from 'lodash'
import cookie from 'cookie'
import { CustomError } from '~/utils/customError'
const {isUndefined} = _;

export async function loginLoader({ request }: LoaderFunctionArgs) {
  const client_id = process.env.DISCORD_APPLICATIONID

  // const redirect_url = (process.env.HOST_DOMAIN || 'http://localhost') + '/login'
  const redirect_url = (process.env.HOST_DOMAIN || 'http://localhost:5173') + '/login'
  const redirect_uri = encodeURIComponent(redirect_url)
  const discordAuthUrl = `https://discord.com/oauth2/authorize?client_id=${client_id}&response_type=code&redirect_uri=${redirect_uri}&scope=identify`

  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code') || ''
  if (code !== '') {
    const userInfo = (await loginOrRegisterUser(code))
    if(isUndefined(userInfo.token)) throw new Error("jwtToken is not Exist")
    const cookieHeader = saveJwtToken(userInfo.token)
    return redirect('/user', {
      status: 301,
      headers: {
        ...cookieHeader
      }
    })
  }

  return json({ discordAuthUrl })
}



export type header = {
  'Set-Cookie': string
  'Content-Type': 'application/json'
}


export function saveJwtToken(jwt:string):header
{
  try{
    
    const cookieHeader =  cookie.serialize('jwt', jwt, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: 60 * 60 * 24 * 7
    })

    const cookieHeaders: header = {
      'Content-Type': 'application/json',
      'Set-Cookie': cookieHeader
    }

    return cookieHeaders
  } catch (e: unknown) {
    throw new Error(CustomError(e))
  }
}