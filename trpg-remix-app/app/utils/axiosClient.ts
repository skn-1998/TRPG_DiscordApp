// import 'dotenv'
import { LoaderFunctionArgs, redirect, json, TypedResponse } from '@remix-run/node'
import axios from 'axios'
import https from 'https'
import { CustomError } from './customError'

const agent = new https.Agent({
  rejectUnauthorized: false
})

export type TRPGUser = {
  message?: string,
  DiscordUserId: string,
  userName: string,
  token?: string
  characterId?:string[]
}

export async function loginOrRegisterUser(code: string): Promise<TRPGUser> {
  try {
    const headers = { 'Content-Type': 'application/json' }
    const corsServerDomain = process.env.SERVER_DOMAIN || 'http://localhost:3000'
    // ログインかjwtを発行して登録
    const res = await axios.post(
      `${corsServerDomain}/auth/login`,
      { code },
      { headers, httpsAgent: agent, withCredentials: true }
    )
    // ユーザー情報(discordUserId, userName)等を返す
    return res.data
  } catch (err: unknown) {
    throw new Error(CustomError(err))
  }
}

export async function validateJWT({ request }: LoaderFunctionArgs): Promise<object> {
  // リクエストからCookieを取得
  const cookie = request.headers.get('Cookie') || ''

  // JWT Cookieが存在するか確認
  const jwtCookie = cookie.split(';').find(cookie => cookie.trim().startsWith('jwt='))
  // console.log(jwtCookie)

  if (!jwtCookie) {
    // Cookieが存在しなければログインページにリダイレクト
    return redirect('/login')
  }
  // JWTの有効性をサーバーに問い合わせる
  const jwt = jwtCookie.split('=')[1]

  const corsServerDomain = process.env.SERVER_DOMAIN || 'http://localhost:3000'
  const verifyUrl = `${corsServerDomain}/trpg-user` // JWT検証用のAPIエンドポイント

  console.log(`verifyUrl: ${verifyUrl}`)

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${jwt}`
  }

  try {
    // console.log(jwt)
    const response = await axios.get(verifyUrl, { headers, httpsAgent: agent, withCredentials: true })
    // console.log(response)
    // console.log('--- response end ---')

    if (!response.data) {
      // JWTが無効ならリダイレクト
      return redirect('/login')
    }
    console.log(response.data)
    // JWTが有効ならそのままページを表示
    // return null // user情報を送る？
    return response.data

  } catch(err) {
    console.log(CustomError(err))
    return redirect('/login')
  }
}
