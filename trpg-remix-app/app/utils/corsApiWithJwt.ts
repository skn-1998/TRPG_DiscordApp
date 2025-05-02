import { ActionFunctionArgs, json } from '@remix-run/node'
import cookie from 'cookie'
import { CustomError } from './customError'
import { axiosInstance } from './axiosClient'

export type ApiOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  endpoint: string
  data?: any
}

export async function corsApiWithJwt({ request }: ActionFunctionArgs, options: ApiOptions) {
  const cookieHeader = request.headers.get('Cookie') || ''
  const _cookie = cookie.parse(cookieHeader) || {}

  const jwt = _cookie.jwt
  console.log('jwt: ' + jwt)

  if (!jwt) {
    throw json({ error: '認証情報が見つかりません' }, { status: 401 })
  }

  try {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`
    }

    let response

    const { endpoint, data, method } = options
    const _method = method || request.method
    console.log(_method)

    switch (_method) {
      case 'GET':
        response = await axiosInstance.get(endpoint, { headers })
        break
      case 'POST':
        response = await axiosInstance.post(endpoint, data, { headers })
        break
      case 'PUT':
        response = await axiosInstance.put(endpoint, data, { headers })
        break
      case 'DELETE':
        response = await axiosInstance.delete(endpoint, { headers, data })
        break
      case 'PATCH':
        response = await axiosInstance.patch(endpoint, data, { headers })
        break
      default:
        response = await axiosInstance.get(endpoint, { headers })
    }

    return response.data
  } catch (err: unknown) {
    console.error(CustomError(err))
    throw json({ error: 'APIリクエストに失敗しました' }, { status: 500 })
  }
}
