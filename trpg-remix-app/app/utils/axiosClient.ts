import { LoaderFunctionArgs, redirect } from '@remix-run/node'
import axios from 'axios'
import https from 'https'
import { CustomError } from './customError'

export type TRPGUser = {
  message?: string
  DiscordUserId: string
  userName: string
  token?: string
  characterId?: string[]
}

// 共通のaxiosインスタンスを作成
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createAxiosInstance = (baseURL: string) => {
  return axios.create({
    baseURL,
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    withCredentials: true
  })
}

const corsServerDomain = process.env.SERVER_DOMAIN || 'http://localhost:3000'
console.log('corsServerDomain: ' + corsServerDomain)
export const axiosInstance = createAxiosInstance(corsServerDomain)

export const loginOrRegisterUser = async (code: string): Promise<TRPGUser> => {
  try {
    console.log('before login')
    const response = await axiosInstance.post('/auth/login', { code })
    console.log('after login')
    return response.data
  } catch (err: unknown) {
    console.log('login catch error')
    throw new Error(CustomError(err))
  }
}

export const validateJWT = async ({ request }: LoaderFunctionArgs): Promise<object | null> => {
  const cookie = request.headers.get('Cookie') || ''
  const jwtCookie = cookie.split(';').find((cookie) => cookie.trim().startsWith('jwt='))

  if (!jwtCookie) {
    return redirect('/login')
  }

  const jwt = jwtCookie.split('=')[1]
  const verifyUrl = '/users' // JWT検証用のAPIエンドポイント

  try {
    console.log('before verify')

    const response = await axiosInstance.get(verifyUrl, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`
      }
    })

    console.log('after verify')

    if (!response.data) {
      return redirect('/login')
    }

    console.log(response.data)
    return response.data
  } catch (err: unknown) {
    console.log('verify catch error')
    console.error(CustomError(err))
    return redirect('/login')
  }
}
