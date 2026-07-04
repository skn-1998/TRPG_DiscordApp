import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getServerDomain } from '~/lib/server-api'

interface RouteContext {
  params: Promise<{ path: string[] }>
}

async function proxyRequest(request: NextRequest, context: RouteContext) {
  const { path } = await context.params
  const targetUrl = new URL(`${getServerDomain()}/${path.map(encodeURIComponent).join('/')}`)
  targetUrl.search = request.nextUrl.search

  const headers = new Headers()
  const contentType = request.headers.get('content-type')
  const cookieStore = await cookies()
  const jwt = cookieStore.get('jwt')?.value

  if (contentType) headers.set('Content-Type', contentType)
  if (jwt) headers.set('Authorization', `Bearer ${jwt}`)

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD'
  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    cache: 'no-store'
  })
  const responseHeaders = new Headers()
  const responseContentType = response.headers.get('content-type')

  if (responseContentType) responseHeaders.set('Content-Type', responseContentType)

  return new NextResponse(response.body, {
    status: response.status,
    headers: responseHeaders
  })
}

export const GET = proxyRequest
export const POST = proxyRequest
export const PUT = proxyRequest
export const PATCH = proxyRequest
export const DELETE = proxyRequest
