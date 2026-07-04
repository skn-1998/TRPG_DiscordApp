import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { LoginResponse } from '~/types'
import { getServerDomain } from '~/lib/server-api'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { code?: string } | null

  if (!body?.code) {
    return NextResponse.json({ message: '認証コードがありません。' }, { status: 400 })
  }

  const response = await fetch(`${getServerDomain()}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: body.code }),
    cache: 'no-store'
  })
  const result = (await response.json().catch(() => null)) as LoginResponse | null

  if (!response.ok || !result?.success || !result.auth.token) {
    return NextResponse.json({ message: 'Discord認証に失敗しました。' }, { status: 401 })
  }

  const cookieStore = await cookies()
  cookieStore.set('jwt', result.auth.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7
  })

  return NextResponse.json({ success: true })
}
