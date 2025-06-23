import { ActionFunctionArgs } from '@remix-run/node'
import cookie from 'cookie'
import { CustomError } from './customError'
import { apiClient } from '~/lib/api-client'

export type ApiOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  endpoint: string
  data?: unknown
}

export async function corsApiWithJwt({ request }: ActionFunctionArgs, options: ApiOptions) {
  const cookieHeader = request.headers.get('Cookie') || ''
  const _cookie = cookie.parse(cookieHeader) || {}

  const jwt = _cookie.jwt
  console.log('jwt: ' + jwt)

  if (!jwt) {
    throw Response.json({ error: '認証情報が見つかりません' }, { status: 401 })
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
        response = await apiClient.get(endpoint, { headers })
        break
      case 'POST':
        response = await apiClient.post(endpoint, data, { headers })
        break
      case 'PUT':
        response = await apiClient.put(endpoint, data, { headers })
        break
      case 'DELETE':
        response = await apiClient.delete(endpoint, { headers, data })
        break
      case 'PATCH':
        response = await apiClient.patch(endpoint, data, { headers })
        break
      default:
        response = await apiClient.get(endpoint, { headers })
    }

    return response.data
  } catch (err: unknown) {
    console.error(CustomError(err))
    throw Response.json({ error: 'APIリクエストに失敗しました' }, { status: 500 })
  }
}
